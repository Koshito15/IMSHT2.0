// ---------------------- PRODUCTS ----------------------
const products = [
  { id: 1, name: "1 Hour", price: 5 },
  { id: 2, name: "2 Hours", price: 10 },
  { id: 3, name: "3 Hours", price: 15 },
  { id: 4, name: "4 Hours", price: 20 },
  { id: 5, name: "5 Hours", price: 25 }
];

let cart = {};
let validVoucherCodes = [];

// ---------------------- INIT ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadVoucherCodes();
  showProducts();
  document.getElementById("search-vouchers")?.addEventListener("input", renderVoucherList);
  document.getElementById("filter-status")?.addEventListener("change", renderVoucherList);

  // If on payment page, set payment total and QR
  const paymentTotalEl = document.getElementById("payment-total");
  if (paymentTotalEl) {
    const orderAmount = localStorage.getItem("orderAmount") || 0;
    paymentTotalEl.textContent = orderAmount;
    // set QR if map exists
    setPaymentQR(orderAmount);
  }
});
// script.js
// Responsible for reading the cart / amount and calling backend to create checkout

document.addEventListener('DOMContentLoaded', () => {
  const totalDisplay = document.getElementById('total-display');
  const itemsCount = document.getElementById('items-count');
  const payButton = document.getElementById('pay-button');
  const messages = document.getElementById('messages');

  // ------------- SOURCE OF AMOUNT -------------
  // This logic tries multiple places for the order total:
  // 1) Query param ?amount=100.50 (in PHP or JS you can set this)
  // 2) localStorage 'cartTotal' (common pattern for static sites)
  // 3) fallback: compute from localStorage 'cartItems' if present
  function readAmountFromSources() {
    // 1) query param
    const urlParams = new URLSearchParams(window.location.search);
    const qAmount = urlParams.get('amount');
    if (qAmount && !isNaN(Number(qAmount))) {
      return Number(qAmount);
    }

    // 2) localStorage 'cartTotal' (stored in pesos, e.g. 250.00)
    try {
      const lsTotal = localStorage.getItem('cartTotal');
      if (lsTotal && !isNaN(Number(lsTotal))) return Number(lsTotal);
    } catch (e) { /* ignore localStorage errors */ }

    // 3) compute from cart items stored in localStorage as JSON array
    try {
      const raw = localStorage.getItem('cartItems'); // expect [{name, qty, price}, ...]
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const tot = arr.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);
          if (!isNaN(tot)) return tot;
        }
      }
    } catch (e) { /* ignore JSON errors */ }

    // default
    return 0;
  }

  function showMessage(msg, type = 'info') {
    messages.textContent = msg;
    messages.className = type;
  }

  const amountPesos = readAmountFromSources(); // e.g. 150.00
  itemsCount.textContent = (localStorage.getItem('cartItems') ? JSON.parse(localStorage.getItem('cartItems')).length : 0);
  totalDisplay.textContent = `₱${Number(amountPesos).toFixed(2)}`;

  // Validate amount
  if (!amountPesos || Number(amountPesos) <= 0) {
    showMessage('Your order total is ₱0.00 — set a nonzero amount before checking out.', 'error');
    payButton.disabled = true;
    return;
  } else {
    payButton.disabled = false;
    showMessage(`Ready to pay ₱${Number(amountPesos).toFixed(2)}`, 'info');
  }

  // Convert to smallest currency unit (centavos). PayMongo expects amount in centavos (e.g., 100.00 PHP -> 10000)
  function pesosToCentavos(pesos) {
    // Avoid float rounding issues by working as integers
    return Math.round(Number(pesos) * 100);
  }

  payButton.addEventListener('click', async () => {
    payButton.disabled = true;
    showMessage('Creating checkout session… (do not refresh)', 'info');

    const payload = {
      amount_centavos: pesosToCentavos(amountPesos),
      currency: 'PHP',
      description: 'Order from IMSHT2.0'
    };

    try {
      const resp = await fetch('create_payment.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Server returned ${resp.status}: ${txt}`);
      }

      const data = await resp.json();
      // Expected server response: { success: true, checkout_url: "https://checkout.paymongo.com/...." }
      if (data && data.checkout_url) {
        showMessage('Redirecting to payment provider…', 'info');
        // redirect user to checkout
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL returned from server.');
      }
    } catch (err) {
      console.error(err);
      showMessage('Payment request failed: ' + err.message, 'error');
      payButton.disabled = false;
    }
  });
});


// ---------------------- UI helpers ----------------------
function showToast(msg, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------------------- BUTTON ANIMATIONS ----------------------
function animateButton(element) {
  element?.classList.add("bouncing");
  setTimeout(() => element?.classList.remove("bouncing"), 300);
}

function goToOrder(button) {
  animateButton(button);
  setTimeout(() => window.location.href = "order.html", 260);
}

function goToPayment(button) {
  animateButton(button);
  setTimeout(() => {
    const totalEl = document.getElementById("total");
    const total = totalEl ? totalEl.textContent : 0;
    localStorage.setItem("orderAmount", total);
    window.location.href = "payment.html";
  }, 260);
}

// ---------------------- PRODUCT DISPLAY ----------------------
function showProducts() {
  const productList = document.getElementById("product-list");
  if (!productList) return;

  productList.innerHTML = "";
  products.forEach(product => {
    const div = document.createElement("div");
    div.className = "product";
    div.innerHTML = `
      <h4>${product.name}</h4>
      <p>₱${product.price}</p>
      <button onclick="addToCart(${product.id}, this)">Add</button>
    `;
    productList.appendChild(div);
  });
}

function addToCart(productId, button) {
  animateButton(button);
  if (cart[productId]) {
    showToast("This voucher is already in your cart.", "error");
    return;
  }
  const product = products.find(p => p.id === productId);
  cart[productId] = product;
  updateCart();
}

function updateCart() {
  const cartList = document.getElementById("cart-items");
  const confirmBtn = document.getElementById("confirm-btn");
  if (!cartList) return;

  cartList.innerHTML = "";
  let total = 0;

  for (let id in cart) {
    const item = cart[id];
    total += item.price;
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${item.name} - ₱${item.price}</span>
      <button class="remove-btn" onclick="removeFromCart(${id})">Remove</button>
    `;
    cartList.appendChild(li);
  }

  document.getElementById("total").textContent = total;
  confirmBtn && confirmBtn.classList.toggle("hidden", Object.keys(cart).length === 0);
}

function removeFromCart(productId) {
  delete cart[productId];
  updateCart();
}

// ---------------------- PURCHASE FLOW ----------------------
function confirmPurchase() {
  if (Object.keys(cart).length === 0) {
    showToast("Cart is empty.", "error");
    return;
  }

  document.getElementById("order-screen")?.classList.add("hidden");
  document.getElementById("confirmation")?.classList.remove("hidden");

  const code = generateVoucherCode();
  validVoucherCodes.push({ code, price: Object.values(cart)[0].price, used: false });
  saveVoucherCodes();

  const voucherContainer = document.getElementById("voucher-codes");
  voucherContainer.innerHTML = `
    <h4>Your Voucher Code:</h4>
    <p class="voucher-display">${code}</p>
  `;

  cart = {};
  updateCart();
}

function resetOrder() {
  cart = {};
  updateCart();
  document.getElementById("confirmation")?.classList.add("hidden");
  document.getElementById("welcome-screen")?.classList.remove("hidden");
  document.getElementById("voucher-codes").innerHTML = "";
  const rm = document.getElementById("redeem-code-input"); if (rm) rm.value = "";
  const msg = document.getElementById("redeem-message"); if (msg) { msg.textContent = ""; msg.classList.add("hidden"); }
}
// ---------------------- POLL FOR VOUCHER (AUTO AFTER WEBHOOK) ----------------------
async function checkAndShowVoucher() {
  // Get amount (in pesos)
  let amount = Number(localStorage.getItem("orderAmount")) || 0;

  try {
    let res = await fetch("vouchers.json?cache=" + Date.now());
    let vouchers = await res.json();

    // Find latest unused voucher matching amount
    let found = [...vouchers].reverse().find(v => v.price === amount && !v.used);

    if (found) {
      showVoucher(found.code, amount);
      return true;
    } else {
      console.warn("No unused voucher found for ₱" + amount);
    }
  } catch (e) {
    console.error("Voucher check failed", e);
  }
  return false;
}

// Example helper
function showVoucher(code, amount) {
  const overlay = document.getElementById("voucher-overlay");
  const box = document.getElementById("voucher-box");
  const details = document.getElementById("voucher-details");

  document.getElementById("voucher-title").textContent = "✅ Payment Verified!";
  document.getElementById("voucher-message").textContent = "Here’s your voucher:";
  document.getElementById("voucher-amount").textContent = amount;
  document.getElementById("voucher-code").textContent = code;

  details.style.display = "block";
  overlay.style.display = "flex";
}

// Start polling if on payment page
if (document.getElementById("voucher-overlay")) {
  setInterval(checkVoucherUpdate, 4000); // every 4 sec
}


// ---------------------- VOUCHER GENERATION ----------------------
function generateVoucherCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

// ---------------------- PAYMENT (PayMongo) ----------------------
const qrMap = {
  5: "gcash-5.jpg",
  10: "gcash-10.jpg",
  15: "gcash-15.jpg",
  20: "gcash-20.jpg",
  25: "gcash-25.jpg",
  30: "gcash-30.jpg",
  35: "gcash-35.jpg",
  40: "gcash-40.jpg",
  45: "gcash-45.jpg",
  50: "gcash-50.jpg",
  55: "gcash-55.jpg",
  60: "gcash-60.jpg",
  65: "gcash-65.jpg",
  70: "gcash-70.jpg",
  75: "gcash-75.jpg"
};

function setPaymentQR(amount) {
  const qrImg = document.getElementById("gcash-qr");
  if (!qrImg) return;
  const amt = Number(amount) || 0;
  if (qrMap[amt]) {
    qrImg.src = qrMap[amt];
  } else {
    qrImg.src = "";
    qrImg.alt = "No QR available for this amount";
  }
}

// GCash pay button handler (on payment.html)
document.getElementById("gcash-btn")?.addEventListener("click", async () => {
  try {
    const selectedAmount = Number(localStorage.getItem("orderAmount")) || 0;
    const amountCentavos = Math.round(selectedAmount * 100);
    if (!amountCentavos || amountCentavos <= 0) {
      showToast("Invalid payment amount.", "error");
      return;
    }

    const resp = await fetch("create_payment.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "amount=" + amountCentavos
    });
    const data = await resp.json();

    if (data.data?.attributes?.redirect?.checkout_url) {
      window.location.href = data.data.attributes.redirect.checkout_url;
    } else {
      console.error("create_payment response:", data);
      showToast("Payment creation failed.", "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Payment request failed.", "error");
  }
});

// ---------------------- REDEEM SYSTEM ----------------------
async function redeemVoucher() {
  const codeInput = document.getElementById("redeem-code-input");
  const code = (codeInput?.value || "").trim().toUpperCase();
  const messageEl = document.getElementById("redeem-message");
  if (!messageEl) return showToast("Redeem UI missing", "error");

  if (!code) {
    messageEl.textContent = "❗ Please enter a voucher code.";
    messageEl.style.color = "red";
    messageEl.classList.remove("hidden");
    return;
  }

  messageEl.textContent = "🔄 Connecting to WiFi...";
  messageEl.style.color = "blue";
  messageEl.classList.remove("hidden");

  const vouchers = await loadVoucherCodes();

  setTimeout(async () => {
    const found = vouchers.find(v => v.code === code);
    if (found) {
      if (!found.used) {
        found.used = true;
        await saveVoucherCodes(); // persist change
        messageEl.textContent = "✅ Connected! Enjoy your internet.";
        messageEl.style.color = "green";
      } else {
        messageEl.textContent = "❌ This voucher has already been used.";
        messageEl.style.color = "red";
      }
    } else {
      messageEl.textContent = "❌ Invalid voucher code. Try again.";
      messageEl.style.color = "red";
    }
  }, 1200);
}

// ---------------------- VOUCHERS STORAGE (server-backed) ----------------------
async function loadVoucherCodes() {
  try {
    const res = await fetch("vouchers.json?cache=" + Date.now());
    if (!res.ok) throw new Error("Failed to load vouchers.json");
    validVoucherCodes = await res.json();
    renderVoucherList();
    return validVoucherCodes;
  } catch (err) {
    console.warn("Failed to load vouchers.json:", err);
    validVoucherCodes = [];
    renderVoucherList();
    return [];
  }
}

async function saveVoucherCodes() {
  try {
    await fetch("save_vouchers.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validVoucherCodes)
    });
    await loadVoucherCodes();
  } catch (err) {
    console.error("Voucher save failed:", err);
    showToast("Failed to save vouchers on server.", "error");
  }
}

// ---------------------- ADMIN PANEL ----------------------
function showAdminPanel() { document.getElementById("admin-panel").style.display = "flex"; renderVoucherList(); }
function hideAdminPanel() { document.getElementById("admin-panel").style.display = "none"; }

function renderVoucherList() {
  const container = document.getElementById("voucher-list");
  if (!container) return;
  const searchValue = (document.getElementById("search-vouchers")?.value || "").toUpperCase();
  const filter = document.getElementById("filter-status")?.value || "all";

  container.innerHTML = "";
  validVoucherCodes = validVoucherCodes || [];

  validVoucherCodes
    .filter(v => v.code?.toUpperCase().includes(searchValue))
    .filter(v => {
      if (filter === "unused") return !v.used;
      if (filter === "used") return v.used;
      return true;
    })
    .forEach(v => {
      const li = document.createElement("li");
      li.className = v.used ? "used" : "unused";
      li.innerHTML = `<span>${v.code}</span><span>₱${v.price || '—'} • ${v.used ? "❌ Used" : "✅ Unused"}</span>`;
      container.appendChild(li);
    });
}

// ---------------------- CSV EXPORT ----------------------
function downloadVouchers() {
  if (!validVoucherCodes.length) {
    showToast("No vouchers to export.", "info");
    return;
  }

  let csv = "Code,Price,Status\n";
  validVoucherCodes.forEach(v => {
    csv += `${v.code},${v.price},${v.used ? "Used" : "Unused"}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vouchers.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------- ADMIN FILTER & SEARCH ----------------------
document.getElementById("search-vouchers")?.addEventListener("input", renderVoucherList);
document.getElementById("filter-status")?.addEventListener("change", renderVoucherList);

function renderVoucherList() {
  const container = document.getElementById("voucher-list");
  if (!container) return;
  container.innerHTML = "";

  const search = document.getElementById("search-vouchers")?.value.toUpperCase() || "";
  const filter = document.getElementById("filter-status")?.value || "all";

  validVoucherCodes.forEach(v => {
    const matchesSearch = v.code.includes(search);
    const matchesFilter =
      filter === "all" ||
      (filter === "used" && v.used) ||
      (filter === "unused" && !v.used);

    if (matchesSearch && matchesFilter) {
      let item = document.createElement("li");
      item.className = v.used ? "used" : "unused";
      item.innerHTML = `<span>${v.code}</span><span>₱${v.price} ${v.used ? "❌" : "✅"}</span>`;
      container.appendChild(item);
    }
  });
}
