const loginOverlay = document.getElementById('loginOverlay');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginStatus = document.getElementById('loginStatus');
const roleLabel = document.getElementById('roleLabel');
const reportDateInput = document.getElementById('reportDate');
const saveReportBtn = document.getElementById('saveReportBtn');
const categoryTabs = document.getElementById('categoryTabs');
const categoryView = document.getElementById('categoryView');
const categoryTemplate = document.getElementById('categoryTemplate');
const itemTemplate = document.getElementById('itemTemplate');

const adminEmail = 'admin@bbq.com';
const users = [
  { email: 'admin@bbq.com', password: 'admin123', role: 'admin', name: 'ผู้ดูแลระบบ' },
  { email: 'staff@bbq.com', password: 'staff123', role: 'employee', name: 'พนักงาน' }
];

const defaultCategories = [
  { id: 'meat', name: 'เนื้อสัตว์', items: [] },
  { id: 'veg', name: 'ผัก', items: [] },
  { id: 'kitchen', name: 'ของใช้ในครัว', items: [] },
  { id: 'general', name: 'ของใช้ทั่วไป', items: [] }
];

let categories = [];
let currentCategoryId = 'meat';
let currentUser = null;

function loadCategories() {
  const raw = localStorage.getItem('bbqStockData');
  if (!raw) {
    categories = JSON.parse(JSON.stringify(defaultCategories));
    saveCategories();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('invalid data');
    categories = defaultCategories.map(defaultCat => {
      const saved = parsed.find(cat => cat.id === defaultCat.id);
      return {
        ...defaultCat,
        items: Array.isArray(saved?.items) ? saved.items : []
      };
    });
  } catch {
    categories = JSON.parse(JSON.stringify(defaultCategories));
  }
}

function saveCategories() {
  localStorage.setItem('bbqStockData', JSON.stringify(categories));
}

function loadUser() {
  const raw = sessionStorage.getItem('bbqUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveUser(user) {
  sessionStorage.setItem('bbqUser', JSON.stringify(user));
}

function clearUser() {
  sessionStorage.removeItem('bbqUser');
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function updateHeader() {
  if (!currentUser) {
    loginStatus.textContent = 'กรุณาเข้าสู่ระบบเพื่อใช้งาน';
    roleLabel.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    logoutBtn.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
  } else {
    loginStatus.textContent = `เข้าสู่ระบบเป็น ${currentUser.name} (${currentUser.email})`;
    roleLabel.textContent = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
    logoutBtn.classList.remove('hidden');
    loginOverlay.classList.add('hidden');
  }
}

function selectCategory(categoryId) {
  currentCategoryId = categoryId;
  renderTabs();
  renderCategoryView();
}

function renderTabs() {
  categoryTabs.innerHTML = '';
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-btn';
    if (category.id === currentCategoryId) button.classList.add('active');
    button.innerHTML = `<strong>${category.name}</strong><span>${category.items.length} รายการ</span>`;
    button.addEventListener('click', () => selectCategory(category.id));
    categoryTabs.appendChild(button);
  });
}

function renderCategoryView() {
  categoryView.innerHTML = '';
  const category = categories.find(cat => cat.id === currentCategoryId);
  if (!category) return;
  const clone = categoryTemplate.content.cloneNode(true);
  const title = clone.querySelector('.category-title');
  const summary = clone.querySelector('.category-summary');
  const itemsWrapper = clone.querySelector('.items');
  const addItemBtn = clone.querySelector('.addItemBtn');
  const addItemForm = clone.querySelector('.add-item-form');
  const itemNameInput = clone.querySelector('.itemNameInput');
  const itemUnitInput = clone.querySelector('.itemUnitInput');
  const itemQtyInput = clone.querySelector('.itemQtyInput');
  const saveItemBtn = clone.querySelector('.saveItemBtn');
  const cancelItemBtn = clone.querySelector('.cancelItemBtn');

  title.textContent = category.name;
  summary.textContent = `มี ${category.items.length} รายการ`;

  if (!currentUser || currentUser.role !== 'admin') addItemBtn.classList.add('hidden');

  addItemBtn.addEventListener('click', () => {
    addItemForm.classList.toggle('hidden');
    if (!addItemForm.classList.contains('hidden')) itemNameInput.focus();
  });

  saveItemBtn.addEventListener('click', () => {
    const name = itemNameInput.value.trim();
    const qty = Number(itemQtyInput.value);
    const unit = itemUnitInput.value.trim() || 'ชิ้น';
    if (!name) {
      alert('กรุณากรอกชื่อรายการ');
      return;
    }
    if (qty < 0 || Number.isNaN(qty)) {
      alert('จำนวนต้องเป็นตัวเลขไม่ติดลบ');
      return;
    }
    category.items.push({ id: crypto.randomUUID(), name, qty, unit });
    saveCategories();
    renderTabs();
    renderCategoryView();
  });

  cancelItemBtn.addEventListener('click', () => {
    addItemForm.classList.add('hidden');
  });

  if (category.items.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'ยังไม่มีรายการในหมวดนี้';
    emptyMessage.style.color = '#475569';
    itemsWrapper.appendChild(emptyMessage);
  }

  category.items.forEach(item => {
    const itemClone = itemTemplate.content.cloneNode(true);
    const itemName = itemClone.querySelector('.item-name');
    const itemUnit = itemClone.querySelector('.item-unit');
    const itemQty = itemClone.querySelector('.item-qty');
    const incBtn = itemClone.querySelector('.qtyBtn.inc');
    const decBtn = itemClone.querySelector('.qtyBtn.dec');
    const deleteBtn = itemClone.querySelector('.deleteItemBtn');
    const editBtn = itemClone.querySelector('.editItemBtn');

    itemName.textContent = item.name;
    itemUnit.textContent = item.unit;
    itemQty.textContent = item.qty;

    incBtn.addEventListener('click', () => {
      item.qty += 1;
      saveCategories();
      renderTabs();
      renderCategoryView();
    });

    decBtn.addEventListener('click', () => {
      if (item.qty > 0) {
        item.qty -= 1;
        saveCategories();
        renderTabs();
        renderCategoryView();
      }
    });

    if (currentUser && currentUser.role === 'admin') {
      editBtn.addEventListener('click', () => {
        const newName = prompt('แก้ไขชื่อรายการ', item.name);
        if (newName !== null) item.name = newName.trim() || item.name;
        const newUnit = prompt('แก้ไขหน่วย', item.unit);
        if (newUnit !== null) item.unit = newUnit.trim() || item.unit;
        const newQty = prompt('แก้ไขจำนวน', String(item.qty));
        const numberQty = Number(newQty);
        if (!Number.isNaN(numberQty) && numberQty >= 0) item.qty = numberQty;
        saveCategories();
        renderTabs();
        renderCategoryView();
      });
      deleteBtn.addEventListener('click', () => {
        if (confirm(`ลบรายการ "${item.name}" ?`)) {
          category.items = category.items.filter(i => i.id !== item.id);
          saveCategories();
          renderTabs();
          renderCategoryView();
        }
      });
    } else {
      editBtn.classList.add('hidden');
      deleteBtn.classList.add('hidden');
    }

    itemsWrapper.appendChild(itemClone);
  });

  categoryView.appendChild(clone);
}

function generateReportCsv(date) {
  const rows = [['วันที่', 'หมวดหมู่', 'ชื่อสินค้า', 'จำนวน', 'หน่วย']];
  categories.forEach(category => {
    if (category.items.length === 0) {
      rows.push([date, category.name, '-', '0', '-']);
      return;
    }
    category.items.forEach(item => {
      rows.push([date, category.name, item.name, String(item.qty), item.unit]);
    });
  });
  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function saveReport() {
  if (!currentUser) {
    alert('กรุณาเข้าสู่ระบบก่อนบันทึกรายงาน');
    return;
  }
  const date = reportDateInput.value;
  if (!date) {
    alert('กรุณาเลือกวันที่รายงาน');
    return;
  }
  const csv = generateReportCsv(date);
  const filename = `stock-report-${date}.csv`;
  downloadCsv(csv, filename);
  const mailSubject = encodeURIComponent(`รายงานสต็อกประจำวัน ${date}`);
  const mailBody = encodeURIComponent(
    `สวัสดีผู้ดูแลระบบ,%0D%0A%0D%0Aไฟล์รายงานสต็อกประจำวัน ${date} ถูกสร้างแล้ว กรุณาแนบไฟล์ ${filename} และส่งให้ผู้ดูแลระบบตามอีเมลนี้.%0D%0A%0D%0Aผู้ใช้: ${currentUser.name} (${currentUser.email})%0D%0A%0D%0Aขอบคุณครับ/ค่ะ`
  );
  window.open(`mailto:${adminEmail}?subject=${mailSubject}&body=${mailBody}`, '_blank');
  alert('สร้างไฟล์รายงานแล้ว ระบบจะเปิดอีเมลให้คุณส่งต่อไปยังผู้ดูแลระบบ');
}

function login() {
  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value.trim();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    return;
  }
  currentUser = { ...user };
  saveUser(currentUser);
  updateHeader();
  renderTabs();
  renderCategoryView();
}

function logout() {
  currentUser = null;
  clearUser();
  updateHeader();
  renderTabs();
  categoryView.innerHTML = '';
}

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
saveReportBtn.addEventListener('click', saveReport);

reportDateInput.value = getToday();
loadCategories();
currentUser = loadUser();
updateHeader();
renderTabs();
if (currentUser) renderCategoryView();
