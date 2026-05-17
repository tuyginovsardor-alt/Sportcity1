<?php
// ============================================
// api/banners.php — Hero Banner CRUD
// ============================================

$db = getDB();

switch ($method) {

    case 'GET':
        $stmt = $db->query(
            "SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC"
        );
        jsonSuccess($stmt->fetchAll());

    case 'POST':
        requireAdmin();
        $b = getBody();
        if (empty($b['title']) || empty($b['img'])) jsonError('title va img kerak', 422);

        $stmt = $db->prepare("
            INSERT INTO banners (title, subtitle, btn_text, img, is_active, sort_order)
            VALUES (?,?,?,?,?,?)
        ");
        $stmt->execute([
            trim($b['title']),
            trim($b['subtitle'] ?? ''),
            trim($b['btn_text'] ?? "Ko'proq ko'rish"),
            trim($b['img']),
            isset($b['is_active']) ? (int)$b['is_active'] : 1,
            (int)($b['sort_order'] ?? 0),
        ]);
        $newId = $db->lastInsertId();
        $row = $db->query("SELECT * FROM banners WHERE id = $newId")->fetch();
        jsonSuccess($row, 201);

    case 'PUT':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);
        $b = getBody();

        $fields = []; $params = [];
        foreach (['title','subtitle','btn_text','img','is_active','sort_order'] as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $params[] = in_array($f, ['is_active','sort_order']) ? (int)$b[$f] : $b[$f];
            }
        }
        if (empty($fields)) jsonError('Yangilanadigan maydon yo\'q', 422);
        $params[] = $id;
        $db->prepare("UPDATE banners SET " . implode(', ', $fields) . " WHERE id = ?")
           ->execute($params);

        $row = $db->query("SELECT * FROM banners WHERE id = $id")->fetch();
        jsonSuccess($row);

    case 'DELETE':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);
        $db->prepare("DELETE FROM banners WHERE id = ?")->execute([$id]);
        jsonSuccess(['deleted' => true]);

    default:
        jsonError('Method ruxsat etilmagan', 405);
}
