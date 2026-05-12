
let lastDataHash = "";

async function updateSportCity() {
    try {
        // Faylni har doim yangi versiyasini olish (Cache-busting)
        const response = await fetch(`data.json?v=${Date.now()}`);
        if (!response.ok) return;
        
        const data = await response.json();
        const currentHash = JSON.stringify(data);
        
        // Agar ma'lumot o'zgarmagan bo'lsa, hech nima qilma
        if (lastDataHash === currentHash) return;
        lastDataHash = currentHash;

        console.log("Ma'lumotlar avtomatik yangilandi!");

        // 1. Kategoriyalarni yangilash
        const catContainer = document.querySelector('.cat-scroll');
        if (catContainer && data.categories) {
            catContainer.innerHTML = data.categories.map(c => `
                <div class="cat-item">
                    <img src="${c.img}" alt="${c.name}">
                    <span>${c.name}</span>
                </div>
            `).join('');
        }

        // 2. Mahsulotlarni yangilash
        const productGrid = document.querySelector('.products-grid');
        if (productGrid && data.products) {
            productGrid.innerHTML = data.products.map(p => `
                <div class="prod-card" data-id="${p.id}">
                    ${p.is_new ? '<div class="prod-badge">Yangi</div>' : ''}
                    <div class="prod-img">
                        <img src="${p.image}" alt="${p.name}">
                    </div>
                    <div class="prod-info">
                        <span class="prod-cat">${p.category}</span>
                        <h3 class="prod-name">${p.name}</h3>
                        <div class="prod-footer">
                            <span class="prod-price">${p.price} UZS</span>
                            <button class="add-cart-btn">+</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // 3. Kontaktlarni yangilash
        const phoneEl = document.getElementById('footer-phone');
        if (phoneEl && data.site_info.contact.phone) {
            phoneEl.innerText = data.site_info.contact.phone;
        }

    } catch (err) {
        console.error("Yangilash xatosi:", err);
    }
}

// Har 30 soniyada tekshirish
setInterval(updateSportCity, 30000);
// Birinchi marta yuklash
updateSportCity();
