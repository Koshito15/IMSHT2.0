// WifiSpot Kiosk Script - Champion Edition

// ---------------------- CONFIG ----------------------
const products = [
    { id: 1, name: "1 Hour", price: 5,   qrImage: "qr_5.jpg" },
    { id: 2, name: "3 Hours", price: 15,  qrImage: "qr_15.jpg" },
    { id: 3, name: "1 Day", price: 25,  qrImage: "qr_25.jpg" },
    { id: 4, name: "3 Days", price: 60,  qrImage: "qr_60.jpg" },
    { id: 5, name: "7 Days", price: 100, qrImage: "qr_100.jpg" }
];

// ---------------------- STATE ----------------------
let allVouchers = [];
let paymentTimer;

// ---------------------- INITIALIZATION ----------------------
document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("search-vouchers")?.addEventListener("input", renderVoucherList);
    document.getElementById("filter-status")?.addEventListener("change", renderVoucherList);
    
    await loadVouchersFromServer();
    showProducts();
});

// ---------------------- UI MANAGEMENT ----------------------
function showScreen(screenId, button = null) {
  const loader = document.getElementById('loader');
  const targetScreen = document.getElementById(screenId);

  if (paymentTimer) clearInterval(paymentTimer);
  if (button) animateButton(button);

  loader.classList.remove('hidden');

  setTimeout(() => {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
    if (targetScreen) targetScreen.classList.remove('hidden');

    if (screenId === 'welcome-screen') {
      const redeemInput = document.getElementById("redeem-code-input");
      const redeemMsg = document.getElementById("redeem-message");
      if (redeemInput) redeemInput.value = "";
      if (redeemMsg) redeemMsg.classList.add("hidden");
    }
    loader.classList.add('hidden');
  }, 400);
}

function showToast(msg, type = "info") {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function animateButton(element) {
    if (!element) return;
    element.classList.add("bouncing");
    setTimeout(() => element.classList.remove("bouncing"), 400);
}

// ---------------------- PURCHASE FLOW ----------------------
function showProducts() {
    const productList = document.getElementById("product-list");
    if (!productList) return;
    productList.innerHTML = "";
    products.forEach(product => {
        const isAvailable = allVouchers.some(v => v.price == product.price && !v.used);
        const div = document.createElement("div");
        div.className = "product";
        if (!isAvailable) div.classList.add('disabled');
        
        div.innerHTML = `
            ${!isAvailable ? '<span class="out-of-stock-badge">Sold Out</span>' : ''}
            <h4>${product.name}</h4>
            <p>₱${product.price}</p>
            <button onclick="buyNow(${product.id}, this)" ${!isAvailable ? 'disabled' : ''}>Buy</button>
        `;
        productList.appendChild(div);
    });
}

function buyNow(productId, button) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showToast("Product not found.", "error");
        return;
    }
    document.getElementById("payment-total").textContent = product.price;
    document.getElementById("payment-qr-img").src = product.qrImage;
    document.getElementById("gcash-ref-input").value = "";
    document.getElementById("customer-gcash-no").value = "";
    document.getElementById("payment-screenshot-input").value = "";
    showScreen('payment-screen', button);
    startPaymentTimer(10 * 60);
}

async function handleManualPayment(button) {
    const refInput = document.getElementById("gcash-ref-input");
    const screenshotInput = document.getElementById("payment-screenshot-input");
    const customerGcashNoInput = document.getElementById("customer-gcash-no");

    const refNo = refInput.value.trim();
    const screenshotFile = screenshotInput.files[0];
    const amount = document.getElementById("payment-total").textContent;
    const customerGcashNo = customerGcashNoInput.value.trim();

    if (!refNo || !/^\d{13}$/.test(refNo)) {
        showToast("Please enter a valid 13-digit GCash Reference Number.", "error");
        return;
    }
    if (!customerGcashNo || !/^(09|\+639)\d{9}$/.test(customerGcashNo)) {
        showToast("Please enter a valid PH mobile number (e.g., 09123456789).", "error");
        return;
    }
    if (!screenshotFile) {
        showToast("Please upload a payment screenshot.", "error");
        return;
    }
    
    button.disabled = true;
    button.textContent = "Verifying...";
    const formData = new FormData();
    formData.append('refNo', refNo);
    formData.append('amount', amount);
    formData.append('screenshot', screenshotFile);
    formData.append('customerGcashNo', customerGcashNo);

    try {
        const response = await fetch("handle_payment.php", {
            method: "POST",
            body: formData
        });
        const result = await response.json();

        if (response.ok && result.voucherCode) {
            document.getElementById("success-voucher-code").textContent = result.voucherCode;
            showScreen('success-screen');
        } else {
            throw new Error(result.error || "Payment verification failed.");
        }
    } catch (error) {
        console.error("Payment handling failed:", error);
        showToast(`Error: ${error.message}`, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Get My Voucher";
    }
}

function startPaymentTimer(durationInSeconds) {
    let timer = durationInSeconds;
    const display = document.getElementById('payment-timer');
    if (paymentTimer) clearInterval(paymentTimer);

    paymentTimer = setInterval(function () {
        let minutes = parseInt(timer / 60, 10);
        let seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        display.textContent = `Time left: ${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(paymentTimer);
            showToast("Payment time expired. Please try again.", "error");
            showScreen('welcome-screen');
        }
    }, 1000);
}

function copyVoucher() {
  const voucherCode = document.getElementById("success-voucher-code").textContent;
  navigator.clipboard.writeText(voucherCode).then(() => {
    showToast("Voucher copied to clipboard!", "success");
    const copyBtn = document.getElementById('copy-voucher-btn');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  }).catch(err => {
    showToast("Failed to copy.", "error");
  });
}

// ---------------------- SERVER & ADMIN ----------------------
async function loadVouchersFromServer() {
    try {
        const response = await fetch("get_vouchers.php?t=" + new Date().getTime());
        if (!response.ok) throw new Error("Network response was not ok.");
        const data = await response.json();
        allVouchers = Array.isArray(data) ? data : [];
        renderVoucherList();
    } catch (error) {
        console.error("Failed to load vouchers:", error);
        showToast("Could not load voucher data.", "error");
        allVouchers = [];
    }
}

function showAdminPanel() { document.getElementById("admin-panel")?.classList.remove('hidden'); }
function hideAdminPanel() { document.getElementById("admin-panel")?.classList.add('hidden'); }

function renderVoucherList() {
    const listEl = document.getElementById("voucher-list");
    if (!listEl) return;
    const searchValue = document.getElementById("search-vouchers").value.toUpperCase();
    const filterValue = document.getElementById("filter-status").value;
    const filteredVouchers = allVouchers
        .filter(v => v.code && v.code.toUpperCase().includes(searchValue))
        .filter(v => {
            if (filterValue === 'all') return true;
            if (filterValue === 'used') return v.used;
            if (filterValue === 'unused') return !v.used;
            return true;
        });
    listEl.innerHTML = filteredVouchers.length ? '' : '<li>No vouchers found.</li>';
    filteredVouchers.forEach(v => {
        const li = document.createElement("li");
        li.className = v.used ? "used" : "unused";
        const refText = v.ref_no ? `• Ref: ${v.ref_no}` : '';
        li.innerHTML = `<span>${v.code} (₱${v.price})</span><span>${v.used ? "Used" : "Available"}</span>`;
        listEl.appendChild(li);
    });
}

function downloadVouchers() {
    if (!allVouchers.length) return showToast("No vouchers to export.", "info");
    let csvContent = "Code,Price,Status,ReferenceNumber,CreatedAt\n";
    allVouchers.forEach(v => {
        const row = [v.code, v.price, v.used ? "Used" : "Unused", v.ref_no || '', v.created_at || ''].join(",");
        csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "wifispot_vouchers.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function redeemVoucher() {
    const codeInput = document.getElementById("redeem-code-input");
    const code = (codeInput?.value || "").trim().toUpperCase();
    const messageEl = document.getElementById("redeem-message");

    if (!code) {
        messageEl.textContent = "❗ Please enter a voucher code.";
        messageEl.style.color = "#ffc107"; // Yellow for warning
        messageEl.classList.remove("hidden");
        return;
    }
    
    // Check the code against the list loaded from the server
    const voucher = allVouchers.find(v => v.code === code);
    
    if (!voucher) {
        messageEl.textContent = "❌ Invalid voucher code. Please check and try again.";
        messageEl.style.color = "var(--error-red)";
    } else if (voucher.used) {
        messageEl.textContent = "⚠️ This voucher has already been used.";
        messageEl.style.color = "#ffc107"; // Yellow for warning
    } else {
        messageEl.textContent = "✅ This is a valid voucher. Please connect to the Wifi network and enter it on the login page.";
        messageEl.style.color = "var(--success-green)";
    }
    messageEl.classList.remove("hidden");
}