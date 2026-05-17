<?php
// ============================================
// api/admin.php — Admin Login / Logout
// ============================================

$db = getDB();

switch ($method) {

    // Login
    case 'POST':
        $b = getBody();
        $action = $b['action'] ?? 'login';

        if ($action === 'login') {
            $phone = preg_replace('/\D/', '', $b['phone'] ?? '');
            $pass  = $b['password'] ?? '';

            if ($phone !== ADMIN_PHONE || $pass !== ADMIN_PASS) {
                jsonError('Telefon yoki parol noto\'g\'ri', 401);
            }

            // Eski tokenlarni o'chirish
            $db->prepare("DELETE FROM admin_sessions WHERE expires_at < NOW()")->execute();

            // Yangi token
            $token   = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', time() + 86400 * 7); // 7 kun

            $db->prepare("INSERT INTO admin_sessions (token, expires_at) VALUES (?,?)")
               ->execute([$token, $expires]);

            jsonSuccess([
                'token'      => $token,
                'expires_at' => $expires,
                'message'    => 'Admin panelga xush kelibsiz!',
            ]);
        }

        if ($action === 'verify') {
            $token = $b['token'] ?? '';
            $stmt = $db->prepare(
                "SELECT id, expires_at FROM admin_sessions WHERE token = ? AND expires_at > NOW()"
            );
            $stmt->execute([$token]);
            $session = $stmt->fetch();
            jsonSuccess(['valid' => (bool)$session]);
        }

        jsonError('Noto\'g\'ri action', 400);

    // Logout
    case 'DELETE':
        $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
        if ($token) {
            $db->prepare("DELETE FROM admin_sessions WHERE token = ?")->execute([$token]);
        }
        jsonSuccess(['logged_out' => true]);

    default:
        jsonError('Method ruxsat etilmagan', 405);
}
