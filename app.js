/* ============================
   ERP App Core (app.js)
   Design by Wahyu — TSH ERP
   ============================ */

/* ---------- CONFIG ---------- */
const App = (() => {
  const S = {
    API: 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec', // TODO: GANTI dgn Web App URL-mu
    LS_USER: 'erpUser',
    LS_CACHE: 'erp_cache_all',
    LS_CACHE_TIME: 'erp_cache_time',
    CACHE_TTL: 15000, // 15s
  };

  /* ---------- UTILS ---------- */
  const $  = (sel,root=document)=>root.querySelector(sel);
  const $$ = (sel,root=document)=>[...root.querySelectorAll(sel)];
  const esc = (s)=> String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toCSV = (rows)=> rows.map(r=>r.map(c=>{
    const s = String(c ?? '');
    return (s.includes(',')||s.includes('"')||s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');

  const saveCSV = (filename, rows) => {
    const blob = new Blob([toCSV(rows)], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pad = (n)=> String(n).padStart(2,'0');
  const todayDate = ()=> {
    const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  /* -------- AUTH (SESSION) -------- */
  const me = ()=> {
    try { return JSON.parse(sessionStorage.getItem(S.LS_USER)||'null'); }
    catch { return null; }
  };

  const isLoggedIn = ()=> !!me();

  const ensureAuth = ()=>{
    if (!isLoggedIn()) location.href = 'index.html?needLogin=1';
  };

  const setUser = (obj)=> sessionStorage.setItem(S.LS_USER, JSON.stringify(obj||null));

  const logout = ()=>{
    sessionStorage.removeItem(S.LS_USER);
    location.href = 'index.html';
  };

  const login = async (username, password) => {
    const url = `${S.API}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res = await fetch(url, {cache:'no-store'});
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'LOGIN_FAILED');
    setUser({user: json.user, role: json.role, token: json.token});
    return json;
  };

  /* ----------- NAV / UI ----------- */
  const mountBurger = ()=>{
    const btn  = $('#burger');
    const menu = $('#mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', ()=> menu.classList.toggle('hidden'));
  };

  // Dipakai di index.html login bar
  const mountLoginForm = ()=>{
    const form  = $('#loginForm');
    const uInp  = $('#loginUser');
    const pInp  = $('#loginPass');
    const btn   = $('#loginBtn');
    const note  = $('#loginNote');

    if (!form) return;

    // Jika sudah login, sembunyikan form & tampilkan info user
    if (isLoggedIn()){
      form.classList.add('hidden');
      const info = $('#loginInfo');
      if (info) {
        info.innerHTML = `<span class="text-sm text-slate-600">ログイン中：<b>${esc(me().user)}</b>（${esc(me().role||'')}）</span>`;
        info.classList.remove('hidden');
      }
      return;
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      btn.disabled = true; note.textContent = 'ログイン中…';
      try{
        const u = (uInp.value||'').trim();
        const p = (pInp.value||'').trim();
        await login(u, p);
        location.href = 'index.html';
      }catch(err){
        console.warn(err);
        note.textContent = 'ログイン失敗';
        btn.disabled = false;
      }
    });

    // Enter key di input:
    [uInp,pInp].forEach(el=> el?.addEventListener('keydown', (ev)=>{
      if (ev.key === 'Enter') btn?.click();
    }));

    // Pesan butuh login
    const url = new URL(location.href);
    if (url.searchParams.get('needLogin') === '1') {
      note.textContent = 'ログインしてください';
    }
  };

  /* ----------- FETCH DATA ----------- */
  const fetchAll = async ()=>{
    const now = Date.now();
    const last = Number(sessionStorage.getItem(S.LS_CACHE_TIME)||0);
    if (now - last < S.CACHE_TTL) {
      try { return JSON.parse(sessionStorage.getItem(S.LS_CACHE)||'{}'); }
      catch{}
    }
    const res  = await fetch(S.API, {cache:'no-store'});
    const json = await res.json();
    sessionStorage.setItem(S.LS_CACHE, JSON.stringify(json));
    sessionStorage.setItem(S.LS_CACHE_TIME, String(now));
    return json;
  };

  const fetchMasterOnly = async ()=>{
    const res = await fetch(`${S.API}?action=master`, {cache:'no-store'});
    return await res.json(); // {ok:true, master:[...]}
  };

  /* ----------- POST / UPDATE ----------- */
  const postJSON = async (payload) => {
    const res = await fetch(S.API, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    try { return await res.json(); }
    catch { return await res.text(); }
  };

  // MASTER upsert/delete
  const masterUpsert = (row)=> postJSON({action:'MASTER_UPSERT', ...row});
  const masterDelete = (id)=>    postJSON({action:'MASTER_DELETE', id});

  // Tambah row ke PLAN / SHIP (kompatibel doPost lama)
  const appendPlan = (row)=> postJSON(row);
  const appendShip = (row)=> postJSON(row);

  /* ------ SEARCH + PAGINATION ------ */
  const searchFilter = (list, query, fields) => {
    const q = (query||'').trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      fields.some(f => String(r[f]??'').toLowerCase().includes(q))
    );
  };

  const paginate = (list, page=1, perPage=10) => {
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total/perPage));
    const p = Math.min(Math.max(1, page), pages);
    const start = (p-1)*perPage;
    return {
      page: p, perPage, total, pages,
      items: list.slice(start, start+perPage)
    };
  };

  /* --------- ROLE PROTECTION --------- */
  // contoh: requireRole(['管理者','生産管理部'])
  const requireRole = (roles=[])=>{
    const u = me();
    if (!u) { ensureAuth(); return; }
    if (roles.length && !roles.includes(u.role)) {
      alert('権限がありません。'); location.href='index.html';
    }
  };

  /* ----------- PAGE INITIALIZER ----------- */
  // Panggil dari setiap halaman: App.initPage('dashboard' | 'plan' | 'ship' | dst)
  const initPage = (name)=>{
    mountBurger();

    // Index (login first page)
    if (name === 'index') {
      mountLoginForm();
      // sembunyikan tombol login jika sudah login
      if (isLoggedIn()){
        const loginWrap = $('#loginWrap');
        loginWrap?.classList.add('hidden');
      }
      return;
    }

    // selain index: butuh login
    ensureAuth();

    // Tampilkan identitas user di header bila ada elemen #loginBar
    const lb = $('#loginBar');
    if (lb) lb.textContent = `ログイン中：${me()?.user||''}（${me()?.role||''}）`;
  };

  /* ---------- PUBLIC API ---------- */
  return {
    // config
    API: S.API,
    // utils
    $, $$, esc, saveCSV, todayDate,
    // auth
    me, isLoggedIn, ensureAuth, logout, login,
    // ui
    mountBurger, mountLoginForm,
    // data
    fetchAll, fetchMasterOnly, masterUpsert, masterDelete, appendPlan, appendShip,
    // search/paging
    searchFilter, paginate,
    // role
    requireRole,
    // page init
    initPage,
  };
})();

/* ====== Small enhancements for pages ====== */
// Optional: Auto-close mobile menu after click
document.addEventListener('click', (e)=>{
  const a = e.target.closest('#mobileMenu a');
  if (!a) return;
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.add('hidden');
});
