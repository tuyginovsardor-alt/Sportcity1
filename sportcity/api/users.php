<?php
// ============================================
// api/users.php — Foydalanuvchilar API
// ============================================

$db = getDB();

switch ($method) {

    // Foydalanuvchi ma'lumoti
    case 'GET':
        if (empty($_GET['phone'])) jsonError('phone kerak', 400);
        $phone = preg_replace('/\D/', '', $_GET['phone']);

        $stmt = $db->prepare(
            "SELECT id, phone, name, coins, is_admin, created_at FROM users WHERE phone = ?"
        );
        $stmt->execute([$phone]);
        $user = $stmt->fetch();

        if (!$user) {
            // Avtomatik yaratish
            $db->prepare("INSERT INTO users (phone, coins) VALUES (?,0)")
               ->execute([$phone]);
            $user = ['phone' => $phone, 'name' => '', 'coins' => 0, 'is_admin' => 0];
        }

        // Foydalanuvchi zakazlari
        $orders = $db->prepare(
            "SELECT * FROM orders WHERE user_phone = ? ORDER BY created_at DESC LIMIT 10"
        );
        $orders->execute([$phone]);
        $user['orders'] = $orders->fetchAll();

        jsonSuccess($user);

    // Foydalanuvchi yaratish / yangilash
    case 'POST':
        $b = getBody();
        if (empty($b['phone'])) jsonError('phone kerak', 422);
        $phone = preg_replace('/\D/', '', $b['phone']);

        $db->prepare("
            INSERT INTO users (phone, name, coins)
            VALUES (?,?,0)
            ON DUPLICATE KEY UPDATE name = VALUES(name)
        ")->execute([$phone, trim($b['name'] ?? '')]);

        $stmt = $db->prepare("SELECT * FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        jsonSuccess($stmt->fetch(), 201);

    // Coin qo'shish (admin)
    case 'PUT':
        requireAdmin();
        $b = getBody();
        if (empty($b['phone'])) jsonError('phone kerak', 422);
        $phone = preg_replace('/\D/', '', $b['phone']);
        $coins = (int)($b['coins'] ?? 0);

        $db->prepare("
            INSERT INTO users (phone, coins) VALUES (?,?)
            ON DUPLICATE KEY UPDATE coins = coins + VALUES(coins)
        ")->execute([$phone, $coins]);

        $stmt = $db->prepare(
            "SELECT id, phone, name, coins FROM users WHERE phone = ?"
        );
        $stmt->execute([$phone]);
        jsonSuccess($stmt->fetch());

    default:
        jsonError('Method ruxsat etilmagan', 405);
}
