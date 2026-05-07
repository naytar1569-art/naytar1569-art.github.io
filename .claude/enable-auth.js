/**
 * Enable Google Sign-In and add authorized domain using firebase-tools internal API
 */
const path = require('path');
const FB   = 'C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib';

const { Client } = require(FB + '/apiv2');
const api2 = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true });

const PROJECT_ID    = 'lamthong-bbq-2025';
const GITHUB_DOMAIN = 'naytar1569-art.github.io';

async function main() {
  console.log('\n🍖  Enabling Firebase Google Sign-In...\n');

  // Enable Google Sign-In
  console.log('🔐 Enabling Google Sign-In provider...');
  try {
    const r = await api2.request({
      method:  'POST',
      path:    `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs`,
      queryParams: { idpId: 'google.com' },
      body:    { name: `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`, enabled: true },
      skipLog: { body: true, resBody: true },
    });
    console.log('✅ Google Sign-In enabled:', r.status);
  } catch(e) {
    if (e.message?.includes('409') || e.message?.includes('already')) {
      console.log('✅ Google Sign-In already enabled');
    } else {
      console.log('⚠️  Enable failed:', e.message);
      // Try PATCH
      try {
        const r2 = await api2.request({
          method:  'PATCH',
          path:    `/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`,
          queryParams: { updateMask: 'enabled' },
          body:    { enabled: true },
        });
        console.log('✅ Patched:', r2.status);
      } catch(e2) { console.log('⚠️  PATCH failed:', e2.message); }
    }
  }

  // Get current config then add domain
  console.log('\n🌍 Adding authorized domain...');
  try {
    const getRes = await api2.request({ method: 'GET', path: `/admin/v2/projects/${PROJECT_ID}/config` });
    let domains = getRes.body?.authorizedDomains || ['localhost', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`];
    if (!domains.includes(GITHUB_DOMAIN)) domains.push(GITHUB_DOMAIN);

    const patchRes = await api2.request({
      method: 'PATCH',
      path:   `/admin/v2/projects/${PROJECT_ID}/config`,
      queryParams: { updateMask: 'authorizedDomains' },
      body:   { authorizedDomains: domains },
    });
    console.log(`✅ ${GITHUB_DOMAIN} added to authorized domains`);
  } catch(e) {
    console.log('⚠️  Domain setup:', e.message);
  }

  console.log('\n✅ Auth configuration complete!\n');
}

main().catch(e => { console.error('❌', e.message || e); process.exit(1); });
