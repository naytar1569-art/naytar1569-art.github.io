const auth = require('C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PROJECT_ID    = 'lamthong-bbq-2025';
const GITHUB_DOMAIN = 'naytar1569-art.github.io';

const FIREBASE_CONFIG = {
  projectId:         "lamthong-bbq-2025",
  appId:             "1:202910034130:web:834d18faa8f1d88ac2650b",
  storageBucket:     "lamthong-bbq-2025.firebasestorage.app",
  apiKey:            "AIzaSyBV8Bzeg1lZB-4yFzTXO9ML2d1249QwtTA",
  authDomain:        "lamthong-bbq-2025.firebaseapp.com",
  messagingSenderId: "202910034130",
  measurementId:     "G-CBL6WVH329",
};

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

async function main() {
  console.log('\n🍖  Completing Firebase setup...\n');

  // Get all accounts
  const accounts = auth.getAllAccounts();
  console.log('Firebase accounts:', accounts.map(a => a.user?.email));

  if (accounts.length === 0) {
    console.error('❌ No firebase accounts found. Run: firebase login');
    process.exit(1);
  }

  // Get access token
  const tokenResult = await auth.getAccessToken(accounts[0], []);
  const T = tokenResult.access_token;
  console.log('✅ Token OK:', T.substring(0, 20) + '...\n');

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
    console.log(r1b.s===200 ? '✅ Google Sign-In enabled' : `⚠️  ${r1b.s}: ${r1b.b.substring(0,200)}`);
  }

  // Add GitHub domain to authorized domains
  console.log('\n🌍 Adding authorized domain...');
  const r2 = await api(T, 'GET', 'identitytoolkit.googleapis.com', `/admin/v2/projects/${PROJECT_ID}/config`);
  let domains = ['localhost', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`];
  if (r2.s===200) { const d=r2.j().authorizedDomains; if(d) domains=d; }
  if (!domains.includes(GITHUB_DOMAIN)) domains.push(GITHUB_DOMAIN);
  const r3 = await api(T, 'PATCH', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`, {authorizedDomains:domains});
  console.log(r3.s===200 ? `✅ ${GITHUB_DOMAIN} authorized` : `⚠️  ${r3.s}: ${r3.b.substring(0,200)}`);

  // Update script.js files
  console.log('\n📝 Updating script.js...');
  const configStr = JSON.stringify(FIREBASE_CONFIG, null, 2)
    .split('\n').map((l, i) => i===0 ? l : '  '+l).join('\n');
  const scriptPaths = [
    path.join(__dirname, 'script.js'),
    path.join(__dirname, '..', 'script.js'),
  ];
  for (const p of scriptPaths) {
    if (!fs.existsSync(p)) continue;
    let txt = fs.readFileSync(p, 'utf8');
    txt = txt.replace(
      /const GOOGLE_CLIENT_ID\s*=\s*'[^']*';/,
      `const FIREBASE_CONFIG = ${configStr};`
    );
    fs.writeFileSync(p, txt, 'utf8');
    console.log('  ✅', path.basename(p), 'updated');
  }

  console.log('\n✅ All done! Firebase config injected into script.js');
  console.log('   Now updating auth code to use Firebase SDK...\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
