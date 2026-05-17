<?php
// ============================================
// api/orders.php — Zakazlar API
// ============================================

$db = getDB();

switch ($method) {

    // Barcha zakazlar (admin) yoki foydalanuvchi zakazlari
    case 'GET':
        if (!empty($_GET['phone'])) {
            $stmt = $db->prepare(
                "SELECT * FROM orders WHERE user_phone = ? ORDER BY created_at DESC"
            );
            $stmt->execute([$_GET['phone']]);
            jsonSuccess($stmt->fetchAll());
        }

        // Admin — barcha zakazlar
        requireAdmin();
        $status = $_GET['status'] ?? '';
        if ($status) {
            $stmt = $db->prepare(
                "SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC"
            );
            $stmt->execute([$status]);
        } else {
            $stmt = $db->query("SELECT * FROM orders ORDER BY created_at DESC");
        }
        $rows = $stmt->fetchAll();
        jsonSuccess(['orders' => $rows, 'total' => count($rows)]);

    // Yangi zakaz yaratish
    case 'POST':
        $b = getBody();
        foreach (['user_phone','items','total'] as $f) {
            if (empty($b[$f])) jsonError("$f majburiy", 422);
        }

        $orderCode   = '#' . strtoupper(substr(md5(uniqid()), 0, 6));
        $coinsEarned = (int)($b['coins_earned'] ?? 10);

        $stmt = $db->prepare("
            INSERT INTO orders (order_code, user_phone, items, total, coins_earned, status)
            VALUES (?,?,?,?,?,'new')
        ");
        $stmt->execute([
            $orderCode,
            $b['user_phone'],
            is_array($b['items']) ? json_encode($b['items'], JSON_UNESCAPED_UNICODE) : $b['items'],
            (int)$b['total'],
            $coinsEarned,
        ]);
        $newId = $db->lastInsertId();

        // Foydalanuvchiga coin qo'shish
        $db->prepare("
            INSERT INTO users (phone, coins) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE coins = coins + VALUES(coins)
        ")->execute([$b['user_phone'], $coinsEarned]);

        $row = $db->query("SELECT * FROM orders WHERE id = $newId")->fetch();
        jsonSuccess($row, 201);

    // Zakaz statusini yangilash (admin)
    case 'PUT':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);
        $b = getBody();

        $allowed = ['new','processing','delivered','cancelled'];
        if (empty($b['status']) || !in_array($b['status'], $allowed)) {
            jsonError('Status noto\'g\'ri. Mumkin: ' . implode(', ', $allowed), 422);
        }

        $db->prepare("UPDATE orders SET status = ? WHERE id = ?")
           ->execute([$b['status'], $id]);

        $row = $db->query("SELECT * FROM orders WHERE id = $id")->fetch();
        jsonSuccess($row);

    default:
        jsonError('Method ruxsat etilmagan', 405);
}
