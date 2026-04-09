export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(env.FRONTEND_URL);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    if (url.pathname === '/login') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/callback') {
      return handleCallback(url, request, env);
    }

    if (url.pathname === '/refresh') {
      return handleRefresh(request, env, headers);
    }

    return new Response('Not found', { status: 404, headers });
  }
};

async function handleLogin(request, env) {
  const state = crypto.randomUUID();

  // GitHub App OAuth — no scope needed, permissions come from app config
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${env.WORKER_URL}/callback`,
    state,
  });

  const headers = new Headers({
    Location: `https://github.com/login/oauth/authorize?${params}`,
    'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
  });
  return new Response(null, { status: 302, headers });
}

async function handleCallback(url, request, env) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return Response.redirect(`${env.FRONTEND_URL}#error=missing_code`, 302);
  }

  // Validate CSRF state parameter
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const savedState = cookies.oauth_state;
  if (!state || !savedState || state !== savedState) {
    return Response.redirect(`${env.FRONTEND_URL}#error=invalid_state`, 302);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await tokenResponse.json();

  if (data.error) {
    return Response.redirect(
      `${env.FRONTEND_URL}#error=${encodeURIComponent(data.error_description || data.error)}`,
      302
    );
  }

  // GitHub App returns: access_token, refresh_token, expires_in
  const fragment = new URLSearchParams({
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    expires_in: String(data.expires_in || ''),
  });

  const headers = new Headers({
    Location: `${env.FRONTEND_URL}#${fragment}`,
    'Set-Cookie': 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
  });
  return new Response(null, { status: 302, headers });
}

async function handleRefresh(request, env, corsH) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsH });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsH });
  }

  const { refresh_token } = body;
  if (!refresh_token) {
    return Response.json({ error: 'missing refresh_token' }, { status: 400, headers: corsH });
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token,
    }),
  });

  const data = await tokenResponse.json();

  if (data.error) {
    return Response.json(
      { error: data.error_description || data.error },
      { status: 401, headers: corsH }
    );
  }

  return Response.json(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    },
    { headers: corsH }
  );
}

function parseCookies(cookieStr) {
  const cookies = {};
  cookieStr.split(';').forEach((pair) => {
    const [key, ...val] = pair.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
