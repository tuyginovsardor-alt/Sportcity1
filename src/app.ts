import { 
  auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, increment 
} from './firebase';
import { uploadImage } from './supabase';

// ─── Holat ───────────────────────────────────────────────────────
let products: any[] = [];
let categories: any[] = [];
let banners: any[] = [];
let posts: any[] = [];
let cart: any[] = [], favs = new Set();
(window as any).favs = favs;
let currentFilter = 'all', currentCatFilter = 'all', searchKeyword = '';
let currentUser: any = null;
let isAdminUser = false;
let adminUnlocked = false;
let selectedChatUserId = '';
let selectedPayment = 'cash';

const SITE_OWNERS = [
  'tuyginovsardor36@gmail.com',
  'numanovbekzod21@gmail.com',
  'numanovbegzod20@gmail.com',
  'tuyginovsardor@gmail.com'
];

// Listener registry to prevent leaks
const unsubscribers: { [key: string]: () => void } = {};
function safeUnsub(key: string) { if (unsubscribers[key]) { unsubscribers[key](); delete unsubscribers[key]; } }

// ─── Yordamchi Funksiyalar ─────────────────────────────────────
function fmt(n: any) { return n ? Number(n).toLocaleString('uz-UZ') : '0'; }
function isInCart(id: string) { return cart.some(i => i.id === id); }

function showToast(title: string, sub: string, type: 's'|'i'|'e' = 'i') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div'); t.className = 'toast-item';
  t.innerHTML = `<div class="toast-dot ${type}"></div><div><div class="toast-txt">${title}</div>${sub ? `<div class="toast-sub-txt">${sub}</div>` : ''}</div>`;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}
(window as any).showToast = showToast;

function goAuthStep(n: number) { 
  document.querySelectorAll('.auth-step2').forEach(s => s.classList.remove('active')); 
  document.getElementById('step' + n)?.classList.add('active'); 
}
(window as any).goAuthStep = goAuthStep;

function scrollToProds() { document.getElementById('prodSection')?.scrollIntoView({ behavior: 'smooth' }); }
(window as any).scrollToProds = scrollToProds;

function closeCart() { 
  document.getElementById('cartOverlay')?.classList.remove('open'); 
  document.getElementById('cartSheet')?.classList.remove('open'); 
  document.body.style.overflow = ''; 
  setNavActive('navHome'); 
}
(window as any).closeCart = closeCart;

(window as any).openCart = () => { 
  document.getElementById('cartOverlay')?.classList.add('open'); 
  document.getElementById('cartSheet')?.classList.add('open'); 
  document.body.style.overflow = 'hidden'; 
  renderCart(); 
  setNavActive('navCart'); 
  // Update path without reload if not already there
  if (window.location.pathname !== '/cart') window.history.pushState(null, '', '/cart');
};

function openProfile() { 
  document.getElementById('profileOverlay')?.classList.add('open'); 
  document.body.style.overflow = 'hidden'; 
  if(currentUser) goAuthStep(3); else goAuthStep(0); 
  if (window.location.pathname !== '/profile') window.history.pushState(null, '', '/profile');
}
(window as any).openProfile = openProfile;

function setNavActive(id: string) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById(id)?.classList.add('active'); }
(window as any).setNavActive = setNavActive;

function removeFromCart(id: string) { 
  cart = cart.filter(x => x.id !== id); 
  updateCartBadge(); renderCart(); renderGrid(getFiltered()); 
}
(window as any).removeFromCart = removeFromCart;

function closeCatalog() { document.getElementById('catalogOverlay')?.classList.remove('open'); document.body.style.overflow = ''; }
(window as any).closeCatalog = closeCatalog;

function filterCat(c: string) { 
  currentCatFilter = c; currentFilter = 'all'; 
  renderBrands(); renderGrid(getFiltered()); 
  scrollToProds(); 
}
(window as any).filterCat = filterCat;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // showToast('Xatolik', 'Ruxsat yo\'q yoki serverda xatolik', 'e');
}

// ─── Yuklab olish ─────────────────────────────────────────────────
async function loadAll() {
  safeUnsub('products');
  unsubscribers['products'] = onSnapshot(collection(db, 'products'), (snapshot) => {
    products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

  safeUnsub('categories');
  unsubscribers['categories'] = onSnapshot(collection(db, 'categories'), (snapshot) => {
    categories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

  safeUnsub('banners');
  unsubscribers['banners'] = onSnapshot(collection(db, 'banners'), (snapshot) => {
    banners = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHeroSlides();
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'banners'));

  safeUnsub('posts');
  unsubscribers['posts'] = onSnapshot(collection(db, 'posts'), (snapshot) => {
    posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPosts();
    renderAdminPosts();
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'posts'));

  if (currentUser) {
    await syncUser(currentUser);
    loadUserData();
    loadChat();
    loadUserNotifications();
  }
}

async function loadUserNotifications() {
  if (!currentUser) return;
  const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(15));
  safeUnsub('notifications');
  unsubscribers['notifications'] = onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderNotifications(list);
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));
}

function renderNotifications(list: any[]) {
  const badge = document.getElementById('bellBadge');
  const count = list.filter((n: any) => !n.read).length;
  if (badge) {
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  const el = document.getElementById('notifList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray);font-size:13px">Hozircha xabarlar yo\'q</div>';
    return;
  }
  el.innerHTML = list.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
      <div class="notif-icon ${n.type || 'info'}">
        ${n.type === 'order' ? '📦' : n.type === 'msg' ? '💬' : '🔔'}
      </div>
      <div class="notif-info">
        <div class="notif-title">${n.title}</div>
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.createdAt?.toDate().toLocaleString()}</div>
      </div>
    </div>`).join('');
}

(window as any).markNotifRead = async (id: string) => {
  await updateDoc(doc(db, 'notifications', id), { read: true });
};

(window as any).clearNotifications = async () => {
  if (!currentUser) return;
  const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
  const snap = await getDocs(q);
  snap.forEach(async (d) => {
    await updateDoc(doc(db, 'notifications', d.id), { read: true });
  });
};

async function loadChat() {
  if (!currentUser) return;
  const qChat = query(collection(db, 'support_chats'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'asc'));
  safeUnsub('chat');
  unsubscribers['chat'] = onSnapshot(qChat, (snapshot) => {
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderChat(messages);
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'support_chats_user'));
}

function renderChat(messages: any[]) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  el.innerHTML = '<div style="background:var(--card);padding:10px;border-radius:12px;font-size:12px;color:var(--gray);line-height:1.4">Assalomu alaykum! SportCity yordam xizmatiga xush kelibsiz. Savolingiz bormi?</div>' + 
    messages.map(m => `
    <div style="align-self: ${m.sender === 'user' ? 'flex-end' : 'flex-start'}; background: ${m.sender === 'user' ? 'var(--blue)' : 'var(--card2)'}; padding: 10px 14px; border-radius: 12px; font-size: 13px; max-width: 80%; line-height: 1.4; color: white; margin-top: 5px">
      ${m.text}
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

(window as any).toggleChatWindow = () => {
  const win = document.getElementById('chatWindow');
  if (win) win.style.display = win.style.display === 'none' ? 'flex' : 'none';
};

(window as any).sendChatMessage = async () => {
  if (!currentUser) return showToast('Kirish kerak', 'Xabar yozish uchun kiring', 'i');
  const inp = document.getElementById('chatInput') as HTMLInputElement;
  const text = inp.value.trim();
  if (!text) return;
  try {
    await addDoc(collection(db, 'support_chats'), {
      userId: currentUser.uid,
      text,
      sender: 'user',
      createdAt: serverTimestamp()
    });
    inp.value = '';
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

async function loadUserData() {
  if (!currentUser) return;
  
  const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
  isAdminUser = SITE_OWNERS.includes(currentUser.email) || adminDoc.exists();

  const ordersQuery = query(collection(db, 'orders'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
  safeUnsub('orders');
  unsubscribers['orders'] = onSnapshot(ordersQuery, (snapshot) => {
    const userOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProfileOrders(userOrders);
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'user_orders'));

  safeUnsub('user_data');
  unsubscribers['user_data'] = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
    if (snapshot.exists()) showProfileData();
  }, (err) => handleFirestoreError(err, OperationType.GET, 'user_data_snap'));
  if (isAdminUser) {
    const btn = document.getElementById('adminEntryBtn');
    if (btn) btn.style.display = 'block';
    loadAdminData();
    loadAdminChatSessions();
    loadAdminList();
    loadAdminSiteSettings();
    checkSupabaseConfig();
  }
}

function checkSupabaseConfig() {
  const url = (import.meta as any).env.VITE_SUPABASE_URL;
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  const warn = document.getElementById('supabaseWarning');
  if (warn) {
    warn.style.display = (!url || !key) ? 'block' : 'none';
  }
}

async function loadAdminChatSessions() {
  onSnapshot(query(collection(db, 'support_chats'), orderBy('createdAt', 'desc')), (snapshot) => {
    const allMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const sessions = new Map();
    allMsgs.forEach((m: any) => {
      if (!sessions.has(m.userId)) {
        sessions.set(m.userId, {
          lastMsg: m.text,
          lastTime: m.createdAt,
          unread: m.sender === 'user' && !m.adminRead,
          userId: m.userId
        });
      }
    });
    renderAdminChatUserList(Array.from(sessions.values()));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'admin_chat_sessions'));
}

function renderAdminChatUserList(sessions: any[]) {
  const el = document.getElementById('chatUserList');
  if (!el) return;
  el.innerHTML = sessions.map(s => `
    <div class="admin-chat-user ${s.userId === selectedChatUserId ? 'active' : ''} ${s.unread ? 'has-new' : ''}" onclick="selectChatChannel('${s.userId}')">
      <div class="acu-avatar">${s.userId.substring(0,1).toUpperCase()}</div>
      <div class="acu-info">
        <div class="acu-name">User ${s.userId.substring(0,6)}</div>
        <div class="acu-last">${s.lastMsg.substring(0, 20)}${s.lastMsg.length > 20 ? '...' : ''}</div>
      </div>
      ${s.unread ? '<div class="acu-badge">Yangi</div>' : ''}
    </div>`).join('');
}

(window as any).selectChatChannel = async (uid: string) => {
  selectedChatUserId = uid;
  (document.getElementById('adminChatInputRow') as HTMLElement).style.display = 'flex';
  (document.getElementById('adminChatPlaceholder') as HTMLElement).style.display = 'none';
  
  const qChat = query(collection(db, 'support_chats'), where('userId', '==', uid), orderBy('createdAt', 'asc'));
  onSnapshot(qChat, (snapshot) => {
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminChatMessages(messages);
    
    // Mark as read
    snapshot.docs.forEach(async (d) => {
      const m = d.data();
      if (m.sender === 'user' && !m.adminRead) {
        await updateDoc(doc(db, 'support_chats', d.id), { adminRead: true });
      }
    });
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'admin_chat_channel'));
};

function renderAdminChatMessages(messages: any[]) {
  const el = document.getElementById('adminChatMessages');
  if (!el) return;
  el.innerHTML = messages.map(m => `
    <div class="admin-msg-item ${m.sender === 'admin' ? 'is-me' : ''}">
      <div class="admin-msg-bubble">
        ${m.text}
        <div class="admin-msg-time">${m.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

(window as any).sendAdminChat = async () => {
  if (!selectedChatUserId) return;
  const inp = document.getElementById('adminChatMessageInp') as HTMLInputElement;
  const text = inp.value.trim();
  if (!text) return;
  try {
    await addDoc(collection(db, 'support_chats'), {
      userId: selectedChatUserId,
      text,
      sender: 'admin',
      createdAt: serverTimestamp()
    });
    inp.value = '';
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

async function loadAdminData() {
  onSnapshot(collection(db, 'orders'), (snapshot) => {
    const allOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminOrders(allOrders);
    updateAdminStats(allOrders);
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'admin_orders'));

  onSnapshot(collection(db, 'users'), (snapshot) => {
    const allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminUsers(allUsers);
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'admin_users'));
}

function renderAll() {
  renderCategories();
  renderBrands();
  renderPopular();
  renderGrid(getFiltered());
  const sel = document.getElementById('ap-cat') as HTMLSelectElement;
  if (sel) sel.innerHTML = categories.map(c => `<option>${c.name}</option>`).join('');
  const fc = document.getElementById('footerCats');
  if (fc) fc.innerHTML = categories.slice(0, 6).map(c => `<li onclick="filterCat('${c.name}')" style="cursor:pointer">${c.name}</li>`).join('');
  renderAdminProducts();
  renderAdminCategories();
  renderAdminPosts();
}

// ─── Auth ───────────────────────────────────────────────────────
(window as any).loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;
    await syncUser(currentUser);
    showToast('Xush kelibsiz! 👋', currentUser.displayName || currentUser.email, 's');
    goAuthStep(3);
    showProfileData();
    setTimeout(() => {
       const step3 = document.getElementById('step3');
       if (step3 && step3.classList.contains('active')) closeProfile();
    }, 1500);
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

(window as any).loginWithEmail = async () => {
  const email = (document.getElementById('emailInput') as HTMLInputElement).value;
  const pass = (document.getElementById('passInput') as HTMLInputElement).value;
  if (!email || !pass) return showToast('Email va parol kerak!', '', 'e');
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    currentUser = result.user;
    showToast('Kirish muvaffaqiyatli! ✅', email, 's');
    goAuthStep(3);
    showProfileData();
    setTimeout(() => {
       const step3 = document.getElementById('step3');
       if (step3 && step3.classList.contains('active')) closeProfile();
    }, 1500);
  } catch (e: any) { showToast('Kirishda xatolik', e.message, 'e'); }
};

(window as any).registerWithEmail = async () => {
  const email = (document.getElementById('emailInput') as HTMLInputElement).value;
  const pass = (document.getElementById('passInput') as HTMLInputElement).value;
  if (!email || !pass) return showToast('Email va parol kerak!', '', 'e');
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    currentUser = result.user;
    await syncUser(currentUser);
    showToast("Ro'yxatdan o'tildi! 🎉", email, 's');
    goAuthStep(3);
    showProfileData();
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

// ─── Missing Auth/UI Functions ───
let currentPin = '';
(window as any).formatPhoneInput = (el: HTMLInputElement) => {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 9) v = v.substring(0, 9);
  let fmt = '';
  if (v.length > 0) fmt += v.substring(0, 2);
  if (v.length > 2) fmt += ' ' + v.substring(2, 5);
  if (v.length > 5) fmt += ' ' + v.substring(5, 7);
  if (v.length > 7) fmt += ' ' + v.substring(7, 9);
  el.value = fmt;
};

(window as any).loginByPhone = () => {
  const phone = (document.getElementById('phoneInput') as HTMLInputElement).value.replace(/\D/g, '');
  if (phone.length < 9) return showToast('Xatolik', 'Raqamni to\'liq kiriting', 'e');
  currentPin = '';
  updatePinDots();
  goAuthStep(2);
};

(window as any).pinPress = async (digit: string) => {
  if (currentPin.length < 4) {
    currentPin += digit;
    updatePinDots();
    if (currentPin.length === 4) {
      const snap = await getDoc(doc(db, 'users', currentUser?.uid || 'temp'));
      const savedPin = snap.exists() ? snap.data().pin : '1111';
      
      if (currentPin === savedPin) {
        showToast('Xush kelibsiz!', 'Muvaffaqiyatli kirildi', 's');
        goAuthStep(3);
        showProfileData();
        // Only auto-close if user is still on the "Success" step after delay
        setTimeout(() => {
           const step3 = document.getElementById('step3');
           if (step3 && step3.classList.contains('active')) closeProfile();
        }, 1500);
      } else {
        const err = document.getElementById('pinErrMsg');
        if (err) err.textContent = 'PIN kod noto\'g\'ri';
        setTimeout(() => {
          currentPin = '';
          updatePinDots();
          if (err) err.textContent = '';
        }, 1000);
      }
    }
  }
};

(window as any).pinBack = () => {
  currentPin = currentPin.slice(0, -1);
  updatePinDots();
};

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    if (dot) dot.classList.toggle('filled', i < currentPin.length);
  }
}

(window as any).goSlide = (n: number) => {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  slides.forEach((s, i) => s.classList.toggle('active', i === n));
  dots.forEach((d, i) => d.classList.toggle('active', i === n));
};

async function syncUser(user: any) {
  const userDoc = doc(db, 'users', user.uid);
  const snap = await getDoc(userDoc);
  if (!snap.exists()) {
    await setDoc(userDoc, {
      email: user.email, displayName: user.displayName,
      coins: 0, createdAt: serverTimestamp()
    });
  }
  
  // Sync Admin Status if in SITE_OWNERS
  if (SITE_OWNERS.includes(user.email)) {
    const adminDoc = doc(db, 'admins', user.uid);
    const adminSnap = await getDoc(adminDoc);
    if (!adminSnap.exists()) {
      await setDoc(adminDoc, {
        email: user.email,
        uid: user.uid,
        role: 'owner',
        createdAt: serverTimestamp()
      });
    }
  }
}

onAuthStateChanged(auth, (user) => {
  const oldUser = currentUser;
  currentUser = user;
  if (user) {
    if (!oldUser || oldUser.uid !== user.uid) {
       syncUser(user);
       loadUserData();
       loadChat();
       loadUserNotifications();
    }
    if (document.getElementById('profileOverlay')?.classList.contains('open')) {
      goAuthStep(3);
      showProfileData();
    }
  } else {
    const admBtn = document.getElementById('adminEntryBtn');
    if (admBtn) admBtn.style.display = 'none';
    // Cleanup user listeners
    ['notifications', 'chat', 'orders', 'user_profile', 'admin_chat_list', 'admin_chat_msgs'].forEach(key => safeUnsub(key));
  }
});

(window as any).logout = async () => {
  if (confirm('Haqiqatdan ham tizimdan chiqmoqchimisiz?')) {
    // Clear cache/localStorage on logout as requested for "fresh" site next time
    localStorage.clear();
    sessionStorage.clear();
    await signOut(auth);
    currentUser = null;
    showToast('Chiqish amalga oshirildi', 'Barcha keshlar tozalandi', 'i');
    setTimeout(() => location.reload(), 1000);
  }
};

// ─── UI ──────────────────────────────────────────────────────────
function renderCategories() {
  const el = document.getElementById('catsGrid');
  if (!el) return;
  el.innerHTML = categories.map(c => `
    <div class="cat-card" onclick="filterCat('${c.name}')">
      <img class="cat-img" src="${c.img}" alt="${c.name}" loading="lazy">
      <div class="cat-overlay2"></div>
      <div class="cat-name2">${c.name}</div>
    </div>`).join('');
}

function renderBrands() {
  const brands = ['all', ...new Set(products.map(p => p.brand))];
  const el = document.getElementById('brandsRow');
  if (!el) return;
  el.innerHTML = brands.map(b => `
    <button class="brand-chip ${b === currentFilter ? 'active' : ''}" onclick="filterBrand('${b}')">${b === 'all' ? 'Barchasi' : b}</button>`).join('');
}

function renderPopular() {
  const el = document.getElementById('popularScroll');
  if (!el) return;
  // Filter for TOP products, fallback to first 6 if none marked
  let topList = products.filter(p => p.isTop);
  if (!topList.length) topList = products.slice(0, 6);
  
  el.innerHTML = topList.map(p => `
    <article class="prod-card" onclick="openProduct('${p.id}')">
      <div class="prod-img-wrap">
        ${p.badge ? `<div class="prod-badge badge-${p.badge}">${p.badge_text || ''}</div>` : ''}
        <img class="prod-img" src="${p.img}" alt="${p.name} - ${p.brand} sport anjomi" loading="lazy">
      </div>
      <div class="prod-info">
        <h3 class="prod-name2">${p.name}</h3>
        <div class="prod-price2">${fmt(p.price)} <span>so'm</span></div>
      </div>
    </article>`).join('');
}

function renderGrid(list: any[]) {
  const g = document.getElementById('prodGrid');
  if (!g) return;
  if (!list.length) { g.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray);font-size:13px">Mahsulot topilmadi</div>'; return; }
  g.innerHTML = list.map(p => `
    <article class="prod-grid-card" onclick="openProduct('${p.id}')">
      ${p.badge ? `<div class="prod-badge badge-${p.badge}" style="position:absolute;top:8px;left:8px;z-index:2;font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;padding:3px 8px;border-radius:5px">${p.badge_text || ''}</div>` : ''}
      <button class="pgc-fav ${favs.has(p.id) ? 'active' : ''}" onclick="toggleFav(event,'${p.id}')">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
      </button>
      <div class="pgc-img-wrap"><img class="pgc-img" src="${p.img}" alt="${p.name} - ${p.brand} sport anjomi" loading="lazy"></div>
      <div class="pgc-info">
        <div class="pgc-brand">${p.brand}</div>
        <h3 class="pgc-name">${p.name}</h3>
        <div class="rating-row">${renderStars(p.rating)}<span class="rating-count2">(${p.reviews || 0})</span></div>
        <div class="pgc-price-row">
          <div>
            ${p.old_price ? `<div class="pgc-old">${fmt(p.old_price)}</div>` : ''}
            <div class="pgc-price">${fmt(p.price)} <span class="pgc-price2"><span>so'm</span></span></div>
          </div>
          <button class="pgc-add ${isInCart(p.id) ? 'added' : ''}" onclick="addToCart(event,'${p.id}')">
            <svg viewBox="0 0 24 24">${isInCart(p.id) ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}</svg>
          </button>
        </div>
      </div>
    </article>`).join('');
}

function renderStars(r: number = 5) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<svg class="star2 ${i <= Math.round(r) ? '' : 'e'}" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return `<div class="stars2">${s}</div>`;
}

function getFiltered() {
  return products.filter(p =>
    (currentFilter === 'all' || p.brand === currentFilter) &&
    (currentCatFilter === 'all' || p.cat === currentCatFilter) &&
    (!searchKeyword || 
      p.name?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
      p.brand?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
      p.description?.toLowerCase().includes(searchKeyword.toLowerCase())
    )
  );
}

(window as any).globalSearch = (val: string) => {
  searchKeyword = val;
  renderGrid(getFiltered());
};

// ─── Web API ──────────────────────────────────────────────────
(window as any).filterBrand = (b: string) => { currentFilter = b; currentCatFilter = 'all'; renderBrands(); renderGrid(getFiltered()); scrollToProds(); };
(window as any).resetFilter = () => { currentFilter = 'all'; currentCatFilter = 'all'; renderBrands(); renderGrid(getFiltered()); };

(window as any).toggleFav = (e: any, id: string) => { 
  e.stopPropagation(); 
  if (favs.has(id)) { favs.delete(id); showToast("Olib tashlandi", "", "i"); } 
  else { favs.add(id); showToast("Sevimlilarga qo'shildi", "❤️", "s"); } 
  renderGrid(getFiltered()); 
};

(window as any).addToCart = (e: any, id: string) => { 
  e.stopPropagation(); 
  const p = products.find(x => x.id === id); if (!p) return; 
  const ex = cart.find(x => x.id === id); 
  if (ex) ex.qty++; else cart.push({ ...p, qty: 1 }); 
  updateCartBadge(); renderGrid(getFiltered()); 
  showToast(p.name, "Savatga qo'shildi ✓", "s"); 
};

function updateCartBadge() { 
  const t = cart.reduce((s, i) => s + i.qty, 0); 
  const cb = document.getElementById('cartBadge'); 
  if (cb) { cb.textContent = String(t); cb.style.display = t ? 'flex' : 'none'; }
  const cc = document.getElementById('cartCount'); 
  if (cc) cc.textContent = String(t); 
}

// Removed duplicate openCart

function renderCart() {
  const wrap = document.getElementById('cartItems') as HTMLElement;
  const foot = document.getElementById('cartFoot') as HTMLElement;
  if (!cart.length) { 
    wrap.innerHTML = `<div class="cart-empty2"><svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg><p>Savat bo'sh</p></div>`; 
    foot.style.display = 'none'; return; 
  }
  foot.style.display = 'block';
  wrap.innerHTML = cart.map(i => `
    <div class="cart-item2">
      <img class="cart-item-img2" src="${i.img}" alt="${i.name}">
      <div class="cart-item-info2">
        <div class="ci-brand">${i.brand}</div>
        <div class="ci-name">${i.name}</div>
        <div class="ci-bottom">
          <div class="ci-price">${fmt(i.price * i.qty)} so'm</div>
          <div class="qty-row">
            <button class="qty-b" onclick="changeQty('${i.id}',-1)">−</button>
            <span class="qty-v">${i.qty}</span>
            <button class="qty-b" onclick="changeQty('${i.id}',1)">+</button>
          </div>
        </div>
      </div>
      <button class="ci-del" onclick="removeFromCart('${i.id}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
    </div>`).join('');
  const ct = document.getElementById('cartTotal');
  if (ct) ct.textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0)) + " so'm";
}

(window as any).changeQty = (id: string, d: number) => { 
  const i = cart.find(x => x.id === id); if (!i) return; 
  i.qty += d; if (i.qty < 1) { removeFromCart(id); return; } 
  updateCartBadge(); renderCart(); renderGrid(getFiltered()); 
};

(window as any).setPayment = (type: string) => {
  selectedPayment = type;
  const cashBtn = document.getElementById('payCash');
  const cardBtn = document.getElementById('payCard');
  if (cashBtn && cardBtn) {
    if (type === 'cash') {
      cashBtn.style.background = 'var(--blue)';
      cashBtn.style.borderColor = 'var(--blue)';
      cardBtn.style.background = 'var(--bg)';
      cardBtn.style.borderColor = 'var(--border)';
    } else {
      cardBtn.style.background = 'var(--blue)';
      cardBtn.style.borderColor = 'var(--blue)';
      cashBtn.style.background = 'var(--bg)';
      cashBtn.style.borderColor = 'var(--border)';
    }
  }
};

(window as any).checkout = async () => {
  if (!cart.length) return;
  if (!currentUser) { closeCart(); openProfile(); showToast('Avval kiring!', 'Zakaz uchun profil kerak', 'i'); return; }
  
  const phoneVal = (document.getElementById('checkoutPhone') as HTMLInputElement).value.trim();
  const comment = (document.getElementById('checkoutComment') as HTMLInputElement).value.trim();
  
  if (phoneVal.length < 9) return showToast('Xatolik', 'Telefon raqamni to\'liq kiriting', 'e');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemsStr = cart.map(i => i.name + (i.qty > 1 ? ' x' + i.qty : '')).join(', ');
  const coinsEarned = Math.floor(total / 10000); // 1 coin for every 10k so'm
  
  try {
    const orderData = {
      userId: currentUser.uid, 
      userEmail: currentUser.email || '',
      userPhone: '+998' + phoneVal,
      comment,
      paymentMethod: selectedPayment,
      items: itemsStr, 
      total, 
      status: 'new', 
      coins_earned: coinsEarned,
      createdAt: serverTimestamp(), 
      order_code: '#' + Math.floor(Math.random() * 9000 + 1000)
    };

    if (selectedPayment === 'card') {
      showToast('QulayPay...', 'To\'lov tizimiga yo\'naltirilmoqda', 'i');
      // In a real scenario, we would redirect to a checkout URL here
      // window.location.href = `https://qulaypay.uz/pay?orderId=${orderId}&amount=${total}`;
      // For now, we just save the order as 'card' payment
    }

    await addDoc(collection(db, 'orders'), orderData);
    await updateDoc(doc(db, 'users', currentUser.uid), { coins: increment(coinsEarned) });
    
    cart = []; 
    updateCartBadge(); 
    renderCart();
    
    if (selectedPayment === 'card') {
      showToast('Karta orqali tayyor! ✅', 'QulayPay orqali muvaffaqiyatli', 's');
    } else {
      showToast('Buyurtma yuborildi! 🎉', 'Naqd to\'lov (kuryerga)', 's');
    }
    
    setTimeout(closeCart, 700);
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

function renderProfileOrders(orders: any[]) {
  const ol = document.getElementById('pOrdersList');
  if (!ol) return;
  if (!orders.length) { ol.innerHTML = '<div style="color:var(--gray);font-size:12px">Hozircha zakaz yo\'q</div>'; return; }
  
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  ol.innerHTML = orders.map(o => {
    const created = o.createdAt?.toMillis() || 0;
    const canCancel = (now - created < TWO_HOURS) && o.status === 'new';
    
    return `
    <div class="p-order-item">
      <div class="poi-head">
        <span class="poi-id">${o.order_code || o.id}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="poi-status status-${o.status}">${o.status.toUpperCase()}</span>
          ${canCancel ? `<button class="poi-cancel-btn" onclick="cancelOrder('${o.id}')">Bekor qilish</button>` : ''}
        </div>
      </div>
      <div class="poi-items">${o.items}</div>
      <div class="poi-foot">
        <div class="poi-total">${fmt(o.total)} so'm</div>
        <div class="poi-date">${o.createdAt?.toDate().toLocaleString() || ''}</div>
      </div>
      <div class="poi-coin">🪙 +${o.coins_earned || 0} coin olindi</div>
    </div>`;
  }).join('');
}

(window as any).cancelOrder = async (id: string) => {
  if (!confirm('Haqiqatdan ham buyurtmani bekor qilmoqchimisiz?')) return;
  try {
    await updateDoc(doc(db, 'orders', id), { status: 'cancelled' });
    showToast('Buyurtma bekor qilindi', '', 'i');
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

function showProfileData() {
  if (!currentUser) return;
  const pName = document.getElementById('pName');
  const pEmail = document.getElementById('pEmail');
  const pFullName = document.getElementById('pFullName');
  const pAddress = document.getElementById('pAddress');
  const admBtn = document.getElementById('adminEntryBtn');

  if (pName) pName.textContent = currentUser.displayName || currentUser.email?.split('@')[0] || 'Foydalanuvchi';
  if (pEmail) pEmail.textContent = currentUser.email || '—';

  safeUnsub('user_profile');
  unsubscribers['user_profile'] = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      if (pFullName) pFullName.textContent = d.full_name || 'Belgilanmagan';
      if (pAddress) pAddress.textContent = d.address || 'Belgilanmagan';
      const c = document.getElementById('pCoins'); if (c) c.textContent = String(d.coins || 0);
    }
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'user_profile_snap'));

  if (SITE_OWNERS.includes(currentUser.email || '')) {
    isAdminUser = true;
    if (admBtn) admBtn.style.display = 'block';
  } else {
    getDoc(doc(db, 'admins', currentUser.uid)).then(s => {
      isAdminUser = s.exists();
      if (isAdminUser && admBtn) admBtn.style.display = 'block';
    });
  }
}

(window as any).openCatalog = () => { renderCatalogList(categories); document.getElementById('catalogOverlay')?.classList.add('open'); document.body.style.overflow = 'hidden'; };

function renderCatalogList(list: any[]) {
  const el = document.getElementById('catalogList');
  if (!el) return;
  el.innerHTML = `
    <div class="catalog-sec-label">Kategoriyalar</div>
    <div class="catalog-all-item" onclick="closeCatalog();resetFilter();scrollToProds()">
      <div class="catalog-all-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div>
      <div><div class="catalog-all-name">Barchasi</div><div style="font-size:10px;color:var(--gray);margin-top:1px">${products.length} ta mahsulot</div></div>
    </div>
    ${list.map(c => `
      <div class="catalog-item ${currentCatFilter === c.name ? 'active' : ''}" onclick="filterCat('${c.name}');closeCatalog()">
        <img class="catalog-item-img" src="${c.img}" alt="${c.name}" loading="lazy">
        <div class="catalog-item-info"><div class="catalog-item-name">${c.name}</div><div class="catalog-item-count">${products.filter(p => p.cat === c.name).length} ta mahsulot</div></div>
        <svg class="catalog-item-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`).join('')}`;
}

function renderPosts() {
  const el = document.getElementById('postsRow');
  if (!el) return;
  if (!posts.length) { el.innerHTML = ''; return; }
  el.innerHTML = posts.map(p => `
    <article class="post-card" onclick="openPost('${p.id}')">
      <div class="post-img-wrap">
        <img class="post-img" src="${p.img}" alt="${p.title}" loading="lazy">
      </div>
      <div class="post-info">
        <time class="post-date">${p.createdAt?.toDate().toLocaleDateString('uz-UZ') || ''}</time>
        <h3 class="post-title">${p.title}</h3>
        <p class="post-excerpt">${p.excerpt || p.text?.substring(0, 80) + '...'}</p>
      </div>
    </article>`).join('');
}

(window as any).openPost = (id: string) => {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  
  // Hash Routing
  window.history.pushState(null, '', `#post-${id}`);

  // SEO updates
  document.title = `${p.title} — SPORTCITY Yangiliklari`;
  updateMeta('description', p.excerpt || p.text?.substring(0, 160));
  updateMeta('og:title', p.title);
  updateMeta('og:image', p.img);

  (document.getElementById('prodModalContent') as HTMLElement).innerHTML = `
    <button class="pm-close" onclick="closeProdModal()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <img class="pm-img" src="${p.img}" alt="${p.title}">
    <div class="pm-info">
      <div class="pm-brand">YANGILIKLAR</div>
      <h2 class="pm-name">${p.title}</h2>
      <div class="pm-desc" style="white-space: pre-wrap">${p.text}</div>
      <div class="pm-price-row">
        <div class="poi-date">Sana: ${p.createdAt?.toDate().toLocaleString() || ''}</div>
      </div>
    </div>`;
  document.getElementById('prodModalOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
};

function updateMeta(name: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
  if (el) el.setAttribute('content', content);
}

function updateStructuredData(data: any) {
  let script = document.getElementById('dynamic-ld-json');
  if (!script) {
    script = document.createElement('script');
    script.id = 'dynamic-ld-json';
    script.setAttribute('type', 'application/ld+json');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

(window as any).openProduct = (id: string) => {
  const p = products.find(x => x.id === id); if (!p) return;
  
  // Hash Routing
  window.history.pushState(null, '', `#product-${id}`);

  // Dynamic SEO
  document.title = `${p.name} — SPORTCITY`;
  updateMeta('description', p.description || `${p.name} - ${p.brand} brendidan sifatli sport anjomi.`);
  updateMeta('og:title', p.name);
  updateMeta('og:image', p.img);
  updateMeta('keywords', `${p.name}, ${p.brand}, ${p.cat}, sport city, o'zbekiston`);
  
  // Product Schema
  updateStructuredData({
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": p.name,
    "image": p.img,
    "description": p.description,
    "brand": { "@type": "Brand", "name": p.brand },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "UZS",
      "price": p.price,
      "availability": "https://schema.org/InStock"
    }
  });

  const sizes = Array.isArray(p.sizes) ? p.sizes : (p.sizes ? p.sizes.split(',') : []);
  let selSize = sizes[0] || '';
  (document.getElementById('prodModalContent') as HTMLElement).innerHTML = `
    <button class="pm-close" onclick="closeProdModal()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <img class="pm-img" src="${p.img}" alt="${p.name}">
    <div class="pm-info">
      <div class="pm-brand">${p.brand}</div>
      <div class="pm-name">${p.name}</div>
      <div class="rating-row" style="margin-bottom:12px">${renderStars(p.rating)}<span class="rating-count2">(${p.reviews || 0} ta sharh)</span></div>
      <div class="pm-desc">${p.description || ''}</div>
      ${sizes.length ? `<div class="pm-sizes"><div class="pm-size-label">O'lcham tanlang</div><div class="pm-sizes-row">${sizes.map(s => `<button class="pm-size-btn ${s === selSize ? 'active' : ''}" onclick="this.parentElement.querySelectorAll('.pm-size-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${s}</button>`).join('')}</div></div>` : ''}
      <div class="pm-price-row">
        <div>
          ${p.old_price ? `<div class="pm-price-old">${fmt(p.old_price)} so'm</div>` : ''}
          <div class="pm-price-new">${fmt(p.price)} <span style="font-size:16px;opacity:.5">so'm</span></div>
        </div>
      </div>
      <div class="pm-actions">
        <button class="pm-add-btn" onclick="addToCart(event,'${p.id}');closeProdModal()">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Savatga qo'shish
        </button>
      </div>
    </div>`;
  document.getElementById('prodModalOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
};

(window as any).closeProdModal = (e: any) => { 
  if (e !== undefined && e.target && e.target.id !== 'prodModalOverlay' && e.target.closest('.pm-close') === null) return;
  
  document.getElementById('prodModalOverlay')?.classList.remove('open'); 
  document.body.style.overflow = ''; 
  // Reset Hash
  window.history.pushState(null, '', window.location.pathname);
  // Reset SEO
  document.title = "SPORTCITY — Premium Sport Anjomlari Do'koni";
  updateMeta('description', "SPORTCITY — O'zbekistondagi eng yaxshi sport anjomlari do'koni. Futbol, fitnes, boks va yugurish uchun sifatli jihozlar va kiyimlar. Toshkent bo'ylab tezkor yetkazib berish!");
  const dynamicSd = document.getElementById('dynamic-ld-json');
  if (dynamicSd) dynamicSd.remove();
};
function closeProfile() { 
  document.getElementById('profileOverlay')?.classList.remove('open'); 
  document.body.style.overflow = ''; 
  setNavActive('navHome'); 
  if (window.location.pathname !== '/') window.history.pushState(null, '', '/');
}
(window as any).closeProfile = closeProfile;

// ─── Admin logic ──────────────────────────────────────────────
let currentAdminPage = 1;
(window as any).openAdmin = () => {
  if (!isAdminUser) return showToast('Kirish taqiqlangan', 'Faqat adminlar uchun', 'e');
  const overlay = document.getElementById('adminOverlay');
  if (overlay) {
    overlay.classList.add('open');
  }
  document.body.style.overflow = 'hidden';
};

(window as any).closeAdmin = () => { 
  const overlay = document.getElementById('adminOverlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
  document.body.style.overflow = ''; 
};

(window as any).toggleAdminPanelPage = () => {
  currentAdminPage = currentAdminPage === 1 ? 2 : 1;
  const nav1 = document.getElementById('adminNav1');
  const nav2 = document.getElementById('adminNav2');
  const indicator = document.getElementById('adminPageIndicator');
  
  if (nav1 && nav2 && indicator) {
    if (currentAdminPage === 1) {
      nav1.style.display = 'block';
      nav2.style.display = 'none';
      indicator.textContent = 'DASHBOARD';
      (window as any).switchAdminTab('dashboard');
    } else {
      nav1.style.display = 'none';
      nav2.style.display = 'block';
      indicator.textContent = 'CONTENT';
      (window as any).switchAdminTab('products');
    }
  }
};

(window as any).switchAdminTab = (name: string) => {
  // Update nav buttons
  document.querySelectorAll('.admin-tab').forEach(t => {
    const tabName = t.getAttribute('data-tab');
    t.classList.toggle('active', tabName === name);
  });
  
  // Update sections
  document.querySelectorAll('.admin-section').forEach(s => {
    s.classList.remove('active');
    if (s.id === 'tab-' + name) s.classList.add('active');
  });

  // Special loads
  if (name === 'orders') loadAdminOrdersList();
  if (name === 'users') loadAdminUsersList();
}

async function loadAdminOrdersList() {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAdminOrders(orders);
}

async function loadAdminUsersList() {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAdminUsers(users);
}

async function loadAdminList() {
  onSnapshot(collection(db, 'admins'), (snapshot) => {
    const admins = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminList(admins);
  });
}

function renderAdminList(admins: any[]) {
  const el = document.getElementById('adminManagerList');
  if (!el) return;
  el.innerHTML = admins.map(a => `
    <div class="a-user-row">
      <div class="a-user-avatar" style="background:var(--blue)">${(a.email || '?')[0].toUpperCase()}</div>
      <div class="a-user-info">
        <div class="a-user-phone">${a.email}</div>
        <div class="a-user-orders">Lavozim: ${a.role || 'Admin'}</div>
      </div>
      <button class="a-btn-danger" onclick="removeAdmin('${a.id}')" style="padding:6px 12px;font-size:10px">Tashlatish</button>
    </div>`).join('');
}

(window as any).promoteToAdmin = async () => {
  const phone = (document.getElementById('promotePhone') as HTMLInputElement).value.trim();
  if (!phone) return showToast('Xatolik', 'Email yoki Phone kiriting', 'e');
  
  try {
    // Search for user by email or phone
    let q = query(collection(db, 'users'), where('email', '==', phone));
    let snap = await getDocs(q);
    
    if (snap.empty) {
      q = query(collection(db, 'users'), where('phone', '==', phone));
      snap = await getDocs(q);
    }
    
    if (snap.empty) return showToast('Xatolik', 'Foydalanuvchi topilmadi', 'e');
    
    const user = snap.docs[0];
    const userData = user.data();
    
    await setDoc(doc(db, 'admins', user.id), {
      email: userData.email,
      uid: user.id,
      role: 'admin',
      promotedBy: currentUser.email,
      createdAt: serverTimestamp()
    });
    
    showToast('Muvaffaqiyatli', 'Yangi admin tayinlandi', 's');
    (document.getElementById('promotePhone') as HTMLInputElement).value = '';
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

(window as any).removeAdmin = async (id: string) => {
  if (!confirm('Ushbu adminni huquqlaridan mahrum qilmoqchimisiz?')) return;
  await deleteDoc(doc(db, 'admins', id));
  showToast('Amalga oshirildi', 'Admin olib tashlandi', 'i');
};

async function loadAdminSiteSettings() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'socials'));
    if (snap.exists()) {
      const d = snap.data();
      (document.getElementById('set-tg') as HTMLInputElement).value = d.telegram || '';
      (document.getElementById('set-inst') as HTMLInputElement).value = d.instagram || '';
      (document.getElementById('set-yt') as HTMLInputElement).value = d.youtube || '';
      (document.getElementById('set-tt') as HTMLInputElement).value = d.tiktok || '';
    }
  } catch (e) {
    console.error('Error loading admin site settings', e);
  }
}

(window as any).saveSocialSettings = async () => {
  const telegram = (document.getElementById('set-tg') as HTMLInputElement).value;
  const instagram = (document.getElementById('set-inst') as HTMLInputElement).value;
  const youtube = (document.getElementById('set-yt') as HTMLInputElement).value;
  const tiktok = (document.getElementById('set-tt') as HTMLInputElement).value;
  
  await setDoc(doc(db, 'site_settings', 'socials'), {
    telegram, instagram, youtube, tiktok,
    updatedAt: serverTimestamp()
  });
  showToast('Saqlandi', 'Ijtimoiy tarmoqlar yangilandi', 's');
  loadGlobalSettings(); // Update footer
};

function updateAdminStats(allOrders: any[]) {
  const sp = document.getElementById('statProducts'); if (sp) sp.textContent = String(products.length);
  const so = document.getElementById('statOrders'); if (so) so.textContent = String(allOrders.length);
  const sr = document.getElementById('statRevenue'); if (sr) sr.textContent = fmt(allOrders.reduce((s, o) => s + o.total, 0));
  const su = document.getElementById('statUsers');
  const userList = document.getElementById('adminUsersList');
  if (su && userList) su.textContent = String(userList.children.length);
}

function renderAdminOrders(allOrders: any[]) {
  const el = document.getElementById('adminOrdersList');
  if (!el) return;
  if (!allOrders.length) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;padding:16px 0">Hozircha zakaz yo\'q</div>'; return; }
  el.innerHTML = allOrders.map(o => `
    <div class="a-order-row">
      <div class="a-order-head">
        <span class="a-order-id">${o.order_code || o.id}</span>
        <select onchange="updateOrderStatus('${o.id}',this.value)" style="background:var(--card);color:white;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">
          ${['new','processing','delivered','cancelled'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="a-order-phone">📱 ${o.userPhone || o.userEmail}</div>
      <div style="font-size:11px;font-weight:700;margin-bottom:6px;color:var(--gold)">
        💰 To'lov: ${o.paymentMethod === 'card' ? '💳 Karta (QulayPay)' : '💵 Naqd (Kuryerga)'}
      </div>
      <div class="a-order-items">${o.items}</div>
      ${o.comment ? `<div style="font-size:11px;color:var(--gray);margin-top:4px;font-style:italic">💬 ${o.comment}</div>` : ''}
      <div class="a-order-total">${fmt(o.total)} so'm · 🪙${o.coins_earned} coin</div>
    </div>`).join('');
}

(window as any).updateOrderStatus = async (id: string, status: string) => {
  await updateDoc(doc(db, 'orders', id), { status });
  showToast('Holat yangilandi', status, 's');
};

function renderAdminProducts() {
  const el = document.getElementById('adminProdList');
  if (!el) return;
  el.innerHTML = products.map(p => `
    <div class="a-prod-row">
      <img class="a-prod-img" src="${p.img}" alt="${p.name}">
      <div class="a-prod-info">
        <div class="a-prod-brand">${p.brand} ${p.isTop ? '<span style="color:var(--gold);font-size:14px">⭐</span>' : ''}</div>
        <div class="a-prod-name">${p.name}</div>
        <div class="a-prod-price">${fmt(p.price)} so'm</div>
      </div>
      <div class="a-prod-actions">
        <button class="a-btn-sm ${p.isTop ? 'active' : ''}" onclick="toggleTopStatus('${p.id}',${p.isTop||false})" title="Topga chiqarish/olish">⭐</button>
        <button class="a-btn-sm" onclick="editPrice('${p.id}',${p.price},${p.old_price||0})">💰</button>
        <button class="a-btn-sm" onclick="editImg('${p.id}','${p.name}','${p.img}')">🖼</button>
        <button class="a-btn-danger" onclick="deleteProduct('${p.id}')">🗑</button>
      </div>
    </div>`).join('');
}

(window as any).toggleTopStatus = async (id: string, current: boolean) => {
  await updateDoc(doc(db, 'products', id), { isTop: !current });
  showToast(!current ? 'Topga qo\'shildi' : 'Topdan olindi', '', 's');
};

(window as any).editPrice = (id: string, p: number, old: number) => {
  (document.getElementById('editProdId') as HTMLInputElement).value = id;
  (document.getElementById('editPrice') as HTMLInputElement).value = String(p);
  (document.getElementById('editOldPrice') as HTMLInputElement).value = String(old);
  (document.getElementById('priceEditModal') as HTMLElement).style.display = 'flex';
};

(window as any).savePrice = async () => {
  const id = (document.getElementById('editProdId') as HTMLInputElement).value;
  const price = Number((document.getElementById('editPrice') as HTMLInputElement).value);
  const old_price = Number((document.getElementById('editOldPrice') as HTMLInputElement).value);
  await updateDoc(doc(db, 'products', id), { price, old_price });
  (document.getElementById('priceEditModal') as HTMLElement).style.display = 'none';
  showToast('Saqlandi', 'Narx yangilandi', 's');
};

(window as any).editImg = (id: string, name: string, img: string) => {
  (document.getElementById('imgEditProdId') as HTMLInputElement).value = id;
  (document.getElementById('imgEditProdName') as HTMLElement).textContent = name;
  (document.getElementById('imgEditUrl') as HTMLInputElement).value = img;
  (document.getElementById('imgEditPreview') as HTMLImageElement).src = img;
  (document.getElementById('imgEditModal') as HTMLElement).style.display = 'flex';
};

(window as any).saveProductImg = async () => {
  const id = (document.getElementById('imgEditProdId') as HTMLInputElement).value;
  const img = (document.getElementById('imgEditUrl') as HTMLInputElement).value;
  await updateDoc(doc(db, 'products', id), { img });
  (document.getElementById('imgEditModal') as HTMLElement).style.display = 'none';
  showToast('Saqlandi', 'Rasm yangilandi', 's');
};

(window as any).deleteProduct = async (id: string) => {
  if (!confirm('Ochirilsinmi?')) return;
  await deleteDoc(doc(db, 'products', id));
  showToast('Ochirildi', '', 'i');
};

(window as any).addProduct = async () => {
  const brand = (document.getElementById('ap-brand') as HTMLInputElement).value;
  const name = (document.getElementById('ap-name') as HTMLInputElement).value;
  const price = Number((document.getElementById('ap-price') as HTMLInputElement).value);
  const old_price = Number((document.getElementById('ap-oldprice') as HTMLInputElement).value);
  const img = (document.getElementById('ap-img') as HTMLInputElement).value;
  const cat = (document.getElementById('ap-cat') as HTMLSelectElement).value;
  const badge = (document.getElementById('ap-badge') as HTMLSelectElement).value;
  const badge_text = badge.toUpperCase();
  const isTop = (document.getElementById('ap-top') as HTMLInputElement).checked;
  const sizes = (document.getElementById('ap-sizes') as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(s=>s);
  const description = (document.getElementById('ap-desc') as HTMLInputElement).value;

  if (!brand || !name || !price) return showToast('Malumotlar chala', '', 'e');
  await addDoc(collection(db, 'products'), {
    brand, name, price, old_price, img, cat, badge, badge_text, sizes, description, isTop,
    rating: 5, reviews: 0, createdAt: serverTimestamp()
  });
  showToast('Qoshildi', name, 's');
  // Reset form
  (document.getElementById('ap-name') as HTMLInputElement).value = '';
  (document.getElementById('ap-price') as HTMLInputElement).value = '';
  (document.getElementById('ap-top') as HTMLInputElement).checked = false;
};

function renderAdminUsers(allUsers: any[]) {
  const el = document.getElementById('adminUsersList');
  if (!el) return;
  el.innerHTML = allUsers.map(u => `
    <div class="a-user-row">
      <div class="a-user-avatar">${(u.displayName || u.email || '?')[0].toUpperCase()}</div>
      <div class="a-user-info">
        <div class="a-user-phone">${u.email || 'Email yoq'}</div>
        <div class="a-user-orders">ID: ${u.id.substring(0,8)}</div>
      </div>
      <div class="a-user-coin">🪙 ${u.coins || 0}</div>
    </div>`).join('');
}

(window as any).addCoinsToUser = async () => {
  const searchVal = (document.getElementById('coinPhone') as HTMLInputElement).value;
  const amount = Number((document.getElementById('coinAmount') as HTMLInputElement).value);
  if (!searchVal || !amount) return showToast('Malumot kiritilmadi', '', 'e');
  
  // Try finding by email
  let q = query(collection(db, 'users'), where('email', '==', searchVal));
  let snap = await getDocs(q);
  
  if (snap.empty) {
    // Try finding by phone
    q = query(collection(db, 'users'), where('phone', '==', searchVal));
    snap = await getDocs(q);
  }
  
  if (snap.empty) return showToast('Foydalanuvchi topilmadi', '', 'e');
  
  await updateDoc(doc(db, 'users', snap.docs[0].id), { coins: increment(amount) });
  showToast('Coin qoshildi', searchVal, 's');
};

(window as any).addCategory = async () => {
  const name = (document.getElementById('cat-name') as HTMLInputElement).value;
  const desc = (document.getElementById('cat-desc') as HTMLInputElement).value;
  const img = (document.getElementById('cat-img') as HTMLInputElement).value;
  if (!name || !img) return showToast('Malumotlar chala', '', 'e');
  await addDoc(collection(db, 'categories'), { name, description: desc, img, createdAt: serverTimestamp() });
  (document.getElementById('cat-name') as HTMLInputElement).value = '';
  (document.getElementById('cat-desc') as HTMLInputElement).value = '';
  (document.getElementById('cat-img') as HTMLInputElement).value = '';
  showToast('Kategoriya qoshildi', name, 's');
};

function renderAdminCategories() {
  const el = document.getElementById('catAdminList');
  if (!el) return;
  el.innerHTML = categories.map((c, i) => `
    <div class="cat-admin-row">
      <img class="cat-admin-img-prev" src="${c.img}">
      <div class="cat-admin-info">
        <div class="cat-admin-name">${c.name}</div>
      </div>
      <div style="display:flex;gap:5px">
        <button class="a-btn-sm" onclick="editCatImg('${c.id}','${c.name}','${c.img}')">🖼</button>
        <button class="a-btn-danger" onclick="deleteCategory('${c.id}')">🗑</button>
      </div>
    </div>`).join('');
}

(window as any).editCatImg = (id: string, name: string, img: string) => {
  (document.getElementById('catImgEditIdx') as HTMLInputElement).value = id;
  (document.getElementById('catImgEditName') as HTMLElement).textContent = name;
  (document.getElementById('catImgEditUrl') as HTMLInputElement).value = img;
  (document.getElementById('catImgEditPreview') as HTMLImageElement).src = img;
  (document.getElementById('catImgEditModal') as HTMLElement).style.display = 'flex';
};

(window as any).saveCatImg = async () => {
  const id = (document.getElementById('catImgEditIdx') as HTMLInputElement).value;
  const img = (document.getElementById('catImgEditUrl') as HTMLInputElement).value;
  await updateDoc(doc(db, 'categories', id), { img });
  (document.getElementById('catImgEditModal') as HTMLElement).style.display = 'none';
  showToast('Saqlandi', 'Kategoriya rasmi yangilandi', 's');
};

(window as any).deleteCategory = async (id: string) => {
  if (!confirm('Ochirilsinmi?')) return;
  await deleteDoc(doc(db, 'categories', id));
  showToast('Ochirildi', '', 'i');
};

(window as any).addPost = async () => {
  const title = (document.getElementById('post-title') as HTMLInputElement).value;
  const excerpt = (document.getElementById('post-excerpt') as HTMLInputElement).value;
  const text = (document.getElementById('post-text') as HTMLTextAreaElement).value;
  const img = (document.getElementById('post-img') as HTMLInputElement).value;
  if (!title || !text || !img) return showToast('Malumotlar chala', '', 'e');
  await addDoc(collection(db, 'posts'), { title, excerpt, text, img, createdAt: serverTimestamp() });
  showToast('Yangilik qoshildi', title, 's');
};

function renderAdminPosts() {
  const el = document.getElementById('adminPostsList');
  if (!el) return;
  el.innerHTML = posts.map(p => `
    <div class="a-prod-row">
      <img class="a-prod-img" src="${p.img}" alt="${p.title}">
      <div class="a-prod-info">
        <div class="a-prod-name">${p.title}</div>
        <div style="font-size:10px;color:var(--gray)">${p.createdAt?.toDate().toLocaleDateString()}</div>
      </div>
      <div class="a-prod-actions">
        <button class="a-btn-danger" onclick="deletePost('${p.id}')">🗑</button>
      </div>
    </div>`).join('');
}

(window as any).deletePost = async (id: string) => {
  if (!confirm('Ochirilsinmi?')) return;
  await deleteDoc(doc(db, 'posts', id));
  showToast('Ochirildi', '', 'i');
};

(window as any).updateSiteInfo = async () => {
  const phone = (document.getElementById('site-phone') as HTMLInputElement).value;
  const address = (document.getElementById('site-address') as HTMLInputElement).value;
  const tg = (document.getElementById('site-tg') as HTMLInputElement).value;
  await setDoc(doc(db, 'site_info', 'config'), { contact: { phone, address }, telegram: tg, updatedAt: serverTimestamp() }, { merge: true });
  showToast('Saqlandi', 'Kontaktlar yangilandi', 's');
};

(window as any).uploadHero = async (idx: number, input: HTMLInputElement) => {
  const file = input.files?.[0];
  if (!file) return;
  try {
    showToast('Yuklanmoqda...', 'Hero rasm saqlanmoqda', 'i');
    const url = await uploadImage(file);
    (document.getElementById('heroUrlInput' + idx) as HTMLInputElement).value = url;
    (document.getElementById('adminHeroPreview' + idx) as HTMLImageElement).src = url;
    showToast('Tayyor!', 'Rasm yuklandi', 's');
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

(window as any).uploadFile = async (inputId: string, targetInputId: string, cb?: (url: string) => void) => {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    showToast('Yuklanmoqda...', 'Rasm saqlanmoqda', 'i');
    const url = await uploadImage(file);
    (document.getElementById(targetInputId) as HTMLInputElement).value = url;
    if (cb) cb(url);
    showToast('Tayyor!', 'Rasm yuklandi', 's');
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

(window as any).updateHeroImage = async (idx: number) => {
  const url = (document.getElementById('heroUrlInput' + idx) as HTMLInputElement).value;
  await setDoc(doc(db, 'banners', 'banner' + idx), { img: url });
  showToast('Yangilandi', 'Hero rasm saqlandi', 's');
};

(window as any).closeCatalogCheck = (e: any) => { if (e.target.id === 'catalogOverlay') closeCatalog(); };
(window as any).closeProfileCheck = (e: any) => { if (e.target.id === 'profileOverlay') closeProfile(); };

(window as any).filterCatalogList = (val: string) => {
  const filtered = categories.filter(c => c.name.toLowerCase().includes(val.toLowerCase()));
  renderCatalogList(filtered);
};

function renderHeroSlides() {
  const slidesEl = document.getElementById('heroSlides');
  if (!slidesEl) return;
  slidesEl.innerHTML = banners.map((b, i) => `
    <div class="hero-slide ${i === 0 ? 'active' : ''}">
      <img class="hero-img" src="${b.img}" alt="banner">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-title">${b.title || 'SPORTCITY'}</div>
        <button class="hero-btn" onclick="scrollToProds()">Hozir Ko'rish</button>
      </div>
    </div>`).join('');
}

async function loadSiteInfo() {
  onSnapshot(doc(db, 'site_info', 'config'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const sp = document.getElementById('site-phone') as HTMLInputElement; if (sp) sp.value = data.phone || '';
      const sa = document.getElementById('site-address') as HTMLInputElement; if (sa) sa.value = data.address || '';
      const st = document.getElementById('site-tg') as HTMLInputElement; if (st) st.value = data.telegram || '';
      
      if (data.logo) {
        applySiteLogo(data.logo);
        const lInp = document.getElementById('logoUrlInput') as HTMLInputElement; if (lInp) lInp.value = data.logo;
        const lPrev = document.getElementById('adminLogoPreview') as HTMLImageElement; if (lPrev) lPrev.src = data.logo;
      }
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'site_info/main'));
}

function applySiteLogo(url: string) {
  // Update Favicons
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.setAttribute('href', url);
  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.setAttribute('href', url);

  // Update all logo images in DOM
  const selectors = [
    '.tb-logo-img', 
    '.footer-logo-img', 
    '.catalog-logo-img', 
    '.auth-logo-img', 
    '.admin-logo-img',
    'img[alt="Logo"]',
    'img[alt="SPORTCITY"]'
  ];
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      (el as HTMLImageElement).src = url;
    });
  });
}

(window as any).uploadLogo = async (input: HTMLInputElement) => {
  const file = input.files?.[0];
  if (!file) return;
  try {
    showToast('Yuklanmoqda...', 'Logo rasm saqlanmoqda', 'i');
    const url = await uploadImage(file);
    const lInp = document.getElementById('logoUrlInput') as HTMLInputElement; if (lInp) lInp.value = url;
    const lPrev = document.getElementById('adminLogoPreview') as HTMLImageElement; if (lPrev) lPrev.src = url;
    showToast('Tayyor!', 'Rasm yuklandi', 's');
  } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

(window as any).updateSiteLogo = async () => {
  const url = (document.getElementById('logoUrlInput') as HTMLInputElement).value;
  if (!url) return showToast('Xatolik', 'Logo URL kerak', 'e');
  try {
    await updateDoc(doc(db, 'site_info', 'config'), { logo: url });
    showToast('Muvaffaqiyatli', 'Sayt logotipi yangilandi', 's');
  } catch (e: any) {
    if (e.message.includes('NOT_FOUND') || e.message.includes('no document to update')) {
      await setDoc(doc(db, 'site_info', 'config'), { logo: url }, { merge: true });
      showToast('Muvaffaqiyatli', 'Sayt logotipi saqlandi', 's');
    } else {
      showToast('Xatolik', e.message, 'e');
    }
  }
};

async function loadGlobalSettings() {
  onSnapshot(doc(db, 'site_settings', 'socials'), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      const footerSocials = document.getElementById('footerSocialLinks');
      if (footerSocials) {
        footerSocials.innerHTML = `
          ${d.telegram ? `<a href="${d.telegram}" target="_blank" class="f-social-link">Telegram</a>` : ''}
          ${d.instagram ? `<a href="${d.instagram}" target="_blank" class="f-social-link">Instagram</a>` : ''}
          ${d.youtube ? `<a href="${d.youtube}" target="_blank" class="f-social-link">YouTube</a>` : ''}
          ${d.tiktok ? `<a href="${d.tiktok}" target="_blank" class="f-social-link">TikTok</a>` : ''}
        `;
      }
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'site_settings/socials'));
}

// ─── Routing ──────────────────────────────────────────────────
(window as any).navigateTo = (path: string) => {
  window.history.pushState(null, '', path);
  handleRouting();
};

(window as any).openFavorites = () => {
  if (favs.size === 0) {
    showToast('Hozircha bo\'sh', 'Hech qanday mahsulot sevimlilarga qo\'shilmagan', 'i');
  } else {
    showToast('Sevimlilar', favs.size + ' ta mahsulot', 'i');
  }
  // Navigate to profile or a special section if we had one
  // For now, we reuse the profile logic
  openProfile();
};

function handleRouting() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  
  // Close all overlays and sheets by default when navigating
  const closables = [
    'catalogOverlay', 'cartOverlay', 'profileOverlay', 'prodModalOverlay', 'notifOverlay', 'adminOverlay',
    'cartSheet', 'profileSheet', 'catalogDrawer'
  ];
  closables.forEach(id => document.getElementById(id)?.classList.remove('open'));
  document.body.style.overflow = '';

  // Handle Home
  if (path === '/' || path === '/index.html' || path === '') {
    // If there is a hash, handle it (backward compatibility or deep links)
    if (hash.startsWith('#product-')) {
      const id = hash.replace('#product-', '');
      setTimeout(() => (window as any).openProduct(id), products.length ? 0 : 800);
      return;
    }
  }

  // Handle Paths
  if (path.startsWith('/product/')) {
    const id = path.replace('/product/', '');
    setTimeout(() => (window as any).openProduct(id), products.length ? 0 : 800);
  } else if (path.startsWith('/post/')) {
    const id = path.replace('/post/', '');
    setTimeout(() => (window as any).openPost(id), posts.length ? 0 : 800);
  } else if (path === '/catalog') {
    (window as any).openCatalog();
  } else if (path === '/favorites') {
    (window as any).openProfile(); // Profile has favorites for now
  } else if (path === '/cart') {
    (window as any).openCart();
  } else if (path === '/profile') {
    (window as any).openProfile();
  }
  
  // Update nav active states
  updateNavState(path);
}

function updateNavState(path: string) {
  const navs = {
    '/': 'navHome',
    '/favorites': 'navFav',
    '/cart': 'navCart',
    '/profile': 'navProfile'
  } as any;
  const activeId = navs[path] || 'navHome';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(activeId)?.classList.add('active');
}

window.addEventListener('popstate', handleRouting);
window.addEventListener('hashchange', handleRouting);
setTimeout(handleRouting, 800);

let deferredPrompt: any;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.style.display = 'block';
});

(window as any).installPWA = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.style.display = 'none';
  }
  deferredPrompt = null;
};

// ─── Profile & PIN Features ──────────────────────────────────
(window as any).openEditProfile = () => {
    const mod = document.getElementById('editProfileModal');
    if (mod) mod.style.display = 'flex';
    const fInp = document.getElementById('editFullName') as HTMLInputElement;
    const aInp = document.getElementById('editAddress') as HTMLTextAreaElement;
    const curF = document.getElementById('pFullName')?.textContent;
    const curA = document.getElementById('pAddress')?.textContent;
    if (fInp && curF && curF !== 'Belgilanmagan') fInp.value = curF;
    if (aInp && curA && curA !== 'Belgilanmagan') aInp.value = curA;
};

(window as any).saveProfileUpdates = async () => {
    if (!currentUser) return;
    const full_name = (document.getElementById('editFullName') as HTMLInputElement).value;
    const address = (document.getElementById('editAddress') as HTMLTextAreaElement).value;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { full_name, address });
        showToast('Saqlandi', 'Profil ma\'lumotlari yangilandi', 's');
        document.getElementById('editProfileModal')!.style.display = 'none';
    } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

(window as any).openPinSettings = () => {
    const mod = document.getElementById('pinSettingsModal');
    if (mod) mod.style.display = 'flex';
};

(window as any).saveNewPin = async () => {
    if (!currentUser) return;
    const pin = (document.getElementById('newPin1') as HTMLInputElement).value;
    if (pin.length !== 4) return showToast('Xatolik', 'PIN 4 ta raqam bo\'lishi kerak', 'e');
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { pin });
        showToast('Muvaffaqiyatli', 'PIN kod yangilandi', 's');
        document.getElementById('pinSettingsModal')!.style.display = 'none';
    } catch (e: any) { showToast('Xatolik', e.message, 'e'); }
};

let recoveryCodeSent = '';
(window as any).startPinRecovery = () => {
    if (!currentUser) return;
    const mod = document.getElementById('pinRecoveryModal');
    if (mod) mod.style.display = 'flex';
    const disp = document.getElementById('recoveryEmailDisplay');
    if (disp) disp.textContent = currentUser.email || 'Email topilmadi';
    document.getElementById('recoveryCodeInput')!.style.display = 'none';
    document.getElementById('sendRecoveryBtn')!.style.display = 'block';
};

(window as any).sendRecoveryEmail = async () => {
    recoveryCodeSent = Math.floor(100000 + Math.random() * 900000).toString();
    showToast('Kod yuborildi', 'Recovery kod (simulyatsiya): ' + recoveryCodeSent, 'i');
    document.getElementById('recoveryCodeInput')!.style.display = 'block';
    document.getElementById('sendRecoveryBtn')!.style.display = 'none';
};

(window as any).verifyRecoveryCode = () => {
    const inp = (document.getElementById('recoveryCode') as HTMLInputElement).value;
    if (inp === recoveryCodeSent && recoveryCodeSent !== '') {
        showToast('Tasdiqlandi', 'Yangi PIN o\'rnating', 's');
        document.getElementById('pinRecoveryModal')!.style.display = 'none';
        (window as any).openPinSettings();
    } else {
        showToast('Xato', 'Kod noto\'g\'ri', 'e');
    }
};

window.addEventListener('popstate', () => {
  // Close all overlays on back button
  closeProfile();
  closeCart();
  closeCatalog();
  closeAdmin();
  document.getElementById('editProfileModal')!.style.display = 'none';
  document.getElementById('pinSettingsModal')!.style.display = 'none';
  document.getElementById('pinRecoveryModal')!.style.display = 'none';
});

loadAll();
loadSiteInfo();
loadGlobalSettings();
loadAdminSiteSettings();

