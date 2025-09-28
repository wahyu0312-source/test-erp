/* ============================
   ERP App Core (app.js)
   Design by Wahyu — TSH ERP
   ============================ */

/* ---------- CONFIG ---------- */
const App = (() => {
  const S = {
    API: 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec', // TODO: ganti
    // pakai localStorage agar tahan pindah tab / pwa
    LS_USER: 'erp_user_v2',
    LS_CACHE: 'erp_cache_all',
    LS_CACHE_TIME: 'erp_cache_time',
    CACHE_TTL: 15000,
  };

  /* ---------- UTILS ---------- */
  const $  = (sel,root=document)=>root.querySelector(sel);
  const $$ = (sel,root=document)=>[...root.querySelectorAll(sel)];
  const esc = (s)=> String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pad = (n)=> String(n).padStart(2,'0');
  const todayDate = ()=> {
    const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  /* ---------- CSV ---------- */
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

  /* -------- AUTH (localStorage) -------- */
  const me = ()=> {
    try { return JSON.parse(localStorage.getItem(S.LS_USER)||'null'); }
    catch { return null; }
  };
  const setUser = (obj)=> localStorage.setItem(S.LS_USER, JSON.stringify(obj||null));
  const isLoggedIn = ()=> !!me();
  const logout = ()=>{
    try{
      localStorage.removeItem(S.LS_USER);
      localStorage.removeItem(S.LS_CACHE);
      localStorage.removeItem(S.LS_CACHE_TIME);
      sessionStorage.clear?.();
    }catch{}
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
  const ensureAuth = ()=>{
    if (!isLoggedIn()) location.replace('index.html?needLogin=1');
  };

  /* ----------- NAV / UI ----------- */
  const mountBurger = ()=>{
    const btn  = $('#burger');
    const menu = $('#mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', ()=> menu.classList.toggle('hidden'));
  };
  const mountLogout = ()=>{
    $$('#logoutBtn').forEach(b=> b.addEventListener('click', ()=>logout()));
  };
  const fillUserChip = ()=>{
    const u = me();
    const el = $('#userChip');
    if (el && u) el.textContent = `${u.user}（${u.role||''}）`;
  };
  const mountLoginForm = ()=>{
    const form  = $('#loginForm');
    const uInp  = $('#loginUser');
    const pInp  = $('#loginPass');
    const btn   = $('#loginBtn');
    const note  = $('#loginNote');
    if (!form) return;
    if (isLoggedIn()){
      // sudah login → langsung ke dashboard
      location.replace('dashboard.html');
      return;
    }
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      btn.disabled=true; note.textContent='ログイン中…';
      try{
        const u=(uInp.value||'').trim(), p=(pInp.value||'').trim();
        await login(u,p);
        location.replace('dashboard.html');
      }catch(err){
        note.textContent='ログイン失敗';
        btn.disabled=false;
      }
    });
    [uInp,pInp].forEach(el=> el?.addEventListener('keydown', ev=>{ if(ev.key==='Enter') btn?.click();}));
    const need = new URL(location.href).searchParams.get('needLogin');
    if (need==='1') note.textContent='ログインしてください';
  };

  /* ----------- FETCH DATA ----------- */
  const fetchAll = async ()=>{
    const now = Date.now();
    const last = Number(localStorage.getItem(S.LS_CACHE_TIME)||0);
    if (now - last < S.CACHE_TTL) {
      try { return JSON.parse(localStorage.getItem(S.LS_CACHE)||'{}'); } catch{}
    }
    const res  = await fetch(S.API, {cache:'no-store'});
    const json = await res.json();
    localStorage.setItem(S.LS_CACHE, JSON.stringify(json));
    localStorage.setItem(S.LS_CACHE_TIME, String(now));
    return json;
  };
  const fetchMasterOnly = async ()=>{
    const res = await fetch(`${S.API}?action=master`, {cache:'no-store'});
    return await res.json();
  };
  const postJSON = async (payload) => {
    const res = await fetch(S.API, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    try { return await res.json(); } catch { return await res.text(); }
  };
  const masterUpsert = (row)=> postJSON({action:'MASTER_UPSERT', ...row});
  const masterDelete = (id)=>    postJSON({action:'MASTER_DELETE', id});
  const appendPlan  = (row)=> postJSON(row);
  const appendShip  = (row)=> postJSON(row);

  /* ------ SEARCH + PAGINATION ------ */
  const searchFilter = (list, query, fields) => {
    const q = (query||'').trim().toLowerCase();
    if (!q) return list;
    return list.filter(r => fields.some(f => String(r[f]??'').toLowerCase().includes(q)));
  };
  const paginate = (list, page=1, perPage=10) => {
    const total = list.length; const pages = Math.max(1, Math.ceil(total/perPage));
    const p = Math.min(Math.max(1, page), pages); const start=(p-1)*perPage;
    return { page:p, perPage, total, pages, items:list.slice(start,start+perPage) };
  };

  /* --------- ROLE PROTECTION --------- */
  const requireRole = (roles=[])=>{
    const u = me(); if (!u) { ensureAuth(); return; }
    if (roles.length && !roles.includes(u.role)) { alert('権限がありません。'); location.replace('dashboard.html'); }
  };

  /* ----------- PAGE INITIALIZER ----------- */
  const initPage = (name)=>{
    mountBurger(); mountLogout(); fillUserChip();
    if (name==='index'){ mountLoginForm(); return; }
    ensureAuth(); // semua selain index harus login
    // halaman bisa menambah init khusus sendiri
  };

  /* ---------- PUBLIC ---------- */
  return {
    API: S.API,
    $, $$, esc, toCSV, saveCSV, todayDate,
    me, isLoggedIn, ensureAuth, logout, login,
    mountBurger, mountLogout, fillUserChip, mountLoginForm,
    fetchAll, fetchMasterOnly, masterUpsert, masterDelete, appendPlan, appendShip,
    searchFilter, paginate, requireRole, initPage,
  };
})();

// Tutup menu mobile saat klik link-nya
document.addEventListener('click', (e)=>{
  const a = e.target.closest('#mobileMenu a'); if (!a) return;
  const m = document.getElementById('mobileMenu'); m?.classList.add('hidden');
});
