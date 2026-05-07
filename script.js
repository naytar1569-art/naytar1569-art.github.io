// ============================================================
//  LamthongBBQ Stock Management System
// ============================================================

// รหัสผ่านระบบ
const PASSWORDS = {
  admin: 'admin123',      // ผู้ดูแลระบบ
  staff1: 'staff123',     // พนักงาน 1
  staff2: 'staff456'      // พนักงาน 2
};

const ADMIN_EMAIL = 'naytar1569@gmail.com'; // สำหรับส่งรายงาน

const CATEGORIES = [
  { id: 'meat',    name: 'เนื้อสัตว์',    icon: '🥩' },
  { id: 'veg',     name: 'ผัก',          icon: '🥕' },
  { id: 'kitchen', name: 'ของใช้ในครัว', icon: '🍳' },
  { id: 'general', name: 'ของใช้ทั่วไป', icon: '🛒' },
];

// ── State ───────────────────────────────────────────────────────
let currentUser       = null;
let currentCategoryId = CATEGORIES[0].id;
let stockData         = {};
let editingItemId     = null;

// ── Helpers ─────────────────────────────────────────────────────
const el = id => document.getElementById(id);

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info', duration = 3500) {
  const wrap = el('toastContainer');
  const t    = document.createElement('div');
  t.className   = `toast toast-${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('visible')));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 350); }, duration);
}

// ── Storage ──────────────────────────────────────────────────────
function loadStock() {
  try {
    const raw = localStorage.getItem('bbqStock_v3');
    if (raw) {
      const p = JSON.parse(raw);
      CATEGORIES.forEach(c => { stockData[c.id] = Array.isArray(p[c.id]) ? p[c.id] : []; });
      return;
    }
  } catch { /* ignore */ }
  CATEGORIES.forEach(c => { stockData[c.id] = []; });
}

function saveStock() { localStorage.setItem('bbqStock_v3', JSON.stringify(stockData)); }

// ── Auth & Roles ─────────────────────────────────────────────────
function getRoleFromPassword(password) {
  if (password === PASSWORDS.admin) return 'admin';
  if (password === PASSWORDS.staff1 || password === PASSWORDS.staff2) return 'employee';
  return null;
}

function getUserNameFromPassword(password) {
  if (password === PASSWORDS.admin) return 'ผู้ดูแลระบบ';
  if (password === PASSWORDS.staff1) return 'พนักงาน 1';
  if (password === PASSWORDS.staff2) return 'พนักงาน 2';
  return null;
}

function handleLogin() {
  const password = el('passcodeInput').value.trim();
  const role = getRoleFromPassword(password);

  if (!role) {
    el('loginError').classList.remove('hidden');
    el('passcodeInput').focus();
    return;
  }

  currentUser = {
    name: getUserNameFromPassword(password),
    role: role,
    password: password
  };

  sessionStorage.setItem('bbqUser', JSON.stringify(currentUser));
  showApp();
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('bbqUser');
  showLogin();
}

// ── UI State ─────────────────────────────────────────────────────
function showLogin() {
  el('loginOverlay').classList.remove('hidden');
  el('appHeader').classList.add('hidden');
  el('categoryNav').classList.add('hidden');
  el('appContent').classList.add('hidden');
}

function showApp() {
  el('loginOverlay').classList.add('hidden');
  el('appHeader').classList.remove('hidden');
  el('categoryNav').classList.remove('hidden');
  el('appContent').classList.remove('hidden');

  el('userName').textContent = currentUser.name;
  const badge = el('roleLabel');
  badge.textContent = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
  badge.className   = `role-badge ${currentUser.role}`;

  // Load stock data if not loaded yet
  if (Object.keys(stockData).length === 0) {
    loadStock();
  }

  // ตั้งค่าวันที่เป็นวันปัจจุบัน
  const today = new Date().toISOString().split('T')[0];
  el('reportDate').value = today;

  renderTabs();
  renderCategory();

  // Setup additional event listeners after rendering
  setupAdditionalEventListeners();
}

// ── Tabs ─────────────────────────────────────────────────────────
function renderTabs() {
  const track = el('categoryTabs');
  track.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = (stockData[cat.id] || []).length;
    const btn   = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'tab-btn' + (cat.id === currentCategoryId ? ' active' : '');
    btn.innerHTML = `<span class="tab-icon">${cat.icon}</span><span class="tab-name">${escHtml(cat.name)}</span><span class="tab-count">${count}</span>`;
    btn.addEventListener('click', () => { currentCategoryId = cat.id; renderTabs(); renderCategory(); });
    track.appendChild(btn);
  });
}

// ── Category View ─────────────────────────────────────────────────
function renderCategory() {
  const container = el('categoryView');
  container.innerHTML = '';
  const cat     = CATEGORIES.find(c => c.id === currentCategoryId);
  const items   = stockData[currentCategoryId] || [];
  const isAdmin = currentUser?.role === 'admin';

  const header = document.createElement('div');
  header.className = 'cat-header';
  header.innerHTML = `
    <div>
      <h2 class="cat-title">${cat.icon} ${escHtml(cat.name)}</h2>
      <p class="cat-count">${items.length} รายการ</p>
    </div>
    ${isAdmin ? `<button class="add-item-btn" id="showAddFormBtn">+ เพิ่มรายการ</button>` : ''}
  `;
  container.appendChild(header);

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
      </div>`;
    container.appendChild(form);

    el('showAddFormBtn').addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) el('newItemName').focus();
    });
    el('saveNewItemBtn').addEventListener('click', saveNewItem);
    el('cancelNewItemBtn').addEventListener('click', () => form.classList.add('hidden'));
    el('newItemQty').addEventListener('keydown', e => { if (e.key === 'Enter') saveNewItem(); });
  }

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">${cat.icon}</div>
      <p>ยังไม่มีรายการในหมวดหมู่นี้</p>
      ${isAdmin ? '<p>กดปุ่ม "เพิ่มรายการ" เพื่อเริ่มต้น</p>' : ''}
    `;
    container.appendChild(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'items-grid';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-header">
          <h3 class="item-name">${escHtml(item.name)}</h3>
          ${isAdmin ? `<button class="item-edit-btn" data-id="${item.id}">✏️</button>` : ''}
        </div>
        <div class="item-controls">
          <button class="qty-btn minus-btn" data-id="${item.id}" data-action="dec">-</button>
          <div class="qty-display">
            <span class="qty-value">${item.qty}</span>
            <span class="qty-unit">${escHtml(item.unit)}</span>
          </div>
          <button class="qty-btn plus-btn" data-id="${item.id}" data-action="inc">+</button>
        </div>
        ${isAdmin ? `<button class="item-delete-btn" data-id="${item.id}">🗑️ ลบ</button>` : ''}
      `;
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }
}

// ── Item Management ──────────────────────────────────────────────
function saveNewItem() {
  const name = el('newItemName').value.trim();
  const unit = el('newItemUnit').value.trim();
  const qty  = parseInt(el('newItemQty').value) || 0;

  if (!name || !unit) {
    showToast('กรุณากรอกชื่อสินค้าและหน่วย', 'error');
    return;
  }

  const newItem = {
    id: Date.now().toString(),
    name,
    unit,
    qty
  };

  stockData[currentCategoryId].push(newItem);
  saveStock();

  el('newItemName').value = '';
  el('newItemUnit').value = '';
  el('newItemQty').value = '0';
  el('addItemForm').classList.add('hidden');

  renderTabs();
  renderCategory();
  showToast('เพิ่มรายการสำเร็จ', 'success');
}

function updateItemQty(itemId, delta) {
  const items = stockData[currentCategoryId];
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  item.qty = Math.max(0, item.qty + delta);
  saveStock();
  renderCategory();
}

function deleteItem(itemId) {
  if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;

  stockData[currentCategoryId] = stockData[currentCategoryId].filter(i => i.id !== itemId);
  saveStock();
  renderTabs();
  renderCategory();
  showToast('ลบรายการสำเร็จ', 'success');
}

function editItem(itemId) {
  const items = stockData[currentCategoryId];
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  el('editName').value = item.name;
  el('editUnit').value = item.unit;
  el('editQty').value = item.qty;
  el('editModal').classList.remove('hidden');
  el('editName').focus();
}

function saveEditItem() {
  const name = el('editName').value.trim();
  const unit = el('editUnit').value.trim();
  const qty  = parseInt(el('editQty').value) || 0;

  if (!name || !unit) {
    showToast('กรุณากรอกชื่อสินค้าและหน่วย', 'error');
    return;
  }

  const items = stockData[currentCategoryId];
  const item = items.find(i => i.id === editingItemId);
  if (item) {
    item.name = name;
    item.unit = unit;
    item.qty = qty;
    saveStock();
    renderCategory();
    showToast('แก้ไขรายการสำเร็จ', 'success');
  }

  el('editModal').classList.add('hidden');
  editingItemId = null;
}

// ── Report Generation ────────────────────────────────────────────
function generateExcelReport() {
  const reportDate = el('reportDate').value;
  if (!reportDate) {
    showToast('กรุณาเลือกวันที่รายงาน', 'error');
    return;
  }

  const workbook = XLSX.utils.book_new();

  CATEGORIES.forEach(cat => {
    const items = stockData[cat.id] || [];
    if (items.length === 0) return;

    const data = [
      ['รายงานสต็อกสินค้า - ' + cat.name],
      ['วันที่:', reportDate],
      [''],
      ['ชื่อสินค้า', 'จำนวน', 'หน่วย']
    ];

    items.forEach(item => {
      data.push([item.name, item.qty, item.unit]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, cat.name);
  });

  const filename = `LamthongBBQ_Stock_${reportDate}.xlsx`;
  XLSX.writeFile(workbook, filename);

  showToast('ดาวน์โหลดรายงานสำเร็จ', 'success');
}

// ── Event Listeners ──────────────────────────────────────────────
function setupEventListeners() {
  // Login
  const loginBtn = el('loginBtn');
  const passcodeInput = el('passcodeInput');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (passcodeInput) passcodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // Logout
  const logoutBtn = el('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Report
  const saveReportBtn = el('saveReportBtn');
  if (saveReportBtn) saveReportBtn.addEventListener('click', generateExcelReport);

  // Edit Modal
  const saveEditBtn = el('saveEditBtn');
  const cancelEditBtn = el('cancelEditBtn');
  if (saveEditBtn) saveEditBtn.addEventListener('click', saveEditItem);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
    el('editModal').classList.add('hidden');
    editingItemId = null;
  });
}

function setupAdditionalEventListeners() {
  // Dynamic events for items
  document.addEventListener('click', e => {
    const target = e.target;

    if (target.classList.contains('qty-btn')) {
      const itemId = target.dataset.id;
      const action = target.dataset.action;
      const delta = action === 'inc' ? 1 : -1;
      updateItemQty(itemId, delta);
    }

    if (target.classList.contains('item-edit-btn')) {
      const itemId = target.dataset.id;
      editItem(itemId);
    }

    if (target.classList.contains('item-delete-btn')) {
      const itemId = target.dataset.id;
      deleteItem(itemId);
    }
  });
}

// ── Initialization ───────────────────────────────────────────────
function init() {
  // Load saved user session
  try {
    const saved = sessionStorage.getItem('bbqUser');
    if (saved) {
      currentUser = JSON.parse(saved);
      const role = getRoleFromPassword(currentUser.password);
      if (role && currentUser.password) {
        showApp();
        return;
      }
    }
  } catch { /* ignore */ }

  loadStock();
  showLogin();
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  init();
});

// ── UI State ─────────────────────────────────────────────────────
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

  const avatar = el('userAvatar');
  if (currentUser.picture) { avatar.src = currentUser.picture; avatar.classList.remove('hidden'); }
  else avatar.classList.add('hidden');

  el('userName').textContent = currentUser.name;
  const badge = el('roleLabel');
  badge.textContent = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
  badge.className   = `role-badge ${currentUser.role}`;

  document.querySelectorAll('.admin-only')
    .forEach(n => n.classList.toggle('hidden', currentUser.role !== 'admin'));

  renderTabs();
  renderCategory();
}

// ── Tabs ─────────────────────────────────────────────────────────
function renderTabs() {
  const track = el('categoryTabs');
  track.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = (stockData[cat.id] || []).length;
    const btn   = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'tab-btn' + (cat.id === currentCategoryId ? ' active' : '');
    btn.innerHTML = `<span class="tab-name">${escHtml(cat.name)}</span><span class="tab-count">${count} รายการ</span>`;
    btn.addEventListener('click', () => { currentCategoryId = cat.id; renderTabs(); renderCategory(); });
    track.appendChild(btn);
  });
}

// ── Category View ─────────────────────────────────────────────────
function renderCategory() {
  const container = el('categoryView');
  container.innerHTML = '';
  const cat     = CATEGORIES.find(c => c.id === currentCategoryId);
  const items   = stockData[currentCategoryId] || [];
  const isAdmin = currentUser?.role === 'admin';

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
      </div>`;
    container.appendChild(form);

    el('showAddFormBtn').addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) el('newItemName').focus();
    });
    el('saveNewItemBtn').addEventListener('click', saveNewItem);
    el('cancelNewItemBtn').addEventListener('click', () => form.classList.add('hidden'));
    el('newItemQty').addEventListener('keydown', e => { if (e.key === 'Enter') saveNewItem(); });
  }

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
  const card    = document.createElement('div');
  card.className = 'item-card';
  const isAdmin  = currentUser?.role === 'admin';
  card.innerHTML = `
    <div class="item-info">
      <span class="item-name">${escHtml(item.name)}</span>
      <span class="item-unit">หน่วย: ${escHtml(item.unit)}</span>
    </div>
    <div class="item-controls">
      <div class="qty-control">
        <button class="qty-btn dec" aria-label="ลด">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn inc" aria-label="เพิ่ม">+</button>
      </div>
      ${isAdmin ? `<div class="item-admin-actions">
        <button class="icon-btn edit-btn" title="แก้ไข">✏️</button>
        <button class="icon-btn delete-btn" title="ลบ">🗑️</button>
      </div>` : ''}
    </div>`;
  card.querySelector('.dec').addEventListener('click', () => adjustQty(item.id, -1));
  card.querySelector('.inc').addEventListener('click', () => adjustQty(item.id, +1));
  if (isAdmin) {
    card.querySelector('.edit-btn').addEventListener('click',   () => openEditModal(item.id));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id));
  }
  return card;
}

// ── CRUD ─────────────────────────────────────────────────────────
function adjustQty(itemId, delta) {
  const item = (stockData[currentCategoryId] || []).find(i => i.id === itemId);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  saveStock(); renderTabs(); renderCategory();
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
  renderTabs(); renderCategory();
}

function deleteItem(itemId) {
  const items = stockData[currentCategoryId] || [];
  const item  = items.find(i => i.id === itemId);
  if (!item || !confirm(`ลบรายการ "${item.name}" ใช่หรือไม่?`)) return;
  stockData[currentCategoryId] = items.filter(i => i.id !== itemId);
  saveStock();
  showToast(`ลบ "${item.name}" แล้ว`, 'info');
  renderTabs(); renderCategory();
}

// ── Edit Modal ────────────────────────────────────────────────────
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

function closeEditModal() { editingItemId = null; el('editModal').classList.add('hidden'); }

function saveEdit() {
  if (!editingItemId) return;
  const item = (stockData[currentCategoryId] || []).find(i => i.id === editingItemId);
  if (!item) { closeEditModal(); return; }
  const name = el('editName').value.trim();
  const unit = el('editUnit').value.trim();
  const qty  = Number(el('editQty').value);
  if (!name) { showToast('กรุณากรอกชื่อสินค้า', 'error'); return; }
  if (isNaN(qty) || qty < 0) { showToast('จำนวนต้องไม่ติดลบ', 'error'); return; }
  item.name = name; item.unit = unit || 'ชิ้น'; item.qty = qty;
  saveStock(); closeEditModal();
  showToast('แก้ไขเรียบร้อย', 'success');
  renderTabs(); renderCategory();
}

// ── Staff Management ──────────────────────────────────────────────
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
    row.innerHTML = `<span>${escHtml(email)}</span>
      <button class="remove-staff" title="ลบ">✕</button>`;
    row.querySelector('.remove-staff').addEventListener('click', () => {
      saveStaff(loadStaff().filter(e => e !== email));
      renderStaffModal();
      showToast(`ลบ ${email} แล้ว`, 'info');
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
  showToast(`เพิ่ม ${email} แล้ว`, 'success');
}

// ── Report & Gmail API ────────────────────────────────────────────
function generateExcel(date) {
  const rows = [['วันที่','หมวดหมู่','ชื่อสินค้า','จำนวน','หน่วย']];
  CATEGORIES.forEach(cat => {
    const items = stockData[cat.id] || [];
    if (items.length === 0) rows.push([date, cat.name, '-', 0, '-']);
    else items.forEach(i => rows.push([date, cat.name, i.name, i.qty, i.unit]));
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:12 },{ wch:16 },{ wch:24 },{ wch:10 },{ wch:10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'สต็อกสินค้า');
  return XLSX.write(wb, { type:'base64', bookType:'xlsx' });
}

function buildMimeEmail({ to, subject, bodyText, filename, fileBase64 }) {
  const boundary = `LBBQ_${Date.now()}`;
  const mime = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${base64EncodeUTF8(subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64EncodeUTF8(bodyText),
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
  return btoa(mime).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function sendViaGmail(accessToken, date) {
  const xlsxB64  = generateExcel(date);
  const filename = `stock-report-${date}.xlsx`;
  const bodyText = [
    `รายงานสต็อกประจำวัน: ${date}`,
    `ผู้ส่ง: ${currentUser.name} (${currentUser.email})`,
    '',
    ...CATEGORIES.map(c => {
      const items = stockData[c.id] || [];
      return `  ${c.name}: ${items.length} รายการ (รวม ${items.reduce((s,i)=>s+i.qty,0)})`;
    }),
    '', 'ดูรายละเอียดในไฟล์แนบ',
  ].join('\n');

  const raw = buildMimeEmail({
    to: ADMIN_EMAIL,
    subject: `รายงานสต็อก LamthongBBQ วันที่ ${date}`,
    bodyText, filename, fileBase64: xlsxB64,
  });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
}

function handleSaveReport() {
  if (!currentUser) return;
  const date = el('reportDate').value;
  if (!date) { showToast('กรุณาเลือกวันที่รายงาน', 'error'); return; }

  // Admin → download Excel
  if (currentUser.role === 'admin') {
    const b64 = generateExcel(date);
    const wb  = XLSX.read(b64, { type:'base64' });
    XLSX.writeFile(wb, `stock-report-${date}.xlsx`);
    showToast(`ดาวน์โหลดรายงาน ${date} เรียบร้อย`, 'success');
    return;
  }

  // Staff → send via Gmail API
  setSaving(true);
  tokenClient.callback = async tokenResponse => {
    if (tokenResponse.error) {
      showToast(`ไม่สามารถขอสิทธิ์ Gmail ได้: ${tokenResponse.error}`, 'error');
      setSaving(false);
      return;
    }
    try {
      await sendViaGmail(tokenResponse.access_token, date);
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

// ── Google Identity Services ──────────────────────────────────────
window.onGoogleLibLoaded = function () {
  google.accounts.id.initialize({
    client_id:             GOOGLE_CLIENT_ID,
    callback:              handleSignIn,
    auto_select:           false,
    cancel_on_tap_outside: false,
    error_callback:        handleGisError,
    use_fedcm_for_prompt:  false,
  });

  google.accounts.id.renderButton(el('gSignInBtn'), {
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
    callback:  () => {},
    error_callback: e => showToast(`Gmail: ${e.type} — ${e.message || ''}`, 'error'),
  });

  // Fallback: if button didn't render after 3s, show manual link
  setTimeout(() => {
    const btn = el('gSignInBtn');
    if (btn && !btn.querySelector('iframe,div[role]')) {
      btn.innerHTML = `<a href="https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(location.origin)}&response_type=token&scope=email+profile+openid" class="google-fallback-link">Sign in with Google ↗</a>`;
      showLoginError('ปุ่ม Google ไม่โหลด — กรุณาตรวจสอบว่าเพิ่ม ' + location.origin + ' ใน Authorized origins แล้ว');
    }
  }, 3000);
};

function handleGisError(error) {
  console.error('GIS error:', error);
  const msg = {
    'idpiframe_initialization_failed': 'เบราว์เซอร์บล็อก cookies — ลองปิด adblocker หรือเปลี่ยน browser',
    'popup_closed_by_user':            'ปิด popup ไปแล้ว — กรุณาลองใหม่',
    'popup_blocked_by_browser':        'Browser บล็อก popup — อนุญาต popup สำหรับเว็บนี้',
    'origin_mismatch':                 'Origin ไม่ตรง — กรุณาเพิ่ม ' + location.origin + ' ใน GCP Authorized origins',
    'access_denied':                   'ถูก deny — ตรวจสอบ OAuth consent screen และ test users',
  }[error.type] || `${error.type}: ${error.message || ''}`;
  showLoginError(msg);
}

function showLoginError(msg) {
  let errEl = el('loginError');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'loginError';
    errEl.style.cssText = 'color:#dc2626;font-size:.82rem;margin-top:12px;line-height:1.5;background:#fee2e2;padding:10px;border-radius:8px;text-align:left';
    el('gSignInBtn').after(errEl);
  }
  errEl.textContent = '⚠️ ' + msg;
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  loadStock();
  el('reportDate').value = new Date().toISOString().slice(0, 10);

  // Restore session
  try {
    const saved = JSON.parse(sessionStorage.getItem('bbqUser') || 'null');
    if (saved?.email && getRole(saved.email)) { currentUser = saved; showApp(); }
    else showLogin();
  } catch { showLogin(); }

  // Event listeners
  el('logoutBtn').addEventListener('click', logout);
  el('unauthorizedLogoutBtn').addEventListener('click', () => {
    google.accounts.id.disableAutoSelect(); showLogin();
  });
  el('saveReportBtn').addEventListener('click', handleSaveReport);

  el('saveEditBtn').addEventListener('click', saveEdit);
  el('cancelEditBtn').addEventListener('click', closeEditModal);
  el('editModal').addEventListener('click', e => { if (e.target === el('editModal')) closeEditModal(); });
  el('editQty').addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit(); });

  el('manageStaffBtn').addEventListener('click', () => { el('staffModal').classList.remove('hidden'); renderStaffModal(); });
  el('closeStaffModal').addEventListener('click', () => el('staffModal').classList.add('hidden'));
  el('staffModal').addEventListener('click', e => { if (e.target === el('staffModal')) el('staffModal').classList.add('hidden'); });
  el('addStaffBtn').addEventListener('click', addStaff);
  el('staffEmailInput').addEventListener('keydown', e => { if (e.key === 'Enter') addStaff(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeEditModal(); el('staffModal').classList.add('hidden'); }
  });
}

document.addEventListener('DOMContentLoaded', init);
