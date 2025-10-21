<?php
// admin_add_vouchers.php
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    include 'db_connect.php';
    
    $price = $_POST['price'] ?? 0;
    $codes_text = $_POST['codes'] ?? '';
    
    $codes = preg_split('/\s+/', $codes_text, -1, PREG_SPLIT_NO_EMPTY);
    
    if (!empty($codes) && $price > 0) {
        $stmt = $conn->prepare("INSERT INTO vouchers (code, price) VALUES (?, ?)");
        $count = 0;
        foreach ($codes as $code) {
            $code = trim(strtoupper($code));
            if (!empty($code)) {
                $stmt->bind_param("si", $code, $price);
                if ($stmt->execute()) {
                    $count++;
                }
            }
        }
        $message = "Successfully added $count new vouchers for ₱$price!";
        $stmt->close();
    } else {
        $message = "Please provide valid codes and select a price.";
    }
    $conn->close();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Add Vouchers</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
        .container { max-width: 500px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        textarea { width: 100%; height: 200px; margin-bottom: 10px; box-sizing: border-box; }
        select, button { width: 100%; padding: 10px; margin-bottom: 10px; box-sizing: border-box; }
        .message { padding: 10px; background: #d4edda; border: 1px solid #c3e6cb; color: #155724; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Add New Vouchers</h2>
        <?php if ($message): ?>
            <p class="message"><?php echo htmlspecialchars($message); ?></p>
        <?php endif; ?>
        <form method="POST">
            <label for="codes">Voucher Codes (one per line):</label>
            <textarea id="codes" name="codes" required></textarea>
            
            <label for="price">Select Price Tier:</label>
            <select id="price" name="price" required>
                <option value="">-- Select Price --</option>
                <option value="5">1 Hour (₱5)</option>
                <option value="15">3 Hours (₱15)</option>
                <option value="25">1 Day (₱25)</option>
                <option value="60">3 Days (₱60)</option>
                <option value="100">7 Days (₱100)</option>
            </select>
            
            <button type="submit">Add Vouchers</button>
        </form>
    </div>
</body>
</html>