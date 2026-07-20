// ===========================
// GLOBAL STATE
// ===========================
let currentPage = 'dashboard';
let allProducts = [];
let allCategories = [];
let allLoadedOrders = [];

const API = '';

// ===========================
// INIT / AUTHENTICATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

function checkAuth() {
  const isAuth = sessionStorage.getItem('admin_authenticated') === 'true';
  const loginScreen = document.getElementById('admin-login-screen');
  const appContainer = document.getElementById('admin-app');

  if (isAuth) {
    if (loginScreen) loginScreen.style.setProperty('display', 'none', 'important');
    if (appContainer) appContainer.style.display = 'block';
    
    try {
      const user = JSON.parse(sessionStorage.getItem('admin_user'));
      if (user) {
        document.getElementById('admin-user-name').textContent = user.displayName || user.username;
        document.getElementById('admin-user-role').textContent = user.role === 'admin' ? 'Administrator' : 'Inventory Manager';
      }
    } catch (e) {}

    setupSidebar();
    navigateTo('dashboard');
  } else {
    if (loginScreen) loginScreen.style.setProperty('display', 'flex', 'important');
    if (appContainer) appContainer.style.display = 'none';
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json());

    if (res.success) {
      sessionStorage.setItem('admin_authenticated', 'true');
      sessionStorage.setItem('admin_user', JSON.stringify(res.user));
      showToast('Logged in successfully! Welcome.', 'success');
      checkAuth();
    } else {
      showToast(res.message || 'Authentication failed', 'error');
    }
  } catch (err) {
    showToast('Failed to authenticate with server', 'error');
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('admin_authenticated');
  sessionStorage.removeItem('admin_user');
  showToast('Logged out successfully', 'info');
  checkAuth();
}

function setupSidebar() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
      // Close on mobile
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

function navigateTo(page) {
  currentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show page
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  // Update topbar
  const titles = { dashboard: 'Dashboard', products: 'Products', categories: 'Categories', movements: 'Stock Movements', orders: 'Customer Orders', analytics: 'Analytics & Reports' };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  // Update add button
  const addBtn = document.getElementById('topbar-add-btn');
  if (page === 'categories') {
    addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Category`;
    addBtn.style.display = 'flex';
  } else if (page === 'products' || page === 'dashboard') {
    addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Product`;
    addBtn.style.display = 'flex';
  } else {
    addBtn.style.display = 'none';
  }

  // Load data
  if (page === 'dashboard') loadDashboard();
  else if (page === 'products') loadProducts();
  else if (page === 'categories') loadCategories();
  else if (page === 'movements') loadMovements();
  else if (page === 'orders') loadOrders();
  else if (page === 'analytics') loadAnalytics();
}

function handleTopbarAdd() {
  if (currentPage === 'categories') {
    openCategoryModal();
  } else {
    openProductModal();
  }
}

// ===========================
// API HELPERS
// ===========================
async function apiFetch(url, options = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return res.json();
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===========================
// MODAL HELPERS
// ===========================
function openModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('active');
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}

// Close on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ===========================
// DASHBOARD
// ===========================
async function loadDashboard() {
  try {
    const res = await apiFetch('/api/stats');
    if (!res.success) return;
    const { totalProducts, totalCategories, lowStock, totalValue, recentMovements, lowStockProducts } = res.data;

    document.getElementById('stat-total-products').textContent = totalProducts;
    document.getElementById('stat-categories').textContent = totalCategories;
    document.getElementById('stat-low-stock').textContent = lowStock;
    document.getElementById('stat-total-value').textContent = formatCurrency(totalValue);

    // Low stock badge
    const badge = document.getElementById('low-stock-badge');
    badge.style.display = lowStock > 0 ? 'inline' : 'none';
    badge.textContent = lowStock;

    // Low stock products
    const lsList = document.getElementById('low-stock-list');
    if (lowStockProducts.length === 0) {
      lsList.innerHTML = '<div class="empty-state-small">✅ All stock levels are healthy</div>';
    } else {
      lsList.innerHTML = lowStockProducts.map(p => `
        <div class="low-stock-item">
          <div class="ls-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div>
            <div class="ls-name">${escHtml(p.name)}</div>
            <div class="ls-sku">${escHtml(p.sku)} · ${escHtml(p.category_name || 'No category')}</div>
          </div>
          <div class="ls-qty">${p.quantity} ${escHtml(p.unit || 'pcs')}</div>
        </div>
      `).join('');
    }

    // Recent movements
    const rmList = document.getElementById('recent-movements-list');
    if (recentMovements.length === 0) {
      rmList.innerHTML = '<div class="empty-state-small">No movements recorded yet</div>';
    } else {
      rmList.innerHTML = recentMovements.map(m => {
        const icons = { in: '↑', out: '↓', set: '=', adjustment: '~' };
        return `
        <div class="movement-item">
          <div class="move-icon move-${m.type}">${icons[m.type] || '~'}</div>
          <div>
            <div class="move-name">${escHtml(m.product_name)}</div>
            <div class="move-time">${formatDate(m.created_at)}</div>
          </div>
          <div class="move-qty" style="color: ${m.type === 'in' ? 'var(--green)' : m.type === 'out' ? 'var(--red)' : 'var(--blue)'}">
            ${m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}${m.quantity}
          </div>
        </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

// ===========================
// PRODUCTS
// ===========================
async function loadProducts() {
  try {
    const [prodRes, catRes] = await Promise.all([
      apiFetch('/api/products'),
      apiFetch('/api/categories')
    ]);
    allProducts = prodRes.data || [];
    allCategories = catRes.data || [];
    populateCategoryFilter();
    renderProducts(allProducts);
  } catch (err) {
    showToast('Failed to load products', 'error');
  }
}

function populateCategoryFilter() {
  const filter = document.getElementById('category-filter');
  filter.innerHTML = '<option value="">All Categories</option>' +
    allCategories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
}

function filterProducts() {
  const search = document.getElementById('product-search').value.toLowerCase();
  const category = document.getElementById('category-filter').value;
  const status = document.getElementById('status-filter').value;
  const lowStock = document.getElementById('low-stock-filter').checked;

  let filtered = allProducts.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) &&
        !p.sku.toLowerCase().includes(search) &&
        !(p.supplier || '').toLowerCase().includes(search)) return false;
    if (category && String(p.category_id) !== category) return false;
    if (status && p.status !== status) return false;
    if (lowStock && p.quantity > p.low_stock_threshold) return false;
    return true;
  });

  renderProducts(filtered);
}

function renderProducts(products) {
  const tbody = document.getElementById('products-tbody');
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No products found.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const isLow = p.quantity > 0 && p.quantity <= p.low_stock_threshold;
    const isOut = p.quantity === 0;
    const stockClass = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok';
    const barPct = p.low_stock_threshold > 0 ? Math.min(100, (p.quantity / (p.low_stock_threshold * 2)) * 100) : 100;
    const barColor = isOut ? 'var(--red)' : isLow ? 'var(--orange)' : 'var(--green)';

    const thumbnailHtml = p.image_url 
      ? `<img src="${p.image_url}" class="admin-prod-thumb" alt="${escHtml(p.name)}" />`
      : `<div class="admin-prod-thumb-placeholder">📦</div>`;

    return `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${thumbnailHtml}
          <div>
            <div class="product-name">${escHtml(p.name)}</div>
            ${p.description ? `<div class="product-desc">${escHtml(p.description.slice(0, 50))}${p.description.length > 50 ? '...' : ''}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="sku-badge">${escHtml(p.sku)}</span></td>
      <td>${escHtml(p.category_name || '—')}</td>
      <td>${formatCurrency(p.price)}</td>
      <td>
        <div class="stock-cell">
          <span class="stock-num ${stockClass}">${p.quantity}</span>
          <span style="font-size:11px;color:var(--text-muted)">${escHtml(p.unit || 'pcs')}</span>
          <div class="stock-bar"><div class="stock-bar-fill" style="width:${barPct}%;background:${barColor}"></div></div>
        </div>
      </td>
      <td><span class="status-badge status-${p.status}">${p.status}</span></td>
      <td>
        <div class="action-group">
          <button class="btn-icon" title="Adjust Stock" onclick="openStockModal(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          </button>
          <button class="btn-icon" title="Edit" onclick="openProductModal(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon" title="Delete" onclick="confirmDeleteProduct(${p.id}, '${escHtml(p.name.replace(/'/g, "\\'"))}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--red)"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ===========================
// PRODUCT MODAL
// ===========================
async function openProductModal(productId = null) {
  // Ensure categories loaded
  if (allCategories.length === 0) {
    const res = await apiFetch('/api/categories');
    allCategories = res.data || [];
  }

  const catSelect = document.getElementById('p-category');
  catSelect.innerHTML = '<option value="">Select category</option>' +
    allCategories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  clearProductImage();

  if (productId) {
    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('product-save-btn').textContent = 'Update Product';
    try {
      const res = await apiFetch(`/api/products/${productId}`);
      const p = res.data;
      document.getElementById('product-id').value = p.id;
      document.getElementById('p-name').value = p.name;
      document.getElementById('p-sku').value = p.sku;
      document.getElementById('p-description').value = p.description || '';
      document.getElementById('p-category').value = p.category_id || '';
      document.getElementById('p-price').value = p.price;
      document.getElementById('p-cost').value = p.cost;
      document.getElementById('p-quantity').value = p.quantity;
      document.getElementById('p-threshold').value = p.low_stock_threshold;
      document.getElementById('p-unit').value = p.unit || '';
      document.getElementById('p-supplier').value = p.supplier || '';
      document.getElementById('p-location').value = p.location || '';
      document.getElementById('p-status').value = p.status;
      if (p.image_url) {
        document.getElementById('p-image-url').value = p.image_url;
        document.getElementById('p-image-preview').src = p.image_url;
        document.getElementById('p-image-preview-wrap').style.display = 'block';
      }
    } catch {}
  } else {
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-save-btn').textContent = 'Save Product';
    document.getElementById('p-threshold').value = '10';
    document.getElementById('p-unit').value = 'pcs';
    document.getElementById('p-status').value = 'active';
  }

  openModal('product-modal');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const data = {
    name: document.getElementById('p-name').value,
    sku: document.getElementById('p-sku').value,
    description: document.getElementById('p-description').value,
    category_id: document.getElementById('p-category').value || null,
    price: document.getElementById('p-price').value,
    cost: document.getElementById('p-cost').value,
    quantity: document.getElementById('p-quantity').value,
    low_stock_threshold: document.getElementById('p-threshold').value,
    unit: document.getElementById('p-unit').value,
    supplier: document.getElementById('p-supplier').value,
    location: document.getElementById('p-location').value,
    status: document.getElementById('p-status').value,
    image_url: document.getElementById('p-image-url').value
  };

  try {
    const res = await apiFetch(id ? `/api/products/${id}` : '/api/products', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });

    if (!res.success) { showToast(res.message, 'error'); return; }

    closeModal('product-modal');
    showToast(id ? 'Product updated!' : 'Product added!', 'success');
    loadProducts();
    if (currentPage === 'dashboard') loadDashboard();
  } catch (err) {
    showToast('Error saving product', 'error');
  }
}

// ===========================
// STOCK ADJUST MODAL
// ===========================
async function openStockModal(productId) {
  const res = await apiFetch(`/api/products/${productId}`);
  if (!res.success) { showToast('Product not found', 'error'); return; }
  const p = res.data;

  document.getElementById('stock-product-id').value = productId;
  document.getElementById('stock-product-info').innerHTML = `
    <div>
      <div class="spi-name">${escHtml(p.name)}</div>
      <div class="spi-sku">${escHtml(p.sku)}</div>
    </div>
    <div class="spi-qty">Current: <span>${p.quantity} ${escHtml(p.unit || 'pcs')}</span></div>
  `;
  document.getElementById('stock-quantity').value = '';
  document.getElementById('stock-note').value = '';
  document.querySelector('input[name="stock-type"][value="in"]').checked = true;

  openModal('stock-modal');
}

async function adjustStock(e) {
  e.preventDefault();
  const id = document.getElementById('stock-product-id').value;
  const type = document.querySelector('input[name="stock-type"]:checked').value;
  const quantity = document.getElementById('stock-quantity').value;
  const note = document.getElementById('stock-note').value;

  try {
    const res = await apiFetch(`/api/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ type, quantity, note })
    });

    if (!res.success) { showToast(res.message, 'error'); return; }

    closeModal('stock-modal');
    showToast('Stock updated!', 'success');
    loadProducts();
    if (currentPage === 'dashboard') loadDashboard();
  } catch (err) {
    showToast('Error adjusting stock', 'error');
  }
}

// ===========================
// DELETE PRODUCT
// ===========================
function confirmDeleteProduct(id, name) {
  document.getElementById('delete-message').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  document.getElementById('delete-confirm-btn').onclick = () => deleteProduct(id);
  openModal('delete-modal');
}

async function deleteProduct(id) {
  try {
    const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.success) { showToast(res.message, 'error'); return; }
    closeModal('delete-modal');
    showToast('Product deleted', 'info');
    loadProducts();
    loadDashboard();
  } catch {
    showToast('Error deleting product', 'error');
  }
}

// ===========================
// CATEGORIES
// ===========================
async function loadCategories() {
  try {
    const res = await apiFetch('/api/categories');
    allCategories = res.data || [];
    renderCategories(allCategories);
  } catch {
    showToast('Failed to load categories', 'error');
  }
}

const catIconMap = ['📦', '🔧', '💻', '👕', '🍎', '🏠', '🚗', '📚', '💊', '🎮', '⚡', '🎨'];

function renderCategories(categories) {
  const grid = document.getElementById('categories-grid');
  
  let gridHtml = `
    <div class="category-card add-category-card" onclick="openCategoryModal()" style="border: 2px dashed var(--border-hover); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px; cursor: pointer; text-align: center; gap: 12px; transition: all var(--transition);">
      <div class="add-cat-icon" style="font-size: 36px; background: rgba(79, 142, 247, 0.1); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--blue);">➕</div>
      <div class="cat-name" style="color: var(--blue); font-weight: 600;">Add New Category</div>
      <div class="cat-desc" style="font-size: 12px; color: var(--text-muted);">Create a new grouping for products</div>
    </div>
  `;

  if (categories.length > 0) {
    gridHtml += categories.map((c, i) => `
      <div class="category-card">
        <div class="cat-icon">${catIconMap[i % catIconMap.length]}</div>
        <div class="cat-name">${escHtml(c.name)}</div>
        ${c.description ? `<div class="cat-desc">${escHtml(c.description)}</div>` : ''}
        <div class="cat-count">${c.product_count} product${c.product_count !== 1 ? 's' : ''}</div>
        <div class="cat-actions">
          <button class="btn btn-ghost btn-sm" onclick="openCategoryModal(${c.id})">Edit</button>
          <button class="btn btn-sm" style="background:rgba(255,95,116,0.1);color:var(--red);border:1px solid rgba(255,95,116,0.2)" onclick="confirmDeleteCategory(${c.id}, '${escHtml(c.name.replace(/'/g, "\\'"))}')">Delete</button>
        </div>
      </div>
    `).join('');
  }
  
  grid.innerHTML = gridHtml;
}

async function openCategoryModal(categoryId = null) {
  document.getElementById('category-form').reset();
  document.getElementById('category-id').value = '';

  if (categoryId) {
    document.getElementById('category-modal-title').textContent = 'Edit Category';
    const cat = allCategories.find(c => c.id === categoryId);
    if (cat) {
      document.getElementById('category-id').value = cat.id;
      document.getElementById('c-name').value = cat.name;
      document.getElementById('c-description').value = cat.description || '';
    }
  } else {
    document.getElementById('category-modal-title').textContent = 'Add Category';
  }
  openModal('category-modal');
}

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('category-id').value;
  const data = {
    name: document.getElementById('c-name').value,
    description: document.getElementById('c-description').value
  };

  try {
    const res = await apiFetch(id ? `/api/categories/${id}` : '/api/categories', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });

    if (!res.success) { showToast(res.message, 'error'); return; }

    closeModal('category-modal');
    showToast(id ? 'Category updated!' : 'Category added!', 'success');
    loadCategories();
  } catch {
    showToast('Error saving category', 'error');
  }
}

function confirmDeleteCategory(id, name) {
  document.getElementById('delete-message').textContent = `Delete category "${name}"? Products in this category will not be deleted but will become uncategorized.`;
  document.getElementById('delete-confirm-btn').onclick = () => deleteCategory(id);
  openModal('delete-modal');
}

async function deleteCategory(id) {
  try {
    const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.success) { showToast(res.message, 'error'); return; }
    closeModal('delete-modal');
    showToast('Category deleted', 'info');
    loadCategories();
  } catch {
    showToast('Error deleting category', 'error');
  }
}

// ===========================
// MOVEMENTS
// ===========================
async function loadMovements() {
  try {
    const res = await apiFetch('/api/movements');
    const movements = res.data || [];
    const tbody = document.getElementById('movements-tbody');

    if (movements.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No stock movements recorded yet.</td></tr>';
      return;
    }

    const typeLabels = { in: 'Stock In', out: 'Stock Out', set: 'Set Quantity' };
    tbody.innerHTML = movements.map(m => `
      <tr>
        <td style="color:var(--text-secondary);font-size:13px">${formatDate(m.created_at)}</td>
        <td><span style="font-weight:600">${escHtml(m.product_name)}</span></td>
        <td><span class="sku-badge">${escHtml(m.sku)}</span></td>
        <td><span class="move-badge ${m.type}">${typeLabels[m.type] || m.type}</span></td>
        <td style="font-weight:700;color:${m.type === 'in' ? 'var(--green)' : m.type === 'out' ? 'var(--red)' : 'var(--blue)'}">
          ${m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}${m.quantity}
        </td>
        <td style="color:var(--text-secondary);font-size:13px">${escHtml(m.note || '—')}</td>
      </tr>
    `).join('');
  } catch {
    showToast('Failed to load movements', 'error');
  }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatCurrency(val) {
  if (!val && val !== 0) return '—';
  return 'Ksh ' + new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===========================
// PRODUCT IMAGE PREVIEW HELPERS
// ===========================
function previewImageFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64 = evt.target.result;
    document.getElementById('p-image-url').value = base64;
    const previewWrap = document.getElementById('p-image-preview-wrap');
    const previewImg = document.getElementById('p-image-preview');
    previewImg.src = base64;
    previewWrap.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function previewImageUrl(url) {
  const previewWrap = document.getElementById('p-image-preview-wrap');
  const previewImg = document.getElementById('p-image-preview');
  if (url.trim()) {
    previewImg.src = url.trim();
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
    previewImg.src = '';
  }
}

function clearProductImage() {
  document.getElementById('p-image-file').value = '';
  document.getElementById('p-image-url').value = '';
  document.getElementById('p-image-preview-wrap').style.display = 'none';
  document.getElementById('p-image-preview').src = '';
}

// ===========================
// ORDERS LOADING & RENDERING
// ===========================
async function loadOrders() {
  try {
    const res = await apiFetch('/api/admin/orders');
    const orders = res.data || [];
    allLoadedOrders = orders;
    const tbody = document.getElementById('orders-tbody');

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No orders recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => {
      let detailsHtml = '—';
      if (o.payment_details) {
        try {
          const details = JSON.parse(o.payment_details);
          if (o.payment_method.toLowerCase().includes('mpesa') || o.payment_method.toLowerCase().includes('m-pesa')) {
            detailsHtml = `<div>Phone: <strong>${escHtml(details.phone)}</strong></div>`;
          } else if (o.payment_method.toLowerCase().includes('bank')) {
            detailsHtml = `<div>From Acct: <strong>${escHtml(details.account)}</strong></div>`;
          } else {
            detailsHtml = escHtml(o.payment_details);
          }
        } catch {
          detailsHtml = escHtml(o.payment_details);
        }
      }

      // Parse purchased items
      let itemsHtml = '<span style="color:var(--text-muted);font-size:12px">—</span>';
      if (o.items) {
        try {
          const items = JSON.parse(o.items);
          if (Array.isArray(items) && items.length > 0) {
            itemsHtml = `<div class="order-items-list">${items.map(item => `
              <div class="order-item-entry">
                <span class="order-item-name">${escHtml(item.name)}</span>
                <span class="order-item-qty">×${item.qty}</span>
                <span class="order-item-price">${formatCurrency(item.price * item.qty)}</span>
              </div>
            `).join('')}</div>`;
          }
        } catch {
          itemsHtml = '<span style="color:var(--text-muted);font-size:12px">N/A</span>';
        }
      }

      return `
        <tr>
          <td><span class="sku-badge" style="background:rgba(155,107,255,0.1);color:var(--purple);border-color:rgba(155,107,255,0.2)">#${o.id}</span></td>
          <td style="color:var(--text-secondary);font-size:13px">${formatDate(o.created_at)}</td>
          <td><span style="font-weight:600">${escHtml(o.customer_name)}</span></td>
          <td><a href="tel:${escHtml(o.customer_phone)}" style="color:var(--blue);text-decoration:none;">${escHtml(o.customer_phone)}</a></td>
          <td>
            <span class="status-badge" style="background:${o.payment_method.toLowerCase().includes('mpesa') || o.payment_method.toLowerCase().includes('m-pesa') ? 'rgba(61,220,132,0.12)' : 'rgba(79,142,247,0.12)'};color:${o.payment_method.toLowerCase().includes('mpesa') || o.payment_method.toLowerCase().includes('m-pesa') ? 'var(--green)' : 'var(--blue)'};border:none;">
              ${escHtml(o.payment_method)}
            </span>
          </td>
          <td style="font-size:13px">${detailsHtml}</td>
          <td>${itemsHtml}</td>
          <td style="font-weight:700;color:var(--green)">${formatCurrency(o.total_amount)}</td>
          <td style="text-align:center;">
            <button class="btn btn-ghost btn-sm" onclick="printAdminOrderInvoice(${o.id})" style="padding: 4px 8px; font-size: 11px;">
              🖨️ Print
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch {
    showToast('Failed to load orders', 'error');
  }
}

// ===========================
// VISUAL ANALYTICS & REPORTS
// ===========================
async function loadAnalytics() {
  try {
    const res = await apiFetch('/api/analytics/stats');
    if (!res.success) {
      showToast('Failed to load analytics statistics', 'error');
      return;
    }
    
    const { totalSales, totalOrders, categoryBreakdown, salesTrend, topProducts } = res.data;
    
    document.getElementById('analytics-total-sales').textContent = formatCurrency(totalSales);
    document.getElementById('analytics-total-orders').textContent = totalOrders;
    
    const topTbody = document.getElementById('top-products-tbody');
    if (topProducts.length === 0) {
      topTbody.innerHTML = '<tr><td colspan="2" class="empty-row">No product sales data.</td></tr>';
    } else {
      topTbody.innerHTML = topProducts.map(p => `
        <tr>
          <td><span style="font-weight:600">${escHtml(p.name)}</span></td>
          <td style="text-align:right; font-weight:700; color:var(--purple)">${p.quantity} units</td>
        </tr>
      `).join('');
    }
    
    renderSalesTrendChart(salesTrend);
    renderCategoryDonutChart(categoryBreakdown);
    
  } catch (err) {
    showToast('Failed to connect to analytics service', 'error');
  }
}

function renderSalesTrendChart(trendData) {
  const container = document.getElementById('trend-chart-container');
  if (!trendData || trendData.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);">No sales trend data available</div>';
    return;
  }
  
  const maxSales = Math.max(...trendData.map(t => t.sales), 1);
  const containerHeight = 200;
  
  container.innerHTML = trendData.map(t => {
    const heightPx = (t.sales / maxSales) * containerHeight;
    const monthFormatted = t.month;
    
    return `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; position:relative;" class="chart-bar-group">
        <div class="chart-tooltip" style="position:absolute; bottom:${heightPx + 15}px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:4px; padding:4px 8px; font-size:10px; font-weight:700; color:white; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity 0.2s; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:10;">
          Ksh ${t.sales.toLocaleString('en-KE')}
        </div>
        <div style="width:100%; max-width:40px; height:${heightPx}px; background:linear-gradient(to top, var(--blue), var(--purple)); border-radius:4px 4px 0 0; cursor:pointer; transition:all 0.3s;" 
             onmouseover="this.previousElementSibling.style.opacity=1; this.style.filter='brightness(1.2)';" 
             onmouseout="this.previousElementSibling.style.opacity=0; this.style.filter='none';">
        </div>
        <span style="font-size:10px; color:var(--text-muted); margin-top:8px; font-weight:500;">${monthFormatted}</span>
      </div>
    `;
  }).join('');
}

function renderCategoryDonutChart(breakdown) {
  const chartEl = document.getElementById('category-donut-chart');
  const legendEl = document.getElementById('category-legend');
  
  if (!breakdown || breakdown.length === 0) {
    chartEl.innerHTML = '<circle cx="100" cy="100" r="70" fill="transparent" stroke="var(--border-color)" stroke-width="12"></circle><text x="100" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="10">No Sales</text>';
    legendEl.innerHTML = '<div style="color:var(--text-muted)">No category data</div>';
    return;
  }
  
  const colors = ['#3b82f6', '#a855f7', '#10b981', '#f97316', '#ef4444', '#eab308'];
  const total = breakdown.reduce((sum, item) => sum + item.sales, 0);
  const perimeter = 2 * Math.PI * 70;
  
  let currentOffset = 0;
  
  const segmentsHtml = breakdown.map((item, index) => {
    const pct = item.sales / total;
    const segmentLength = pct * perimeter;
    const strokeColor = colors[index % colors.length];
    const rotation = (currentOffset / perimeter) * 360 - 90;
    currentOffset += segmentLength;
    
    return `
      <circle cx="100" cy="100" r="70" fill="transparent" 
              stroke="${strokeColor}" stroke-width="14" 
              stroke-dasharray="${segmentLength} ${perimeter - segmentLength}" 
              transform="rotate(${rotation} 100 100)"
              style="transition: all 0.3s; cursor:pointer;"
              onmouseover="this.setAttribute('stroke-width', '18'); document.getElementById('donut-center-text').textContent = 'Ksh ${item.sales.toLocaleString(undefined, {maximumFractionDigits:0})}'; document.getElementById('donut-center-label').textContent = '${escHtml(item.category)}';"
              onmouseout="this.setAttribute('stroke-width', '14'); document.getElementById('donut-center-text').textContent = 'Ksh ${total.toLocaleString(undefined, {maximumFractionDigits:0})}'; document.getElementById('donut-center-label').textContent = 'Total Revenue';">
      </circle>
    `;
  }).join('');
  
  chartEl.innerHTML = `
    <circle cx="100" cy="100" r="70" fill="transparent" stroke="rgba(255,255,255,0.03)" stroke-width="14"></circle>
    ${segmentsHtml}
    <text x="100" y="98" id="donut-center-text" text-anchor="middle" fill="white" font-size="13" font-weight="700">Ksh ${total.toLocaleString(undefined, {maximumFractionDigits:0})}</text>
    <text x="100" y="116" id="donut-center-label" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="500">Total Revenue</text>
  `;
  
  legendEl.innerHTML = breakdown.map((item, index) => {
    const pct = ((item.sales / total) * 100).toFixed(1);
    const bulletColor = colors[index % colors.length];
    return `
      <div style="display:flex; align-items:center; gap:8px; justify-content:space-between; width:180px;">
        <div style="display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${bulletColor}; flex-shrink:0;"></span>
          <span style="color:var(--text-secondary); font-weight:500; overflow:hidden; text-overflow:ellipsis;">${escHtml(item.category)}</span>
        </div>
        <span style="color:white; font-weight:700;">${pct}%</span>
      </div>
    `;
  }).join('');
}

async function exportCSV(type) {
  try {
    if (type === 'products') {
      const res = await apiFetch('/api/products');
      if (!res.success || !res.data) { showToast('No product data available', 'error'); return; }
      
      const headers = ['Product ID', 'Name', 'SKU', 'Category', 'Unit Price (Ksh)', 'Initial Quantity', 'Supplier', 'Location', 'Status'];
      const rows = res.data.map(p => [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.category_name || 'Uncategorized',
        p.price,
        p.quantity,
        `"${(p.supplier || '').replace(/"/g, '""')}"`,
        p.location || 'N/A',
        p.status
      ]);
      
      downloadCSVFile('sama_products_report.csv', [headers, ...rows]);
      showToast('Product inventory report downloaded successfully!', 'success');
      
    } else if (type === 'sales') {
      const res = await apiFetch('/api/admin/orders');
      if (!res.success || !res.data) { showToast('No sales records available', 'error'); return; }
      
      const headers = ['Order ID', 'Date', 'Customer Name', 'Customer Phone', 'Payment Method', 'Purchased Items', 'Total Amount (Ksh)'];
      const rows = res.data.map(o => {
        let itemsDesc = '';
        try {
          const items = JSON.parse(o.items || '[]');
          itemsDesc = items.map(i => `${i.qty}x ${i.name}`).join('; ');
        } catch(e) {
          itemsDesc = 'N/A';
        }
        
        return [
          o.id,
          o.created_at,
          `"${o.customer_name.replace(/"/g, '""')}"`,
          o.customer_phone,
          o.payment_method,
          `"${itemsDesc.replace(/"/g, '""')}"`,
          o.total_amount
        ];
      });
      
      downloadCSVFile('sama_sales_report.csv', [headers, ...rows]);
      showToast('Sales transaction report downloaded successfully!', 'success');
    }
  } catch (err) {
    showToast('Failed to generate export report', 'error');
  }
}

function downloadCSVFile(filename, rows) {
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printAdminOrderInvoice(orderId) {
  const order = allLoadedOrders.find(o => o.id === orderId);
  if (!order) {
    showToast('Order details not found', 'error');
    return;
  }
  
  let parsedItems = [];
  try {
    parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  } catch (e) {}
  
  const formattedOrder = {
    id: `SAMA-${String(order.id).padStart(4, '0')}`,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    table: order.payment_details && order.payment_details.includes('Address') ? order.payment_details : 'Central Office/Storefront Order',
    payment_method: order.payment_method,
    created_at: order.created_at,
    items: parsedItems,
    total_amount: order.total_amount
  };
  
  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) {
    showToast('Pop-up blocked! Please allow pop-ups to print invoices.', 'error');
    return;
  }
  
  let itemsRows = '';
  let subtotal = 0;
  
  if (Array.isArray(formattedOrder.items)) {
    formattedOrder.items.forEach(item => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      itemsRows += `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${escHtml(item.name)}</td>
          <td style="text-align: center; padding: 6px 0; border-bottom: 1px solid #eee;">${item.qty}</td>
          <td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #eee;">Ksh ${item.price.toLocaleString('en-KE', {minimumFractionDigits: 2})}</td>
          <td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #eee;">Ksh ${itemTotal.toLocaleString('en-KE', {minimumFractionDigits: 2})}</td>
        </tr>
      `;
    });
  }
  
  const tax = subtotal * 0.16;
  const total = subtotal + tax;
  
  const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sama Hardware Admin - Invoice #${formattedOrder.id}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          color: #333;
          padding: 30px;
          line-height: 1.4;
          font-size: 14px;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #ccc;
          padding-bottom: 15px;
          margin-bottom: 15px;
        }
        .logo {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .logo span {
          color: #2563eb;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 25px;
          font-size: 13px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        th {
          border-bottom: 2px solid #ccc;
          padding: 8px 0;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          font-weight: 700;
        }
        .totals {
          border-top: 2px dashed #ccc;
          padding-top: 12px;
          margin-top: 12px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
        }
        .totals-row.grand {
          font-size: 16px;
          font-weight: 700;
          border-top: 1px solid #ddd;
          padding-top: 10px;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 50px;
          font-size: 11px;
          color: #888;
          border-top: 1px solid #eee;
          padding-top: 15px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 25px; text-align: right;">
        <button onclick="window.print();" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size:13px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);">🖨️ Print Invoice</button>
        <button onclick="window.close();" style="padding: 10px 20px; background: #eee; border: 1px solid #ccc; border-radius: 6px; margin-left: 10px; cursor: pointer; font-size:13px;">Close</button>
      </div>
      <div class="header">
        <div class="logo"><span>SAMA</span> HARDWARE</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Hardware Central Administration Board</div>
        <div style="font-size: 11px; color: #888;">Nairobi, Kenya | Tel: +254 700 111 222</div>
      </div>
      <div class="meta-grid">
        <div>
          <strong style="color:#555">BILL TO:</strong><br>
          <span style="font-size:15px; font-weight:700;">${escHtml(formattedOrder.customer_name)}</span><br>
          Tel: ${escHtml(formattedOrder.customer_phone)}<br>
          Details: ${escHtml(formattedOrder.table)}
        </div>
        <div style="text-align: right;">
          <strong style="color:#555">INVOICE DETAILS:</strong><br>
          Invoice No: <strong>#${formattedOrder.id}</strong><br>
          Date: ${new Date(formattedOrder.created_at).toLocaleString('en-KE')}<br>
          Payment Channel: ${escHtml(formattedOrder.payment_method)}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Item Description</th>
            <th style="text-align: center; width: 60px;">Qty</th>
            <th style="text-align: right; width: 100px;">Price</th>
            <th style="text-align: right; width: 120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>Ksh ${subtotal.toLocaleString('en-KE', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="totals-row">
          <span>VAT (16%)</span>
          <span>Ksh ${tax.toLocaleString('en-KE', {minimumFractionDigits: 2})}</span>
        </div>
        <div class="totals-row grand">
          <span>Total Invoice Amount</span>
          <span>Ksh ${total.toLocaleString('en-KE', {minimumFractionDigits: 2})}</span>
        </div>
      </div>
      <div class="footer">
        <strong>Thank you for doing business with Sama Hardware!</strong><br>
        This is a computer generated official invoice and does not require signature.<br>
        Sama Hardware &copy; 2026
      </div>
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => { window.print(); }, 500);
        });
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
}
