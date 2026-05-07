#!/usr/bin/env node
// ============================================================
//  LamthongBBQ — Automated Google OAuth Setup
//  รัน: node setup-oauth.js
// ============================================================

const { execSync, exec, execFileSync } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// ── Config ────────────────────────────────────────────────────
const ADMIN_EMAIL  = 'naytar1569@gmail.com';
const APP_TITLE    = 'LamthongBBQ Stock';
const GITHUB_ORIGIN = 'https://naytar1569-art.github.io';

// Script paths (both .claude/ and root are updated)
const SCRIPT_PATHS = [
  path.join(__dirname, 'script.js'),
  path.join(__dirname, '..', 'script.js'),
];

// ── Colors ────────────────────────────────────────────────────
const ok    = s => `\x1b[32m✅ ${s}\x1b[0m`;
const warn  = s => `\x1b[33m⚠️  ${s}\x1b[0m`;
const info  = s => `\x1b[36mℹ️  ${s}\x1b[0m`;
const step  = s => `\x1b[1m\x1b[34m▶ ${s}\x1b[0m`;
const err   = s => `\x1b[31m❌ ${s}\x1b[0m`;
const bold  = s => `\x1b[1m${s}\x1b[0m`;
const hr    = () => '\x1b[90m' + '─'.repeat(55) + '\x1b[0m';

// ── Helpers ───────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe', ...opts }).toString().trim();
}

function tryRun(cmd) {
  try { return run(cmd); } catch { return ''; }
}

function openBrowser(url) {
  try { run(`start "" "${url}"`); } catch { console.log(info(`เปิด URL นี้ในเบราว์เซอร์: ${url}`)); }
}

function refreshPath() {
  try {
    const machine = tryRun('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\'PATH\', \'Machine\')"');
    const user    = tryRun('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\'PATH\', \'User\')"');
    if (machine) process.env.PATH = machine + ';' + (user || '');
  } catch { /* ignore */ }
}

function findGcloud() {
  const candidates = [
    'gcloud',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud'),
    'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd',
    path.join(process.env.USERPROFILE || '', 'google-cloud-sdk', 'bin', 'gcloud'),
  ];
  for (const c of candidates) {
    if (tryRun(`"${c}" --version 2>nul`).includes('Google Cloud')) return c;
    if (tryRun(`"${c}" --version`).includes('Google Cloud')) return c;
  }
  return null;
}

function updateScriptJs(clientId) {
  let updated = 0;
  for (const p of SCRIPT_PATHS) {
    if (!fs.existsSync(p)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after  = before.replace(
      /const GOOGLE_CLIENT_ID\s*=\s*'[^']*'/,
      `const GOOGLE_CLIENT_ID = '${clientId}'`
    );
    if (before !== after) {
      fs.writeFileSync(p, after, 'utf8');
      updated++;
    }
  }
  return updated;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n' + hr());
  console.log(bold('  🍖  LamthongBBQ Stock — Google OAuth Setup'));
  console.log(hr() + '\n');

  // ── Step 1: Install gcloud ────────────────────────────────
  console.log(step('ขั้นตอน 1/5 — ตรวจสอบ Google Cloud SDK'));
  let gcloud = findGcloud();

  if (gcloud) {
    console.log(ok(`พบ gcloud: ${gcloud}`));
  } else {
    console.log(warn('ยังไม่มี Google Cloud SDK — กำลังติดตั้งผ่าน winget...'));
    console.log(info('(ใช้เวลาประมาณ 3-5 นาที โปรดรอ)\n'));
    try {
      run('winget install Google.CloudSDK --silent --accept-package-agreements --accept-source-agreements', { inherit: true });
    } catch (e) {
      // winget may return non-zero even on success
    }
    refreshPath();
    gcloud = findGcloud();
    if (!gcloud) {
      // Try common install location
      const possible = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd');
      if (fs.existsSync(possible)) gcloud = possible;
    }
    if (!gcloud) {
      console.log(err('ติดตั้งไม่สำเร็จ กรุณาดาวน์โหลดเองที่: https://cloud.google.com/sdk/docs/install'));
      process.exit(1);
    }
    console.log(ok('ติดตั้ง Google Cloud SDK สำเร็จ'));
  }

  const G = `"${gcloud}"`;

  // ── Step 2: Login ─────────────────────────────────────────
  console.log('\n' + step('ขั้นตอน 2/5 — เข้าสู่ระบบ Google'));
  console.log(info(`กรุณา login ด้วย: ${bold(ADMIN_EMAIL)}`));
  console.log(info('เบราว์เซอร์จะเปิดขึ้นมาอัตโนมัติ...\n'));

  try {
    run(`${G} auth login --no-browser`, { inherit: true });
  } catch {
    // no-browser might fail, try normal
    try {
      run(`${G} auth login`, { inherit: true });
    } catch (e) {
      console.log(err('Login ล้มเหลว: ' + e.message));
      process.exit(1);
    }
  }
  console.log('\n' + ok('Login สำเร็จ'));

  // ── Step 3: Create project ────────────────────────────────
  console.log('\n' + step('ขั้นตอน 3/5 — สร้างโปรเจค GCP'));
  const projectId = `lamthong-bbq-${Date.now().toString(36).slice(-6)}`;
  console.log(info(`Project ID: ${bold(projectId)}`));

  try {
    run(`${G} projects create ${projectId} --name="${APP_TITLE}"`, { inherit: true });
    run(`${G} config set project ${projectId}`, { inherit: true });
    console.log(ok('สร้างโปรเจคสำเร็จ'));
  } catch (e) {
    console.log(err('สร้างโปรเจคล้มเหลว: ' + e.message));
    process.exit(1);
  }

  // Get project number
  let projectNumber = tryRun(`${G} projects describe ${projectId} --format=value(projectNumber)`);
  if (!projectNumber) {
    console.log(warn('ไม่พบ project number — จะใช้ project ID แทน'));
    projectNumber = projectId;
  }
  console.log(info(`Project number: ${projectNumber}`));

  // ── Step 4: Enable APIs ───────────────────────────────────
  console.log('\n' + step('ขั้นตอน 4/5 — เปิดใช้งาน APIs'));
  const apis = [
    ['gmail.googleapis.com',          'Gmail API'],
    ['iap.googleapis.com',            'Identity-Aware Proxy API'],
    ['oauth2.googleapis.com',         'OAuth2 API'],
  ];
  for (const [api, label] of apis) {
    console.log(info(`กำลังเปิด ${label}...`));
    try {
      run(`${G} services enable ${api} --project=${projectId}`, { inherit: true });
      console.log(ok(label));
    } catch {
      console.log(warn(`อาจเปิด ${label} ไม่สำเร็จ — ดำเนินการต่อ`));
    }
  }

  // ── Step 5: OAuth consent screen + Client ID ──────────────
  console.log('\n' + step('ขั้นตอน 5/5 — สร้าง OAuth Consent Screen'));

  // Create brand (consent screen)
  console.log(info('กำลังสร้าง OAuth consent screen...'));
  try {
    run(
      `${G} alpha iap oauth-brands create ` +
      `--project=${projectId} ` +
      `--application_title="${APP_TITLE}" ` +
      `--support_email=${ADMIN_EMAIL}`,
      { inherit: true }
    );
    console.log(ok('OAuth consent screen สำเร็จ'));
  } catch {
    console.log(warn('Consent screen อาจมีอยู่แล้ว หรือต้องการ billing — ดำเนินการต่อ'));
  }

  // ── Open Console for OAuth Web Client creation ────────────
  console.log('\n' + hr());
  console.log(bold('  🔑  สร้าง OAuth Web Client ID (ต้องทำด้วยตนเอง 1 ครั้ง)'));
  console.log(hr() + '\n');

  const consoleUrl = `https://console.cloud.google.com/apis/credentials/oauthclient?project=${projectId}`;

  console.log('เบราว์เซอร์จะเปิดไปที่ Google Cloud Console ให้:\n');
  console.log('  1. เลือก Application type: ' + bold('Web application'));
  console.log('  2. Name: ' + bold(APP_TITLE));
  console.log('  3. Authorized JavaScript origins — กด "ADD URI" แล้วพิมพ์:');
  console.log('     ' + bold(GITHUB_ORIGIN));
  console.log('  4. กด ' + bold('CREATE'));
  console.log('  5. Copy ' + bold('Client ID') + ' (ขึ้นต้นด้วย ตัวเลข.apps.googleusercontent.com)\n');

  console.log(info('กำลังเปิดเบราว์เซอร์...\n'));
  openBrowser(consoleUrl);

  const clientId = await ask(bold('📋 วาง Client ID ที่ได้มาที่นี่: '));

  if (!clientId || !clientId.includes('.apps.googleusercontent.com')) {
    console.log(err('Client ID ไม่ถูกต้อง กรุณาตรวจสอบและรันใหม่'));
    process.exit(1);
  }

  // ── Update script.js ──────────────────────────────────────
  const count = updateScriptJs(clientId);
  if (count > 0) {
    console.log('\n' + ok(`อัปเดต script.js ${count} ไฟล์ เรียบร้อย`));
  } else {
    console.log(warn('ไม่พบบรรทัด GOOGLE_CLIENT_ID ใน script.js — กรุณาอัปเดตด้วยตนเอง'));
    console.log(info(`const GOOGLE_CLIENT_ID = '${clientId}'`));
  }

  // ── Commit + Push ─────────────────────────────────────────
  const shouldPush = await ask('\n🚀 Push ขึ้น GitHub เลยไหม? (y/n): ');
  if (shouldPush.toLowerCase() === 'y') {
    try {
      const repoRoot = path.join(__dirname, '..');
      run(`git -C "${repoRoot}" add script.js .claude/script.js`, { inherit: true });
      run(
        `git -C "${repoRoot}" commit -m "Config: set Google OAuth Client ID"`,
        { inherit: true }
      );
      run(`git -C "${repoRoot}" push origin main`, { inherit: true });
      console.log('\n' + ok('Push สำเร็จ! เว็บจะอัปเดตใน 1-2 นาที'));
    } catch (e) {
      console.log(warn('Push ล้มเหลว กรุณา push ด้วยตนเอง: ' + e.message));
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log('\n' + hr());
  console.log(bold('  ✅  Setup เสร็จสมบูรณ์!'));
  console.log(hr() + '\n');
  console.log(`  Client ID : ${bold(clientId)}`);
  console.log(`  Project   : ${bold(projectId)}`);
  console.log(`  Admin     : ${bold(ADMIN_EMAIL)}`);
  console.log(`  เว็บไซต์  : ${bold(GITHUB_ORIGIN)}\n`);
  console.log(bold('ขั้นตอนต่อไป:'));
  console.log('  1. เปิดเว็บ ' + GITHUB_ORIGIN);
  console.log('  2. กด Sign in with Google → เข้าด้วย ' + ADMIN_EMAIL);
  console.log('  3. ไปที่ "จัดการพนักงาน" เพื่อเพิ่ม Gmail ของพนักงาน\n');
}

main().catch(e => {
  console.error('\n' + err(e.message || String(e)));
  process.exit(1);
});
