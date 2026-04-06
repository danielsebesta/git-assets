export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(env.FRONTEND_URL);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    if (url.pathname === '/login') {
      return handleLogin(env);
    }

    if (url.pathname === '/callback') {
      return handleCallback(url, env);
    }

    return new Response('Not found', { status: 404, headers });
  }
};

function handleLogin(env) {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${env.WORKER_URL}/callback`,
    scope: 'repo',
    state: crypto.randomUUID(),
  });

  return Response.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
    302
  );
}

async function handleCallback(url, env) {
  const code = url.searchParams.get('code');

  if (!code) {
    return Response.redirect(`${env.FRONTEND_URL}#error=missing_code`, 302);
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

  return Response.redirect(
    `${env.FRONTEND_URL}#access_token=${data.access_token}`,
    302
  );
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
