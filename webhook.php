<?php
// webhook.php
require 'voucher_utils.php';

// read raw body
$input = file_get_contents('php://input');
if (!$input) {
    http_response_code(400);
    echo 'No input';
    exit;
}

// log raw for debugging
file_put_contents('webhook.log', date('c') . " " . $input . PHP_EOL, FILE_APPEND);

$event = json_decode($input, true);
if (!$event) {
    http_response_code(400);
    echo 'Invalid JSON';
    exit;
}

/*
 PayMongo event payload structure can vary.
 For safety inspect the payload and find the actual event type.
 Common approach: check `type` or `data.type`.
 For this example we handle `payment.paid` or source events that indicate payment succeeded.
*/

$type = $event['type'] ?? ($event['data']['type'] ?? null);

// If the webhook indicates a successful payment, create a voucher
// Adjust this logic depending on actual PayMongo payload in your dashboard logs.
if ($type === 'payment.paid' || $type === 'source.chargeable' || $type === 'source.paid') {
    // Attempt to obtain amount (in cents) from payload
    $amountCentavos = null;

    // many events contain attributes.data.attributes.amount
    if (isset($event['data']['attributes']['amount'])) {
        $amountCentavos = intval($event['data']['attributes']['amount']);
    } else {
        // try nested patterns
        $possible = $event['data']['attributes']['data']['attributes'] ?? null;
        if ($possible && isset($possible['amount'])) $amountCentavos = intval($possible['amount']);
    }

    // Fallback amount
    $amountPesos = $amountCentavos ? round($amountCentavos / 100, 2) : 0;

    // Generate voucher code & save
    $code = generateVoucherCode();
    saveVoucher($amountPesos, $code);

    // log
    file_put_contents('payments.log', date('c') . " Generated voucher {$code} for ₱{$amountPesos}\n", FILE_APPEND);
}

// acknowledge
http_response_code(200);
echo json_encode(['status' => 'ok']);