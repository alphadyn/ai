const STORE_CONFIG = {
  currency: 'USD',
  taxRate: 0.0825,
  stripePublishableKey: '',
  paymentIntentEndpoint: ''
};

const products = [
  { id: 'terra-mug', name: 'Terra Stoneware Mug', section: 'Home Goods', type: 'product', brand: 'Atlas & Co.', price: 28, stock: 42, sponsored: false, tags: ['kitchen', 'ceramic', 'gift'], image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80', description: 'Hand-glazed mug with a balanced handle and warm matte finish.' },
  { id: 'linen-throw', name: 'Woven Linen Throw', section: 'Home Goods', type: 'product', brand: 'Harbor Loom', price: 86, stock: 18, sponsored: true, tags: ['textile', 'living room', 'sponsored'], image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=900&q=80', description: 'Breathable midweight throw for sofas, guest rooms, and cool evenings.' },
  { id: 'brass-lamp', name: 'Low-Glow Brass Lamp', section: 'Home Goods', type: 'product', brand: 'Northline', price: 142, stock: 7, sponsored: false, tags: ['lighting', 'desk', 'decor'], image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80', description: 'Compact task lamp with dimmable warmth and a weighted base.' },
  { id: 'sonic-dock', name: 'Sonic Desk Dock', section: 'Tech', type: 'product', brand: 'Signal House Audio', price: 219, stock: 11, sponsored: true, tags: ['audio', 'workspace', 'charging'], image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=80', description: 'Desktop audio dock with wireless charging and conference-ready clarity.' },
  { id: 'field-pack', name: 'Weatherproof Field Pack', section: 'Travel', type: 'product', brand: 'Ridgeway Supply', price: 128, stock: 23, sponsored: false, tags: ['bag', 'commute', 'outdoor'], image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80', description: 'Structured everyday pack with sealed zippers and padded device storage.' },
  { id: 'pantry-set', name: 'Glass Pantry Set', section: 'Kitchen', type: 'product', brand: 'Bright Pantry', price: 64, stock: 0, sponsored: true, tags: ['storage', 'kitchen', 'sponsored'], image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80', description: 'Stackable glass storage jars with oak lids and writable labels.' },
  { id: 'desk-plan', name: 'Workspace Setup Session', section: 'Services', type: 'service', brand: 'Nomad Desk Lab', price: 175, stock: 99, sponsored: true, tags: ['service', 'workspace', 'consultation'], image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80', description: 'A remote planning session for ergonomics, cable flow, and lighting.' },
  { id: 'gift-curation', name: 'Gift Curation Concierge', section: 'Services', type: 'service', brand: 'Atlas & Co.', price: 45, stock: 99, sponsored: false, tags: ['service', 'gifts', 'concierge'], image: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80', description: 'Tell us the recipient and budget; receive a polished shortlist within a day.' },
  { id: 'pantry-consult', name: 'Pantry Planning Visit', section: 'Services', type: 'service', brand: 'Bright Pantry', price: 135, stock: 12, sponsored: true, tags: ['service', 'kitchen', 'organization'], image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80', description: 'In-home planning for pantry zones, staple lists, and storage sizing.' }
];

const state = {
  query: '',
  section: 'All',
  stockOnly: false,
  cart: new Map(),
  stripe: null,
  stripeCard: null
};

const elements = {
  searchInput: document.querySelector('#searchInput'),
  stockOnly: document.querySelector('#stockOnly'),
  sectionFilters: document.querySelector('#sectionFilters'),
  catalogGroups: document.querySelector('#catalogGroups'),
  serviceTiles: document.querySelector('#serviceTiles'),
  inventoryRows: document.querySelector('#inventoryRows'),
  resultSummary: document.querySelector('#resultSummary'),
  cartCount: document.querySelector('#cartCount'),
  cartDrawer: document.querySelector('#cartDrawer'),
  cartItems: document.querySelector('#cartItems'),
  cartSubtotal: document.querySelector('#cartSubtotal'),
  cartTax: document.querySelector('#cartTax'),
  cartTotal: document.querySelector('#cartTotal'),
  scrim: document.querySelector('#scrim'),
  toast: document.querySelector('#toast'),
  checkoutForm: document.querySelector('#checkoutForm'),
  paymentStatus: document.querySelector('#paymentStatus'),
  paymentRequestButton: document.querySelector('#paymentRequestButton'),
  applePayDemo: document.querySelector('#applePayDemo'),
  cardElement: document.querySelector('#cardElement')
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: STORE_CONFIG.currency });

const secureStore = {
  dbName: 'atlas-store-secure-v1',
  storeName: 'keys',
  async openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async getKey() {
    const db = await this.openDb();
    const existingKey = await new Promise((resolve, reject) => {
      const request = db.transaction(this.storeName).objectStore(this.storeName).get('cart-key');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (existingKey) return existingKey;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise((resolve, reject) => {
      const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(key, 'cart-key');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return key;
  },
  async saveCart(cart) {
    if (!window.crypto?.subtle || !window.indexedDB) return;
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify([...cart]));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    localStorage.setItem('atlas-cart', JSON.stringify({ iv: arrayToBase64(iv), payload: arrayToBase64(new Uint8Array(encrypted)) }));
  },
  async loadCart() {
    if (!window.crypto?.subtle || !window.indexedDB) return new Map();
    const saved = localStorage.getItem('atlas-cart');
    if (!saved) return new Map();
    try {
      const record = JSON.parse(saved);
      const key = await this.getKey();
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToArray(record.iv) }, key, base64ToArray(record.payload));
      return new Map(JSON.parse(new TextDecoder().decode(decrypted)));
    } catch (error) {
      localStorage.removeItem('atlas-cart');
      return new Map();
    }
  }
};

function arrayToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToArray(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function matchesFilters(item) {
  const haystack = [item.name, item.section, item.brand, item.type, item.description, ...item.tags].join(' ').toLowerCase();
  const sectionMatch = state.section === 'All' || item.section === state.section;
  const stockMatch = !state.stockOnly || item.stock > 0;
  return sectionMatch && stockMatch && haystack.includes(state.query.toLowerCase());
}

function filteredItems() {
  return products.filter(matchesFilters);
}

function renderFilters() {
  const sections = ['All', ...new Set(products.map(item => item.section))];
  elements.sectionFilters.innerHTML = sections.map(section => `
    <button class="chip ${state.section === section ? 'active' : ''}" type="button" data-section="${section}">${section}</button>
  `).join('');
}

function renderCatalog() {
  const items = filteredItems().filter(item => item.type === 'product');
  const groups = [...new Set(items.map(item => item.section))];
  elements.resultSummary.textContent = `Showing ${filteredItems().length} item${filteredItems().length === 1 ? '' : 's'}`;
  elements.catalogGroups.innerHTML = groups.map(section => {
    const sectionItems = items.filter(item => item.section === section);
    return `
      <div class="catalog-group">
        <h3 class="group-title">${section}</h3>
        <div class="tile-grid">${sectionItems.map(productTile).join('')}</div>
      </div>
    `;
  }).join('') || '<p class="empty-cart">No products match these filters.</p>';
}

function renderServices() {
  const services = filteredItems().filter(item => item.type === 'service');
  elements.serviceTiles.innerHTML = services.map(productTile).join('') || '<p class="empty-cart">No services match these filters.</p>';
}

function productTile(item) {
  return `
    <article class="product-tile">
      <img src="${item.image}" alt="${item.name}">
      <div class="tile-body">
        <div class="tile-meta"><span>${item.brand}</span><span>${item.stock > 0 ? `${item.stock} available` : 'Sold out'}</span></div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        ${item.sponsored ? '<p class="sponsored">Sponsored placement</p>' : ''}
      </div>
      <div class="tile-footer">
        <span class="price">${money.format(item.price)}</span>
        <button class="add-button" type="button" data-add="${item.id}" ${item.stock < 1 ? 'disabled' : ''}>${item.type === 'service' ? 'Book' : 'Add'}</button>
      </div>
    </article>
  `;
}

function renderInventory() {
  elements.inventoryRows.innerHTML = filteredItems().map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.section}</td>
      <td>${item.brand}${item.sponsored ? ' - Ad' : ''}</td>
      <td>${item.stock}</td>
      <td>${money.format(item.price)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">No inventory matches these filters.</td></tr>';
}

function addToCart(id) {
  const item = products.find(product => product.id === id);
  if (!item || item.stock < 1) return;
  const current = state.cart.get(id) || 0;
  state.cart.set(id, Math.min(current + 1, item.stock));
  persistAndRenderCart();
  showToast(`${item.name} added to cart.`);
}

function updateQuantity(id, delta) {
  const item = products.find(product => product.id === id);
  const next = (state.cart.get(id) || 0) + delta;
  if (!item || next < 1) state.cart.delete(id);
  else state.cart.set(id, Math.min(next, item.stock));
  persistAndRenderCart();
}

async function persistAndRenderCart() {
  renderCart();
  await secureStore.saveCart(state.cart);
}

function cartTotals() {
  const subtotal = [...state.cart].reduce((sum, [id, quantity]) => {
    const item = products.find(product => product.id === id);
    return sum + (item ? item.price * quantity : 0);
  }, 0);
  const tax = subtotal * STORE_CONFIG.taxRate;
  return { subtotal, tax, total: subtotal + tax };
}

function renderCart() {
  const lines = [...state.cart].map(([id, quantity]) => ({ item: products.find(product => product.id === id), quantity })).filter(line => line.item);
  elements.cartCount.textContent = lines.reduce((sum, line) => sum + line.quantity, 0);
  elements.cartItems.innerHTML = lines.map(({ item, quantity }) => `
    <div class="cart-line">
      <img src="${item.image}" alt="${item.name}">
      <div>
        <h3>${item.name}</h3>
        <p>${money.format(item.price)} each</p>
      </div>
      <div class="quantity">
        <button type="button" data-qty="${item.id}" data-delta="-1" aria-label="Remove one ${item.name}">-</button>
        <strong>${quantity}</strong>
        <button type="button" data-qty="${item.id}" data-delta="1" aria-label="Add one ${item.name}">+</button>
      </div>
    </div>
  `).join('') || '<p class="empty-cart">Your cart is empty.</p>';
  const totals = cartTotals();
  elements.cartSubtotal.textContent = money.format(totals.subtotal);
  elements.cartTax.textContent = money.format(totals.tax);
  elements.cartTotal.textContent = money.format(totals.total);
}

function openCart() {
  elements.cartDrawer.classList.add('open');
  elements.cartDrawer.setAttribute('aria-hidden', 'false');
  elements.scrim.classList.add('open');
}

function closeCart() {
  elements.cartDrawer.classList.remove('open');
  elements.cartDrawer.setAttribute('aria-hidden', 'true');
  elements.scrim.classList.remove('open');
}

function renderAll() {
  renderFilters();
  renderCatalog();
  renderServices();
  renderInventory();
  renderCart();
  if (window.lucide) lucide.createIcons();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2800);
}

function exportInventory() {
  const payload = JSON.stringify(filteredItems(), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'atlas-store-inventory.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function setupPayments() {
  const canUseApplePay = window.ApplePaySession && ApplePaySession.canMakePayments();
  elements.applePayDemo.hidden = !canUseApplePay;
  if (!STORE_CONFIG.stripePublishableKey || !STORE_CONFIG.paymentIntentEndpoint || !window.Stripe) {
    return;
  }
  state.stripe = Stripe(STORE_CONFIG.stripePublishableKey);
  const elementsApi = state.stripe.elements();
  state.stripeCard = elementsApi.create('card', { hidePostalCode: true });
  elements.cardElement.textContent = '';
  state.stripeCard.mount('#cardElement');
  const totals = cartTotals();
  const paymentRequest = state.stripe.paymentRequest({
    country: 'US',
    currency: STORE_CONFIG.currency.toLowerCase(),
    total: { label: 'Atlas & Co. order', amount: Math.round(totals.total * 100) },
    requestPayerName: true,
    requestPayerEmail: true
  });
  const result = await paymentRequest.canMakePayment();
  if (result) {
    elements.paymentRequestButton.hidden = false;
    elementsApi.create('paymentRequestButton', { paymentRequest }).mount('#paymentRequestButton');
    elements.paymentStatus.textContent = 'Wallet payments are available on this device. Credit cards are processed by Stripe Elements.';
  }
}

async function submitOrder(event) {
  event.preventDefault();
  if (!state.cart.size) {
    showToast('Add at least one item before checkout.');
    openCart();
    return;
  }
  const formData = new FormData(elements.checkoutForm);
  const order = {
    customer: Object.fromEntries(formData.entries()),
    items: [...state.cart].map(([id, quantity]) => ({ id, quantity })),
    totals: cartTotals(),
    createdAt: new Date().toISOString()
  };
  await secureStore.saveCart(state.cart);
  if (STORE_CONFIG.paymentIntentEndpoint) {
    await fetch(STORE_CONFIG.paymentIntentEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
      credentials: 'same-origin'
    });
    showToast('Order sent to the secure payment endpoint.');
  } else {
    showToast('Demo order prepared. Configure a payment endpoint to process real cards.');
  }
}

document.addEventListener('click', event => {
  const addButton = event.target.closest('[data-add]');
  const quantityButton = event.target.closest('[data-qty]');
  const sectionButton = event.target.closest('[data-section]');
  if (addButton) addToCart(addButton.dataset.add);
  if (quantityButton) updateQuantity(quantityButton.dataset.qty, Number(quantityButton.dataset.delta));
  if (sectionButton) {
    state.section = sectionButton.dataset.section;
    renderAll();
  }
});

document.querySelector('.cart-toggle').addEventListener('click', openCart);
document.querySelector('.close-cart').addEventListener('click', closeCart);
elements.scrim.addEventListener('click', closeCart);
elements.searchInput.addEventListener('input', event => {
  state.query = event.target.value.trim();
  renderAll();
});
elements.stockOnly.addEventListener('change', event => {
  state.stockOnly = event.target.checked;
  renderAll();
});
document.querySelector('#exportInventory').addEventListener('click', exportInventory);
elements.applePayDemo.addEventListener('click', () => showToast('Apple Pay is available only on supported Apple devices over HTTPS with a merchant/payment processor configured.'));
elements.checkoutForm.addEventListener('submit', submitOrder);

secureStore.loadCart().then(savedCart => {
  state.cart = savedCart;
  renderAll();
  setupPayments();
});