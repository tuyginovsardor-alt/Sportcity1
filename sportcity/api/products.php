<?php
// ============================================
// api/products.php — Mahsulotlar CRUD API
// ============================================
// GET    /api/products          — barchasi
// GET    /api/products?cat=X    — kategori bo'yicha filter
// GET    /api/products?brand=X  — brend bo'yicha filter
// GET    /api/products/{id}     — bitta mahsulot
// POST   /api/products          — yangi qo'shish (admin)
// PUT    /api/products/{id}     — tahrirlash (admin)
// DELETE /api/products/{id}     — o'chirish (admin)
// ============================================

$db = getDB();

switch ($method) {

    // ─── Olish ───────────────────────────────────────────────────────────
    case 'GET':
        if ($id !== null) {
            // Bitta mahsulot
            $stmt = $db->prepare("SELECT * FROM products WHERE id = ? AND is_active = 1");
            $stmt->execute([$id]);
            $product = $stmt->fetch();
            if (!$product) jsonError('Mahsulot topilmadi', 404);
            $product['sizes'] = $product['sizes'] ? explode(',', $product['sizes']) : [];
            jsonSuccess($product);
        }

        // Filter
        $where  = ['is_active = 1'];
        $params = [];

        if (!empty($_GET['cat'])) {
            $where[]  = 'cat = ?';
            $params[] = $_GET['cat'];
        }
        if (!empty($_GET['brand'])) {
            $where[]  = 'brand = ?';
            $params[] = $_GET['brand'];
        }
        if (!empty($_GET['search'])) {
            $where[]  = '(name LIKE ? OR brand LIKE ?)';
            $s = '%' . $_GET['search'] . '%';
            $params[] = $s;
            $params[] = $s;
        }

        $limit  = min((int)($_GET['limit'] ?? 100), 200);
        $offset = (int)($_GET['offset'] ?? 0);

        $sql = "SELECT * FROM products WHERE " . implode(' AND ', $where) .
               " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        // Sizes ni array ga o'girish
        foreach ($rows as &$row) {
            $row['sizes'] = $row['sizes'] ? explode(',', $row['sizes']) : [];
        }

        // Jami soni
        $countSql = "SELECT COUNT(*) FROM products WHERE " . implode(' AND ', $where);
        array_pop($params); // offset
        array_pop($params); // limit
        $countStmt = $db->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        jsonSuccess(['products' => $rows, 'total' => $total]);

    // ─── Yaratish ────────────────────────────────────────────────────────
    case 'POST':
        requireAdmin();
        $b = getBody();

        // Majburiy maydonlar
        foreach (['brand', 'name', 'price', 'cat'] as $field) {
            if (empty($b[$field])) jsonError("$field majburiy", 422);
        }

        $sizes = is_array($b['sizes'] ?? null)
            ? implode(',', array_map('trim', $b['sizes']))
            : trim($b['sizes'] ?? '');

        $stmt = $db->prepare("
            INSERT INTO products
                (brand, name, price, old_price, img, badge, badge_text, cat,
                 rating, reviews, sizes, description)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            trim($b['brand']),
            trim($b['name']),
            (int)$b['price'],
            !empty($b['old_price']) ? (int)$b['old_price'] : null,
            trim($b['img'] ?? ''),
            $b['badge']      ?? null,
            $b['badge_text'] ?? null,
            trim($b['cat']),
            (float)($b['rating']  ?? 4.5),
            (int)($b['reviews']   ?? 0),
            $sizes,
            trim($b['description'] ?? ''),
        ]);

        $newId = (int)$db->lastInsertId();

        // Kategoriya mahsulot sonini yangilash
        $db->prepare("UPDATE categories SET prod_count = prod_count + 1 WHERE name = ?")
           ->execute([$b['cat']]);

        // Yangi qo'shilgan mahsulotni qaytarish
        $stmt2 = $db->prepare("SELECT * FROM products WHERE id = ?");
        $stmt2->execute([$newId]);
        $newProd = $stmt2->fetch();
        $newProd['sizes'] = $newProd['sizes'] ? explode(',', $newProd['sizes']) : [];

        jsonSuccess($newProd, 201);

    // ─── Yangilash ───────────────────────────────────────────────────────
    case 'PUT':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);
        $b = getBody();

        // Mavjudligini tekshirish
        $check = $db->prepare("SELECT id, cat FROM products WHERE id = ?");
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) jsonError('Mahsulot topilmadi', 404);

        $sizes = isset($b['sizes'])
            ? (is_array($b['sizes'])
                ? implode(',', array_map('trim', $b['sizes']))
                : trim($b['sizes']))
            : null;

        // Faqat yuborilgan maydonlarni yangilash
        $fields = [];
        $params = [];

        $allowed = ['brand','name','price','old_price','img','badge','badge_text',
                    'cat','rating','reviews','description','is_active'];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $params[] = $f === 'price' || $f === 'old_price' || $f === 'reviews'
                    ? ($b[$f] !== null ? (int)$b[$f] : null)
                    : ($f === 'rating' ? (float)$b[$f] : $b[$f]);
            }
        }
        if ($sizes !== null) {
            $fields[] = "sizes = ?";
            $params[] = $sizes;
        }

        if (empty($fields)) jsonError('Yangilanadigan maydon yo\'q', 422);

        $params[] = $id;
        $db->prepare("UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?")
           ->execute($params);

        // Kategoriya o'zgarsa son yangilansin
        if (isset($b['cat']) && $b['cat'] !== $existing['cat']) {
            $db->prepare("UPDATE categories SET prod_count = GREATEST(prod_count-1,0) WHERE name = ?")
               ->execute([$existing['cat']]);
            $db->prepare("UPDATE categories SET prod_count = prod_count+1 WHERE name = ?")
               ->execute([$b['cat']]);
        }

        $stmt = $db->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->execute([$id]);
        $updated = $stmt->fetch();
        $updated['sizes'] = $updated['sizes'] ? explode(',', $updated['sizes']) : [];

        jsonSuccess($updated);

    // ─── O'chirish ───────────────────────────────────────────────────────
    case 'DELETE':
        requireAdmin();
        if ($id === null) jsonError('ID kerak', 400);

        $check = $db->prepare("SELECT id, cat FROM products WHERE id = ?");
        $check->execute([$id]);
        $product = $check->fetch();
        if (!$product) jsonError('Mahsulot topilmadi', 404);

        // Soft delete (is_active = 0)
        $db->prepare("UPDATE products SET is_active = 0 WHERE id = ?")
           ->execute([$id]);

        $db->prepare("UPDATE categories SET prod_count = GREATEST(prod_count-1,0) WHERE name = ?")
           ->execute([$product['cat']]);

        jsonSuccess(['deleted' => true, 'id' => $id]);

    default:
        jsonError('Method ruxsat etilmagan', 405);
}
