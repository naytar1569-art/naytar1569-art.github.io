const categoryCountEl = document.getElementById('categoryCount');
const itemCountEl = document.getElementById('itemCount');
const categoriesEl = document.getElementById('categories');
const newCategoryBtn = document.getElementById('newCategoryBtn');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const categoryNameInput = document.getElementById('categoryNameInput');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const cancelBtn = document.getElementById('cancelBtn');
const categoryTemplate = document.getElementById('categoryTemplate');

let categories = [];
let editingCategoryId = null;

function loadData() {
  const raw = localStorage.getItem('stockCategories');
  categories = raw ? JSON.parse(raw) : [
    { id: crypto.randomUUID(), name: 'หมวดเครื่องดื่ม', items: [] },
    { id: crypto.randomUUID(), name: 'หมวดของกิน', items: [] },
    { id: crypto.randomUUID(), name: 'หมวดอุปกรณ์', items: [] },
    { id: crypto.randomUUID(), name: 'หมวดอื่นๆ', items: [] }
  ];
}

function saveData() {
  localStorage.setItem('stockCategories', JSON.stringify(categories));
}

function render() {
  categoriesEl.innerHTML = '';
  let totalItems = 0;

  categories.forEach(category => {
    const clone = categoryTemplate.content.cloneNode(true);
    const title = clone.querySelector('.category-title');
    const summary = clone.querySelector('.category-summary');
    const itemsWrapper = clone.querySelector('.items');
    const addItemBtn = clone.querySelector('.addItemBtn');
    const deleteCategoryBtn = clone.querySelector('.deleteCategoryBtn');
    const addItemForm = clone.querySelector('.add-item-form');
    const itemNameInput = clone.querySelector('.itemNameInput');
    const itemQtyInput = clone.querySelector('.itemQtyInput');
    const itemUnitInput = clone.querySelector('.itemUnitInput');
    const saveItemBtn = clone.querySelector('.saveItemBtn');
    const cancelItemBtn = clone.querySelector('.cancelItemBtn');

    title.textContent = category.name;
    summary.textContent = `${category.items.length} รายการ`;

    category.items.forEach(item => {
      const itemCard = document.createElement('div');
      itemCard.className = 'item-card';
      itemCard.innerHTML = `
        <div class="item-row">
          <strong>${item.name}</strong>
          <span>${item.qty} ${item.unit}</span>
        </div>
        <div class="item-row item-actions">
          <button data-action="dec" data-category="${category.id}" data-item="${item.id}">- ลด</button>
          <button data-action="inc" data-category="${category.id}" data-item="${item.id}">+ เพิ่ม</button>
          <button data-action="edit" data-category="${category.id}" data-item="${item.id}" class="secondary">แก้ไข</button>
          <button data-action="remove" data-category="${category.id}" data-item="${item.id}" class="secondary">ลบ</button>
        </div>
      `;
      itemsWrapper.appendChild(itemCard);
      totalItems += 1;
    });

    addItemBtn.addEventListener('click', () => {
      addItemForm.classList.toggle('hidden');
      if (!addItemForm.classList.contains('hidden')) {
        itemNameInput.focus();
      }
    });

    deleteCategoryBtn.addEventListener('click', () => {
      if (confirm(`ลบหมวดหมู่ \"${category.name}\" ?`)) {
        categories = categories.filter(c => c.id !== category.id);
        saveData();
        render();
      }
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
      saveData();
      render();
    });

    cancelItemBtn.addEventListener('click', () => {
      addItemForm.classList.add('hidden');
    });

    itemsWrapper.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const action = button.dataset.action;
      const categoryId = button.dataset.category;
      const itemId = button.dataset.item;
      const targetCategory = categories.find(c => c.id === categoryId);
      if (!targetCategory) return;
      const targetItem = targetCategory.items.find(i => i.id === itemId);
      if (!targetItem) return;

      if (action === 'inc') {
        targetItem.qty += 1;
      } else if (action === 'dec') {
        if (targetItem.qty > 0) targetItem.qty -= 1;
      } else if (action === 'remove') {
        if (confirm(`ลบรายการ \"${targetItem.name}\" ?`)) {
          targetCategory.items = targetCategory.items.filter(i => i.id !== itemId);
        }
      } else if (action === 'edit') {
        const newName = prompt('แก้ไขชื่อรายการ', targetItem.name);
        if (newName !== null) {
          const newQty = prompt('แก้ไขจำนวน', String(targetItem.qty));
          const newUnit = prompt('แก้ไขหน่วย', targetItem.unit);
          if (newName.trim()) targetItem.name = newName.trim();
          const q = Number(newQty);
          if (!Number.isNaN(q) && q >= 0) targetItem.qty = q;
          if (newUnit !== null && newUnit.trim()) targetItem.unit = newUnit.trim();
        }
      }

      saveData();
      render();
    });

    categoriesEl.appendChild(clone);
  });

  categoryCountEl.textContent = categories.length;
  itemCountEl.textContent = totalItems;
}

newCategoryBtn.addEventListener('click', () => {
  editingCategoryId = null;
  modalTitle.textContent = 'เพิ่มหมวดหมู่ใหม่';
  categoryNameInput.value = '';
  modal.classList.remove('hidden');
  categoryNameInput.focus();
});

saveCategoryBtn.addEventListener('click', () => {
  const name = categoryNameInput.value.trim();
  if (!name) {
    alert('กรุณากรอกชื่อหมวดหมู่');
    return;
  }

  categories.push({ id: crypto.randomUUID(), name, items: [] });
  saveData();
  modal.classList.add('hidden');
  render();
});

cancelBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
});

window.addEventListener('click', event => {
  if (event.target === modal) {
    modal.classList.add('hidden');
  }
});

loadData();
render();
