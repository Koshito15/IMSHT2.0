<?php
// success.php

// Load existing vouchers
$vouchersFile = "vouchers.json";
$vouchers = [];
if (file_exists($vouchersFile)) {
    $vouchers = json_decode(file_get_contents($vouchersFile), true);
    if (!is_array($vouchers)) $vouchers = [];
}

// Helper: generate random voucher code
function generateVoucherCode($length = 8) {
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    $code = "";
    for ($i = 0; $i < $length; $i++) {
        $code .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $code;
}

// Read amount from localStorage fallback (or PayMongo API if needed)
// For now, simulate using GET parameter (or manually set for testing)
$amount = isset($_GET['amount']) ? intval($_GET['amount']) / 100 : 0; // convert centavos → pesos

// Generate voucher
$voucherCode = generateVoucherCode();
$newVoucher = [
    "code" => $voucherCode,
    "price" => $amount,
    "used" => false
];

// Save voucher
$vouchers[] = $newVoucher;
file_put_contents($vouchersFile, json_encode($vouchers, JSON_PRETTY_PRINT));

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="kiosk">
    <div class="kiosk-container">
      <h2>✅ Payment Successful!</h2>
      <p>Amount Paid: ₱<?php echo htmlspecialchars($amount); ?></p>
      <h3>Your Voucher Code:</h3>
      <p class="voucher-display"><?php echo htmlspecialchars($voucherCode); ?></p>
      <button onclick="window.location.href='index.html'">Return Home</button>
    </div>
  </div>
</body>
</html>