/* ===== ERP Core (Auth + Guard + Navbar + Util) ===== */
const App = (() => {
  // ==== CONFIG (EDIT the GAS URL only) ====
  const API = 'https://script.google.com/macros/s/AKfycbxdxK93a2UJFKg5mmLi_P7OrAWv4DMUbvWX3bHGEntndIEEHWZc_dqN-iyqarKQvIFS/exec';

  // ==== Storage Keys ====
  const K_SESSION = 'erp_session_v1';  // {user,role,token,ts}

  // ==== Small util ====
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const esc = encodeURIComponent;

  function readSession(){
    try { return JSON.parse(localStorage.getItem(K_SESSION) || 'null'); }
    catch { return null; }
  }
  function writeSession(s){ localStorage.setItem(K_SESSION, JSON.stringify(s||{})); }
  function clearSession(){ localStorage.removeItem(K_SESSION); }

  function isAuthed(){
    const s = readSession();
    if(!s || !s.user || !s.token) return false;
    // (optional) 24h expiry
    const DAY = 24*60*60*1000;
    return (Date.now() - (s.ts||0)) < DAY;
  }

  function guard(pageId){
    // pages that require login
    const mustLogin = ['dashboard','plan','ship','confirm','ticket','scan','charts','master'];
    if (mustLogin.includes(pageId) && !isAuthed()){
      location.replace('index.html?needLogin=1');
      return false;
    }
    return true;
  }

  // ==== Navbar (also adds working Logout) ====
  function mountNavbar(){
    const nav = document.querySelector('.app-topbar');
    if(!nav) return;

    const s = readSession();
    const user = s?.user || '';

    nav.innerHTML = `
      <div class="max-w-7xl mx-auto px-3 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a class="brand inline-flex items-center gap-2" href="dashboard.html">
            <img src="tsh.png" alt="TSH" class="h-7"><span class="font-semibold">ERPシステム</span>
          </a>
          <nav class="hidden md:flex items-center gap-4 text-sm">
            <a href="dashboard.html">ダッシュボード</a>
            <a href="plan.html">生産計画</a>
            <a href="ship.html">出荷計画</a>
            <a href="confirm.html">出荷確認書</a>
            <a href="charts.html">分析チャート</a>
            <a href="master.html">マスター</a>
            <a href="scan.html">QRスキャン</a>
          </nav>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-600 hidden sm:inline">${user?`👤 ${user}`:''}</span>
          <button id="btnBurger" class="md:hidden btn" aria-label="menu">☰</button>
          <button id="btnLogout" class="btn btn-ghost ${user?'':'hidden'}">ログアウト</button>
        </div>
      </div>
      <div id="mnav" class="md:hidden hidden border-t bg-white">
        <nav class="max-w-7xl mx-auto px-3 py-3 grid gap-2 text-sm">
          <a href="dashboard.html">ダッシュボード</a>
          <a href="plan.html">生産計画</a>
          <a href="ship.html">出荷計画</a>
          <a href="confirm.html">出荷確認書</a>
          <a href="charts.html">分析チャート</a>
          <a href="master.html">マスター</a>
          <a href="scan.html">QRスキャン</a>
        </nav>
      </div>
    `;

    $('#btnBurger')?.addEventListener('click', ()=> $('#mnav').classList.toggle('hidden'));
    $('#btnLogout')?.addEventListener('click', ()=> {
      clearSession();
      location.replace('index.html');
    });
  }

  // ==== LOGIN ====
  async function apiLogin(u,p){
    const url = `${API}?action=login&username=${esc(u)}&password=${esc(p)}`;
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('NETWORK_'+res.status);
    return await res.json();
  }

  function bindLoginForm(){
    const f = $('#loginForm'); if(!f) return;
    const iu = $('#loginUser'), ip = $('#loginPass'), msg = $('#loginMsg');
    const btn = $('#btnLogin'), ping = $('#btnPing');

    // Enter key ok (form submit)
    f.addEventListener('submit', async (e)=>{
      e.preventDefault(); e.stopPropagation();
      const u = (iu.value||'').trim();
      const p = (ip.value||'').trim();
      if(!u || !p){ msg.textContent = 'ログイン失敗（USER_OR_PASS_EMPTY）'; return; }

      btn.disabled = true; msg.textContent = 'チェック中…';
      try{
        const j = await apiLogin(u,p);
        if(j && j.ok){
          writeSession({ user:j.user, role:j.role, token:j.token, ts:Date.now() });
          location.replace('dashboard.html');
        }else{
          msg.textContent = 'ログイン失敗';
        }
      }catch(err){
        msg.textContent = '通信エラー: '+ String(err.message||err);
      }finally{
        btn.disabled = false;
      }
    });

    // API sanity check
    ping?.addEventListener('click', async ()=>{
      const u = (iu.value||'admin'); const p = (ip.value||'1234');
      try{
        const j = await apiLogin(u,p);
        msg.textContent = j && j.ok ? 'API OK' : 'NG';
      }catch(e){ msg.textContent = 'NG('+e.message+')'; }
    });
  }

  // ==== Public init per page ====
  function init(pageId){
    if(pageId === 'login'){
      // if already logged in, go to dashboard
      if(isAuthed()){ location.replace('dashboard.html'); return; }
      bindLoginForm();
      return;
    }

    if(!guard(pageId)) return; // redirects to login if not authed
    mountNavbar();
  }

  // expose minimal helpers some pages already use
  return {
    init,
    session: { read:readSession, clear:clearSession, isAuthed },
  };
})();
