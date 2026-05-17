<?php
// ============================================
// api/categories.php — Kategoriyalar CRUD
// ============================================

$db = getDB();

switch ($method) {

    case 'GET':
        $stmt = $db->query("SELECT * FROM categories ORDER BY id ASC");
        jsonSuccess($stmt->fetchAll());

    case 'POST':
        requireAdmin();
        $b = getBody();
        if (empty($b['name'])) jsonError('Kategoriya nomi kerak', 422);

        $stmt = $db->prepare("INSERT INTO categories (name, img, prod_count) VALUES (?,?,?)");
        $stmt->execute([
            trim($b['name']),
            trim($b['img'] ?? ''),
            (int)($b['prod_count'] ?? 0),
        ]);
        $newId = $db->lastInsertId();
        $row = $db->query("SELECT * FROM categories WHERE id = $newId")->fetch();
        jsonSuccess($row, 201);

    case 'PUT':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);
        $b = getBody();

        $check = $db->prepare("SELECT id FROM categories WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) jsonError('Kategoriya topilmadi', 404);

        $fields = []; $params = [];
        foreach (['name','img','prod_count'] as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $params[] = $f === 'prod_count' ? (int)$b[$f] : $b[$f];
            }
        }
        if (empty($fields)) jsonError('Yangilanadigan maydon yo\'q', 422);
        $params[] = $id;
        $db->prepare("UPDATE categories SET " . implode(', ', $fields) . " WHERE id = ?")
           ->execute($params);

        $row = $db->query("SELECT * FROM categories WHERE id = $id")->fetch();
        jsonSuccess($row);

    case 'DELETE':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);
        $db->prepare("DELETE FROM categories WHERE id = ?")->execute([$id]);
        jsonSuccess(['deleted' => true, 'id' => $id]);

    default:
        jsonError('Method ruxsat etilmagan', 405);
}
