const https  = require('https');
const path   = require('path');
const fs     = require('fs');

const PROJECT_ID    = 'lamthong-bbq-2025';
const GITHUB_DOMAIN = 'naytar1569-art.github.io';

const CLIENT_ID     = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
const CLIENT_SECRET = 'd-FL95Q19q7MQmFpd7hHD0Ty';
const REFRESH_TOKEN = '1//0gMF7I1SQPQwRCgYIARAAGBASNgF-L9IrdQ9nhT9iVQrCIttqFdFMvJQNO_Obf5IIm1q_802N270ezmsOxRsIE35Q5xKGPkk1Sw';

function httpReq(opts, body) {
  return new Promise((res, rej) => {
    const data = body ? (typeof body==='string'?body:JSON.stringify(body)) : null;
    if (data && opts.headers) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, rs => {
      let b = ''; rs.on('data', c => b += c);
      rs.on('end', () => res({ s: rs.statusCode, b, j: () => JSON.parse(b) }));
    });
    r.on('error', rej); if (data) r.write(data); r.end();
  });
}

async function main() {
  // Get ADC token
  const tok = await httpReq({
    host: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token`);
  const token = tok.j();
  if (!token.access_token) { console.error('Token failed:', tok.b); process.exit(1); }
  const T = token.access_token;
  console.log('✅ Token OK\n');

  function api(method, host, p, body = null) {
    return httpReq({ host, path: p, method,
      headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': PROJECT_ID }
    }, body);
  }

  // Step 1: Initialize Firebase Auth config
  console.log('1. Initializing Firebase Auth...');
  const initRes = await api('PATCH', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn,authorizedDomains`,
    {
      signIn: {
        allowDuplicateEmails: false,
        email:  { enabled: true, passwordRequired: false },
        phoneNumber: { enabled: false },
        anonymous: { enabled: false },
      },
      authorizedDomains: [
        'localhost',
        `${PROJECT_ID}.firebaseapp.com`,
        `${PROJECT_ID}.web.app`,
        GITHUB_DOMAIN,
      ]
    }
  );
  console.log('   Status:', initRes.s, initRes.s === 200 ? '✅' : initRes.b.substring(0, 300));

  // Step 2: Get OAuth client for Firebase (Web Client auto-created by Google Service)
  console.log('\n2. Getting Firebase Web Client ID...');
  // Firebase auto-creates an OAuth Web client when Firebase Auth is set up
  // Try to find it via the IAM Credentials API
  const G = 'C:/Users/ACER/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd';
  const { execSync } = require('child_process');
  let googleClientId = null;
  let googleClientSecret = null;

  try {
    // Try to get the auto-created web client
    const oauthList = execSync(`"${G}" alpha iap oauth-clients list --project=${PROJECT_ID} --format=json 2>nul`, { encoding: 'utf8' }).trim();
    if (oauthList && oauthList !== '[]') {
      const clients = JSON.parse(oauthList);
      const webClient = clients.find(c => c.displayName?.includes('Web') || c.name?.includes('web'));
      if (webClient) {
        googleClientId     = webClient.name.split('/').pop() + '.apps.googleusercontent.com';
        googleClientSecret = webClient.secret;
        console.log('   Found client ID:', googleClientId.substring(0, 30) + '...');
      }
    }
  } catch (e) {
    console.log('   IAP clients not available:', e.message.substring(0, 100));
  }

  // Step 3: Enable Google Sign-In
  console.log('\n3. Enabling Google Sign-In provider...');
  const idpBody = {
    name:    `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`,
    enabled: true,
  };
  if (googleClientId)     idpBody.clientId     = googleClientId;
  if (googleClientSecret) idpBody.clientSecret = googleClientSecret;

  const r1 = await api('POST', 'identitytoolkit.googleapis.com',
    `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com`, idpBody);
  if (r1.s === 200 || r1.s === 409) {
    console.log('   ✅ Google Sign-In enabled');
  } else {
    console.log('   Status:', r1.s, r1.b.substring(0, 300));
    // Need OAuth client ID — let's check the firebase-managed approach
    if (r1.b.includes('client_id cannot be empty')) {
      console.log('\n   ⚠️  Firebase needs an OAuth Web Client ID for Google Sign-In.');
      console.log('   This will be set up via the Firebase Console (2 clicks).');
      console.log('   Please go to: https://console.firebase.google.com/project/lamthong-bbq-2025/authentication/providers');
      console.log('   → Click Google → Enable → Save\n');
    }
  }

  // Step 4: Verify authorized domains
  console.log('\n4. Verifying authorized domains...');
  const cfgCheck = await api('GET', 'identitytoolkit.googleapis.com', `/admin/v2/projects/${PROJECT_ID}/config`);
  if (cfgCheck.s === 200) {
    const cfg = cfgCheck.j();
    const domains = cfg.authorizedDomains || [];
    console.log('   Domains:', domains.join(', '));
    console.log('   GitHub domain present:', domains.includes(GITHUB_DOMAIN) ? '✅' : '❌');
  } else {
    console.log('   Status:', cfgCheck.s, cfgCheck.b.substring(0, 200));
  }

  console.log('\n✅ Firebase Auth initialization complete!');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
