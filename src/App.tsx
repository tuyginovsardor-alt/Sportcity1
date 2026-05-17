import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, Search, Menu, X, Phone, MapPin, ChevronRight, Star, Truck, 
  ShieldCheck, Instagram, Facebook, LayoutDashboard, Settings, Plus, Trash2, 
  Save, LogOut, ChevronLeft, Package, Layers, Loader2, Minus, CreditCard, ClipboardList
} from "lucide-react";
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, serverTimestamp, getDoc, updateDoc, query, orderBy
} from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth, loginWithGoogle } from './lib/firebase';

// --- TYPES ---
interface Category { id: string; name: string; img: string; }
interface Product { id: string; name: string; price: string; category: string; image: string; is_new: boolean; stock: number; }
interface SiteInfo { name: string; description: string; contact: { phone: string; address: string; }; }
interface CartItem extends Product { quantity: number; }
interface Order { id: string; customerName: string; phone: string; address: string; items: any[]; total: string; status: 'pending' | 'completed'; createdAt: any; }

export default function App() {
  const [view, setView] = useState<'store' | 'admin'>('store');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category))));
    const unsubProds = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const unsubInfo = onSnapshot(doc(db, 'site_info', 'config'), (snap) => snap.exists() && setSiteInfo(snap.data() as SiteInfo));

    const checkSeed = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'site_info', 'config'));
        if (!configDoc.exists()) {
          await setDoc(doc(db, 'site_info', 'config'), { name: "SPORTCITY", description: "Premium Sport Anjomlari", contact: { phone: "+998 90 123 45 67", address: "Namangan" } });
        }
      } finally { setLoading(false); }
    };
    checkSeed();
    return () => { unsubAuth(); unsubCats(); unsubProds(); unsubInfo(); };
  }, []);

  const isAdmin = user?.email === "tuyginovsardor36@gmail.com";

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  if (loading) return <div className="h-screen flex flex-col items-center justify-center bg-white"><Loader2 className="w-12 h-12 text-orange-600 animate-spin" /><p className="mt-4 font-bold tracking-widest text-slate-400">YUKLANMOQDA...</p></div>;

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 selection:bg-orange-100">
      {view === 'store' ? (
        <StoreView 
          categories={categories} products={products} siteInfo={siteInfo} setView={setView} 
          isAdmin={isAdmin} cart={cart} setCart={setCart} setShowCart={setShowCart} addToCart={addToCart}
        />
      ) : <AdminPanel categories={categories} products={products} siteInfo={siteInfo} setView={setView} user={user} />}

      <CartDrawer isOpen={showCart} onClose={() => setShowCart(false)} cart={cart} setCart={setCart} />
    </div>
  );
}

// --- STORE COMPONENTS ---
function StoreView({ categories, products, siteInfo, setView, isAdmin, cart, setShowCart, addToCart }: any) {
  const [activeCategory, setActiveCategory] = useState("Hammasi");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filtered = products.filter((p: any) => activeCategory === "Hammasi" || p.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-white/90 backdrop-blur-xl h-16 shadow-lg shadow-slate-100/50' : 'bg-transparent h-24'}`}>
        <div className="max-w-7xl mx-auto w-full h-full flex justify-between items-center px-6">
          <div className="flex items-center gap-12">
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`text-3xl font-black italic tracking-tighter transition-colors duration-500 ${isScrolled ? 'text-orange-600' : 'text-white'}`}
            >
              {siteInfo?.name || "SPORTCITY"}
            </motion.h1>
            <div className={`hidden lg:flex gap-8 text-[10px] font-black uppercase tracking-[0.3em] italic transition-colors duration-500 ${isScrolled ? 'text-slate-500' : 'text-white/60'}`}>
              <a href="#" className="hover:text-orange-600 transition-colors">BOSH SAHIFA</a>
              <a href="#prods" className="hover:text-orange-600 transition-colors">MAHSULOTLAR</a>
              <a href="#categories" className="hover:text-orange-600 transition-colors">KATEGORIYALAR</a>
              {isAdmin && (
                <button onClick={() => setView('admin')} className="text-orange-500 flex items-center gap-1 bg-orange-500/10 px-3 py-1 rounded-full">
                  <LayoutDashboard className="w-3 h-3" /> ADMIN
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowCart(true)} 
              className={`p-4 rounded-2xl relative transition-all duration-500 hover:scale-110 active:scale-90 ${isScrolled ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-900 shadow-2xl shadow-black/20'}`}
            >
              <ShoppingBag className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full border-2 border-white font-black">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section - Restored Visual Impact */}
        <section className="relative h-screen min-h-[700px] bg-slate-900 flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600" 
              className="w-full h-full object-cover opacity-40 mix-blend-overlay grayscale"
              alt="Hero bg"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-20">
            <div className="max-w-4xl space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <span className="inline-block bg-orange-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.4em] shadow-xl shadow-orange-600/30">
                  Premium Sifat
                </span>
                <h2 className="text-[12vw] lg:text-[9rem] font-black italic tracking-tighter leading-[0.8] text-white uppercase select-none">
                  KUCHLI <span className="text-orange-600">SPORT,</span><br />
                  KUCHLI <span className="italic outline-text">NATIJA.</span>
                </h2>
              </motion.div>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-slate-400 text-lg lg:text-2xl max-w-xl font-medium leading-relaxed italic"
              >
                {siteInfo?.description || "Sizning g'alabalaringiz bizning asosiy maqsadimiz."}
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="flex flex-wrap gap-6 pt-4"
              >
                <button className="bg-orange-600 text-white px-10 py-6 rounded-[2rem] font-black italic text-xl hover:bg-white hover:text-slate-900 transition-all shadow-2xl shadow-orange-600/20 flex items-center gap-3 group">
                  HOZIR SOTIB OLISH <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </button>
                <button className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-10 py-6 rounded-[2rem] font-black italic text-xl hover:bg-white/20 transition-all">
                  KATALOG
                </button>
              </motion.div>
            </div>
          </div>

          {/* Floating Stats */}
          <div className="absolute bottom-12 right-12 hidden lg:flex gap-12 text-white border-l-4 border-orange-600 pl-8">
            <div>
              <p className="text-4xl font-black italic">100%</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sifat Kafolati</p>
            </div>
            <div>
              <p className="text-4xl font-black italic">24/7</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mijozlarni Qo'llash</p>
            </div>
          </div>
        </section>

        {/* Categories Section - Restored Visuals */}
        <section id="categories" className="py-32 px-6 max-w-7xl mx-auto w-full space-y-16">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8">
            <div className="space-y-4">
              <h3 className="text-5xl lg:text-7xl font-black italic tracking-tighter uppercase leading-none">
                OMMABOP <span className="text-orange-600">KATEGORIYALAR</span>
              </h3>
              <div className="h-2 w-32 bg-orange-600"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {categories.map((cat: any) => (
              <motion.div 
                whileHover={{ y: -10 }}
                key={cat.id} 
                className={`group relative h-[450px] rounded-[3rem] overflow-hidden cursor-pointer border-4 transition-all duration-500 shadow-2xl ${activeCategory === cat.name ? 'border-orange-600 scale-105 z-10' : 'border-transparent shadow-slate-200'}`} 
                onClick={() => setActiveCategory(cat.name)}
              >
                <img src={cat.img} className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110" alt={cat.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent flex flex-col justify-end p-10">
                   <span className="text-orange-600 font-bold text-xs uppercase tracking-widest mb-2">To'plam</span>
                   <span className="text-white font-black text-4xl uppercase italic leading-tight group-hover:translate-x-2 transition-transform">{cat.name}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Stats / Services Bar */}
        <section className="bg-white border-y border-slate-100 py-16">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center flex-shrink-0 text-orange-600">
                <Truck className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-black italic text-xl uppercase italic">TEZKOR YETKAZISH</h4>
                <p className="text-slate-500 text-sm font-medium">Barcha buyurtmalar 24 soatda.</p>
              </div>
            </div>
            <div className="flex items-center gap-6 border-x border-slate-100 px-12">
              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center flex-shrink-0 text-orange-600">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-black italic text-xl uppercase italic">XAVFSIZ TO'LOV</h4>
                <p className="text-slate-500 text-sm font-medium">100% xavfsiz va ishonchli.</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center flex-shrink-0 text-orange-600">
                <Star className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-black italic text-xl uppercase italic">ENG YAXSHI NARX</h4>
                <p className="text-slate-500 text-sm font-medium">Sifat uchun eng maqbul narx.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Products Section - Restored Visual Impact */}
        <section id="prods" className="py-32 px-6 max-w-7xl mx-auto w-full space-y-20">
          <div className="flex flex-col md:flex-row justify-between items-end gap-12">
            <div className="space-y-6">
              <h3 className="text-5xl lg:text-7xl font-black italic tracking-tighter uppercase whitespace-pre-wrap leading-[0.9]">
                ENG YAXSHI <br /> <span className="text-orange-600">TAVSIYALAR.</span>
              </h3>
              <p className="text-slate-400 font-bold text-lg uppercase tracking-widest italic">{activeCategory} to'plami</p>
            </div>
            
            <div className="flex flex-wrap gap-3 bg-slate-100 p-2 rounded-[2rem]">
               {["Hammasi", ...categories.map((c: any) => c.name)].map((c: any) => (
                 <button 
                  key={c} 
                  onClick={() => setActiveCategory(c)}
                  className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeCategory === c ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {c}
                </button>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            <AnimatePresence mode="popLayout">
              {filtered.map((p: any) => (
                <motion.div 
                  layout 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={p.id} 
                  className="bg-white rounded-[3.5rem] p-6 border border-slate-50 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] transition-all duration-700 group relative"
                >
                  <div className="aspect-[4/5] bg-slate-50 rounded-[3rem] overflow-hidden mb-8 relative">
                     <img src={p.image} className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110 group-hover:rotate-1" alt={p.name} />
                     {p.is_new && (
                       <span className="absolute top-8 left-8 bg-orange-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-600/40">New</span>
                     )}
                  </div>
                  
                  <div className="px-4 pb-4 space-y-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-orange-600 tracking-[0.3em] font-sans">{p.category}</span>
                      <h4 className="text-3xl font-black italic uppercase leading-tight tracking-tight group-hover:text-orange-600 transition-colors">{p.name}</h4>
                    </div>
                    <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Narxi</span>
                        <span className="text-3xl font-black text-slate-900 tracking-tighter">
                          {p.price} <small className="text-[10px] font-bold text-slate-400 uppercase italic">UZS</small>
                        </span>
                      </div>
                      <button onClick={() => addToCart(p)} className="bg-slate-900 text-white p-6 rounded-3xl hover:bg-orange-600 transition-all shadow-xl shadow-slate-200">
                        <Plus className="w-8 h-8" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-40 text-center border-4 border-dashed border-slate-100 rounded-[4rem]">
              <p className="text-slate-300 font-black italic text-3xl uppercase tracking-widest">Ushbu turkumda mahsulotlar topilmadi</p>
            </motion.div>
          )}
        </section>

        {/* Featured Call to Action */}
        <section className="px-6 pb-32">
           <div className="max-w-7xl mx-auto bg-orange-600 rounded-[4rem] p-12 lg:p-24 relative overflow-hidden flex flex-col items-center text-center space-y-12 shadow-2xl shadow-orange-600/30">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                 <img src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-4xl lg:text-8xl font-black italic text-white leading-none tracking-tighter relative z-10 uppercase">
                 G'ALABA SARI <br /> BIZ BILAN.
              </h2>
              <p className="text-white/80 text-xl font-medium max-w-xl relative z-10 italic">Sportingiz uchun eng sifatli jihozlarni biz bilan kashf eting.</p>
              <button className="bg-white text-orange-600 px-16 py-8 rounded-[2.5rem] font-black italic text-3xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/10 relative z-10 uppercase tracking-tighter">
                 ALOQAGA CHIQISH
              </button>
           </div>
        </section>
      </main>

      {/* Footer - Visual Enhancement */}
      <footer className="bg-slate-950 text-white pt-32 pb-16 px-6 rounded-t-[5rem]">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="grid lg:grid-cols-2 gap-24">
            <div className="space-y-12">
               <h2 className="text-6xl lg:text-9xl font-black italic tracking-tighter leading-none text-white uppercase select-none">
                  BIZ <br /> <span className="text-orange-600">BILAN</span> <br /> BOG'LANING.
               </h2>
               <div className="flex gap-6">
                  <a href="#" className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center hover:bg-orange-600 transition-all hover:-translate-y-2 border border-white/10"><Instagram className="w-10 h-10" /></a>
                  <a href="#" className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center hover:bg-orange-600 transition-all hover:-translate-y-2 border border-white/10"><Facebook className="w-10 h-10" /></a>
                  <a href={`tel:${siteInfo?.contact.phone}`} className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center hover:bg-orange-600 transition-all hover:-translate-y-2 border border-white/10"><Phone className="w-10 h-10" /></a>
               </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-12 bg-white/5 rounded-[3rem] space-y-6 border border-white/10 hover:bg-white/10 transition-colors">
                <MapPin className="w-12 h-12 text-orange-600 mb-4" />
                <span className="text-slate-500 font-black text-xs uppercase tracking-[0.3em]">Bosh Ofis</span>
                <p className="text-3xl font-black leading-tight italic uppercase tracking-tighter">{siteInfo?.contact.address || "Namangan"}</p>
              </div>
              <div className="p-12 bg-white/5 rounded-[3rem] space-y-6 border border-white/10 hover:bg-white/10 transition-colors">
                <Phone className="w-12 h-12 text-orange-600 mb-4" />
                <span className="text-slate-500 font-black text-xs uppercase tracking-[0.3em]">Ishonch telefoni</span>
                <p className="text-3xl font-black italic uppercase tracking-tighter">{siteInfo?.contact.phone || "+998 90 000 00 00"}</p>
              </div>
            </div>
          </div>
          
          <div className="pt-16 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-12">
            <p className="text-slate-600 font-black tracking-[0.5em] text-xs uppercase italic">© 2024 {siteInfo?.name} — ALL RIGHTS RESERVED</p>
            <div className="flex gap-12 text-slate-500 text-[10px] font-black uppercase tracking-widest italic">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- CART DRAWER ---
function CartDrawer({ isOpen, onClose, cart, setCart }: any) {
  const [orderMode, setOrderMode] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);

  const total = cart.reduce((sum: number, item: any) => sum + (parseInt(item.price.replace(/,/g, '')) * item.quantity), 0);

  const updateQty = (id: string, delta: number) => {
    setCart((prev: any) => prev.map((item: any) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((i: any) => i.quantity > 0));
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), { 
        customerName: form.name, phone: form.phone, address: form.address, 
        items: cart, total: total.toLocaleString(), status: 'pending', createdAt: serverTimestamp() 
      });
      alert("Sizning buyurtmangiz qabul qilindi! Tez orada operatorlarimiz bog'lanishadi.");
      setCart([]);
      onClose();
      setOrderMode(false);
    } catch (e) { alert("Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring."); } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/40 z-[100] backdrop-blur-md" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 h-screen w-full max-w-lg bg-white z-[101] shadow-2xl flex flex-col rounded-l-[3rem] overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">SAVATCHA</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{cart.length} ta mahsulot</p>
              </div>
              <button onClick={onClose} className="p-4 bg-slate-50 hover:bg-orange-600 hover:text-white transition-all rounded-2xl"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 text-center space-y-6">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <ShoppingBag className="w-12 h-12" />
                  </div>
                  <p className="text-slate-300 font-black italic text-xl uppercase tracking-widest leading-none">Savatchangiz bo'sh</p>
                  <button onClick={onClose} className="text-orange-600 font-black uppercase text-xs border-b-2 border-orange-600 pb-1">Xaridni boshlash</button>
                </div>
              ) : (
                cart.map((item: any) => (
                  <div key={item.id} className="flex gap-6 items-center group">
                    <div className="w-24 h-24 bg-slate-50 rounded-3xl overflow-hidden flex-shrink-0">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-1">{item.category}</p>
                      <h4 className="font-black italic uppercase text-lg truncate mb-1">{item.name}</h4>
                      <p className="text-slate-900 font-black text-xl tracking-tighter">{item.price} <small className="text-[10px] text-slate-400">UZS</small></p>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-2 border border-slate-100">
                      <button onClick={() => updateQty(item.id, -1)} className="p-2 hover:bg-white hover:text-orange-600 rounded-xl transition-all"><Minus className="w-4 h-4" /></button>
                      <span className="font-black text-lg w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="p-2 hover:bg-white hover:text-orange-600 rounded-xl transition-all"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-10 bg-slate-900 text-white space-y-8 rounded-tl-[4rem]">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] block mb-2">Umumiy To'lov</span>
                    <span className="text-5xl font-black tracking-tighter text-orange-600">{total.toLocaleString()} <small className="text-xl italic">UZS</small></span>
                  </div>
                </div>

                {orderMode ? (
                  <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleOrder} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <input required placeholder="ISMINGIZ" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-orange-600 transition-all font-black italic uppercase text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                      <input required placeholder="TELEFON RAQAMINGIZ" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-orange-600 transition-all font-black italic uppercase text-sm" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                      <input required placeholder="YETKAZIB BERISH MANZILI" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-orange-600 transition-all font-black italic uppercase text-sm" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-orange-600 text-white py-6 rounded-3xl font-black italic uppercase text-xl shadow-2xl shadow-orange-600/30 flex justify-center items-center gap-3 active:scale-95 transition-all">
                      {loading ? <Loader2 className="animate-spin" /> : "BUYURTMANI TASDIQLASH"}
                    </button>
                    <button type="button" onClick={() => setOrderMode(false)} className="w-full text-slate-500 font-bold uppercase text-[10px] tracking-widest italic text-center">ORQAGA</button>
                  </motion.form>
                ) : (
                  <button onClick={() => setOrderMode(true)} className="w-full bg-white text-slate-900 py-8 rounded-[2rem] font-black italic uppercase text-2xl shadow-2xl hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-4 group">
                    BUYURTMA BERISH <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- ADMIN PANEL ---
function AdminPanel({ categories, products, siteInfo, setView, user }: any) {
  const [tab, setTab] = useState<'prods' | 'order' | 'info'>('prods');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({ name: '', price: '', category: '', image: '', is_new: true, stock: 10 });

  useEffect(() => {
    return onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });
  }, []);

  const isAdmin = user?.email === "tuyginovsardor36@gmail.com";

  const handleSave = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) { 
        await updateDoc(doc(db, 'products', editing.id), form); 
        setEditing(null); 
        alert("O'zgarishlar saqlandi!");
      } else { 
        await addDoc(collection(db, 'products'), { ...form, createdAt: serverTimestamp() }); 
        alert("Yangi mahsulot qo'shildi!");
      }
      setForm({ name: '', price: '', category: '', image: '', is_new: true, stock: 10 });
    } catch (err) {
      alert("Xatolik yuz berdi");
    } finally { setLoading(false); }
  };

  const deleteProd = async (id: string) => { 
    if (confirm("Ushbu mahsulotni o'chirishni xohlaysizmi?")) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  if (!user || !isAdmin) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-white text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-12 max-w-md">
        <div className="w-32 h-32 bg-orange-600 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-orange-600/30">
          <ShieldCheck className="w-16 h-16" />
        </div>
        <div className="space-y-4">
          <h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none">ADMIN <br /> <span className="text-orange-600">ACCESS.</span></h2>
          <p className="text-slate-500 font-medium italic">Faqat ruxsat berilgan foydalanuvchilar kirishi mumkin.</p>
        </div>
        <div className="space-y-4 pt-8">
          <button onClick={() => loginWithGoogle()} className="w-full bg-white text-slate-950 px-8 py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-4 hover:bg-orange-600 hover:text-white transition-all">
            <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-900 font-bold">G</span>
            GOOGLE BILAN KIRISH
          </button>
          <button onClick={() => setView('store')} className="w-full text-slate-500 font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-2">
            <ChevronLeft className="w-4 h-4" /> DO'KONGA QAYTISH
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden">
      <aside className="w-80 bg-slate-950 text-white p-10 flex flex-col gap-16 relative overflow-hidden hidden lg:flex">
         <div className="relative z-10">
           <h1 className="text-3xl font-black italic text-orange-600 leading-none tracking-tighter">SPORTCITY <br /> <span className="text-white text-sm tracking-widest uppercase">PRO PANEL</span></h1>
         </div>
         
         <nav className="flex-1 space-y-4 relative z-10">
            {[ 
              {id: 'prods', icon: Package, l: 'MAHSULOTLAR'}, 
              {id: 'order', icon: ClipboardList, l: 'BUYURTMALAR'}, 
              {id: 'info', icon: Settings, l: 'SOZLAMALAR'} 
            ].map(i => (
              <button 
                key={i.id} 
                onClick={() => setTab(i.id as any)} 
                className={`w-full flex items-center gap-5 p-6 rounded-[2rem] font-black italic uppercase text-xs tracking-widest transition-all duration-300 ${tab === i.id ? 'bg-orange-600 text-white shadow-2xl shadow-orange-600/30 translate-x-2' : 'text-slate-500 hover:text-white'}`}
              >
                <i.icon className="w-5 h-5" /> {i.l}
              </button>
            ))}
         </nav>

         <div className="space-y-6 relative z-10 pt-10 border-t border-white/5">
           <button onClick={() => setView('store')} className="w-full flex items-center gap-3 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" /> DO'KONNI KO'RISH
           </button>
           <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 text-red-500 font-black uppercase text-[10px] tracking-widest hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" /> TIZIMDAN CHIQISH
           </button>
         </div>

         {/* Background Decor */}
         <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-orange-600/10 rounded-full blur-[100px]"></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 lg:p-20 space-y-16 no-scrollbar">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
           <div className="space-y-2">
             <h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
               {tab === 'prods' ? "MAHSULOTLAR" : tab === 'order' ? "BUYURTMALAR" : "SOZLAMALAR"}
             </h2>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] italic">Xush kelibsiz, Admin</p>
           </div>
           <div className="flex items-center gap-4 bg-white p-3 pr-8 rounded-[2rem] shadow-sm border border-slate-100">
             <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-orange-600 shadow-lg shadow-orange-600/20">
                <img src={user.photoURL} className="w-full h-full object-cover" />
             </div>
             <div>
               <p className="font-black italic uppercase text-xs leading-none mb-1">{user.displayName}</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator</p>
             </div>
           </div>
        </header>

        {tab === 'prods' && (
          <div className="space-y-20">
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-[4rem] shadow-2xl shadow-slate-200/50 border border-slate-50 space-y-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">{editing ? "MAHSULOTNI TAHRIRLASH" : "YANGI MAHSULOT QO'SHISH"}</h3>
              </div>
              
              <form onSubmit={handleSave} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Nomi</label>
                  <input required placeholder="Masalan: Nike Zoom" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[2rem] border-2 border-transparent outline-none focus:border-orange-600 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Narxi (UZS)</label>
                  <input required placeholder="99.000" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[2rem] border-2 border-transparent outline-none focus:border-orange-600 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Kategoriya</label>
                  <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[2rem] border-2 border-transparent outline-none focus:border-orange-600 transition-all font-black italic uppercase text-xs">
                    <option value="">TANLANG...</option>
                    {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Rasm URL Manzili</label>
                  <input required placeholder="https://..." value={form.image} onChange={e => setForm({...form, image: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[2rem] border-2 border-transparent outline-none focus:border-orange-600 transition-all font-bold" />
                </div>
                <button disabled={loading} className="bg-slate-900 text-white p-6 rounded-[2rem] font-black italic uppercase text-sm tracking-widest hover:bg-orange-600 transition-all shadow-2xl shadow-slate-200 flex justify-center items-center gap-3">
                  {loading ? <Loader2 className="animate-spin" /> : editing ? "O'ZGARISHNI SAQLASH" : "MAHSULOTNI QO'SHISH"}
                </button>
              </form>
              {editing && <button onClick={() => { setEditing(null); setForm({ name: '', price: '', category: '', image: '', is_new: true, stock: 10 }); }} className="text-red-500 font-bold uppercase text-[10px] tracking-widest italic ml-4">Bekor qilish</button>}
            </motion.section>

            <section className="bg-white rounded-[4rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-50">
               <div className="p-10 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter">MAHSULOTLAR RO'YXATI</h3>
                  <div className="bg-slate-100 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">{products.length} ta jami</div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest">
                     <tr>
                       <th className="p-10">MAHSULOT</th>
                       <th className="p-10">KATEGORIYA</th>
                       <th className="p-10">NARX</th>
                       <th className="p-10 text-right">AMALLAR</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-10">
                            <div className="flex items-center gap-6">
                              <div className="w-20 h-20 bg-slate-100 rounded-3xl overflow-hidden flex-shrink-0">
                                <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              </div>
                              <h5 className="font-black italic uppercase text-lg leading-tight">{p.name}</h5>
                            </div>
                          </td>
                          <td className="p-10">
                             <span className="bg-slate-100 text-[10px] font-black px-4 py-2 rounded-full text-slate-500 whitespace-nowrap uppercase tracking-widest">{p.category}</span>
                          </td>
                          <td className="p-10">
                            <span className="text-xl font-black tracking-tighter text-orange-600">{p.price} <small className="text-[10px] text-slate-400">UZS</small></span>
                          </td>
                          <td className="p-10 text-right">
                             <div className="flex justify-end gap-3">
                               <button onClick={() => { setEditing(p); setForm(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-5 bg-blue-50 text-blue-600 rounded-3xl hover:bg-blue-600 hover:text-white transition-all"><Save className="w-6 h-6" /></button>
                               <button onClick={() => deleteProd(p.id)} className="p-5 bg-red-50 text-red-600 rounded-3xl hover:bg-red-600 hover:text-white transition-all"><Trash2 className="w-6 h-6" /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
               </div>
            </section>
          </div>
        )}

        {tab === 'order' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter">BUYURTMALAR TARIXI</h3>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-600 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Yangi: {orders.filter(o => o.status !== 'completed').length}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Yopilgan: {orders.filter(o => o.status === 'completed').length}</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <AnimatePresence>
                {orders.map(order => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={order.id} 
                    className={`bg-white p-12 rounded-[4rem] shadow-xl shadow-slate-200/50 border-2 transition-all flex flex-col lg:flex-row justify-between gap-12 ${order.status === 'completed' ? 'border-transparent opacity-60' : 'border-orange-100 ring-4 ring-orange-50'}`}
                  >
                     <div className="space-y-6 flex-1">
                       <div className="flex items-center gap-4">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'}`}>
                            {order.status === 'completed' ? "YETKAZILDI" : "YANGI BUYURTMA"}
                          </span>
                          <span className="text-slate-300 font-bold text-[10px] uppercase tabular-nums">#{order.id.slice(-6).toUpperCase()}</span>
                       </div>
                       <div className="space-y-2">
                         <h4 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{order.customerName}</h4>
                         <p className="text-xl font-bold italic text-slate-500 flex items-center gap-2">
                           <Phone className="w-5 h-5 text-orange-600" /> {order.phone}
                         </p>
                         <p className="text-slate-400 font-medium flex items-center gap-2">
                           <MapPin className="w-5 h-5" /> {order.address}
                         </p>
                       </div>
                       <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-50">
                         {order.items.map((i, idx) => (
                           <div key={idx} className="bg-slate-50 px-4 py-2 rounded-2xl flex items-center gap-3 border border-slate-100">
                             <img src={i.image} className="w-10 h-10 rounded-xl object-cover" />
                             <div>
                               <p className="text-[10px] font-black italic uppercase leading-none">{i.name}</p>
                               <p className="text-[9px] font-bold text-orange-600 uppercase italic">x{i.quantity}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>

                     <div className="lg:w-80 flex flex-col justify-between items-end gap-8 lg:border-l lg:border-slate-50 lg:pl-12">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Umumiy Hisob</p>
                          <p className="text-5xl font-black tracking-tighter text-slate-900 leading-none">{order.total} <small className="text-sm italic">UZS</small></p>
                        </div>
                        
                        <div className="flex flex-col w-full gap-3">
                          {order.status !== 'completed' && (
                            <button 
                              onClick={async () => {
                                if (confirm("Buyurtma yetkazilganligini tasdiqlaysizmi?")) {
                                  await updateDoc(doc(db, 'orders', order.id), { status: 'completed' });
                                }
                              }}
                              className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black italic uppercase text-xs tracking-widest hover:bg-green-600 transition-all shadow-xl"
                            >
                              YETKAZILDI DEB BELGILASH
                            </button>
                          )}
                          <button onClick={async () => confirm("Ushbu buyurtmani o'chirmoqchimisiz?") && await deleteDoc(doc(db, 'orders', order.id))} className="w-full text-red-500 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" /> BUYURTMANI O'CHIRISH
                          </button>
                        </div>
                     </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {orders.length === 0 && (
                <div className="py-40 text-center border-4 border-dashed border-slate-200 rounded-[5rem]">
                  <p className="text-slate-300 font-black italic text-2xl uppercase tracking-widest">Hozircha buyurtmalar yo'q</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
