/**
 * Automate GCP Consent Screen using Edge (pre-installed, may have GCP session)
 */
const { chromium } = require('playwright');

const PROJECT_ID  = 'gmail-api-495616';
const ADMIN_EMAIL = 'naytar1569@gmail.com';
const CLIENT_NUM  = '395886691537';

const CONSENT_URL = `https://console.cloud.google.com/apis/credentials/consent/edit?project=${PROJECT_ID}`;
const CREDS_URL   = `https://console.cloud.google.com/apis/credentials/oauthclient/${CLIENT_NUM}?project=${PROJECT_ID}`;

const EDGE_PROFILE = 'C:/Users/ACER/AppData/Local/Microsoft/Edge/User Data';

async function tryClick(page, selectors, label) {
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000, state: 'visible' });
      await page.click(sel);
      console.log(`   ✅ Clicked: ${label}`);
      return true;
    } catch { /* next */ }
  }
  console.log(`   ⚠️  Not found: ${label}`);
  return false;
}

async function run() {
  console.log('\n🍖  Automating GCP via Microsoft Edge...\n');

  let context;
  try {
    console.log('Opening Edge with your session...');
    context = await chromium.launchPersistentContext(EDGE_PROFILE, {
      headless: false,
      channel: 'msedge',
      args: ['--profile-directory=Default', '--no-first-run', '--disable-popup-blocking'],
      viewport: { width: 1280, height: 900 },
      timeout: 15000,
    });
    console.log('✅ Edge opened\n');
  } catch (e) {
    console.log(`Edge profile error: ${e.message.split('\n')[0]}`);
    console.log('Trying Edge without profile...');
    const browser = await chromium.launch({
      channel: 'msedge', headless: false,
      args: ['--no-first-run', '--disable-popup-blocking'],
    });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  }

  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    // ── Step 1: Consent screen ─────────────────────────────────────
    console.log('Step 1: Navigating to consent screen...');
    await page.goto(CONSENT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (page.url().includes('accounts.google.com')) {
      console.log('⏳ Please sign in to GCP in the Edge window (waiting up to 2 min)...');
      await page.waitForURL('**/console.cloud.google.com**', { timeout: 120000 });
      await page.goto(CONSENT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    await page.waitForTimeout(5000);
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const isPublished = bodyText.includes('In production');
    console.log(`   Publishing status: ${isPublished ? 'In production ✅' : 'Testing ⚠️ (needs fix)'}`);

    if (!isPublished) {
      // Add test user first
      console.log('\n   Adding test user...');
      if (await tryClick(page, ['button:has-text("ADD USERS")', 'text=ADD USERS'], 'ADD USERS')) {
        await page.waitForTimeout(2000);
        try {
          const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 });
          await emailInput.fill(ADMIN_EMAIL);
          await page.waitForTimeout(500);
          await tryClick(page, ['button:has-text("ADD")'], 'Confirm ADD');
          await page.waitForTimeout(2000);
          console.log(`   ✅ Test user ${ADMIN_EMAIL} added`);
        } catch { console.log('   Could not fill email input'); }
      }

      // Publish app
      console.log('\n   Publishing app...');
      if (await tryClick(page, ['button:has-text("PUBLISH APP")', 'text=PUBLISH APP'], 'PUBLISH APP')) {
        await page.waitForTimeout(2000);
        await tryClick(page, ['button:has-text("CONFIRM")', 'button:has-text("OK")'], 'Confirm');
        await page.waitForTimeout(3000);
        console.log('   ✅ App is now In production!');
      }
    }

    // ── Step 2: Verify OAuth Client authorized origins ─────────────
    console.log('\nStep 2: Checking OAuth Client authorized origins...');
    await page.goto(CREDS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const html = await page.evaluate(() => document.body.innerText).catch(() => '');
    const hasOrigin = html.includes('naytar1569-art.github.io');
    console.log(`   naytar1569-art.github.io: ${hasOrigin ? '✅ Present' : '❌ MISSING'}`);

    if (!hasOrigin) {
      console.log('\n   Adding missing origin...');
      if (await tryClick(page, ['button:has-text("ADD URI")', 'text=ADD URI'], 'ADD URI')) {
        await page.waitForTimeout(1500);
        // Find empty URI input
        const inputs = await page.$$('input[placeholder*="https"], input[aria-label*="URI" i], input[type="url"]');
        for (let i = inputs.length - 1; i >= 0; i--) {
          try {
            const val = await inputs[i].inputValue();
            if (!val) {
              await inputs[i].fill('https://naytar1569-art.github.io');
              console.log('   ✅ Filled: https://naytar1569-art.github.io');
              break;
            }
          } catch { /* skip */ }
        }
        await page.waitForTimeout(500);
        await tryClick(page, ['button:has-text("SAVE")', 'button:has-text("Save")'], 'SAVE');
        await page.waitForTimeout(4000);
        console.log('   ✅ Origin saved!');
      }
    }

    console.log('\n' + '═'.repeat(55));
    console.log('✅  Setup complete!');
    console.log('   Try signing in at: https://naytar1569-art.github.io');
    console.log('   Browser closes in 10 seconds...');
    console.log('═'.repeat(55) + '\n');
    await page.waitForTimeout(10000);

  } catch (err) {
    console.error('\n❌ Error:', err.message.split('\n')[0]);
    console.log('Browser stays open for 20 seconds — check manually.');
    await page.waitForTimeout(20000);
  } finally {
    await context.close().catch(() => {});
  }
}

run().catch(e => console.error('Fatal:', e.message.split('\n')[0]));
