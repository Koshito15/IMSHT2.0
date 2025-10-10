<?php
// failed.php
$vouchersFile = "vouchers.json";
$amount = 0;
$status = "unknown";

$sourceId = $_GET['id'] ?? null;

if ($sourceId && file_exists($vouchersFile)) {
    $vouchers = json_decode(file_get_contents($vouchersFile), true);
    if (is_array($vouchers)) {
        foreach ($vouchers as $voucher) {
            if ($voucher['source_id'] === $sourceId) {
                $amount = $voucher['price'];
                $status = $voucher['status'] ?? "unknown";
                break;
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
  <link rel="stylesheet" href="style.css?v=2">
</head>
<body>
  <div class="kiosk">
    <div class="kiosk-container">
      <h2>❌ Payment Failed</h2>
      <?php if ($amount > 0): ?>
        <p>Your payment attempt of ₱<?php echo htmlspecialchars($amount); ?> has status: <b><?php echo htmlspecialchars($status); ?></b>.</p>
      <?php else: ?>
        <p>Unfortunately, your payment did not go through.</p>
      <?php endif; ?>
      <button onclick="window.location.href='index.html'">Try Again</button>
    </div>
  </div>
</body>
</html>
