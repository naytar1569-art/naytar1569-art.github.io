// ============================================================
//  LamthongBBQ Stock Management System
// ============================================================
//
//  SETUP REQUIRED (Google Cloud Console):
//  1. ไปที่ https://console.cloud.google.com
//  2. สร้างโปรเจค → APIs & Services → Enable Gmail API
//  3. OAuth consent screen → External → เพิ่ม scope:
//       email, profile, https://www.googleapis.com/auth/gmail.send
//  4. Credentials → Create → OAuth 2.0 Client ID → Web application
//  5. Authorized JavaScript origins: https://naytar1569-art.github.io
//  6. นำ Client ID มาวางที่ GOOGLE_CLIENT_ID ด้านล่าง
//  7. เพิ่ม Gmail ของพนักงานใน "จัดการพนักงาน" (เฉพาะ admin)
//
// ============================================================

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const ADMIN_EMAIL      = 'naytar1569@gmail.com';

const CATEGORIES = [
  { id: 'meat',    name: 'เนื้อสัตว์' },
  { id: 'veg',     name: 'ผัก' },
  { id: 'kitchen', name: 'ของใช้ในครัว' },
  { id: 'general', name: 'ของใช้ทั่วไป' },
];

// ── State ─────────────────────────────────────────────────────
let currentUser        = null;
let currentCategoryId  = CATEGORIES[0].id;
let stockData          = {};   // { categoryId: [{ id, name, unit, qty }] }
let tokenClient        = null;
let editingItemId      = null;

// ── Helpers ───────────────────────────────────────────────────
const el = id => document.getElementById(id);

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function base64EncodeUTF8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function showToast(msg, type = 'info', duration = 3500) {
  const container = el('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('visible'));
  });
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── Storage ───────────────────────────────────────────────────
function loadStock() {
  try {
    const raw = localStorage.getItem('bbqStock_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      CATEGORIES.forEach(cat => {
        stockData[cat.id] = Array.isArray(parsed[cat.id]) ? parsed[cat.id] : [];
      });
      return;
    }
  } catch { /* ignore */ }
  CATEGORIES.forEach(cat => { stockData[cat.id] = []; });
}

function saveStock() {
  localStorage.setItem('bbqStock_v2', JSON.stringify(stockData));
}

function loadStaff() {
  try { return JSON.parse(localStorage.getItem('bbqStaff') || '[]'); }
  catch { return []; }
}

function saveStaff(list) {
  localStorage.setItem('bbqStaff', JSON.stringify(list));
}

// ── Auth ──────────────────────────────────────────────────────
function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

function getRole(email) {
  if (!email) return null;
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return 'admin';
  const staff = loadStaff();
  if (staff.map(e => e.toLowerCase()).includes(email.toLowerCase())) return 'employee';
  return null;
}

function handleSignIn(credentialResponse) {
  const payload = parseJwt(credentialResponse.credential);
  if (!payload) {
    showToast('ไม่สามารถอ่านข้อมูลจาก Google ได้', 'error');
    return;
  }
  const email = (payload.email || '').toLowerCase();
  const role  = getRole(email);
  if (!role) {
    showUnauthorized(email);
    return;
  }
  currentUser = {
    email,
    name:       payload.name    || email,
    picture:    payload.picture || '',
    role,
    credential: credentialResponse.credential,
  };
  sessionStorage.setItem('bbqCurrentUser', JSON.stringify(currentUser));
  showApp();
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('bbqCurrentUser');
  if (typeof google !== 'undefined') google.accounts.id.disableAutoSelect();
  showLogin();
}

// ── UI State ──────────────────────────────────────────────────
function showLogin() {
  el('loginOverlay').classList.remove('hidden');
  el('unauthorizedOverlay').classList.add('hidden');
  el('appHeader').classList.add('hidden');
  el('appContent').classList.add('hidden');
}

function showUnauthorized(email) {
  el('loginOverlay').classList.add('hidden');
  el('unauthorizedOverlay').classList.remove('hidden');
  el('appHeader').classList.add('hidden');
  el('appContent').classList.add('hidden');
  el('unauthorizedEmail').textContent = `อีเมล: ${email}`;
}

function showApp() {
  el('loginOverlay').classList.add('hidden');
  el('unauthorizedOverlay').classList.add('hidden');
  el('appHeader').classList.remove('hidden');
  el('appContent').classList.remove('hidden');

  // Update header user info
  const avatar = el('userAvatar');
  if (currentUser.picture) {
    avatar.src = currentUser.picture;
    avatar.classList.remove('hidden');
  } else {
    avatar.classList.add('hidden');
  }
  el('userName').textContent = currentUser.name;

  const badge = el('roleLabel');
  if (currentUser.role === 'admin') {
    badge.textContent = 'ผู้ดูแลระบบ';
    badge.className   = 'role-badge admin';
  } else {
    badge.textContent = 'พนักงาน';
    badge.className   = 'role-badge employee';
  }

  // Show admin-only UI elements
  document.querySelectorAll('.admin-only').forEach(node => {
    node.classList.toggle('hidden', currentUser.role !== 'admin');
  });

  renderTabs();
  renderCategory();
}

// ── Tabs ──────────────────────────────────────────────────────
function renderTabs() {
  const track = el('categoryTabs');
  track.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = (stockData[cat.id] || []).length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-btn' + (cat.id === currentCategoryId ? ' active' : '');
    btn.innerHTML = `<span class="tab-name">${escHtml(cat.name)}</span><span class="tab-count">${count} รายการ</span>`;
    btn.addEventListener('click', () => {
      currentCategoryId = cat.id;
      renderTabs();
      renderCategory();
    });
    track.appendChild(btn);
  });
}

// ── Category View ─────────────────────────────────────────────
function renderCategory() {
  const container = el('categoryView');
  container.innerHTML = '';

  const cat   = CATEGORIES.find(c => c.id === currentCategoryId);
  const items = stockData[currentCategoryId] || [];
  const isAdmin = currentUser?.role === 'admin';

  // ── Category header
  const header = document.createElement('div');
  header.className = 'cat-header';
  header.innerHTML = `
    <div>
      <h2 class="cat-title">${escHtml(cat.name)}</h2>
      <p class="cat-count">${items.length} รายการ</p>
    </div>
    ${isAdmin ? `<button class="add-item-btn" id="showAddFormBtn">+ เพิ่มรายการ</button>` : ''}
  `;
  container.appendChild(header);

  // ── Add item form (admin only)
  if (isAdmin) {
    const form = document.createElement('div');
    form.id = 'addItemForm';
    form.className = 'add-item-form hidden';
    form.innerHTML = `
      <div class="form-row">
        <label>ชื่อสินค้า<input id="newItemName" type="text" placeholder="เช่น หมูสามชั้น"></label>
        <label>หน่วย<input id="newItemUnit" type="text" placeholder="เช่น กก."></label>
        <label>จำนวนเริ่มต้น<input id="newItemQty" type="number" min="0" step="1" value="0"></label>
      </div>
      <div class="form-actions">
        <button id="saveNewItemBtn" class="btn-primary">บันทึก</button>
        <button id="cancelNewItemBtn" class="btn-secondary">ยกเลิก</button>
      </div>
    `;
    container.appendChild(form);

    el('showAddFormBtn').addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) el('newItemName').focus();
    });

    el('saveNewItemBtn').addEventListener('click', saveNewItem);
    el('cancelNewItemBtn').addEventListener('click', () => form.classList.add('hidden'));

    el('newItemName').addEventListener('keydown', e => {
      if (e.key === 'Enter') el('newItemUnit').focus();
    });
    el('newItemUnit').addEventListener('keydown', e => {
      if (e.key === 'Enter') el('newItemQty').focus();
    });
    el('newItemQty').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveNewItem();
    });
  }

  // ── Items
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'ยังไม่มีรายการในหมวดนี้';
    container.appendChild(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'items-grid';
    items.forEach(item => grid.appendChild(buildItemCard(item)));
    container.appendChild(grid);
  }
}

function buildItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  const isAdmin = currentUser?.role === 'admin';

  card.innerHTML = `
    <div class="item-info">
      <span class="item-name">${escHtml(item.name)}</span>
      <span class="item-unit">หน่วย: ${escHtml(item.unit)}</span>
    </div>
    <div class="item-controls">
      <div class="qty-control">
        <button class="qty-btn dec" aria-label="ลด" data-id="${item.id}">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn inc" aria-label="เพิ่ม" data-id="${item.id}">+</button>
      </div>
      ${isAdmin ? `
      <div class="item-admin-actions">
        <button class="icon-btn edit-btn" data-id="${item.id}" title="แก้ไข" aria-label="แก้ไข">✏️</button>
        <button class="icon-btn delete-btn" data-id="${item.id}" title="ลบ" aria-label="ลบ">🗑️</button>
      </div>` : ''}
    </div>
  `;

  card.querySelector('.dec').addEventListener('click', () => adjustQty(item.id, -1));
  card.querySelector('.inc').addEventListener('click', () => adjustQty(item.id, +1));

  if (isAdmin) {
    card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(item.id));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id));
  }

  return card;
}

// ── CRUD ──────────────────────────────────────────────────────
function adjustQty(itemId, delta) {
  const item = (stockData[currentCategoryId] || []).find(i => i.id === itemId);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  saveStock();
  renderTabs();
  renderCategory();
}

function saveNewItem() {
  const name = el('newItemName').value.trim();
  const unit = el('newItemUnit').value.trim() || 'ชิ้น';
  const qty  = Number(el('newItemQty').value);
  if (!name) { showToast('กรุณากรอกชื่อสินค้า', 'error'); return; }
  if (isNaN(qty) || qty < 0) { showToast('จำนวนต้องไม่ติดลบ', 'error'); return; }
  stockData[currentCategoryId].push({ id: crypto.randomUUID(), name, unit, qty });
  saveStock();
  showToast(`เพิ่ม "${name}" เรียบร้อย`, 'success');
  renderTabs();
  renderCategory();
}

function deleteItem(itemId) {
  const items = stockData[currentCategoryId] || [];
  const item  = items.find(i => i.id === itemId);
  if (!item) return;
  if (!confirm(`ลบรายการ "${item.name}" ใช่หรือไม่?`)) return;
  stockData[currentCategoryId] = items.filter(i => i.id !== itemId);
  saveStock();
  showToast(`ลบ "${item.name}" เรียบร้อย`, 'info');
  renderTabs();
  renderCategory();
}

// ── Edit Modal ────────────────────────────────────────────────
function openEditModal(itemId) {
  const item = (stockData[currentCategoryId] || []).find(i => i.id === itemId);
  if (!item) return;
  editingItemId = itemId;
  el('editName').value = item.name;
  el('editUnit').value = item.unit;
  el('editQty').value  = item.qty;
  el('editModal').classList.remove('hidden');
  el('editName').focus();
}

function closeEditModal() {
  editingItemId = null;
  el('editModal').classList.add('hidden');
}

function saveEdit() {
  if (!editingItemId) return;
  const item = (stockData[currentCategoryId] || []).find(i => i.id === editingItemId);
  if (!item) { closeEditModal(); return; }

  const name = el('editName').value.trim();
  const unit = el('editUnit').value.trim();
  const qty  = Number(el('editQty').value);
  if (!name) { showToast('กรุณากรอกชื่อสินค้า', 'error'); return; }
  if (isNaN(qty) || qty < 0) { showToast('จำนวนต้องไม่ติดลบ', 'error'); return; }

  item.name = name;
  item.unit = unit || 'ชิ้น';
  item.qty  = qty;
  saveStock();
  closeEditModal();
  showToast('แก้ไขเรียบร้อย', 'success');
  renderTabs();
  renderCategory();
}

// ── Staff Management ──────────────────────────────────────────
function renderStaffModal() {
  const list  = el('staffList');
  const staff = loadStaff();
  list.innerHTML = '';
  if (staff.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.88rem;padding:8px 0">ยังไม่มีพนักงาน</p>';
    return;
  }
  staff.forEach(email => {
    const row = document.createElement('div');
    row.className = 'staff-row';
    row.innerHTML = `<span>${escHtml(email)}</span><button class="remove-staff" data-email="${escHtml(email)}" title="ลบ">✕</button>`;
    row.querySelector('.remove-staff').addEventListener('click', () => {
      const updated = loadStaff().filter(e => e !== email);
      saveStaff(updated);
      renderStaffModal();
      showToast(`ลบ ${email} เรียบร้อย`, 'info');
    });
    list.appendChild(row);
  });
}

function addStaff() {
  const email = el('staffEmailInput').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('กรุณากรอกอีเมลที่ถูกต้อง', 'error'); return; }
  if (email === ADMIN_EMAIL.toLowerCase()) { showToast('อีเมลนี้เป็น admin อยู่แล้ว', 'error'); return; }
  const staff = loadStaff();
  if (staff.map(e => e.toLowerCase()).includes(email)) { showToast('อีเมลนี้มีอยู่แล้ว', 'error'); return; }
  staff.push(email);
  saveStaff(staff);
  el('staffEmailInput').value = '';
  renderStaffModal();
  showToast(`เพิ่ม ${email} เรียบร้อย`, 'success');
}

// ── Report & Excel ─────────────────────────────────────────────
function generateExcel(date) {
  const rows = [['วันที่', 'หมวดหมู่', 'ชื่อสินค้า', 'จำนวน', 'หน่วย']];
  CATEGORIES.forEach(cat => {
    const items = stockData[cat.id] || [];
    if (items.length === 0) {
      rows.push([date, cat.name, '-', 0, '-']);
    } else {
      items.forEach(item => rows.push([date, cat.name, item.name, item.qty, item.unit]));
    }
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'สต็อกสินค้า');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

function buildMimeMessage({ to, subject, bodyText, filename, fileBase64 }) {
  const boundary  = `LamthongBBQ_${Date.now()}`;
  const subjB64   = base64EncodeUTF8(subject);
  const bodyB64   = base64EncodeUTF8(bodyText);

  // All parts below are ASCII after encoding so btoa() on the joined string is safe
  const mime = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${subjB64}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
    '',
    `--${boundary}`,
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    fileBase64,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return btoa(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendViaGmailApi(accessToken, date) {
  const xlsxB64  = generateExcel(date);
  const filename = `stock-report-${date}.xlsx`;

  const bodyText = [
    `รายงานสต็อกประจำวัน: ${date}`,
    `ผู้ส่ง: ${currentUser.name} (${currentUser.email})`,
    '',
    'สรุปรายหมวด:',
    ...CATEGORIES.map(cat => {
      const items = stockData[cat.id] || [];
      const total = items.reduce((s, i) => s + i.qty, 0);
      return `  - ${cat.name}: ${items.length} รายการ (รวม ${total})`;
    }),
    '',
    'ดูรายละเอียดในไฟล์แนบ',
  ].join('\n');

  const raw = buildMimeMessage({
    to:       ADMIN_EMAIL,
    subject:  `รายงานสต็อก LamthongBBQ วันที่ ${date}`,
    bodyText,
    filename,
    fileBase64: xlsxB64,
  });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return true;
}

function handleSaveReport() {
  if (!currentUser) return;
  const date = el('reportDate').value;
  if (!date) { showToast('กรุณาเลือกวันที่รายงาน', 'error'); return; }

  // Admin: just download Excel locally
  if (currentUser.role === 'admin') {
    if (typeof XLSX === 'undefined') { showToast('ไม่สามารถโหลด SheetJS ได้', 'error'); return; }
    const b64 = generateExcel(date);
    const wb  = XLSX.read(b64, { type: 'base64' });
    XLSX.writeFile(wb, `stock-report-${date}.xlsx`);
    showToast(`ดาวน์โหลดรายงาน ${date} เรียบร้อย`, 'success');
    return;
  }

  // Staff: send via Gmail API
  if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    showToast('ยังไม่ได้ตั้งค่า Google Client ID — ดูคำแนะนำในหน้า Login', 'error');
    return;
  }

  if (!tokenClient) { showToast('Google API ยังไม่พร้อม กรุณารอสักครู่', 'error'); return; }

  setSaving(true);

  tokenClient.callback = async tokenResponse => {
    if (tokenResponse.error) {
      showToast(`ไม่สามารถขอสิทธิ์ Gmail ได้: ${tokenResponse.error}`, 'error');
      setSaving(false);
      return;
    }
    try {
      await sendViaGmailApi(tokenResponse.access_token, date);
      showToast(`✅ ส่งรายงาน ${date} ไปที่ ${ADMIN_EMAIL} เรียบร้อย`, 'success', 5000);
    } catch (e) {
      showToast(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  tokenClient.requestAccessToken({ prompt: '' });
}

function setSaving(on) {
  const btn = el('saveReportBtn');
  btn.disabled    = on;
  btn.textContent = on ? '⏳ กำลังส่ง...' : '💾 บันทึกรายงาน';
}

// ── Google Identity Services ──────────────────────────────────
window.onGoogleLibLoaded = function () {
  if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    el('setupNotice').classList.remove('hidden');
    return;
  }

  google.accounts.id.initialize({
    client_id:           GOOGLE_CLIENT_ID,
    callback:            handleSignIn,
    auto_select:         false,
    cancel_on_tap_outside: false,
  });

  google.accounts.id.renderButton(el('googleSignInBtn'), {
    type:   'standard',
    theme:  'outline',
    size:   'large',
    text:   'signin_with',
    locale: 'th',
    width:  280,
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope:     'https://www.googleapis.com/auth/gmail.send',
    callback:  () => { /* set dynamically before use */ },
  });
};

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadStock();

  // Set today's date
  el('reportDate').value = new Date().toISOString().slice(0, 10);

  // Restore session
  try {
    const saved = JSON.parse(sessionStorage.getItem('bbqCurrentUser') || 'null');
    if (saved && saved.email && getRole(saved.email)) {
      currentUser = saved;
      showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }

  // Core event listeners
  el('logoutBtn').addEventListener('click', logout);
  el('unauthorizedLogoutBtn').addEventListener('click', () => {
    if (typeof google !== 'undefined') google.accounts.id.disableAutoSelect();
    showLogin();
  });
  el('saveReportBtn').addEventListener('click', handleSaveReport);

  // Edit modal
  el('saveEditBtn').addEventListener('click', saveEdit);
  el('cancelEditBtn').addEventListener('click', closeEditModal);
  el('editModal').addEventListener('click', e => { if (e.target === el('editModal')) closeEditModal(); });
  el('editQty').addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEditModal();
      el('staffModal').classList.add('hidden');
    }
  });

  // Staff modal
  el('manageStaffBtn').addEventListener('click', () => {
    el('staffModal').classList.remove('hidden');
    renderStaffModal();
  });
  el('closeStaffModal').addEventListener('click', () => el('staffModal').classList.add('hidden'));
  el('staffModal').addEventListener('click', e => { if (e.target === el('staffModal')) el('staffModal').classList.add('hidden'); });
  el('addStaffBtn').addEventListener('click', addStaff);
  el('staffEmailInput').addEventListener('keydown', e => { if (e.key === 'Enter') addStaff(); });
}

document.addEventListener('DOMContentLoaded', init);
