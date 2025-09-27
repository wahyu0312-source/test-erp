/* ================== ERP Mini (Dashboard only slice) ================== */
const App = (function(){
  // === CONFIG ===
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec";      // <— GANTI
  const ENDPOINT = {
    ROOT: GAS_URL,
    AUTH: GAS_URL,
    PING: GAS_URL + "?action=ping"
  };

  // Paksa sembunyikan sync di semua role? (true = sembunyi total)
  const FORCE_HIDE_SYNC = false;

  // Role yang boleh lihat menu Sync
  const SYNC_ROLES = new Set(["管理者","生産管理部"]);

  const PROCESS_LIST = ["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];

  // === STATE ===
  const $ = (q)=>document.querySelector(q);
  const today = ()=> new Date().toISOString().slice(0,10);

  const state = {
    user: localStorage.getItem('tsh_user') || "",
    dept: localStorage.getItem('tsh_dept') || "",
    token: localStorage.getItem('tsh_token') || "",
    plan: JSON.parse(localStorage.getItem('tsh_plan') || "[]"),
    ship: JSON.parse(localStorage.getItem('tsh_ship') || "[]"),
    master: JSON.parse(localStorage.getItem('tsh_master') || "[]"),
    _interval:null
  };
  function save(){
    localStorage.setItem('tsh_plan', JSON.stringify(state.plan));
    localStorage.setItem('tsh_ship', JSON.stringify(state.ship));
    localStorage.setItem('tsh_master', JSON.stringify(state.master));
  }
  function clearLocal(){
    ['tsh_user','tsh_dept','tsh_token','tsh_plan','tsh_ship','tsh_master'].forEach(k=>localStorage.removeItem(k));
    location.reload();
  }
  function logSync(m){ const el=$("#syncLog"); if(el) el.textContent=m; }

  // ===== Login (sederhana) =====
  function ensureLogin(){
    const bar=$("#loginBar"); if(!bar) return;
    if(!state.user || !state.token){
      bar.style.display="flex";
      bar.innerHTML=`<form class="login-card" autocomplete="off">
        <div class="login-title">ERPシステム 東京精密発條株式会社</div>
        <div class="login-row">
          <input id="loginName" class="inp" placeholder="ユーザー名" autocomplete="username"/>
          <input id="loginPass" type="password" class="inp" placeholder="パスワード" autocomplete="current-password"/>
          <button id="enter" type="button" class="btn btn-primary">LOGIN</button>
        </div>
        <div id="loginErr" class="text-xs" style="color:#ef4444;margin-top:6px"></div>
      </form>`;
      const name=$("#loginName"), pass=$("#loginPass"), btn=$("#enter"), out=$("#loginErr");
      const doLogin=()=>{
        out.textContent="";
        const n=(name.value||"").trim(), p=pass.value||"";
        if(!n||!p){ out.textContent="ユーザー名とパスワードを入力してください。"; return; }
        btn.disabled=true; const old=btn.textContent; btn.textContent="ログイン中…";
        fetch(ENDPOINT.PING).then(()=> fetch(ENDPOINT.AUTH+`?action=login&username=${encodeURIComponent(n)}&password=${encodeURIComponent(p)}&t=${Date.now()}`))
        .then(r=>r.json()).then(resp=>{
          if(!resp.ok){ out.textContent="ログイン失敗: "+(resp.error||""); btn.disabled=false; btn.textContent=old; return; }
          state.user=resp.user; state.dept=resp.dept; state.token=resp.token;
          localStorage.setItem('tsh_user',resp.user);
          localStorage.setItem('tsh_dept',resp.dept);
          localStorage.setItem('tsh_token',resp.token);
          if(resp.master) state.master=resp.master;
          if(resp.plan) state.plan=resp.plan;
          if(resp.ship) state.ship=resp.ship;
          save(); location.reload();
        }).catch(e=>{ out.textContent="通信エラー: "+e; btn.disabled=false; btn.textContent=old; });
      };
      btn.onclick=doLogin;
      [name,pass].forEach(el=> el.addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); }));
    } else {
      bar.style.display="none";
    }
  }
  function bindLogout(){ $("#btnLogout")?.addEventListener('click', clearLocal); }

  // ===== Burger / Drawer: FIX untuk Chrome mobile =====
  function initBurger(){
    const burger=$("#burger"), drawer=$("#drawer"), backdrop=$("#backdrop");
    if(!burger || !drawer || !backdrop) return;

    const toggle=(open)=>{
      const want = (typeof open==='boolean') ? open : !drawer.classList.contains('open');
      drawer.classList.toggle('open', want);
      backdrop.classList.toggle('show', want);
      burger.setAttribute('aria-expanded', want ? 'true' : 'false');
      document.body.style.overflow = want ? 'hidden' : '';
    };

    const fire=(e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); };

    // Pointer events paling stabil (Chrome/Android + iOS)
    burger.addEventListener('pointerup', fire, {passive:false});
    // fallback
    burger.addEventListener('click', fire, {passive:false});
    burger.addEventListener('touchend', fire, {passive:false});

    const close=(e)=>{ e.preventDefault(); toggle(false); };
    backdrop.addEventListener('pointerup', close, {passive:false});
    backdrop.addEventListener('click', close, {passive:false});
    backdrop.addEventListener('touchend', close, {passive:false});

    // Tutup saat resize ke desktop
    window.addEventListener('resize', ()=>{ if(window.innerWidth>920) toggle(false); });

    // Tutup saat tekan Escape
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') toggle(false); });

    // Tutup ketika klik link di drawer
    drawer.querySelectorAll('a').forEach(a=>{
      a.addEventListener('pointerup', ()=>toggle(false), {passive:true});
      a.addEventListener('click', ()=>toggle(false), {passive:true});
      a.addEventListener('touchend', ()=>toggle(false), {passive:true});
    });
  }

  // ===== Role-based UI (sembunyikan sync) =====
  function applyRoleVisibility(){
    const sync = $("#syncSection");
    if(!sync) return;
    if(FORCE_HIDE_SYNC){ sync.classList.add('hidden'); return; }
    if(!state.dept || !SYNC_ROLES.has(state.dept)) sync.classList.add('hidden');
    else sync.classList.remove('hidden');
  }

  // ===== Dashboard =====
  function pageDashboard(){
    ensureLogin(); bindLogout(); initBurger(); applyRoleVisibility();

    // Now list
    const nowList=$("#nowList");
    const items = state.plan.slice(0,10).map(p=>`
      <div class='card' style="padding:8px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:600">${p.itemName||'-'} <span class="text-muted">(${p.itemNo||''})</span></div>
          <div class='text-muted' style="font-size:12px">得意先:${p.customer||'-'} ・ 製造番号:${p.prodNo||'-'} ・ 開始:${p.start||'-'}</div>
        </div>
        <div style="text-align:right">
          <div class='badge'>${p.process||'-'} / ${p.status||'-'}</div>
          <div class='text-muted' style="font-size:12px">${p.updated||''}</div>
        </div>
      </div>`).join('');
    nowList.innerHTML = items || '<div class="text-muted">データがありません。</div>';

    // Chart proses
    if(window.Chart){
      const counts=PROCESS_LIST.map(proc=>state.plan.filter(p=>p.process===proc).length);
      const ctx=document.getElementById('byProcessChart');
      if(ctx) new Chart(ctx.getContext('2d'),{type:'bar',data:{labels:PROCESS_LIST,datasets:[{label:'件数',data:counts}]},options:{plugins:{legend:{display:false}}}});
    }

    // Ship today
    const t=today();
    const list=state.ship.filter(s=>s.date===t).map(s=>`
      <div class='card' style="padding:8px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-weight:600">${s.itemName||''}</div><div class='text-muted' style="font-size:12px">${s.customer||''} ・ 数量:${s.qty||0}</div></div>
        <div><span class='badge'>${s.status||''}</span><div class='text-muted' style="font-size:12px;text-align:right">${s.updated||''}</div></div>
      </div>`).join('');
    const shipToday=$("#shipToday"); if(shipToday) shipToday.innerHTML=list||'<div class="text-muted">本日の出荷予定はありません。</div>';

    // SYNC buttons (hanya kalau kelihatan)
    $("#btnPull")?.addEventListener('click', pullSheet);
    $("#btnPush")?.addEventListener('click', pushSheet);
    $("#btnClearLocal")?.addEventListener('click', clearLocal);
    const auto=$("#autoSync"); if(auto){ auto.onchange=()=>{ if(auto.checked){ state._interval=setInterval(pullSheet,30000);} else { clearInterval(state._interval);} } }
  }

  // ===== Sync =====
  async function pullSheet(){
    try{
      const r=await fetch(ENDPOINT.ROOT);
      const j=await r.json();
      if(j.plan) state.plan=j.plan;
      if(j.ship) state.ship=j.ship;
      if(j.master) state.master=j.master;
      save(); location.reload();
    }catch(e){ logSync('同期失敗: '+e); }
  }
  async function pushSheet(){
    try{
      for(const p of state.plan){
        await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...p,user:state.user})});
      }
      for(const s of state.ship){
        await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...s,user:state.user})});
      }
      logSync('全件送信完了');
    }catch(e){ logSync('送信エラー'); }
  }

  // ===== Init =====
  function initPage(page){
    if(page==='dashboard') pageDashboard();
    // panggil umum terakhir supaya burger pasti aktif
    ensureLogin(); bindLogout(); initBurger(); applyRoleVisibility();
  }

  return { initPage };
})();
