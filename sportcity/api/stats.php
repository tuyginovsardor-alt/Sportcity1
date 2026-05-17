<?php
// ============================================
// api/stats.php — Admin Dashboard Statistika
// ============================================

requireAdmin();
$db = getDB();

if ($method !== 'GET') jsonError('Faqat GET', 405);

// Umumiy statistika
$totalProducts  = (int)$db->query("SELECT COUNT(*) FROM products WHERE is_active=1")->fetchColumn();
$totalOrders    = (int)$db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
$totalUsers     = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
$totalRevenue   = (int)($db->query("SELECT COALESCE(SUM(total),0) FROM orders WHERE status != 'cancelled'")->fetchColumn());
$newOrders      = (int)$db->query("SELECT COUNT(*) FROM orders WHERE status='new'")->fetchColumn();
$todayOrders    = (int)$db->query("SELECT COUNT(*) FROM orders WHERE DATE(created_at)=CURDATE()")->fetchColumn();

// Oxirgi 5 zakaz
$recentOrders = $db->query(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5"
)->fetchAll();

// Kategoriya bo'yicha mahsulot soni
$catStats = $db->query(
    "SELECT cat, COUNT(*) as count FROM products WHERE is_active=1 GROUP BY cat ORDER BY count DESC"
)->fetchAll();

// Eng ko'p sotilgan (zakaz bo'yicha simulyatsiya)
$topProducts = $db->query(
    "SELECT id, brand, name, price, img FROM products WHERE is_active=1 ORDER BY reviews DESC LIMIT 5"
)->fetchAll();

jsonSuccess([
    'summary' => [
        'total_products' => $totalProducts,
        'total_orders'   => $totalOrders,
        'total_users'    => $totalUsers,
        'total_revenue'  => $totalRevenue,
        'new_orders'     => $newOrders,
        'today_orders'   => $todayOrders,
    ],
    'recent_orders' => $recentOrders,
    'cat_stats'     => $catStats,
    'top_products'  => $topProducts,
]);
