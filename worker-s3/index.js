/**
 * GitAssets S3-Compatible API Worker
 *
 * Maps S3 operations to GitHub API + jsDelivr CDN.
 *
 * Credentials mapping:
 *   accessKeyId     = "owner/repo"       (e.g. "danielsebesta/my-assets")
 *   secretAccessKey = GitHub token        (PAT or GitHub App token)
 *
 * Bucket = branch name (default: "main")
 * Key    = file path in the repo
 *
 * Supported operations:
 *   PutObject       — upload/overwrite a file
 *   GetObject       — redirect to jsDelivr CDN
 *   HeadObject      — file metadata
 *   DeleteObject    — delete a file
 *   ListObjectsV2   — list files in a directory
 *   CopyObject      — copy (fetch + re-upload)
 *
 * Auth: AWS Signature V4 or Bearer token in Authorization header.
 */

const GITHUB_API = 'https://api.github.com';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      const auth = parseAuth(request);
      if (!auth) {
        return errorResponse(403, 'AccessDenied', 'Missing or invalid credentials');
      }

      const { owner, repo, token } = auth;
      const url = new URL(request.url);

      // Parse bucket (branch) and key from path: /{bucket}/{key...}
      const pathParts = url.pathname.slice(1).split('/');
      const bucket = pathParts[0] || 'main';
      const key = pathParts.slice(1).join('/');

      // ListObjectsV2: GET /{bucket}?list-type=2
      if (request.method === 'GET' && (!key || url.searchParams.has('list-type'))) {
        return handleListObjects(owner, repo, bucket, url.searchParams, token);
      }

      if (!key) {
        return errorResponse(400, 'InvalidRequest', 'Missing object key');
      }

      switch (request.method) {
        case 'PUT':
          // CopyObject if x-amz-copy-source header present
          if (request.headers.get('x-amz-copy-source')) {
            return handleCopyObject(owner, repo, bucket, key, request, token);
          }
          return handlePutObject(owner, repo, bucket, key, request, token);
        case 'GET':
          return handleGetObject(owner, repo, bucket, key, token);
        case 'HEAD':
          return handleHeadObject(owner, repo, bucket, key, token);
        case 'DELETE':
          return handleDeleteObject(owner, repo, bucket, key, token);
        default:
          return errorResponse(405, 'MethodNotAllowed', `Method ${request.method} not supported`);
      }
    } catch (err) {
      return errorResponse(500, 'InternalError', err.message);
    }
  },
};

// ── S3 Operations ──

async function handlePutObject(owner, repo, bucket, key, request, token) {
  const body = await request.arrayBuffer();
  const base64 = arrayBufferToBase64(body);

  // Check if file exists (to get SHA for update)
  const existing = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}?ref=${bucket}`,
    token,
  );
  const sha = existing.ok ? (await existing.json()).sha : null;

  const payload = {
    message: `Put ${key} (via GitAssets S3)`,
    content: base64,
    branch: bucket,
  };
  if (sha) payload.sha = sha;

  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}`,
    token,
    { method: 'PUT', body: JSON.stringify(payload) },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return errorResponse(res.status, 'PutFailed', err.message || 'Failed to put object');
  }

  const data = await res.json();
  return new Response(null, {
    status: 200,
    headers: {
      ...corsHeaders(),
      ETag: `"${data.content.sha}"`,
      'x-amz-version-id': data.commit.sha,
    },
  });
}

async function handleGetObject(owner, repo, bucket, key, token) {
  // Verify file exists
  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}?ref=${bucket}`,
    token,
  );

  if (!res.ok) {
    if (res.status === 404) return errorResponse(404, 'NoSuchKey', `Key ${key} not found`);
    return errorResponse(res.status, 'GetFailed', 'Failed to get object');
  }

  const data = await res.json();

  // Redirect to CDN for public repos
  const cdnUrl = `${CDN_BASE}/${owner}/${repo}@${bucket}/${key}`;

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders(),
      Location: cdnUrl,
      ETag: `"${data.sha}"`,
      'Content-Type': guessMime(key),
      'x-amz-meta-size': String(data.size),
    },
  });
}

async function handleHeadObject(owner, repo, bucket, key, token) {
  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}?ref=${bucket}`,
    token,
  );

  if (!res.ok) {
    if (res.status === 404) return errorResponse(404, 'NoSuchKey', `Key ${key} not found`);
    return errorResponse(res.status, 'HeadFailed', 'Failed to head object');
  }

  const data = await res.json();

  return new Response(null, {
    status: 200,
    headers: {
      ...corsHeaders(),
      ETag: `"${data.sha}"`,
      'Content-Length': String(data.size),
      'Content-Type': guessMime(key),
    },
  });
}

async function handleDeleteObject(owner, repo, bucket, key, token) {
  // Get SHA first
  const getRes = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}?ref=${bucket}`,
    token,
  );

  if (!getRes.ok) {
    if (getRes.status === 404) return errorResponse(404, 'NoSuchKey', `Key ${key} not found`);
    return errorResponse(getRes.status, 'DeleteFailed', 'Failed to find object');
  }

  const fileData = await getRes.json();

  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}`,
    token,
    {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete ${key} (via GitAssets S3)`,
        sha: fileData.sha,
        branch: bucket,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return errorResponse(res.status, 'DeleteFailed', err.message || 'Failed to delete object');
  }

  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function handleListObjects(owner, repo, bucket, params, token) {
  const prefix = params.get('prefix') || '';
  const delimiter = params.get('delimiter') || '';
  const maxKeys = Math.min(parseInt(params.get('max-keys') || '1000'), 1000);

  const path = prefix.replace(/\/$/, '');
  const res = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${bucket}`,
    token,
  );

  if (!res.ok) {
    if (res.status === 404) {
      // Empty prefix — return empty list
      return listResponse(bucket, prefix, [], [], false);
    }
    return errorResponse(res.status, 'ListFailed', 'Failed to list objects');
  }

  const data = await res.json();
  const items = Array.isArray(data) ? data : [data];

  const contents = [];
  const commonPrefixes = [];

  for (const item of items) {
    if (item.type === 'dir') {
      if (delimiter) {
        commonPrefixes.push(item.path + '/');
      } else {
        // Without delimiter, we'd need to recurse — skip for now
        commonPrefixes.push(item.path + '/');
      }
    } else {
      contents.push({
        key: item.path,
        size: item.size,
        etag: `"${item.sha}"`,
      });
    }
  }

  return listResponse(bucket, prefix, contents.slice(0, maxKeys), commonPrefixes, false);
}

async function handleCopyObject(owner, repo, bucket, key, request, token) {
  const copySource = request.headers.get('x-amz-copy-source');
  // Source format: /bucket/key or just key
  const sourceParts = copySource.replace(/^\//, '').split('/');
  const sourceBucket = sourceParts[0] || bucket;
  const sourceKey = sourceParts.slice(1).join('/');

  if (!sourceKey) {
    return errorResponse(400, 'InvalidRequest', 'Invalid x-amz-copy-source');
  }

  // Fetch source file content
  const getRes = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${sourceKey}?ref=${sourceBucket}`,
    token,
  );

  if (!getRes.ok) {
    return errorResponse(404, 'NoSuchKey', `Source key ${sourceKey} not found`);
  }

  const sourceData = await getRes.json();

  // Check if destination exists
  const destRes = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}?ref=${bucket}`,
    token,
  );
  const destSha = destRes.ok ? (await destRes.json()).sha : null;

  // Upload to destination
  const payload = {
    message: `Copy ${sourceKey} to ${key} (via GitAssets S3)`,
    content: sourceData.content.replace(/\n/g, ''),
    branch: bucket,
  };
  if (destSha) payload.sha = destSha;

  const putRes = await githubFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${key}`,
    token,
    { method: 'PUT', body: JSON.stringify(payload) },
  );

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    return errorResponse(putRes.status, 'CopyFailed', err.message || 'Failed to copy object');
  }

  const result = await putRes.json();

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult>
  <ETag>"${result.content.sha}"</ETag>
</CopyObjectResult>`;

  return new Response(xmlBody, {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/xml' },
  });
}

// ── Auth ──

function parseAuth(request) {
  const authHeader = request.headers.get('Authorization') || '';

  // Bearer token: Authorization: Bearer owner/repo:ghp_xxxxx
  if (authHeader.startsWith('Bearer ')) {
    const value = authHeader.slice(7);
    const colonIdx = value.indexOf(':');
    if (colonIdx === -1) return null;
    const ownerRepo = value.slice(0, colonIdx);
    const token = value.slice(colonIdx + 1);
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo || !token) return null;
    return { owner, repo, token };
  }

  // AWS Signature V4: extract accessKeyId from Credential
  if (authHeader.startsWith('AWS4-HMAC-SHA256')) {
    const credMatch = authHeader.match(/Credential=([^/]+\/[^/]+)\//);
    if (!credMatch) return null;
    const [owner, repo] = credMatch[1].split('/');

    // For AWS Sig V4 we trust the signature was computed correctly
    // and extract the token from x-amz-security-token or a custom header
    const token = request.headers.get('x-amz-security-token') || '';
    if (!owner || !repo || !token) return null;
    return { owner, repo, token };
  }

  return null;
}

// ── Helpers ──

async function githubFetch(url, token, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitAssets-S3-Worker',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function errorResponse(status, code, message) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>${code}</Code>
  <Message>${escapeXml(message)}</Message>
</Error>`;

  return new Response(xml, {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/xml' },
  });
}

function listResponse(bucket, prefix, contents, commonPrefixes, isTruncated) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${escapeXml(bucket)}</Name>
  <Prefix>${escapeXml(prefix)}</Prefix>
  <IsTruncated>${isTruncated}</IsTruncated>
  <MaxKeys>1000</MaxKeys>
  <KeyCount>${contents.length}</KeyCount>
  ${contents.map((c) => `<Contents>
    <Key>${escapeXml(c.key)}</Key>
    <Size>${c.size}</Size>
    <ETag>${escapeXml(c.etag)}</ETag>
  </Contents>`).join('\n  ')}
  ${commonPrefixes.map((p) => `<CommonPrefixes>
    <Prefix>${escapeXml(p)}</Prefix>
  </CommonPrefixes>`).join('\n  ')}
</ListBucketResult>`;

  return new Response(xml, {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/xml' },
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function guessMime(path) {
  const ext = path.split('.').pop().toLowerCase();
  const mimes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    pdf: 'application/pdf', json: 'application/json', xml: 'application/xml',
    html: 'text/html', css: 'text/css', js: 'text/javascript',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
    zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
  };
  return mimes[ext] || 'application/octet-stream';
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, HEAD, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-amz-copy-source, x-amz-security-token, x-amz-content-sha256, x-amz-date',
    'Access-Control-Expose-Headers': 'ETag, x-amz-version-id, x-amz-meta-size',
  };
}
