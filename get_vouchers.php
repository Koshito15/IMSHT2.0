<?php
// get_vouchers.php
header('Content-Type: application/json');
include 'db_connect.php';

$vouchers = [];
$sql = "SELECT code, price, is_used, used_by_ref_no, created_at FROM vouchers ORDER BY id DESC";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $row['used'] = (bool)$row['is_used'];
        $row['ref_no'] = $row['used_by_ref_no'];
        unset($row['is_used']);
        unset($row['used_by_ref_no']);
        $vouchers[] = $row;
    }
}

echo json_encode($vouchers);
$conn->close();
?>