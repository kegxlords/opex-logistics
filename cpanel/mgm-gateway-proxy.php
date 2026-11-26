<?php
/**
 * MGM Pay NGN relay for cPanel shared hosting.
 *
 * Upload this file to HTTPS hosting with a stable outbound IP. MGM credentials
 * are supplied by Vercel at request time; only the relay shared secret below
 * must match MGM_PROXY_SHARED_SECRET in Vercel.
 */
const PROXY_SHARED_SECRET = 'REPLACE_WITH_A_LONG_RANDOM_SHARED_SECRET';

function json_response($status, $body) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
function header_value($name) {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    foreach ($headers as $key => $value) if (strtolower($key) === strtolower($name)) return $value;
    return '';
}
function scalar_signature($fields, $secret, $nested) {
    $pairs = [];
    foreach ($fields as $name => $value) {
        if ($name === 'signature' || in_array($name, $nested, true) || is_array($value) || is_object($value) || $value === '' || $value === null) continue;
        $pairs[(string)$name] = (string)$value;
    }
    uksort($pairs, 'strcmp');
    $parts = [];
    foreach ($pairs as $name => $value) $parts[] = $name . '=' . $value;
    return strtoupper(md5(implode('&', $parts) . '&key=' . $secret));
}
function mgm_request($path, $data, $secret, $config) {
    $data['timestamp'] = (int)round(microtime(true) * 1000);
    $data['signature'] = scalar_signature($data, $secret, ['payee', 'payer']);
    $nonce = substr(bin2hex(random_bytes(8)), 0, 8);
    $payload = json_encode(['merchant_no' => $config['merchant_no'], 'data' => $data], JSON_UNESCAPED_SLASHES);
    $ch = curl_init(rtrim($config['base_url'], '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'ApiVersion: 1.0', 'AppId: ' . $config['app_id'], 'Noncestr: ' . $nonce, 'Timestamp: ' . $data['timestamp']],
        CURLOPT_POSTFIELDS => $payload
    ]);
    $raw = curl_exec($ch); $error = curl_error($ch); $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($error) json_response(502, ['success' => false, 'error' => 'MGM connection failed: ' . $error]);
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) json_response(502, ['success' => false, 'error' => 'MGM returned invalid JSON.', 'http_status' => $status]);
    if ($status < 200 || $status >= 300 || ($decoded['state'] ?? '') !== 'ok') {
        json_response(502, ['success' => false, 'error' => $decoded['message'] ?? $decoded['data']['status_detail'] ?? 'MGM rejected the request.', 'provider' => $decoded]);
    }
    return $decoded;
}
$raw = file_get_contents('php://input');
$provided = header_value('X-MGM-Proxy-Signature');
$expected = hash_hmac('sha256', $raw, PROXY_SHARED_SECRET);
if (!$provided || !hash_equals($expected, $provided)) json_response(401, ['success' => false, 'error' => 'Invalid relay signature.']);
$input = json_decode($raw, true);
if (!is_array($input)) json_response(400, ['success' => false, 'error' => 'JSON body required.']);
$config = $input['config'] ?? [];
foreach (['base_url','merchant_no','app_id','collection_key','payout_key','deposit_notification_url','withdrawal_notification_url','success_redirect_url'] as $required) {
    if (!isset($config[$required]) || $config[$required] === '') json_response(400, ['success' => false, 'error' => 'Missing relay configuration: ' . $required]);
}
$action = $input['action'] ?? '';
if ($action === 'deposit') {
    $order = (string)($input['reference'] ?? ''); $amount = number_format((float)($input['amount'] ?? 0), 2, '.', '');
    if (!$order || (float)$amount <= 0) json_response(400, ['success' => false, 'error' => 'Invalid deposit order.']);
    $provider = mgm_request('/api/pay/payment', [
        'country' => 'NG', 'currency' => 'NGN', 'payment_method_id' => 'BANK_CARD', 'payment_method_flow' => 'REDIRECT',
        'order_id' => $order, 'amount' => $amount, 'notification_url' => $config['deposit_notification_url'],
        'success_redirect_url' => $config['success_redirect_url']
    ], $config['collection_key'], $config);
    json_response(200, ['success' => true, 'gateway_reference' => $provider['data']['payment_id'] ?? $order, 'checkout_url' => $provider['data']['redirect_url'] ?? null, 'provider' => $provider]);
}
if ($action === 'withdrawal') {
    $order = (string)($input['reference'] ?? ''); $amount = number_format((float)($input['amount'] ?? 0), 2, '.', '');
    $bankCode = (string)($input['bank_code'] ?? '');
    if (!$order || (float)$amount <= 0 || !$bankCode) json_response(400, ['success' => false, 'error' => 'Withdrawal reference, amount, and bank code are required.']);
    $provider = mgm_request('/api/settle/settlement', [
        'country' => 'NG', 'currency' => 'NGN', 'order_id' => $order, 'amount' => $amount,
        'notification_url' => $config['withdrawal_notification_url'],
        'payee' => ['name' => (string)($input['account_name'] ?? ''), 'account' => (string)($input['account_number'] ?? ''), 'account_type' => 'BANK', 'bank_code' => $bankCode]
    ], $config['payout_key'], $config);
    json_response(200, ['success' => true, 'gateway_reference' => $provider['data']['settlement_id'] ?? $order, 'provider' => $provider]);
}
json_response(400, ['success' => false, 'error' => 'Unknown gateway action.']);
