// WifiSpot Kiosk Script v4.1.0
// Simplified "Buy Now" flow with dynamic QR codes

// ---------------------- CONFIG ----------------------
// IMPORTANT: Make sure your QR code image filenames match what you enter here.
const products = [
    { id: 1, name: "1 Hour", price: 5,   qrImage: "qr_5.jpg" },
    { id: 2, name: "3 Hours", price: 15,  qrImage: "qr_15.jpg" },
    { id: 3, name: "1 Day", price: 25,  qrImage: "qr_25.jpg" },
    { id: 4, name: "3 Days", price: 60,  qrImage: "qr_60.jpg" },
    { id: 5, name: "7 Days", price: 100, qrImage: "qr_100.jpg" }
];

// ---------------------- STATE ----------------------
let allVouchers = [];

// ---------------------- INITIALIZATION ----------------------
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("search-vouchers")?.addEventListener("input", renderVoucherList);
    document.getElementById("filter-status")?.addEventListener("change", renderVoucherList);
    
    showProducts();
    loadVouchersFromServer();
});

// ---------------------- UI MANAGEMENT ----------------------
function showScreen(screenId, button = null) {
    if (button) animateButton(button);

    setTimeout(() => {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
        }

        // Reset the redeem form when returning to the welcome screen
        if (screenId === 'welcome-screen') {
            const redeemInput = document.getElementById("redeem-code-input");
            const redeemMsg = document.getElementById("redeem-message");
            if (redeemInput) redeemInput.value = "";
            if (redeemMsg) redeemMsg.classList.add("hidden");
        }
    }, button ? 150 : 0);
}

function showToast(msg, type = "info") {
    // Remove any existing toast to prevent stacking
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        // Remove from DOM after fade out completes
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
        const div = document.createElement("div");
        div.className = "product";
        div.innerHTML = `
            <h4>${product.name}</h4>
            <p>₱${product.price}</p>
            <button onclick="buyNow(${product.id}, this)">Buy</button>
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

    // Set the price on the payment screen
    document.getElementById("payment-total").textContent = product.price;
    // Set the correct QR code image
    document.getElementById("payment-qr-img").src = product.qrImage;
    // Clear any previous reference number
    document.getElementById("gcash-ref-input").value = "";
    // Show the payment screen
    showScreen('payment-screen', button);
}

async function handleManualPayment(button) {
    const refInput = document.getElementById("gcash-ref-input");
    const refNo = refInput.value.trim();
    const amount = document.getElementById("payment-total").textContent;

    // Validate that the reference number is numeric and has a reasonable length
    if (!refNo || !/^\d{5,}$/.test(refNo)) {
        showToast("Please enter a valid GCash Reference Number.", "error");
        return;
    }
    
    // Disable button to prevent multiple clicks
    button.disabled = true;
    button.textContent = "Verifying...";
    animateButton(button);

    try {
        const response = await fetch("generate_voucher.php", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, refNo: refNo })
        });

        const result = await response.json();

        if (response.ok && result.voucherCode) {
            // Populate the success screen with details
            document.getElementById("success-amount").textContent = amount;
            document.getElementById("success-voucher-code").textContent = result.voucherCode;
            document.getElementById("success-ref-no").textContent = refNo;
            showScreen('success-screen');
            loadVouchersFromServer(); // Refresh admin panel data in the background
        } else {
            // Throw an error with the message from the server
            throw new Error(result.error || "An unknown error occurred.");
        }

    } catch (error) {
        console.error("Payment handling failed:", error);
        showToast(`Error: ${error.message}`, "error");
    } finally {
        // Re-enable the button after the process is complete
        button.disabled = false;
        button.textContent = "Get My Voucher";
    }
}

// ---------------------- REDEEM & VOUCHER LOGIC ----------------------
async function redeemVoucher() {
    const codeInput = document.getElementById("redeem-code-input");
    const code = (codeInput?.value || "").trim().toUpperCase();
    const messageEl = document.getElementById("redeem-message");

    if (!code) {
        messageEl.textContent = "❗ Please enter a voucher code.";
        messageEl.style.color = "#ffc107"; // Yellow for warning
        messageEl.classList.remove("hidden");
        return;
    }
    
    const voucher = allVouchers.find(v => v.code === code);
    
    if (!voucher) {
        messageEl.textContent = "❌ Invalid voucher code.";
        messageEl.style.color = "#dc3545"; // Red for error
    } else if (voucher.used) {
        messageEl.textContent = "⚠️ This voucher has already been used.";
        messageEl.style.color = "#ffc107"; // Yellow for warning
    } else {
        voucher.used = true;
        await saveVouchersToServer();
        messageEl.textContent = "✅ Connected! Enjoy the internet.";
        messageEl.style.color = "#28a745"; // Green for success
        renderVoucherList(); // Update admin panel if it's open
    }
    messageEl.classList.remove("hidden");
}

// ---------------------- SERVER COMMUNICATION (Vouchers) ----------------------
async function loadVouchersFromServer() {
    try {
        // Add a cache-busting parameter to ensure fresh data
        const response = await fetch("vouchers.json?t=" + new Date().getTime());
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

async function saveVouchersToServer() {
    try {
        await fetch("save_vouchers.php", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allVouchers)
        });
    } catch (error) {
        console.error("Failed to save vouchers:", error);
        showToast("Error saving voucher status to server.", "error");
    }
}

// ---------------------- ADMIN PANEL ----------------------
function showAdminPanel() {
    document.getElementById("admin-panel")?.classList.remove('hidden');
    loadVouchersFromServer(); // Always load fresh data when opening
}

function hideAdminPanel() {
    document.getElementById("admin-panel")?.classList.add('hidden');
}

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
        })
        .reverse(); // Show most recent vouchers first

    listEl.innerHTML = filteredVouchers.length ? '' : '<li>No vouchers found.</li>';

    filteredVouchers.forEach(v => {
        const li = document.createElement("li");
        li.className = v.used ? "used" : "unused";
        const refText = v.ref_no ? `• Ref: ${v.ref_no}` : '';
        li.innerHTML = `<span>${v.code}</span><span>₱${v.price} ${v.used ? "❌" : "✅"} ${refText}</span>`;
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

