<?php
// discord-login.php — замена netlify/functions/discord-login.js

$client_id = getenv('DISCORD_CLIENT_ID') ?: '';
$redirect_uri = getenv('DISCORD_REDIRECT_URI') ?: 'https://xn--80ac4aie0d0a.com/discord-callback.php';

$redirect_param = isset($_GET['redirect']) ? $_GET['redirect'] : '';

$params = http_build_query([
    'client_id'     => $client_id,
    'redirect_uri'  => $redirect_uri,
    'response_type' => 'code',
    'scope'         => 'identify',
    'state'         => $redirect_param,
]);

header('Location: https://discord.com/api/oauth2/authorize?' . $params);
exit;
