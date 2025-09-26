/* ===========================================================
   ERP Mini-ERP (TSH) • app.js (ringkas, memakai endpoint ping)
=========================================================== */
const App = (function(){
  const PROCESS_LIST = ["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];

  // === GANTI DENGAN URL WEB APP ANDA
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec";

  const ENDPOINT={
    ROOT:GAS_URL,
    AUTH:GAS_URL,
    MASTER:GAS_URL+"?action=master",
    PICS:GAS_URL+"?action=pics",
    PING:GAS_URL+"?action=ping"
  };

  const PERMS={
    "管理者":{all:true}, "生産管理部":{view_all:true,edit_plan:true,delete_plan:true,edit_ship:true,mark_shipped:true,push:true,pull:true,confirm_export:true},
    "製造部":{view_all:true,scan_update:true},
    "検査部":{view_all:true,scan_update:true}
  };
  const can=(a)=>state.dept && (PERMS[state.dept]?.all || PERMS[state.dept]?.[a]);
  const $=(q)=>document.querySelector(q);
  const today=()=>new Date().toISOString().slice(0,10);
  const stamp=()=>new Date().toLocaleString()+" | "+(state.user||"-")+(state.pic?(" / "+state.pic):"");

  const state={
    user:localStorage.getItem('tsh_user')||"",
    dept:localStorage.getItem('tsh_dept')||"",
    token:localStorage.getItem('tsh_token')||"",
    pic:localStorage.getItem('tsh_pic')||"",
    plan:JSON.parse(localStorage.getItem('tsh_plan')||"[]"),
    ship:JSON.parse(localStorage.getItem('tsh_ship')||"[]"),
    master:JSON.parse(localStorage.getItem('tsh_master')||"[]"),
    pics:JSON.parse(localStorage.getItem('tsh_pics')||"[]"),
    _interval:null
  };
  function save(){ localStorage.setItem('tsh_plan',JSON.stringify(state.plan)); localStorage.setItem('tsh_ship',JSON.stringify(state.ship));
                   localStorage.setItem('tsh_master',JSON.stringify(state.master)); localStorage.setItem('tsh_pics',JSON.stringify(state.pics)); }
  function logSync(m){ const el=$("#syncLog"); if(el) el.textContent=m; }
  function clearLocal(){ ['tsh_user','tsh_dept','tsh_token','tsh_pic','tsh_plan','tsh_ship','tsh_master','tsh_pics'].forEach(k=>localStorage.removeItem(k)); location.reload(); }

  // ===== Login UI =====
  function ensureLogin(){
    const bar=$("#loginBar"); if(!bar) return;
    if(!state.user || !state.token){
      bar.style.display="flex";
      bar.innerHTML=`<div class="login-card">
        <div class="login-title">ERPシステム 東京精密発條株式会社</div>
        <div class="login-row">
          <input id="loginName" class="inp" placeholder="ユーザー名"/>
          <input id="loginPass" type="password" class="inp" placeholder="パスワード"/>
          <button id="enter" class="btn btn-primary">入室</button>
        </div>
        <div id="loginErr" class="text-xs text-red-500 mt-2"></div>
      </div>`;
      const name=$("#loginName"), pass=$("#loginPass"), btn=$("#enter"), out=$("#loginErr");
      const doLogin=()=>{
        out.textContent="";
        const n=(name.value||"").trim(), p=pass.value||"";
        if(!n||!p){ out.textContent="ユーザー名とパスワードを入力してください。"; return; }
        btn.disabled=true; const prev=btn.textContent; btn.textContent="ログイン中…";
        // ping dulu agar error SPREADSHEET_ID kebaca jelas
        fetch(ENDPOINT.PING).then(r=>r.json()).then(_=>{
          return fetch(ENDPOINT.AUTH+`?action=login&username=${encodeURIComponent(n)}&password=${encodeURIComponent(p)}&t=${Date.now()}`);
        }).then(r=>r.json()).then(resp=>{
          if(!resp.ok){ out.textContent="ログイン失敗: "+(resp.error||""); btn.disabled=false; btn.textContent=prev; return; }
          state.user=resp.user; state.dept=resp.dept; state.token=resp.token;
          localStorage.setItem('tsh_user',resp.user); localStorage.setItem('tsh_dept',resp.dept); localStorage.setItem('tsh_token',resp.token);
          state.master=resp.master||[]; state.pics=resp.pics||[]; save();
          location.reload();
        }).catch(err=>{
          out.textContent="サーバー通信エラー: "+err;
          btn.disabled=false; btn.textContent=prev;
        });
      };
      btn.onclick=doLogin; [name,pass].forEach(el=>el.addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); }));
    } else { bar.style.display="none"; }
  }
  function bindLogout(){ $("#btnLogout")?.addEventListener('click',clearLocal); }

  // ====== Contoh inisialisasi halaman (sesuaikan dg file HTML anda) ======
  function pageDashboard(){ ensureLogin(); bindLogout(); }
  function pagePlan(){ ensureLogin(); bindLogout(); }
  function pageShip(){ ensureLogin(); bindLogout(); }
  function pageConfirm(){ ensureLogin(); bindLogout(); }
  function pageTicket(){ ensureLogin(); bindLogout(); }
  function pageScan(){ ensureLogin(); bindLogout(); }

  function initPage(p){
    if(p==='dashboard') pageDashboard();
    if(p==='plan') pagePlan();
    if(p==='ship') pageShip();
    if(p==='confirm') pageConfirm();
    if(p==='ticket') pageTicket();
    if(p==='scan') pageScan();
  }
  return { initPage };
})();
