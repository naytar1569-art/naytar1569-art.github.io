// ============================================================
//  LamthongBBQ Stock Management System
// ============================================================

const ADMIN_EMAIL = 'naytar1569@gmail.com';

const USERS = {
  'Admin@2025': { name: 'เจ้าของร้าน',    role: 'admin' },
  'Staff@01':   { name: 'พนักงานคนที่ 1', role: 'employee' },
  'Staff@02':   { name: 'พนักงานคนที่ 2', role: 'employee' },
};

const CATEGORIES = [
  { id: 'meat',    name: 'เนื้อสัตว์' },
  { id: 'veg',     name: 'ผัก' },
  { id: 'kitchen', name: 'ของใช้ในครัว' },
  { id: 'general', name: 'ของใช้ทั่วไป' },
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
    const raw = localStorage.getItem('bbqStock_v2');
    if (raw) {
      const p = JSON.parse(raw);
      CATEGORIES.forEach(c => { stockData[c.id] = Array.isArray(p[c.id]) ? p[c.id] : []; });
      return;
    }
  } catch { /* ignore */ }
  CATEGORIES.forEach(c => { stockData[c.id] = []; });
}

function saveStock() { localStorage.setItem('bbqStock_v2', JSON.stringify(stockData)); }

// ── Auth ─────────────────────────────────────────────────────────
function handleLogin() {
  const code = el('passcodeInput').value;
  const user = USERS[code];
  if (!user) {
    const errEl = el('loginError');
    errEl.textContent = 'รหัสผ่านไม่ถูกต้อง';
    errEl.classList.remove('hidden');
    el('passcodeInput').value = '';
    el('passcodeInput').focus();
    return;
  }
  el('loginError').classList.add('hidden');
  currentUser = { name: user.name, role: user.role };
  sessionStorage.setItem('bbqUser', JSON.stringify(currentUser));
  showApp();
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('bbqUser');
  el('passcodeInput').value = '';
  showLogin();
}

// ── UI State ─────────────────────────────────────────────────────
function showLogin() {
  el('loginOverlay').classList.remove('hidden');
  el('appHeader').classList.add('hidden');
  el('appContent').classList.add('hidden');
}

function showApp() {
  el('loginOverlay').classList.add('hidden');
  el('appHeader').classList.remove('hidden');
  el('appContent').classList.remove('hidden');

  el('userAvatar').classList.add('hidden');
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

// ── Passcode Modal (admin) ────────────────────────────────────────
function renderStaffModal() {
  el('staffList').innerHTML = `
    <div class="passcode-list">
      <div class="passcode-item">
        <span class="passcode-role">เจ้าของร้าน</span>
        <code class="passcode-code">Admin@2025</code>
      </div>
      <div class="passcode-item">
        <span class="passcode-role">พนักงานคนที่ 1</span>
        <code class="passcode-code">Staff@01</code>
      </div>
      <div class="passcode-item">
        <span class="passcode-role">พนักงานคนที่ 2</span>
        <code class="passcode-code">Staff@02</code>
      </div>
    </div>
  `;
}

// ── Report ────────────────────────────────────────────────────────
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

async function handleSaveReport() {
  if (!currentUser) return;
  const date = el('reportDate').value;
  if (!date) { showToast('กรุณาเลือกวันที่รายงาน', 'error'); return; }

  const b64      = generateExcel(date);
  const filename = `stock-report-${date}.xlsx`;
  const wb       = XLSX.read(b64, { type: 'base64' });
  XLSX.writeFile(wb, filename);

  if (currentUser.role === 'admin') {
    showToast(`ดาวน์โหลดรายงาน ${date} เรียบร้อย`, 'success');
    return;
  }

  // Staff: build summary text
  const summaryText = [
    `รายงานสต็อก LamthongBBQ วันที่ ${date}`,
    `ผู้ส่ง: ${currentUser.name}`,
    '',
    ...CATEGORIES.map(c => {
      const items = stockData[c.id] || [];
      return `${c.name}: ${items.length} รายการ`;
    }),
  ].join('\n');

  // Try Web Share API (mobile Chrome/Safari supports file sharing)
  if (navigator.share) {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file  = new File([bytes], filename, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `รายงานสต็อก ${date}`, text: summaryText });
        showToast('แชร์รายงานเรียบร้อย', 'success');
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: open mailto
  const subject = encodeURIComponent(`รายงานสต็อก LamthongBBQ วันที่ ${date}`);
  const body    = encodeURIComponent(summaryText + '\n\n(ดูรายละเอียดในไฟล์ Excel ที่ดาวน์โหลด)');
  window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  showToast('ดาวน์โหลดไฟล์แล้ว — กรุณาแนบไฟล์ในอีเมลที่เปิด', 'info', 6000);
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  loadStock();
  el('reportDate').value = new Date().toISOString().slice(0, 10);

  // Restore session
  try {
    const saved = JSON.parse(sessionStorage.getItem('bbqUser') || 'null');
    if (saved?.name && saved?.role && ['admin','employee'].includes(saved.role)) {
      currentUser = saved;
      showApp();
    } else {
      showLogin();
    }
  } catch { showLogin(); }

  // Login
  el('loginBtn').addEventListener('click', handleLogin);
  el('passcodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // App controls
  el('logoutBtn').addEventListener('click', logout);
  el('saveReportBtn').addEventListener('click', handleSaveReport);

  // Edit modal
  el('saveEditBtn').addEventListener('click', saveEdit);
  el('cancelEditBtn').addEventListener('click', closeEditModal);
  el('editModal').addEventListener('click', e => { if (e.target === el('editModal')) closeEditModal(); });
  el('editQty').addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit(); });

  // Passcode modal (admin)
  el('manageStaffBtn').addEventListener('click', () => {
    el('staffModal').classList.remove('hidden');
    renderStaffModal();
  });
  el('closeStaffModal').addEventListener('click', () => el('staffModal').classList.add('hidden'));
  el('staffModal').addEventListener('click', e => {
    if (e.target === el('staffModal')) el('staffModal').classList.add('hidden');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEditModal();
      el('staffModal').classList.add('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
