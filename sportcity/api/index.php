<?php
// ============================================
// api/index.php — Asosiy API Router
// Barcha so'rovlar shu yerdan o'tadi
// ============================================

require_once __DIR__ . '/config.php';
setHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$uri    = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

// URI dan api/ prefiksini olib tashlash
$uri = preg_replace('#^api/?#', '', $uri);
$parts = explode('/', $uri);
$resource = $parts[0] ?? '';
$id = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;

// ─── Route ───
match ($resource) {
    'products'   => require __DIR__ . '/products.php',
    'categories' => require __DIR__ . '/categories.php',
    'banners'    => require __DIR__ . '/banners.php',
    'orders'     => require __DIR__ . '/orders.php',
    'users'      => require __DIR__ . '/users.php',
    'admin'      => require __DIR__ . '/admin.php',
    'stats'      => require __DIR__ . '/stats.php',
    default      => jsonError('Route topilmadi: ' . $resource, 404),
};
