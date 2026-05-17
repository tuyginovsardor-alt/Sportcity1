-- ============================================
-- SPORTCITY — To'liq Ma'lumotlar Bazasi
-- ============================================

CREATE DATABASE IF NOT EXISTS sportcity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportcity;

-- ─── KATEGORIYALAR ───
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    img TEXT,
    prod_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── MAHSULOTLAR ───
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    price INT NOT NULL,
    old_price INT DEFAULT NULL,
    img TEXT,
    badge VARCHAR(20) DEFAULT NULL,
    badge_text VARCHAR(30) DEFAULT NULL,
    cat VARCHAR(100) NOT NULL,
    rating DECIMAL(2,1) DEFAULT 4.5,
    reviews INT DEFAULT 0,
    sizes VARCHAR(200) DEFAULT '',
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── FOYDALANUVCHILAR ───
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) DEFAULT '',
    coins INT DEFAULT 0,
    is_admin TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── ZAKAZLAR ───
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(20) NOT NULL,
    user_phone VARCHAR(20) NOT NULL,
    items TEXT NOT NULL,
    total INT NOT NULL,
    coins_earned INT DEFAULT 0,
    status ENUM('new','processing','delivered','cancelled') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── BANNER/HERO SLIDES ───
CREATE TABLE IF NOT EXISTS banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(300) DEFAULT '',
    btn_text VARCHAR(100) DEFAULT 'Ko\'proq ko\'rish',
    img TEXT NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── ADMIN SESSIYASI ───
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BOSHLANG'ICH MA'LUMOTLAR
-- ============================================

INSERT INTO categories (name, img, prod_count) VALUES
('Futbol',    'https://images.unsplash.com/photo-1551958219-acbc19ecce5c?w=300&q=75', 143),
('Basketbol', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&q=75', 88),
('Fitnes',    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&q=75', 214),
('Tennis',    'https://images.unsplash.com/photo-1489493585363-d69421e0edd3?w=300&q=75', 62),
('Suzish',    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=300&q=75', 57),
('Yugurish',  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=300&q=75', 95),
('Velosiped', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=75', 43),
('Boks',      'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=300&q=75', 38);

INSERT INTO products (brand, name, price, old_price, img, badge, badge_text, cat, rating, reviews, sizes, description) VALUES
('Nike',         'Mercurial Vapor 15',      1290000, 1890000, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80', 'sale', '-32%', 'Futbol',    4.8, 124, '38,39,40,41,42,43', 'Professionallar uchun futbol krossovkalari.'),
('Adidas',       'Final Champions League',  390000,  490000,  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&q=80', 'new',  'NEW',  'Futbol',    4.9, 512, '4,5',               "UEFA Champions League rasmiy to'pi."),
('Bowflex',      'Dumbbell 10kg',           280000,  NULL,    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80', 'hit',  'HIT',  'Fitnes',    4.9, 189, '5kg,10kg,15kg,20kg',"Professional og'irlik ko'tarish uchun dumbell."),
('Under Armour', 'Project Rock 5',          1190000, NULL,    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&q=80', 'new',  'NEW',  'Fitnes',    4.9, 341, '40,41,42,43,44,45', 'Dwayne Johnson dizayni.'),
('Wilson',       'Pro Staff Raketa',        2890000, 3200000, 'https://images.unsplash.com/photo-1551773188-0801da12ddae?w=500&q=80', 'hit',  'HIT',  'Tennis',    4.7, 56,  'L2,L3,L4',          'Professional tennis raketsasi.'),
('Nike',         'Air Jordan 37',           1890000, 2390000, 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=500&q=80', 'sale', '-21%', 'Basketbol', 4.7, 278, '40,41,42,43,44,45', "Jordan seriyasining eng yangi modeli."),
('Puma',         'Nitro Elite Running',     890000,  1100000, 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&q=80', 'sale', '-19%', 'Yugurish',  4.5, 134, '38,39,40,41,42,43', 'Ultra yengil yugurish poyafzali.'),
('Speedo',       'Fastskin LZR',            890000,  NULL,    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=500&q=80', 'new',  'NEW',  'Suzish',    4.8, 67,  'XS,S,M,L',          'Olimpiyada standartidagi suzish kostyumi.');

INSERT INTO banners (title, subtitle, btn_text, img, sort_order) VALUES
('YANGI MAVSUMGA TAYYORMISIZ?', 'Professional sport anjomlar — eng yaxshi brendlardan', "Ko'proq ko'rish", 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80', 1),
('PROFESSIONAL JIHOZLAR', 'Eng zo\'r sifat, eng qulay narxda', "Hozir xarid qiling", 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80', 2),
('CHEGIRMA MAVSUMI', '50% gacha chegirma sport kiyimlarida', "Chegirmalarni ko'rish", 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80', 3);

-- Admin foydalanuvchi
INSERT INTO users (phone, name, coins, is_admin) VALUES ('917777777', 'Admin', 0, 1);
