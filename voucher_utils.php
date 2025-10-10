<?php
// voucher_utils.php

function generateVoucherCode($length = 8) {
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    $code = "";
    for ($i = 0; $i < $length; $i++) {
        $code .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $code;
}

function saveVoucher($amount, $code) {
    $file = __DIR__ . '/vouchers.json';
    $vouchers = [];

    if (file_exists($file)) {
        $contents = file_get_contents($file);
        $vouchers = json_decode($contents, true);
        if (!is_array($vouchers)) $vouchers = [];
    }

    $vouchers[] = [
        "code" => $code,
        "price" => $amount,
        "used" => false,
        "created_at" => date("Y-m-d H:i:s")
    ];

    file_put_contents($file, json_encode($vouchers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}