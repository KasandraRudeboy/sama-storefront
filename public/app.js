// ===========================
// GLOBAL STATE & STORE DATA
// ===========================
let storeProducts = [];
let storeCategories = [];
let activeCategory = '';
let cart = JSON.parse(localStorage.getItem('sama_cart')) || [];
let lastPlacedOrder = null;

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  loadStoreData();
  updateCartBadge();
  
  const printBtn = document.getElementById('print-storefront-receipt-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (lastPlacedOrder) {
        printStorefrontOrderInvoice(lastPlacedOrder);
      } else {
        showToast('No transaction details available to print', 'error');
      }
    });
  }
});

// ===========================
// API DATA LOADING
// ===========================
async function loadStoreData() {
  try {
    const [prodRes, catRes] = await Promise.all([
      fetch('/api/products?status=active').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]);

    if (prodRes.success) storeProducts = prodRes.data;
    if (catRes.success) storeCategories = catRes.data;

    renderCategoryFilters();
    renderStoreProducts();
  } catch (err) {
    showToast('Failed to connect to the store server', 'error');
  }
}

// ===========================
// RENDERING CATEGORIES
// ===========================
function renderCategoryFilters() {
  const container = document.getElementById('store-category-filters');
  
  let html = `<button class="cat-pill ${activeCategory === '' ? 'active' : ''}" onclick="selectStoreCategory('')">All Products</button>`;
  
  storeCategories.forEach(cat => {
    if (cat.product_count > 0) {
      html += `<button class="cat-pill ${String(cat.id) === String(activeCategory) ? 'active' : ''}" onclick="selectStoreCategory('${cat.id}')">
        ${escHtml(cat.name)}
      </button>`;
    }
  });
  
  container.innerHTML = html;
}

function selectStoreCategory(catId) {
  activeCategory = catId;
  renderCategoryFilters();
  filterStoreProducts();
}

// ===========================
// FILTER & SEARCH PRODUCTS
// ===========================
function filterStoreProducts() {
  const searchVal = document.getElementById('store-search').value.toLowerCase();
  
  const filtered = storeProducts.filter(p => {
    if (activeCategory && String(p.category_id) !== String(activeCategory)) return false;
    if (searchVal && !p.name.toLowerCase().includes(searchVal) && 
        !p.sku.toLowerCase().includes(searchVal) && 
        !(p.description || '').toLowerCase().includes(searchVal)) return false;
    return true;
  });
  
  renderFilteredProducts(filtered);
}

// ===========================
// RENDERING PRODUCT CATALOG
// ===========================
function renderStoreProducts() {
  renderFilteredProducts(storeProducts);
}

const emojiMap = ['📦', '📱', '💻', '🎧', '👟', '👕', '🕶️', '⚡', '☕', '🎁', '🍕', '🍰'];

function renderFilteredProducts(products) {
  const grid = document.getElementById('store-products-grid');
  
  if (products.length === 0) {
    grid.innerHTML = `
      <div class="store-loading">
        <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
        <p>No products found matching the criteria.</p>
      </div>`;
    return;
  }
  
  const likedList = JSON.parse(localStorage.getItem('sama_likes')) || [];
  const userRatings = JSON.parse(localStorage.getItem('sama_ratings')) || {};

  grid.innerHTML = products.map((p, idx) => {
    const isOut = p.quantity <= 0;
    const isLow = p.quantity > 0 && p.quantity <= p.low_stock_threshold;
    
    const stockText = isOut ? 'Out of Stock' : isLow ? `Only ${p.quantity} left!` : 'In Stock';
    const stockClass = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-in';
    const cardClickable = !isOut ? `onclick="openProductDetail(${p.id})"` : '';

    const avgRating = Math.round(p.rating || 0);
    let starsHtml = '';
    for (let star = 1; star <= 5; star++) {
      starsHtml += `<span class="star-display ${star <= avgRating ? 'active' : ''}">★</span>`;
    }

    const isLiked = likedList.includes(p.id);
    const heartIcon = isLiked ? '❤️' : '🤍';

    const emoji = emojiMap[p.id % emojiMap.length];
    const imageHtml = p.image_url
      ? `<img src="${p.image_url}" class="media-img" alt="${escHtml(p.name)}" />`
      : `<div class="media-logo">${emoji}</div>`;

    return `
      <article class="product-card ${isOut ? '' : 'product-card-clickable'}" ${cardClickable}>
        <div class="card-media">
          <span class="category-tag">${escHtml(p.category_name || 'Uncategorized')}</span>
          ${imageHtml}
          ${!isOut ? `<div class="card-view-overlay"><span>👁 View Details</span></div>` : ''}
        </div>
        <div class="card-details">
          <h3>${escHtml(p.name)}</h3>
          <p class="card-desc">${escHtml((p.description || 'No description available.').slice(0, 80))}${(p.description || '').length > 80 ? '…' : ''}</p>
          
          <div class="rating-row">
            <div class="stars-display">${starsHtml}</div>
            <span class="rating-value">${p.rating > 0 ? p.rating.toFixed(1) : '0.0'}</span>
            <span class="rating-count">(${p.rating_count || 0})</span>
          </div>

          <div class="card-meta-row">
            <span class="price-tag">${formatCurrency(p.price)}</span>
            <button class="heart-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); submitLike(${p.id})" title="${isLiked ? 'Unlike' : 'Like'}">
              <span class="heart-icon" id="heart-icon-${p.id}">${isLiked ? '❤️' : '🤍'}</span>
            </button>
          </div>

          <div class="stock-indicator ${stockClass}">${stockText}</div>
          
          ${isOut ? `
            <button class="btn btn-ghost card-buy-btn" disabled style="opacity:0.5; cursor:not-allowed; width:100%; justify-content:center; margin-top:14px;">
              Out of Stock
            </button>
          ` : `
            <div class="card-btn-group">
              <button class="btn btn-ghost card-details-btn" onclick="event.stopPropagation(); openProductDetail(${p.id})">
                👁 View Details
              </button>
              <button class="btn btn-primary card-buy-btn" onclick="event.stopPropagation(); addToCart(${p.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                Add to Cart
              </button>
            </div>
          `}
        </div>
      </article>
    `;
  }).join('');
}

// ===========================
// PRODUCT DETAIL MODAL
// ===========================
function openProductDetail(productId) {
  const p = storeProducts.find(prod => prod.id === productId);
  if (!p) return;

  const isOut = p.quantity <= 0;
  const isLow = p.quantity > 0 && p.quantity <= p.low_stock_threshold;
  const stockText = isOut ? 'Out of Stock' : isLow ? `Only ${p.quantity} left!` : 'In Stock';
  const stockClass = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-in';

  const userRatings = JSON.parse(localStorage.getItem('sama_ratings')) || {};
  const userRating = userRatings[p.id] || 0;
  const avgRating = Math.round(p.rating || 0);
  const displayRating = userRating > 0 ? userRating : avgRating;

  let starsHtml = '';
  for (let star = 1; star <= 5; star++) {
    const activeClass = star <= displayRating ? 'active' : '';
    const userRatedClass = userRating > 0 ? 'user-rated' : '';
    starsHtml += `<button class="star-btn ${activeClass} ${userRatedClass}" data-star="${star}" title="Rate ${star} Stars">★</button>`;
  }

  const likedList = JSON.parse(localStorage.getItem('sama_likes')) || [];
  const isLiked = likedList.includes(p.id);
  const heartIcon = isLiked ? '❤️' : '🤍';

  const emoji = emojiMap[p.id % emojiMap.length];
  const imageHtml = p.image_url
    ? `<img src="${p.image_url}" class="detail-img" alt="${escHtml(p.name)}" />`
    : `<div class="detail-img-placeholder">${emoji}</div>`;

  // Check current cart qty
  const cartItem = cart.find(i => i.id === p.id);
  const cartQty = cartItem ? cartItem.qty : 0;

  document.getElementById('product-detail-title').textContent = p.name;
  document.getElementById('product-detail-body').innerHTML = `
    <div class="product-detail-layout">
      <div class="detail-image-wrap">
        ${imageHtml}
        <span class="detail-category-tag">${escHtml(p.category_name || 'Uncategorized')}</span>
      </div>
      <div class="detail-info">
        <h3 class="detail-product-name">${escHtml(p.name)}</h3>
        ${p.sku ? `<div class="detail-sku">SKU: <span>${escHtml(p.sku)}</span></div>` : ''}
        
        <div class="detail-price">${formatCurrency(p.price)}</div>
        <div class="stock-indicator ${stockClass}" style="margin: 8px 0 12px;">${stockText}</div>

        <div class="detail-description">
          <strong>Description:</strong>
          <p>${escHtml(p.description || 'No description available.')}</p>
        </div>

        ${p.unit ? `<div class="detail-meta-row"><span>Unit:</span><span>${escHtml(p.unit)}</span></div>` : ''}
        ${p.supplier ? `<div class="detail-meta-row"><span>Supplier:</span><span>${escHtml(p.supplier)}</span></div>` : ''}

        <div class="detail-rating-row">
          <div class="stars-interactive" id="detail-stars-${p.id}" onclick="handleStarTap(event, ${p.id})">${starsHtml}</div>
          <span class="rating-value" id="detail-rating-val-${p.id}">${p.rating > 0 ? p.rating.toFixed(1) : '0.0'}</span>
          <span class="rating-count" id="detail-rating-cnt-${p.id}">(${p.rating_count || 0} ratings)</span>
        </div>

        <div class="detail-actions">
          <div class="detail-qty-row">
            <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">In Cart: <span id="detail-cart-qty-${p.id}" style="color:var(--blue)">${cartQty}</span></span>
          </div>
          <button class="heart-btn ${isLiked ? 'liked' : ''}" id="detail-like-btn-${p.id}" onclick="submitLike(${p.id})" title="${isLiked ? 'Unlike' : 'Like'}" style="margin-bottom:10px; font-size:22px;">
            <span class="heart-icon" id="detail-heart-icon-${p.id}">${isLiked ? '❤️' : '🤍'}</span>
          </button>
          ${!isOut ? `
          <button class="btn btn-primary card-buy-btn" onclick="addToCartFromDetail(${p.id})" id="detail-add-btn-${p.id}" style="width:100%;justify-content:center;font-size:15px;padding:13px 20px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Add to Cart
          </button>
          <button class="btn btn-ghost" onclick="closeProductDetailModal(); toggleCartModal(true);" style="width:100%;justify-content:center;margin-top:8px;">
            View Cart &amp; Checkout
          </button>
          ` : `<button class="btn btn-ghost" disabled style="width:100%;justify-content:center;opacity:0.5;cursor:not-allowed;">Out of Stock</button>`}
        </div>
      </div>
    </div>
  `;

  const modal = document.getElementById('product-detail-modal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
}

function closeProductDetailModal() {
  const modal = document.getElementById('product-detail-modal');
  modal.classList.remove('active');
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}

// Close product detail on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('product-detail-modal').addEventListener('click', function(e) {
    if (e.target === this) closeProductDetailModal();
  });
  document.getElementById('cart-modal').addEventListener('click', function(e) {
    if (e.target === this) toggleCartModal(false);
  });
});

function addToCartFromDetail(productId) {
  addToCart(productId);
  // Update qty displayed in detail modal
  const cartItem = cart.find(i => i.id === productId);
  const qtyEl = document.getElementById(`detail-cart-qty-${productId}`);
  if (qtyEl && cartItem) qtyEl.textContent = cartItem.qty;
}

// ===========================
// LIKING PRODUCTS
// ===========================
async function submitLike(productId) {
  let likedList = JSON.parse(localStorage.getItem('sama_likes')) || [];
  const isLiked = likedList.includes(productId);
  const endpoint = isLiked ? 'unlike' : 'like';

  try {
    const res = await fetch(`/api/products/${productId}/${endpoint}`, { method: 'POST' }).then(r => r.json());
    if (res.success) {
      const nowLiked = !isLiked;
      if (nowLiked) {
        likedList.push(productId);
        showToast('Loved this product! ❤️', 'success');
      } else {
        likedList = likedList.filter(id => id !== productId);
        showToast('Removed from favorites 🤍', 'info');
      }
      localStorage.setItem('sama_likes', JSON.stringify(likedList));

      // Update card heart icon
      const cardHeart = document.getElementById(`heart-icon-${productId}`);
      if (cardHeart) cardHeart.textContent = nowLiked ? '❤️' : '🤍';
      const cardBtn = cardHeart ? cardHeart.closest('.heart-btn') : null;
      if (cardBtn) cardBtn.classList.toggle('liked', nowLiked);

      // Update detail modal heart icon
      const detailHeart = document.getElementById(`detail-heart-icon-${productId}`);
      if (detailHeart) detailHeart.textContent = nowLiked ? '❤️' : '🤍';
      const detailBtn = document.getElementById(`detail-like-btn-${productId}`);
      if (detailBtn) detailBtn.classList.toggle('liked', nowLiked);

      // Sync in local memory
      const pIndex = storeProducts.findIndex(p => p.id === productId);
      if (pIndex !== -1) storeProducts[pIndex].likes = res.data.likes;
    }
  } catch (err) {
    showToast('Failed to submit like', 'error');
  }
}

// ===========================
// RATING PRODUCTS
// ===========================

// Called when any star button is clicked directly
function handleStarTap(event, productId) {
  const btn = event.target.closest('[data-star]');
  if (!btn) return;

  const clickedStar = parseInt(btn.dataset.star);
  let userRatings = JSON.parse(localStorage.getItem('sama_ratings')) || {};
  const savedRating = userRatings[productId] || 0;

  // Immediately update the star visuals
  updateStarDisplay(productId, clickedStar);

  if (savedRating === clickedStar) {
    // Clicking the same star again = unrate
    submitRatingValue(productId, clickedStar, 'unrate');
  } else if (savedRating > 0) {
    // Already rated — update to new star
    submitRatingValue(productId, clickedStar, 'rate-update', savedRating);
  } else {
    // Fresh rating
    submitRatingValue(productId, clickedStar, 'rate');
  }
}

// Updates the star button visuals in the detail modal
function updateStarDisplay(productId, level) {
  const container = document.getElementById(`detail-stars-${productId}`);
  if (!container) return;
  container.querySelectorAll('[data-star]').forEach(btn => {
    const s = parseInt(btn.dataset.star);
    btn.classList.toggle('active', s <= level);
    btn.classList.toggle('user-rated', level > 0);
  });
}

async function submitRatingValue(productId, ratingValue, action, oldRating = 0) {
  let userRatings = JSON.parse(localStorage.getItem('sama_ratings')) || {};

  try {
    let res;
    if (action === 'unrate') {
      res = await fetch(`/api/products/${productId}/unrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: ratingValue })
      }).then(r => r.json());

      if (res.success) {
        delete userRatings[productId];
        delete _pendingStars[productId];
        localStorage.setItem('sama_ratings', JSON.stringify(userRatings));
        showToast('Rating removed ⭐', 'info');
      }
    } else if (action === 'rate-update') {
      res = await fetch(`/api/products/${productId}/rate-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldRating, newRating: ratingValue })
      }).then(r => r.json());

      if (res.success) {
        userRatings[productId] = ratingValue;
        localStorage.setItem('sama_ratings', JSON.stringify(userRatings));
        showToast(`Updated to ${ratingValue} star${ratingValue > 1 ? 's' : ''}! ⭐`, 'success');
      }
    } else {
      res = await fetch(`/api/products/${productId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: ratingValue })
      }).then(r => r.json());

      if (res.success) {
        userRatings[productId] = ratingValue;
        localStorage.setItem('sama_ratings', JSON.stringify(userRatings));
        showToast(`Rated ${ratingValue} star${ratingValue > 1 ? 's' : ''}! ⭐`, 'success');
      }
    }

    if (res && res.success) {
      const pIndex = storeProducts.findIndex(p => p.id === productId);
      if (pIndex !== -1) {
        storeProducts[pIndex].rating = res.data.rating;
        storeProducts[pIndex].rating_count = res.data.rating_count;
        storeProducts[pIndex].rating_sum = res.data.rating_sum;
      }
      // Update rating value/count labels in detail modal
      const ratingValEl = document.getElementById(`detail-rating-val-${productId}`);
      if (ratingValEl) ratingValEl.textContent = res.data.rating > 0 ? parseFloat(res.data.rating).toFixed(1) : '0.0';
      const ratingCntEl = document.getElementById(`detail-rating-cnt-${productId}`);
      if (ratingCntEl) ratingCntEl.textContent = `(${res.data.rating_count || 0} ratings)`;

      filterStoreProducts();
    } else {
      showToast(res ? res.message : 'Error submitting rating', 'error');
    }
  } catch (err) {
    showToast('Failed to submit rating', 'error');
  }
}

// ===========================
// CART MANAGEMENT
// ===========================
function toggleCartModal(open) {
  const modal = document.getElementById('cart-modal');
  if (open) {
    renderCart();
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  } else {
    modal.classList.remove('active');
    setTimeout(() => { 
      modal.style.display = 'none'; 
      goToCheckoutStep(1);
    }, 200);
  }
}

function addToCart(productId) {
  const prod = storeProducts.find(p => p.id === productId);
  if (!prod) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    if (existing.qty >= prod.quantity) {
      showToast(`Cannot add more. Only ${prod.quantity} items available in inventory.`, 'error');
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      qty: 1,
      unit: prod.unit || 'pcs',
      maxQty: prod.quantity
    });
  }

  saveCart();
  updateCartBadge();
  showToast(`Added "${prod.name}" to cart! 🛍️`, 'success');
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  badge.textContent = count;
}

function saveCart() {
  localStorage.setItem('sama_cart', JSON.stringify(cart));
}

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const summary = document.getElementById('cart-summary');
  
  if (cart.length === 0) {
    list.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-cart-icon">🛒</div>
        <p>Your cart is empty. Start shopping!</p>
      </div>`;
    summary.style.display = 'none';
    return;
  }

  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">${formatCurrency(item.price)} per ${escHtml(item.unit)}</div>
      </div>
      <div class="cart-qty-controls">
        <button class="qty-btn" onclick="adjustCartQty(${item.id}, -1)">-</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="adjustCartQty(${item.id}, 1)">+</button>
      </div>
      <div class="cart-item-subtotal">${formatCurrency(item.price * item.qty)}</div>
      <button class="cart-item-remove" onclick="removeCartItem(${item.id})" title="Remove item">
        ✕
      </button>
    </div>
  `).join('');

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  document.getElementById('cart-total-qty').textContent = totalQty;
  document.getElementById('cart-total-amount').textContent = formatCurrency(totalAmount);
  summary.style.display = 'flex';
}

function adjustCartQty(productId, amount) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  if (amount > 0 && item.qty >= item.maxQty) {
    showToast(`Sorry, only ${item.maxQty} units of this product are in stock!`, 'info');
    return;
  }

  item.qty += amount;
  
  if (item.qty <= 0) {
    removeCartItem(productId);
    return;
  }

  saveCart();
  updateCartBadge();
  renderCart();
}

function removeCartItem(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  updateCartBadge();
  renderCart();
}

// ===========================
// CHECKOUT / PLACING ORDER
// ===========================
function goToCheckoutStep(step) {
  document.querySelectorAll('.checkout-step').forEach(el => el.style.display = 'none');
  document.getElementById(`checkout-step-${step}`).style.display = 'block';

  const titleText = document.getElementById('cart-modal-title-text');
  if (step === 1) {
    titleText.textContent = 'Your Shopping Cart';
  } else if (step === 2) {
    titleText.textContent = 'Checkout Details';
    // Populate order summary
    renderCheckoutOrderSummary();
  } else if (step === 3) {
    titleText.textContent = '🧾 Order Receipt';
  }
}

function renderCheckoutOrderSummary() {
  const container = document.getElementById('checkout-order-summary');
  if (!container) return;
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  container.innerHTML = `
    <div class="co-summary-items">
      ${cart.map(i => `
        <div class="co-summary-line">
          <span>${escHtml(i.name)} × ${i.qty}</span>
          <span>${formatCurrency(i.price * i.qty)}</span>
        </div>
      `).join('')}
    </div>
    <div class="co-summary-total">
      <span>Total</span>
      <span style="font-weight:800;color:var(--green)">${formatCurrency(total)}</span>
    </div>
  `;
}

function togglePaymentInputs(method) {
  const mpesaFields = document.getElementById('mpesa-payment-fields');
  if (mpesaFields) mpesaFields.style.display = method === 'mpesa' ? 'block' : 'none';
}

async function processCheckout(event) {
  event.preventDefault();
  if (cart.length === 0) return;

  const customer_name = document.getElementById('cust-name').value;
  const customer_phone = document.getElementById('cust-phone').value;
  const customer_address = document.getElementById('cust-address').value;
  const payment_method = document.querySelector('input[name="payment-method-radio"]:checked').value;
  
  let payment_details = {};
  if (payment_method === 'mpesa') {
    payment_details = { mpesa: 'Verified manually via Paybill / Send Money' };
  } else {
    const bankAccount = document.getElementById('bank-account').value;
    if (!bankAccount) {
      showToast('Please fill in Bank Account details', 'error');
      return;
    }
    payment_details = { account: bankAccount };
  }

  const total_amount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartSnapshot = [...cart]; // snapshot before clearing

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        customer_name,
        customer_phone,
        payment_method: payment_method === 'mpesa' ? 'M-Pesa' : 'Bank Deposit',
        payment_details,
        total_amount
      })
    }).then(r => r.json());

    if (res.success) {
      const orderId = `SAMA-${String(res.orderId || 'OK').padStart(4, '0')}`;
      const now = new Date();

      lastPlacedOrder = {
        id: orderId,
        customer_name: customer_name,
        customer_phone: customer_phone,
        table: customer_address,
        payment_method: payment_method === 'mpesa' ? 'M-Pesa' : 'Bank Deposit',
        created_at: now.toISOString(),
        items: cartSnapshot,
        total_amount: total_amount
      };

      // Populate receipt
      document.getElementById('receipt-order-id').textContent = orderId;
      document.getElementById('receipt-customer-name').textContent = customer_name;
      document.getElementById('receipt-customer-phone').textContent = customer_phone;
      document.getElementById('receipt-payment-method').textContent = payment_method === 'mpesa' ? '📱 M-Pesa' : '🏦 Bank Deposit';
      document.getElementById('receipt-date').textContent = now.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
      document.getElementById('receipt-total').textContent = formatCurrency(total_amount);

      // Populate receipt items
      document.getElementById('receipt-items-list').innerHTML = cartSnapshot.map(item => `
        <div class="receipt-item-line">
          <div class="receipt-item-name">${escHtml(item.name)}</div>
          <div class="receipt-item-detail">
            <span>${item.qty} × ${formatCurrency(item.price)}</span>
            <span style="font-weight:700">${formatCurrency(item.price * item.qty)}</span>
          </div>
        </div>
      `).join('');

      // Show M-Pesa prompt notice
      const mpesaNotice = document.getElementById('mpesa-prompt-notice');
      if (payment_method === 'mpesa') {
        mpesaNotice.style.display = 'flex';
        showToast(`📲 Order placed! Complete payment to complete fulfillment.`, 'success');
      } else {
        mpesaNotice.style.display = 'none';
      }

      goToCheckoutStep(3);
      
      cart = [];
      saveCart();
      updateCartBadge();
      loadStoreData();
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) {
    showToast('Failed to submit order', 'error');
  }
}

function resetStorefrontCart() {
  toggleCartModal(false);
  document.getElementById('checkout-form').reset();
  goToCheckoutStep(1);
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatCurrency(val) {
  if (!val && val !== 0) return '—';
  return 'Ksh ' + new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  }, 4000);
}

function printStorefrontOrderInvoice(order) {
  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) {
    showToast('Pop-up blocked! Please allow pop-ups to print invoices.', 'error');
    return;
  }
  
  let itemsRows = '';
  let subtotal = 0;
  
  if (Array.isArray(order.items)) {
    order.items.forEach(item => {
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
      <title>Sama Hardware Storefront - Invoice #${order.id}</title>
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
        <div class="logo"><span>SAMA</span> STOREFRONT</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Hardware E-Commerce Delivery Invoice</div>
        <div style="font-size: 11px; color: #888;">Nairobi, Kenya | Tel: +254 700 111 222</div>
      </div>
      <div class="meta-grid">
        <div>
          <strong style="color:#555">BILL TO:</strong><br>
          <span style="font-size:15px; font-weight:700;">${escHtml(order.customer_name)}</span><br>
          Tel: ${escHtml(order.customer_phone)}<br>
          Address: ${escHtml(order.table)}
        </div>
        <div style="text-align: right;">
          <strong style="color:#555">INVOICE DETAILS:</strong><br>
          Invoice No: <strong>#${order.id}</strong><br>
          Date: ${new Date(order.created_at).toLocaleString('en-KE')}<br>
          Payment Channel: ${escHtml(order.payment_method)}
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
        <strong>Thank you for choosing Sama Hardware Storefront!</strong><br>
        This is a computer generated delivery receipt and does not require signature.<br>
        Sama Storefront &copy; 2026
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
