<?php
// ============================================
// config.php — Ma'lumotlar bazasi sozlamalari
// ============================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');        // O'zgartiring
define('DB_PASS', '');            // O'zgartiring
define('DB_NAME', 'sportcity');
define('DB_CHARSET', 'utf8mb4');

define('APP_PORT', 7474); // Backend porti
define('ADMIN_PASS', 'admin123'); // Admin paroli
define('ADMIN_PHONE', '917777777');

// ─── PDO Ulanish ───
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            jsonError('Database ulanmadi: ' . $e->getMessage(), 500);
        }
    }
    return $pdo;
}

// ─── CORS va JSON Header ───
function setHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// ─── JSON Javob ───
function jsonSuccess(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── Request body olish ───
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ─── Admin token tekshirish ───
function requireAdmin(): void {
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if (empty($token)) {
        jsonError('Admin ruxsati yo\'q', 403);
    }
    $db = getDB();
    $stmt = $db->prepare("SELECT id FROM admin_sessions WHERE token = ? AND expires_at > NOW()");
    $stmt->execute([$token]);
    if (!$stmt->fetch()) {
        jsonError('Token yaroqsiz yoki muddati o\'tgan', 403);
    }
}
