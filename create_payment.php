<?php
// create_payment.php
// Expects JSON POST: { amount_centavos: 10000, currency: "PHP", description: "..." }
// Returns JSON { success: true, checkout_url: "..." } or { success: false, error: "..." }

header('Content-Type: application/json');

// Read JSON body
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$amount = isset($input['amount_centavos']) ? intval($input['amount_centavos']) : 0;
$currency = isset($input['currency']) ? strtoupper($input['currency']) : 'PHP';
$description = isset($input['description']) ? $input['description'] : 'Order';

// Validate
if ($amount <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Amount must be > 0']);
    exit;
}

// PayMongo secret key - DO NOT put this in a public repo in real life.
// Replace this with an environment variable in production, e.g. getenv('PAYMONGO_SECRET_KEY')
$secretKey = getenv('sk_test_psr9m6mXoYfv8NKSopxbhN3Q'); // recommended
if (!$secretKey) {
    // fallback for local testing (NOT recommended publicly)
    $secretKey = 'sk_test_psr9m6mXoYfv8NKSopxbhN3Q';
}
if ($secretKey === 'sk_test_psr9m6mXoYfv8NKSopxbhN3Q') {
    // This is just a warning — server can still attempt, but better to set an env var
    error_log("Warning: using placeholder PayMongo secret key. Set PAYMONGO_SECRET_KEY env variable.");
}

// Build checkout session payload
$payload = [
    "data" => [
        "attributes" => [
            "amount" => $amount,
            "currency" => $currency,
            "success_url" => "https://koshito15.github.io/IMSHT2.0/success.php",
            "failure_url" => "https://koshito15.github.io/IMSHT2.0/failed.php",
            "payment_method_types" => ["gcash","card"], // request the methods you want enabled
            "metadata" => [
                "description" => $description
            ],
        ]
    ]
];

$ch = curl_init("https://api.paymongo.com/v1/checkout_sessions");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERPWD, $secretKey . ":"); // PayMongo uses basic auth with secret key as user
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'cURL error: ' . $curlErr]);
    exit;
}

$respJson = json_decode($response, true);

// If PayMongo returns a checkout session, it will be in data.attributes.checkout_url or data.attributes.redirect_url
if (isset($respJson['data']['attributes']['checkout_url'])) {
    $checkoutUrl = $respJson['data']['attributes']['checkout_url'];
    echo json_encode(['success' => true, 'checkout_url' => $checkoutUrl]);
    exit;
}

// Some responses may embed links differently; attempt to find a reasonable URL
// Try to parse for fallback link
if (isset($respJson['data']['attributes']['redirect_url'])) {
    echo json_encode(['success' => true, 'checkout_url' => $respJson['data']['attributes']['redirect_url']]);
    exit;
}

// Otherwise return the raw response for troubleshooting
http_response_code($httpcode ? $httpcode : 500);
echo json_encode(['success' => false, 'error' => 'Unexpected PayMongo response', 'raw' => $respJson]);
exit;
