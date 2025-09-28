/* ==================================================
   ERP Frontend Core – Design by Wahyu (TSH)
   ================================================== */

const App = (() => {
  const CFG = {
    API: 'https://script.google.com/macros/s/AKfycbxdxK93a2UJFKg5mmLi_P7OrAWv4DMUbvWX3bHGEntndIEEHWZc_dqN-iyqarKQvIFS/exec',   // <- GANTI KE WEB APP URL TERBARU
    LS_USER: 'erp_user_v2',
    LS_CACHE: 'erp_cache_all',
    LS_CACHE_TIME: 'erp_cache_time',
    CACHE_TTL: 15000
  };

  /* ---------- helpers ---------- */
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>[...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pad = n => String(n).padStart(2,'0');
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

  /* ---------- csv ---------- */
  const toCSV = rows => rows.map(r=>r.map(c=>{
    const s = String(c ?? '');
    return (s.includes(',')||s.includes('"')||s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const saveCSV = (name, rows) => {
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([toCSV(rows)],{type:'text/csv'}));
    a.download=name; a.click(); URL.revokeObjectURL(a.href);
  };

  /* ---------- session (localStorage) ---------- */
  const me = () => { try { return JSON.parse(localStorage.getItem(CFG.LS_USER)||'null'); } catch { return null; } };
  const setUser = u => localStorage.setItem(CFG.LS_USER, JSON.stringify(u||null));
  const isAuthed = () => !!me();
  const logout = () => {
    try{
      localStorage.removeItem(CFG.LS_USER);
      localStorage.removeItem(CFG.LS_CACHE);
      localStorage.removeItem(CFG.LS_CACHE_TIME);
      sessionStorage.clear?.();
    }catch{}
    location.href = 'index.html';
  };

  /* ---------- API ---------- */
  const ping = async () => {
    // hit endpoint master (tak ubah data) untuk test koneksi
    const res = await fetch(`${CFG.API}?action=master`, {cache:'no-store'});
    return res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`));
  };

  const login = async (user, pass) => {
    const url = `${CFG.API}?action=login&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    const res = await fetch(url, {cache:'no-store'});
    const json = await res.json().catch(()=>({ok:false,error:'BAD_JSON'}));
    if (!json.ok) throw new Error(json.error||'LOGIN_FAILED');
    setUser({user: json.user, role: json.role, token: json.token});
    return json;
  };

  const ensureAuth = () => { if (!isAuthed()) location.replace('index.html?needLogin=1'); };

  const fetchAll = async ()=>{
    const now=Date.now(); const last=Number(localStorage.getItem(CFG.LS_CACHE_TIME)||0);
    if (now-last<CFG.CACHE_TTL){
      try { return JSON.parse(localStorage.getItem(CFG.LS_CACHE)||'{}'); } catch {}
    }
    const res=await fetch(CFG.API, {cache:'no-store'});
    const json=await res.json();
    localStorage.setItem(CFG.LS_CACHE, JSON.stringify(json));
    localStorage.setItem(CFG.LS_CACHE_TIME, String(now));
    return json;
  };
  const fetchMasterOnly = async ()=>{
    const res=await fetch(`${CFG.API}?action=master`, {cache:'no-store'});
    return res.json();
  };
  const postJSON = async payload=>{
    const res = await fetch(CFG.API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    try { return await res.json(); } catch { return await res.text(); }
  };
  const appendPlan = row => postJSON(row);
  const appendShip = row => postJSON(row);
  const masterUpsert = row => postJSON({action:'MASTER_UPSERT',...row});
  const masterDelete = id  => postJSON({action:'MASTER_DELETE',id});

  /* ---------- search & paging ---------- */
  const searchFilter = (list,q,fields)=>{
    const s=(q||'').toLowerCase().trim(); if(!s) return list;
    return list.filter(r=> fields.some(f => String(r[f]??'').toLowerCase().includes(s)));
  };
  const paginate = (list,page=1,per=10)=>{
    const total=list.length, pages=Math.max(1,Math.ceil(total/per));
    const p=Math.min(Math.max(1,page),pages), start=(p-1)*per;
    return {page:p,perPage:per,total,pages,items:list.slice(start,start+per)};
  };

  /* ---------- UI mounts ---------- */
  const mountBurger = ()=>{
    const btn=$('#burger'), menu=$('#mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', ()=> menu.classList.toggle('hidden'));
  };
  const mountLogout = ()=>{
    $$('#logoutBtn').forEach(b=> b.addEventListener('click', logout));
  };
  const fillUserChip = ()=>{
    const u=me(), chip=$('#userChip'); if(chip&&u) chip.textContent=`${u.user}（${u.role||''}）`;
  };
  const mountLoginForm = ()=>{
    const form=$('#loginForm'); if(!form) return;
    const u=$('#loginUser'), p=$('#loginPass'), btn=$('#loginBtn'), note=$('#loginNote'), chk=$('#checkApi');
    if(isAuthed()) { location.replace('dashboard.html'); return; }

    form.addEventListener('submit', async e=>{
      e.preventDefault(); btn.disabled=true; note.textContent='ログイン中…';
      try{
        const res=await login((u.value||'').trim(), (p.value||'').trim());
        note.textContent='OK'; location.replace('dashboard.html');
      }catch(err){
        note.textContent = `ログイン失敗（${err.message}）`;
        btn.disabled=false;
      }
    });
    [u,p].forEach(el=>el?.addEventListener('keydown',e=>{ if(e.key==='Enter') btn?.click(); }));

    if (chk) chk.addEventListener('click', async ()=>{
      chk.disabled=true; note.textContent='API チェック中…';
      try{
        const j=await ping();
        note.textContent = j && j.ok!==false ? 'API OK' : 'API 応答異常';
      }catch(e){ note.textContent=`API NG: ${e.message}`; }
      chk.disabled=false;
    });

    const need=new URL(location.href).searchParams.get('needLogin');
    if(need==='1') note.textContent='ログインしてください';
  };

  /* ---------- page init ---------- */
  const initPage = (name)=>{
    mountBurger(); mountLogout(); fillUserChip();
    if(name==='index'){ mountLoginForm(); return; }
    ensureAuth();
  };

  // close mobile menu on link click
  document.addEventListener('click',e=>{
    const a=e.target.closest('#mobileMenu a'); if(!a) return;
    $('#mobileMenu')?.classList.add('hidden');
  });

  return {
    API: CFG.API,
    $, $$, esc, today, toCSV, saveCSV,
    me, isAuthed, ensureAuth, logout, login, ping,
    fetchAll, fetchMasterOnly, postJSON, appendPlan, appendShip, masterUpsert, masterDelete,
    searchFilter, paginate,
    mountBurger, mountLogout, fillUserChip, mountLoginForm, initPage
  };
})();
