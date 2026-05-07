/**
 * Firebase login via local OAuth server
 * ใช้ firebase-tools Client ID เพื่อเรียก addFirebase ได้
 */
import http   from 'http';
import https  from 'https';
import crypto from 'crypto';
import { exec } from 'child_process';
import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// firebase-tools public OAuth credentials (installed-app type)
const FB_CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FB_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const REDIRECT_PORT    = 9005;
const REDIRECT_URI     = `http://localhost:${REDIRECT_PORT}`;

const PROJECT_ID    = 'lamthong-bbq-2025';
const ADMIN_EMAIL   = 'naytar1569@gmail.com';
const GITHUB_DOMAIN = 'naytar1569-art.github.io';

const SCOPES = [
  'email', 'openid',
  'https://www.googleapis.com/auth/cloudplatformprojects.readonly',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

const TOKEN_CACHE = path.join(__dirname, '.fb-token.json');

// ── HTTP helper ──────────────────────────────────────────────
function httpReq(options, body = null) {
  return new Promise((res, rej) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (data && options.headers) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, r => {
      let b = ''; r.on('data', c => b += c);
      r.on('end', () => res({ status: r.statusCode, text: b, json() { return JSON.parse(b); } }));
    });
    req.on('error', rej); if (data) req.write(data); req.end();
  });
}

function api(token, method, host, urlPath, body = null) {
  return httpReq({
    host, path: urlPath, method,
    headers: {
      Authorization:         `Bearer ${token}`,
      'Content-Type':        'application/json',
      'X-Goog-User-Project': PROJECT_ID,
    }
  }, body);
}

// ── Login flow ───────────────────────────────────────────────
async function getToken() {
  // Check cache
  if (fs.existsSync(TOKEN_CACHE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf8'));
      // Refresh the token
      const r = await httpReq({
        host: 'oauth2.googleapis.com', path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }, new URLSearchParams({
        client_id:     FB_CLIENT_ID, client_secret: FB_CLIENT_SECRET,
        refresh_token: cached.refresh_token, grant_type: 'refresh_token',
      }).toString());
      const data = r.json();
      if (data.access_token) {
        console.log('✅ Using cached Firebase token');
        return data.access_token;
      }
    } catch { /* ignore, re-login */ }
  }

  return new Promise((resolve, reject) => {
    const state        = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id',             FB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri',          REDIRECT_URI);
    authUrl.searchParams.set('response_type',         'code');
    authUrl.searchParams.set('scope',                 SCOPES);
    authUrl.searchParams.set('state',                 state);
    authUrl.searchParams.set('code_challenge',        codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type',           'offline');
    authUrl.searchParams.set('prompt',                'consent');

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== '/') { res.end(); return; }
        const code = url.searchParams.get('code');
        if (!code) { res.writeHead(400); res.end('Missing code'); return; }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2 style="color:green">✅ Login สำเร็จ!</h2>
          <p>กลับไปที่ terminal ได้เลย</p>
          <script>setTimeout(()=>window.close(),2000)</script></body></html>`);
        server.close();

        console.log('\n✅ Authorization code received');
        const tokenRes = await httpReq({
          host: 'oauth2.googleapis.com', path: '/token', method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }, new URLSearchParams({
          code, client_id: FB_CLIENT_ID, client_secret: FB_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString());

        const tokenData = tokenRes.json();
        if (!tokenData.access_token) {
          reject(new Error('Token exchange failed: ' + tokenRes.text)); return;
        }
        // Cache refresh token
        if (tokenData.refresh_token) {
          fs.writeFileSync(TOKEN_CACHE, JSON.stringify({ refresh_token: tokenData.refresh_token }));
        }
        resolve(tokenData.access_token);
      } catch (e) { reject(e); }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log('\n🌐 กรุณา Login ด้วย Google ในเบราว์เซอร์...');
      console.log(`   Account: ${ADMIN_EMAIL}`);
      console.log('   (กด Allow เพื่ออนุญาต LamthongBBQ Stock)\n');
      exec(`start "" "${authUrl.toString()}"`, e => {
        if (e) console.log('   ถ้าเบราว์เซอร์ไม่เปิด คัดลอก URL นี้:\n   ' + authUrl.toString());
      });
    });

    server.on('error', reject);
    // 3-minute timeout
    setTimeout(() => { server.close(); reject(new Error('Login timeout')); }, 180000);
  });
}

// ── Main ─────────────────────────────────────────────────────
console.log('\n🍖  LamthongBBQ — Firebase Automated Setup');
console.log('─'.repeat(50) + '\n');

const TOKEN = await getToken();
console.log('');

// 1. Add Firebase
console.log('🔥 Adding Firebase to project...');
for (let attempt = 1; attempt <= 3; attempt++) {
  const r = await api(TOKEN, 'POST', 'firebase.googleapis.com',
    `/v1beta1/projects/${PROJECT_ID}:addFirebase`, {});
  if (r.status === 200) {
    console.log('   Waiting 5s for Firebase to initialize...');
    await new Promise(rs => setTimeout(rs, 5000));
    console.log('✅ Firebase added'); break;
  } else if (r.status === 409 || r.text.includes('already')) {
    console.log('✅ Firebase already configured'); break;
  } else {
    console.log(`   Attempt ${attempt}: Status ${r.status} — ${r.text.substring(0, 200)}`);
    if (attempt < 3) await new Promise(rs => setTimeout(rs, 2000));
  }
}

// 2. Create web app
console.log('\n🌐 Creating web app...');
const appRes = await api(TOKEN, 'POST', 'firebase.googleapis.com',
  `/v1beta1/projects/${PROJECT_ID}/webApps`, { displayName: 'LamthongBBQ Web' });
if (appRes.status === 200) {
  await new Promise(r => setTimeout(r, 3000));
  console.log('✅ Web app created');
} else {
  console.log(`   Status ${appRes.status}: ${appRes.text.substring(0, 200)}`);
}

// 3. Get config
console.log('\n📋 Getting Firebase config...');
let config = null;
const listRes = await api(TOKEN, 'GET', 'firebase.googleapis.com',
  `/v1beta1/projects/${PROJECT_ID}/webApps`);
if (listRes.status === 200) {
  for (const app of (listRes.json().apps || [])) {
    const cr = await api(TOKEN, 'GET', 'firebase.googleapis.com',
      `/v1beta1/projects/${PROJECT_ID}/webApps/${app.appId}/config`);
    if (cr.status === 200) { config = cr.json(); break; }
  }
}
if (!config) { console.error('❌ Could not get config'); process.exit(1); }
console.log('✅ Config retrieved');

// 4. Enable Google Sign-In
console.log('\n🔐 Enabling Google Sign-In...');
const idpRes = await api(TOKEN, 'POST', 'identitytoolkit.googleapis.com',
  `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com`,
  { name: `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`, enabled: true });
console.log(idpRes.status === 200 || idpRes.status === 409
  ? '✅ Google Sign-In enabled'
  : `   Status ${idpRes.status}: ${idpRes.text.substring(0, 200)}`);

// 5. Add authorized domain
console.log('\n🌍 Adding authorized domain...');
const cfgGet = await api(TOKEN, 'GET', 'identitytoolkit.googleapis.com',
  `/admin/v2/projects/${PROJECT_ID}/config`);
let domains = ['localhost', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`];
if (cfgGet.status === 200) domains = cfgGet.json().authorizedDomains || domains;
if (!domains.includes(GITHUB_DOMAIN)) domains.push(GITHUB_DOMAIN);

const cfgPatch = await api(TOKEN, 'PATCH', 'identitytoolkit.googleapis.com',
  `/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`,
  { authorizedDomains: domains });
console.log(cfgPatch.status === 200
  ? `✅ Added ${GITHUB_DOMAIN}`
  : `   Status ${cfgPatch.status}: ${cfgPatch.text.substring(0, 200)}`);

// 6. Save config
fs.writeFileSync(path.join(__dirname, 'firebase-config.json'), JSON.stringify(config, null, 2));
console.log('\n✅ Saved firebase-config.json');
console.log('\n' + '─'.repeat(50));
console.log('Config:', JSON.stringify(config, null, 2));
