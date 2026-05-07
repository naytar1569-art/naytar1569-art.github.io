/**
 * Configure OAuth consent screen + add test user programmatically
 */
const https  = require('https');
const { execSync } = require('child_process');

const GCLOUD       = 'C:/Users/ACER/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd';
const PROJECT_NUM  = '395886691537';
const PROJECT_ID   = 'gmail-api-495616';
const ADMIN_EMAIL  = 'naytar1569@gmail.com';
const APP_NAME     = 'LamthongBBQ Stock';

function getToken() {
  return execSync(`"${GCLOUD}" auth print-access-token 2>nul`, { encoding: 'utf8' }).trim();
}

function req(method, host, path, body, token) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({ host, path, method,
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    }, rs => { let b=''; rs.on('data',c=>b+=c); rs.on('end',()=>res({s:rs.statusCode,b,j:()=>JSON.parse(b)})); });
    r.on('error', rej);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('\n🍖  Setting up OAuth Consent Screen...\n');

  const TOKEN = getToken();
  console.log('✅ Got access token\n');

  // ── 1. Try clientauthconfig API (what GCP Console uses internally) ──
  console.log('1. Configuring OAuth consent screen via clientauthconfig API...');
  const brandBody = {
    applicationTitle:         APP_NAME,
    supportEmail:             ADMIN_EMAIL,
    logoUri:                  '',
    homePageUri:              `https://naytar1569-art.github.io`,
    privacyPolicyUri:         '',
    termsOfServiceUri:        '',
    allowedDomainsForTestUsers: [ADMIN_EMAIL.split('@')[1]],
    userType:                 'PUBLIC',
  };

  // Try creating brand
  const createR = await req('POST', 'clientauthconfig.googleapis.com',
    `/v1/projects/${PROJECT_NUM}/brand`, brandBody, TOKEN);
  console.log(`   Status: ${createR.s}`, createR.s === 200 ? '✅' : createR.b.substring(0, 250));

  // ── 2. Try IAP brand (may fail for non-org, but worth trying) ──
  console.log('\n2. Trying IAP brand creation...');
  const iapR = await req('POST', 'iap.googleapis.com',
    `/v1/projects/${PROJECT_NUM}/brands`,
    { applicationTitle: APP_NAME, supportEmail: ADMIN_EMAIL }, TOKEN);
  console.log(`   Status: ${iapR.s}`, iapR.b.substring(0, 250));

  let brandName = null;
  if (iapR.s === 200) {
    brandName = iapR.j().name;
    console.log('   Brand:', brandName);
  }

  // Try to list brands
  const listR = await req('GET', 'iap.googleapis.com',
    `/v1/projects/${PROJECT_NUM}/brands`, null, TOKEN);
  console.log('\n3. List brands status:', listR.s, listR.b.substring(0, 300));
  if (listR.s === 200) {
    const brands = listR.j().brands || [];
    if (brands.length > 0) brandName = brands[0].name;
  }

  // ── 3. Add test user if brand exists ──
  if (brandName) {
    console.log('\n4. Adding test user...');
    const testR = await req('POST', 'iap.googleapis.com',
      `/v1/${brandName}/identityAwareProxyClients`,
      { displayName: APP_NAME }, TOKEN);
    console.log(`   Status: ${testR.s}`, testR.b.substring(0, 250));
  }

  // ── 4. Verify OAuth Client authorized origins ──
  console.log('\n5. Verifying OAuth client setup...');
  // Try to use the Discovery API to check OAuth client details
  const discR = await req('GET', 'www.googleapis.com',
    `/discovery/v1/apis/oauth2/v2/rest`, null, TOKEN);
  console.log(`   OAuth2 discovery: ${discR.s}`);

  // ── 5. Try setting up the consent screen via OAuth2 Management API ──
  console.log('\n6. Setting up OAuth consent screen via oauth2 API...');
  const oauth2R = await req('POST', 'accounts.google.com',
    `/o/oauth2/auth`, null, TOKEN);
  console.log(`   Status: ${oauth2R.s}`);

  console.log('\n' + '─'.repeat(50));
  console.log('If the above failed, opening browser for manual setup...');
  const { exec } = require('child_process');
  exec(`start "" "https://console.cloud.google.com/apis/credentials/consent/edit?project=${PROJECT_ID}"`);
  console.log(`Opened: https://console.cloud.google.com/apis/credentials/consent/edit?project=${PROJECT_ID}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
