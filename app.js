const App = (function(){
  const PROCESS_LIST = ["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];

  // === GANTI URL INI ===
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec";
  const ENDPOINT={ ROOT:GAS_URL, AUTH:GAS_URL, MASTER:GAS_URL+"?action=master", PICS:GAS_URL+"?action=pics", PING:GAS_URL+"?action=ping" };

  const $=(q)=>document.querySelector(q);
  const today=()=>new Date().toISOString().slice(0,10);
  const stamp=()=>new Date().toLocaleString()+" | "+(state.user||"-");

  const state={
    user:localStorage.getItem('tsh_user')||"",
    dept:localStorage.getItem('tsh_dept')||"",
    token:localStorage.getItem('tsh_token')||"",
    plan:JSON.parse(localStorage.getItem('tsh_plan')||"[]"),
    ship:JSON.parse(localStorage.getItem('tsh_ship')||"[]"),
    master:JSON.parse(localStorage.getItem('tsh_master')||"[]"),
    pics:JSON.parse(localStorage.getItem('tsh_pics')||"[]"),
    ng:JSON.parse(localStorage.getItem('tsh_ng')||"[]"),
    _interval:null
  };
  function save(){
    localStorage.setItem('tsh_plan',JSON.stringify(state.plan));
    localStorage.setItem('tsh_ship',JSON.stringify(state.ship));
    localStorage.setItem('tsh_master',JSON.stringify(state.master));
    localStorage.setItem('tsh_pics',JSON.stringify(state.pics));
    localStorage.setItem('tsh_ng',JSON.stringify(state.ng));
  }
  function clearLocal(){ ['tsh_user','tsh_dept','tsh_token','tsh_plan','tsh_ship','tsh_master','tsh_pics','tsh_ng'].forEach(k=>localStorage.removeItem(k)); location.reload(); }
  function logSync(m){ $("#syncLog") && ($("#syncLog").textContent = m); }

  // ===== Login minimal =====
  function ensureLogin(){
    const bar=$("#loginBar"); if(!bar) return;
    if(!state.user || !state.token){
      bar.style.display="flex";
      bar.innerHTML=`<form class="login-card" autocomplete="off">
        <div class="login-title">ERPシステム 東京精密発條株式会社</div>
        <div class="login-row">
          <input id="loginName" class="inp" placeholder="ユーザー名"/>
          <input id="loginPass" type="password" class="inp" placeholder="パスワード"/>
          <button id="enter" type="button" class="btn btn-primary">入室</button>
        </div>
        <div id="loginErr" class="text-xs" style="color:#ef4444;margin-top:6px"></div>
      </form>`;
      const name=$("#loginName"), pass=$("#loginPass"), btn=$("#enter"), out=$("#loginErr");
      const doLogin=()=>{
        out.textContent=""; const n=(name.value||"").trim(), p=pass.value||"";
        if(!n||!p){ out.textContent="ユーザー名とパスワードを入力してください。"; return; }
        btn.disabled=true; const prev=btn.textContent; btn.textContent="ログイン中…";
        fetch(ENDPOINT.PING).then(()=> fetch(ENDPOINT.AUTH+`?action=login&username=${encodeURIComponent(n)}&password=${encodeURIComponent(p)}&t=${Date.now()}`))
        .then(r=>r.json()).then(resp=>{
          if(!resp.ok){ out.textContent="ログイン失敗: "+(resp.error||""); btn.disabled=false; btn.textContent=prev; return; }
          state.user=resp.user; state.dept=resp.dept; state.token=resp.token;
          localStorage.setItem('tsh_user',resp.user); localStorage.setItem('tsh_dept',resp.dept); localStorage.setItem('tsh_token',resp.token);
          state.master=resp.master||[]; state.pics=resp.pics||[]; save(); location.reload();
        }).catch(err=>{ out.textContent="通信エラー: "+err; btn.disabled=false; btn.textContent=prev; });
      };
      btn.onclick=doLogin;
      [name,pass].forEach(el=>el.addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); }));
    } else { bar.style.display="none"; }
  }
  function bindLogout(){ $("#btnLogout")?.addEventListener('click',clearLocal); }

  // ===== Burger / Drawer FIX =====
  function initBurger(){
    const burger=$("#burger"), drawer=$("#drawer"), backdrop=$("#backdrop");
    const toggle=(open)=>{
      if(!drawer||!backdrop||!burger) return;
      if(typeof open!=='boolean'){ open=!drawer.classList.contains('open'); }
      drawer.classList.toggle('open', open);
      backdrop.classList.toggle('show', open);
      burger.setAttribute('aria-expanded', open ? 'true':'false');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    if(burger){
      const fire=(e)=>{ e.preventDefault(); toggle(); };
      burger.addEventListener('click', fire, {passive:false});
      burger.addEventListener('touchend', fire, {passive:false}); /* iOS */
      burger.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' ') fire(e); });
    }
    if(backdrop){
      const close=(e)=>{ e.preventDefault(); toggle(false); };
      backdrop.addEventListener('click', close, {passive:false});
      backdrop.addEventListener('touchend', close, {passive:false});
    }
    // Tutup drawer bila resize ke desktop
    window.addEventListener('resize', ()=>{ if(window.innerWidth>920) toggle(false); });
    // Tutup bila klik link di drawer
    drawer?.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', ()=> toggle(false));
      a.addEventListener('touchend', ()=> toggle(false), {passive:true});
    });
  }

  /* ================= Dashboard (ringkas) ================= */
  function pageDashboard(){
    ensureLogin(); bindLogout(); initBurger();
    const nowList=$("#nowList");
    const items=state.plan.slice(0,10).map(p=>`
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

    // Chart contoh kecil
    if(window.Chart){
      const PROCESS = ["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];
      const counts=PROCESS.map(proc=>state.plan.filter(p=>p.process===proc).length);
      const ctx=document.getElementById('byProcessChart'); if(ctx){
        new Chart(ctx.getContext('2d'),{type:'bar',data:{labels:PROCESS,datasets:[{label:'件数',data:counts}]},options:{plugins:{legend:{display:false}}}});
      }
    }

    // ship today
    const t=today();
    const list=state.ship.filter(s=>s.date===t).map(s=>`
      <div class='card' style="padding:8px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-weight:600">${s.itemName}</div><div class='text-muted' style="font-size:12px">${s.customer} ・ 数量:${s.qty}</div></div>
        <div><span class='badge'>${s.status}</span><div class='text-muted' style="font-size:12px;text-align:right">${s.updated||''}</div></div>
      </div>`).join('');
    $("#shipToday").innerHTML=list||'<div class="text-muted">本日の出荷予定はありません。</div>';

    // stock table
    const stock=Object.values(state.plan.reduce((a,p)=>{
      const k=p.itemNo||p.itemName; a[k] ||= {itemName:p.itemName,itemNo:p.itemNo,qtyDone:0,qtyShip:0};
      a[k].qtyDone += Number(p.qtyDone||0);
      a[k].qtyShip = state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((x,y)=>x+Number(y.qty||0),0);
      return a;
    },{}));
    $("#stockBody")?.insertAdjacentHTML('beforeend', stock.map(r=>`<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td><td style="text-align:right">${r.qtyDone||0}</td><td style="text-align:right">${r.qtyShip||0}</td><td style="text-align:right;font-weight:600">${(r.qtyDone||0)-(r.qtyShip||0)}</td></tr>`).join(''));

    // sync
    $("#btnPull")?.addEventListener('click',pullSheet);
    $("#btnPush")?.addEventListener('click',pushSheet);
    $("#btnClearLocal")?.addEventListener('click',clearLocal);
    const auto=$("#autoSync"); if(auto){ auto.onchange=()=>{ if(auto.checked){ state._interval=setInterval(pullSheet,30000);} else { clearInterval(state._interval); } } }
  }

  /* ====== Pull/Push Sheets ====== */
  async function pullSheet(){
    try{
      const r=await fetch(ENDPOINT.ROOT); const j=await r.json();
      if(j.plan) state.plan=j.plan; if(j.ship) state.ship=j.ship; if(j.master) state.master=j.master; if(j.pics) state.pics=j.pics; if(j.ng) state.ng=j.ng;
      save(); location.reload();
    }catch(e){ logSync('同期失敗: '+e); }
  }
  async function pushSheet(){
    try{
      for(const p of state.plan){ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...p,user:state.user})}); }
      for(const s of state.ship){ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...s,user:state.user})}); }
      for(const n of state.ng){ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(n)}); }
      logSync('全件送信完了');
    }catch(e){ logSync('送信エラー'); }
  }

  // ====== init ======
  function initPage(page){
    if(page==='dashboard') pageDashboard();
    // (Halaman lain tetap jalan; burger/backdrop diinisialisasi di sini)
    ensureLogin(); bindLogout(); initBurger();
  }
  return { initPage };
})();
