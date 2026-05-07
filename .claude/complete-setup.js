/**
 * Complete Firebase + OAuth setup using firebase-tools credentials
 * Run via PowerShell: node complete-setup.js
 */
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const PROJECT_ID    = 'lamthong-bbq-2025';
const GITHUB_DOMAIN = 'naytar1569-art.github.io';
const ADMIN_EMAIL   = 'naytar1569@gmail.com';

const FIREBASE_CONFIG = {
  projectId:         "lamthong-bbq-2025",
  appId:             "1:202910034130:web:834d18faa8f1d88ac2650b",
  storageBucket:     "lamthong-bbq-2025.firebasestorage.app",
  apiKey:            "AIzaSyBV8Bzeg1lZB-4yFzTXO9ML2d1249QwtTA",
  authDomain:        "lamthong-bbq-2025.firebaseapp.com",
  messagingSenderId: "202910034130",
  measurementId:     "G-CBL6WVH329",
};

// ── Firebase-tools token helper ───────────────────────────────
async function getFirebaseToken() {
  try {
    const { getCredential } = require(
      path.join('C:\\Users\\ACER\\AppData\\Roaming\\npm\\node_modules\\firebase-tools\\lib\\auth')
    );
    const cred = await getCredential();
    return cred.access_token || cred.accessToken;
  } catch (e) {
    console.log('getCredential failed:', e.message, '— trying refreshToken...');
  }

  try {
    const authMod = require(
      path.join('C:\\Users\\ACER\\AppData\\Roaming\\npm\\node_modules\\firebase-tools\\lib\\auth')
    );
    if (authMod.getTokens) {
      const tokens = await authMod.getTokens();
      if (tokens?.access_token) return tokens.access_token;
    }
  } catch(e) { /* ignore */ }

  // Fallback: use getRefreshToken and exchange manually
  try {
    const credMod = require(
      path.join('C:\\Users\\ACER\\AppData\\Roaming\\npm\\node_modules\\firebase-tools\\lib\\defaultCredentials')
    );
    const cred = await credMod.getCredential();
    const token = await cred.getAccessToken();
    return token.token || token.access_token;
  } catch(e) {
    console.log('defaultCredentials failed:', e.message);
  }

  return null;
}

// ── HTTP helper ───────────────────────────────────────────────
function httpReq(opts, body) {
  return new Promise((res, rej) => {
    const data = body ? (typeof body==='string'?body:JSON.stringify(body)) : null;
    if(data&&opts.headers) opts.headers['Content-Length']=Buffer.byteLength(data);
    const r = https.request(opts, rs=>{
      let b=''; rs.on('data',c=>b+=c);
      rs.on('end',()=>res({s:rs.statusCode,b,j:()=>JSON.parse(b)}));
    });
    r.on('error',rej); if(data) r.write(data); r.end();
  });
}

function api(T, method, host, p, body=null) {
  return httpReq({host, path:p, method,
    headers:{Authorization:`Bearer ${T}`,'Content-Type':'application/json','X-Goog-User-Project':PROJECT_ID}
  }, body);
}

// ── Update code files ─────────────────────────────────────────
function updateFiles(config) {
  const scriptPaths = [
    path.join(__dirname, 'script.js'),
    path.join(__dirname, '..', 'script.js'),
  ];

  const configStr = JSON.stringify(config, null, 2)
    .split('\n').map((l, i) => i===0 ? l : '  '+l).join('\n');

  for (const p of scriptPaths) {
    if (!fs.existsSync(p)) continue;
    let txt = fs.readFileSync(p, 'utf8');
    // Replace GOOGLE_CLIENT_ID placeholder with FIREBASE_CONFIG
    txt = txt.replace(
      /const GOOGLE_CLIENT_ID\s*=\s*'[^']*';/,
      `const FIREBASE_CONFIG = ${configStr};`
    );
    fs.writeFileSync(p, txt, 'utf8');
    console.log('  Updated:', path.relative(path.join(__dirname, '..'), p));
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n🍖  LamthongBBQ — Completing Firebase Setup\n' + '─'.repeat(50) + '\n');

  // Get token
  console.log('🔑 Getting Firebase access token...');
  const T = await getFirebaseToken();
  if (!T) { console.error('❌ Could not get token. Make sure firebase login was run.'); process.exit(1); }
  console.log('✅ Token retrieved\n');

  // Enable Google Sign-In
  console.log('🔐 Enabling Google Sign-In...');
  const r1 = await api(T, 'POST', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com`,
    {name:`projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`, enabled:true});
  if (r1.s===200||r1.s===409) {
    console.log('✅ Google Sign-In enabled');
  } else {
    const r1b = await api(T, 'PATCH', 'identitytoolkit.googleapis.com',
      `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled`,
      {enabled:true});
    console.log(r1b.s===200 ? '✅ Google Sign-In enabled (patched)' : `⚠️  Status ${r1b.s}: ${r1b.b.substring(0,200)}`);
  }

  // Add authorized domain
  console.log('\n🌍 Adding authorized domain...');
  const r2 = await api(T, 'GET', 'identitytoolkit.googleapis.com', `/admin/v2/projects/${PROJECT_ID}/config`);
  let domains = ['localhost', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`];
  if (r2.s===200) { const d=r2.j().authorizedDomains; if(d) domains=d; }
  if (!domains.includes(GITHUB_DOMAIN)) domains.push(GITHUB_DOMAIN);
  const r3 = await api(T, 'PATCH', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`, {authorizedDomains:domains});
  console.log(r3.s===200 ? `✅ Added ${GITHUB_DOMAIN}` : `⚠️  Status ${r3.s}: ${r3.b.substring(0,200)}`);

  // Update code
  console.log('\n📝 Updating script.js with Firebase config...');
  updateFiles(FIREBASE_CONFIG);
  console.log('✅ Files updated');

  console.log('\n' + '═'.repeat(50));
  console.log('✅  Firebase setup complete!');
  console.log('═'.repeat(50));
  console.log('  API Key   :', FIREBASE_CONFIG.apiKey.substring(0,20)+'...');
  console.log('  Auth Domain:', FIREBASE_CONFIG.authDomain);
  console.log('  GitHub    :', GITHUB_DOMAIN, '→ authorized');
  console.log('\n  Next: update index.html + script.js to use Firebase Auth SDK');
  console.log('  Then: commit and push to GitHub\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
