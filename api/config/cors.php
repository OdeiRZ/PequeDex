<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | allowed_origins is '*' on purpose: this API is stateless-token auth
    | (Sanctum Bearer tokens in an Authorization header, not session cookies —
    | see the root README's architecture notes), so supports_credentials
    | stays false and there is no cookie/session to leak to a third-party
    | origin. Browsers only enforce a specific-origin allowlist when
    | credentials (cookies) are involved, so a wildcard here carries none of
    | the risk it would for a cookie-based API.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['ETag'],

    // Cuánto puede recordar el navegador el resultado del preflight (OPTIONS).
    // Con 0 repetía esa petición antes de CADA llamada con Authorization
    // (~125-280 ms medidos en producción). Chrome limita esto a 2 h.
    'max_age' => 7200,

    'supports_credentials' => false,

];
