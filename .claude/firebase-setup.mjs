/**
 * LamthongBBQ Firebase Setup — uses ADC credentials
 */
import https    from 'https';
import fs       from 'fs';
import path     from 'path';
import { fileURLToPath } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID    = 'lamthong-bbq-2025';
const ADMIN_EMAIL   = 'naytar1569@gmail.com';
const GITHUB_DOMAIN = 'naytar1569-art.github.io';

// ADC credentials (from gcloud application-default login)
const ADC_CLIENT_ID     = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
const ADC_CLIENT_SECRET = 'd-FL95Q19q7MQmFpd7hHD0Ty';
const ADC_REFRESH_TOKEN = '1//0gMF7I1SQPQwRCgYIARAAGBASNgF-L9IrdQ9nhT9iVQrCIttqFdFMvJQNO_Obf5IIm1q_802N270ezmsOxRsIE35Q5xKGPkk1Sw';

// ── HTTP ─────────────────────────────────────────────────────
function httpReq(options, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (data && options.headers) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        text: buf,
        json() { return JSON.parse(buf); }
      }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
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

// ── Get fresh access token ────────────────────────────────────
console.log('🔑 Getting access token...');
const tokenRes = await httpReq({
  host: 'oauth2.googleapis.com', path: '/token', method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}, new URLSearchParams({
  client_id:     ADC_CLIENT_ID,
  client_secret: ADC_CLIENT_SECRET,
  refresh_token: ADC_REFRESH_TOKEN,
  grant_type:    'refresh_token',
}).toString());

const tokenData = tokenRes.json();
if (!tokenData.access_token) {
  console.error('❌ Token error:', tokenRes.text);
  process.exit(1);
}
const TOKEN = tokenData.access_token;
console.log('✅ Token OK (scopes include firebase)\n');

// ── Add Firebase to GCP project ──────────────────────────────
console.log('🔥 Adding Firebase to project...');
const fbRes = await api(TOKEN, 'POST', 'firebase.googleapis.com',
  `/v1beta1/projects/${PROJECT_ID}:addFirebase`, {});

if (fbRes.status === 200) {
  console.log('   Waiting for Firebase to initialize (5s)...');
  await new Promise(r => setTimeout(r, 5000));
  console.log('✅ Firebase added to project');
} else if (fbRes.status === 409 || fbRes.text.includes('already a Firebase project')) {
  console.log('✅ Firebase already configured on this project');
} else {
  console.log(`   Status ${fbRes.status}: ${fbRes.text.substring(0, 300)}`);
  console.log('   Continuing...');
}

// ── Create Web App ────────────────────────────────────────────
console.log('\n🌐 Creating Firebase web app...');
const appRes = await api(TOKEN, 'POST', 'firebase.googleapis.com',
  `/v1beta1/projects/${PROJECT_ID}/webApps`,
  { displayName: 'LamthongBBQ Web' });

if (appRes.status === 200) {
  console.log('   Waiting for web app creation (3s)...');
  await new Promise(r => setTimeout(r, 3000));
  console.log('✅ Web app created');
} else {
  console.log(`   Status ${appRes.status}: ${appRes.text.substring(0, 300)}`);
}

// ── Get Firebase config ───────────────────────────────────────
console.log('\n📋 Getting Firebase web app config...');
let firebaseConfig = null;

const listRes = await api(TOKEN, 'GET', 'firebase.googleapis.com',
  `/v1beta1/projects/${PROJECT_ID}/webApps`);

if (listRes.status === 200) {
  const apps = listRes.json().apps || [];
  console.log(`   Found ${apps.length} web app(s)`);
  for (const app of apps) {
    const appId = app.appId;
    if (!appId) continue;
    const cfgRes = await api(TOKEN, 'GET', 'firebase.googleapis.com',
      `/v1beta1/projects/${PROJECT_ID}/webApps/${appId}/config`);
    if (cfgRes.status === 200) {
      firebaseConfig = cfgRes.json();
      console.log('✅ Firebase config retrieved');
      break;
    }
  }
} else {
  console.log(`   Status ${listRes.status}: ${listRes.text.substring(0, 300)}`);
}

if (!firebaseConfig) {
  console.error('\n❌ Could not get Firebase config automatically.');
  console.log('Please visit: https://console.firebase.google.com/project/' + PROJECT_ID + '/settings/general');
  process.exit(1);
}

// ── Enable Google Sign-In ─────────────────────────────────────
console.log('\n🔐 Enabling Google Sign-In...');
const idpBody = {
  name:    `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`,
  enabled: true
};

const createIdpRes = await api(TOKEN, 'POST', 'identitytoolkit.googleapis.com',
  `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com`, idpBody);

if (createIdpRes.status === 200 || createIdpRes.status === 409) {
  console.log('✅ Google Sign-In enabled');
} else {
  const patchRes = await api(TOKEN, 'PATCH', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled`,
    { enabled: true });
  console.log(patchRes.status === 200
    ? '✅ Google Sign-In enabled (patched)'
    : `   Status ${patchRes.status}: ${patchRes.text.substring(0, 200)}`);
}

// ── Add authorized domain ─────────────────────────────────────
console.log('\n🌍 Adding authorized domain: ' + GITHUB_DOMAIN);
{
  const getRes = await api(TOKEN, 'GET', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/config`);

  let domains = ['localhost', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`];
  if (getRes.status === 200) {
    domains = getRes.json().authorizedDomains || domains;
  }
  if (!domains.includes(GITHUB_DOMAIN)) domains.push(GITHUB_DOMAIN);

  const patchRes = await api(TOKEN, 'PATCH', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`,
    { authorizedDomains: domains });

  console.log(patchRes.status === 200
    ? `✅ Added ${GITHUB_DOMAIN} to authorized domains`
    : `   Status ${patchRes.status}: ${patchRes.text.substring(0, 300)}`);
}

// ── Save config ───────────────────────────────────────────────
fs.writeFileSync(
  path.join(__dirname, 'firebase-config.json'),
  JSON.stringify(firebaseConfig, null, 2), 'utf8'
);

console.log('\n' + '═'.repeat(55));
console.log('✅  Firebase setup complete!');
console.log('═'.repeat(55));
console.log('  projectId  :', firebaseConfig.projectId);
console.log('  authDomain :', firebaseConfig.authDomain);
console.log('  apiKey     :', firebaseConfig.apiKey?.substring(0, 20) + '...');
console.log('\n  Saved to firebase-config.json');
console.log('  Next: update index.html + script.js to use Firebase SDK\n');
