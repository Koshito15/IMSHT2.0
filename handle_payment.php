<?php
// handle_payment.php
header('Content-Type: application/json');
include 'db_connect.php';

// --- File Upload Handling ---
$uploadDir = 'uploads/';
$screenshotPath = null;
$errorMessage = '';

if (isset($_FILES['screenshot']) && $_FILES['screenshot']['error'] === UPLOAD_ERR_OK) {
    $file = $_FILES['screenshot'];
    $fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $allowedExtensions = ['jpg', 'jpeg', 'png'];

    if (in_array(strtolower($fileExtension), $allowedExtensions)) {
        $uniqueName = uniqid('payment_', true) . '.' . $fileExtension;
        $destination = $uploadDir . $uniqueName;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            $errorMessage = 'Failed to save the uploaded file. Check folder permissions.';
        }
    } else {
        $errorMessage = 'Invalid file type. Only JPG and PNG are allowed.';
    }
} else {
    $errorMessage = 'Screenshot upload failed. Please try again.';
}

if ($errorMessage) {
    echo json_encode(['error' => $errorMessage]);
    exit();
}

// --- Voucher Generation Logic ---
$amount = $_POST['amount'] ?? 0;
$refNo = $_POST['refNo'] ?? '';
$customerGcashNo = $_POST['customerGcashNo'] ?? '';

if (empty($amount) || empty($refNo) || !ctype_digit($refNo) || empty($customerGcashNo)) {
    echo json_encode(['error' => 'Missing or invalid payment details.']);
    exit();
}

$conn->begin_transaction();

try {
    // Prevent duplicate reference numbers
    $checkStmt = $conn->prepare("SELECT id FROM payments WHERE gcash_ref_no = ?");
    $checkStmt->bind_param("s", $refNo);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        throw new Exception('This GCash Reference Number has already been used.');
    }
    $checkStmt->close();

    // Find an available voucher for the price
    $stmt = $conn->prepare("SELECT id, code FROM vouchers WHERE price = ? AND is_used = FALSE LIMIT 1 FOR UPDATE");
    $stmt->bind_param("i", $amount);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $voucher = $result->fetch_assoc();
        $voucherId = $voucher['id'];
        $voucherCode = $voucher['code'];
        
        // Mark voucher as used
        $updateStmt = $conn->prepare("UPDATE vouchers SET is_used = TRUE, used_at = NOW(), used_by_ref_no = ? WHERE id = ?");
        $updateStmt->bind_param("si", $refNo, $voucherId);
        $updateStmt->execute();
        $updateStmt->close();

        // Log the payment
        $paymentStmt = $conn->prepare("INSERT INTO payments (gcash_ref_no, amount, customer_gcash_no, screenshot_url, status) VALUES (?, ?, ?, ?, 'voucher_issued')");
        $paymentStmt->bind_param("sdss", $refNo, $amount, $customerGcashNo, $destination);
        $paymentStmt->execute();
        $paymentStmt->close();

        $conn->commit();
        echo json_encode(['voucherCode' => $voucherCode]);
    } else {
        throw new Exception('Sorry, no vouchers available for this amount. Please contact an admin.');
    }
    $stmt->close();
} catch (Exception $e) {
    $conn->rollback();
    if (file_exists($destination)) {
        unlink($destination);
    }
    echo json_encode(['error' => $e->getMessage()]);
}

$conn->close();
?>