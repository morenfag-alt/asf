<?php
// discord-callback.php — замена netlify/functions/discord-callback.js

function do_redirect($url) {
    header('Location: ' . $url);
    exit;
}

$code        = isset($_GET['code'])  ? $_GET['code']  : null;
$error       = isset($_GET['error']) ? $_GET['error'] : null;
$state_param = isset($_GET['state']) ? $_GET['state'] : '';

if ($error || !$code) {
    do_redirect('/?auth=error');
}

$client_id     = getenv('DISCORD_CLIENT_ID')     ?: '';
$client_secret = getenv('DISCORD_CLIENT_SECRET') ?: '';
$redirect_uri  = getenv('DISCORD_REDIRECT_URI')  ?: 'https://xn--80ac4aie0d0a.com/discord-callback.php';
$supabase_url  = getenv('SUPABASE_URL')          ?: '';
$supabase_key  = getenv('SUPABASE_SERVICE_KEY')  ?: '';

// --- Helper: HTTP request ---
function http_post($url, $body, $headers = []) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => implode("\r\n", $headers),
        'content' => $body,
        'ignore_errors' => true,
    ]]);
    return file_get_contents($url, false, $ctx);
}

function http_get($url, $headers = []) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'header'  => implode("\r\n", $headers),
        'ignore_errors' => true,
    ]]);
    return file_get_contents($url, false, $ctx);
}

function http_patch($url, $body, $headers = []) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'PATCH',
        'header'  => implode("\r\n", $headers),
        'content' => $body,
        'ignore_errors' => true,
    ]]);
    return file_get_contents($url, false, $ctx);
}

// Step 1: Exchange code for token
$token_body = http_build_query([
    'client_id'     => $client_id,
    'client_secret' => $client_secret,
    'grant_type'    => 'authorization_code',
    'code'          => $code,
    'redirect_uri'  => $redirect_uri,
]);

$token_res = http_post('https://discord.com/api/oauth2/token', $token_body, [
    'Content-Type: application/x-www-form-urlencoded',
]);

if (!$token_res) do_redirect('/?auth=error');
$token_data = json_decode($token_res, true);
if (empty($token_data['access_token'])) do_redirect('/?auth=error');

$access_token = $token_data['access_token'];

// Step 2: Get Discord user
$user_res = http_get('https://discord.com/api/users/@me', [
    'Authorization: Bearer ' . $access_token,
]);
if (!$user_res) do_redirect('/?auth=error');
$discord_user = json_decode($user_res, true);

$avatar_url = $discord_user['avatar']
    ? "https://cdn.discordapp.com/avatars/{$discord_user['id']}/{$discord_user['avatar']}.png?size=128"
    : "https://cdn.discordapp.com/embed/avatars/" . (intval($discord_user['discriminator'] ?? 0) % 5) . ".png";

$sb_headers = [
    'apikey: ' . $supabase_key,
    'Authorization: Bearer ' . $supabase_key,
    'Content-Type: application/json',
];

// Step 3: Upsert user in Supabase
$upsert_body = json_encode([
    'discord_id'  => $discord_user['id'],
    'username'    => $discord_user['username'],
    'avatar_url'  => $avatar_url,
]);

$sb_res = http_post(
    $supabase_url . '/rest/v1/users?on_conflict=discord_id',
    $upsert_body,
    array_merge($sb_headers, ['Prefer: resolution=merge-duplicates,return=representation'])
);

if (!$sb_res) do_redirect('/?auth=error');
$sb_data = json_decode($sb_res, true);
if (empty($sb_data[0])) do_redirect('/?auth=error');

$saved_user = $sb_data[0];
$final_uid  = $saved_user['uid'] ?? null;

// Step 4: Assign uid if missing
if ($final_uid === null) {
    $max_res  = http_get(
        $supabase_url . '/rest/v1/users?select=uid&uid=not.is.null&order=uid.desc&limit=1',
        $sb_headers
    );
    $max_rows = json_decode($max_res, true);
    $next_uid = (!empty($max_rows[0]['uid'])) ? ($max_rows[0]['uid'] + 1) : 1;

    $patch_res = http_patch(
        $supabase_url . '/rest/v1/users?discord_id=eq.' . urlencode($discord_user['id']),
        json_encode(['uid' => $next_uid]),
        array_merge($sb_headers, ['Prefer: return=representation'])
    );

    $patch_rows = json_decode($patch_res, true);
    $final_uid  = $patch_rows[0]['uid'] ?? $next_uid;
}

$user_data = base64_encode(json_encode([
    'id'         => $saved_user['id'],
    'uid'        => $final_uid,
    'discord_id' => $discord_user['id'],
    'username'   => $discord_user['username'],
    'avatar_url' => $avatar_url,
]));

if ($state_param === 'typing') {
    $redirect_to = '/typing.html';
} elseif ($state_param === 'templates') {
    $redirect_to = '/templates.html';
} else {
    $redirect_to = '/';
}
$sep         = (strpos($redirect_to, '?') !== false) ? '&' : '?';
do_redirect($redirect_to . $sep . 'user=' . urlencode($user_data));
