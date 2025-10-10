<?php
// save_vouchers.php
// Receives raw JSON array of vouchers and overwrites vouchers.json
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

$body = file_get_contents('php://input');
if (!$body) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No data received']);
    exit;
}

// Basic validation: ensure JSON decodes
$data = json_decode($body, true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

file_put_contents('vouchers.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo json_encode(['status' => 'ok']);