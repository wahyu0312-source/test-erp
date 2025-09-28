const App = (()=>{
  /* ====== CONFIG ====== */
  const API_URL = window.APP_SCRIPT_URL
    || 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec';

  /* ====== STORAGE AUTH ====== */
  const authStore = {
    get(){ try{ return JSON.parse(localStorage.getItem('erp_auth')||'null'); }catch{ return null; } },
    set(v){ localStorage.setItem('erp_auth', JSON.stringify(v)); },
    clear(){ localStorage.removeItem('erp_auth'); },
    isLogin(){ return !!this.get(); },
    role(){ return this.get()?.role||''; }
  };

  /* ====== DOM & helpers ====== */
  const $  = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> [...r.querySelectorAll(s)];
  const on = (el, ev, fn)=> el && el.addEventListener(ev, fn, {passive:false});
  function toast(msg){
    const x=document.createElement('div');
    x.textContent=msg;
    x.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;z-index:80;opacity:.98';
    document.body.appendChild(x); setTimeout(()=>x.remove(),2500);
  }
  const fetchJSON = (u)=> fetch(u,{cache:'no-store'}).then(r=>r.json());

  /* ====== ROUTE GUARD ====== */
  function guard(page){
    const isLogin = authStore.isLogin();
    if(page==='login'){
      if(isLogin) location.replace('dashboard.html');
      return;
    }
    if(!isLogin){
      location.replace('login.html');
      return;
    }
  }

  /* ====== HEADER / DRAWER / LOGOUT ====== */
  function initShell(){
    const drawer=$('#drawer'), scrim=$('#scrim'), btn=$('#btnBurger');
    const headerLogout=$('#btnLogout'), drawerLogout=$('#drawerLogout');

    const open = ()=>{ if(!drawer) return; drawer.classList.add('is-open'); if(scrim) scrim.hidden=false; btn?.setAttribute('aria-expanded','true'); };
    const close= ()=>{ if(!drawer) return; drawer.classList.remove('is-open'); if(scrim) scrim.hidden=true; btn?.setAttribute('aria-expanded','false'); };

    on(btn,'click', ()=> drawer?.classList.contains('is-open') ? close() : open());
    on(scrim,'click', close);
    on(document,'keydown', e=>{ if(e.key==='Escape') close(); });

    const doLogout = ()=>{ authStore.clear(); location.replace('login.html'); };
    on(headerLogout,'click', doLogout);
    on(drawerLogout,'click', doLogout);
  }

  /* ====== LOGIN PAGE ====== */
  function initLogin(){
    const form = $('#loginForm'), u=$('#lgUser'), p=$('#lgPass'), btn=$('#btnLogin');
    on(form,'submit', async (e)=>{
      e.preventDefault();
      btn.disabled=true;
      try{
        const q=new URLSearchParams({action:'login',username:u.value.trim(),password:p.value.trim()});
        const r=await fetchJSON(`${API_URL}?${q.toString()}`);
        if(r.ok){
          authStore.set({user:r.user,role:r.role,token:r.token});
          location.replace('dashboard.html');
        }else{
          toast('ログイン失敗'); btn.disabled=false;
        }
      }catch(_){ toast('サーバー通信エラー'); btn.disabled=false; }
    });
    on(p,'keydown', e=>{ if(e.key==='Enter') form.requestSubmit(); });
  }

  /* ====== DASHBOARD ====== */
  async function loadAll(){ const r=await fetchJSON(API_URL); return r.ok?r:{plan:[],ship:[],master:[]}; }

  function renderProcessChart(plan){
    const labels=['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程'];
    const counts=new Array(labels.length).fill(0);
    plan.forEach(r=>{ const p=r['プロセス']||r.process||''; const i=labels.indexOf(p); if(i>=0) counts[i]++; });
    const el=$('#byProcessChart'); if(!el) return;
    if(el._chart) el._chart.destroy();
    el._chart=new Chart(el.getContext('2d'),{
      type:'bar',
      data:{labels,datasets:[{label:'在庫',data:counts}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
    });
  }
  function renderNow(plan){
    const wrap=$('#nowList'); if(!wrap) return;
    if(!plan.length){ wrap.textContent='データがありません。'; return; }
    wrap.classList.remove('u-muted'); wrap.innerHTML='';
    plan.slice(-3).reverse().forEach(x=>{
      const div=document.createElement('div'); div.className='row wrap';
      div.innerHTML=`<span class="text-xs u-muted">${x['更新']||x.updated||''}</span>
        <strong>${x['得意先']||x.customer||''}</strong>
        <span>${x['品名']||x.itemName||''}</span>
        <span class="text-xs">[${x['プロセス']||x.process||''}]</span>
        <span class="text-xs u-muted">${x['場所']||x.location||''}</span>`;
      wrap.appendChild(div);
    });
  }
  function renderShipToday(ship){
    const wrap=$('#shipToday'); if(!wrap) return;
    const today=new Date().toISOString().slice(0,10);
    const list=ship.filter(s=> String(s['日付']||s.date||'').startsWith(today));
    if(!list.length){ wrap.textContent='本日の出荷予定はありません。'; return; }
    wrap.classList.remove('u-muted'); wrap.innerHTML='';
    list.forEach(s=>{ const li=document.createElement('div'); li.textContent=`${s['得意先']||s.customer||''} ／ ${s['品名']||s.itemName||''} × ${s['数量']||s.qty||0}`; wrap.appendChild(li); });
  }
  function renderStock(plan){
    const tb=$('#stockBody'); if(!tb) return;
    if(!plan.length){ tb.innerHTML=`<tr><td colspan="5" class="u-muted">データがありません。</td></tr>`; return; }
    const map=new Map();
    plan.forEach(r=>{
      const k=`${r['品名']||r.itemName||''}||${r['品番']||r.itemNo||''}`;
      const done=Number(r['完成数量']||r.qtyDone||0), ship=Number(r['出荷数量']||r.qtyShip||0);
      const prev=map.get(k)||{done:0,ship:0}; map.set(k,{done:prev.done+done, ship:prev.ship+ship});
    });
    tb.innerHTML=''; [...map.entries()].forEach(([k,v])=>{
      const [nm,no]=k.split('||'); const tr=document.createElement('tr');
      tr.innerHTML=`<td>${nm}</td><td>${no}</td><td>${v.done}</td><td>${v.ship}</td><td>${v.done-v.ship}</td>`;
      tb.appendChild(tr);
    });
  }
  async function initDashboard(){
    const {plan,ship}=await loadAll(); renderNow(plan||[]); renderShipToday(ship||[]); renderStock(plan||[]); renderProcessChart(plan||[]);
    // Optional admin-only sync section
    const det=$('#syncPanel'); if(det) det.style.display = (authStore.role()==='管理者') ? '' : 'none';
  }

  /* ====== LIST PAGES (skeleton) ====== */
  async function initPlan(){
    const {plan}=await loadAll();
    const tb=$('#planBody'); if(!tb) return;
    tb.innerHTML='';
    (plan||[]).slice(-100).reverse().forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${r.customer||r['得意先']||''}</td>
      <td>${r.prodNo||r['製造番号']||''}</td>
      <td>${r.itemName||r['品名']||''}</td>
      <td>${r.itemNo||r['品番']||''}</td>
      <td>${r.start||r['開始']||''}</td>
      <td>${r.process||r['プロセス']||''}</td>
      <td>${r.location||r['場所']||''}</td>
      <td>${r.status||r['ステータス']||''}</td>
      <td class="text-xs u-muted">${r.updated||r['更新']||''}</td>
      <td><button class="btn btn--ghost text-xs">編集</button></td>`;
      tb.appendChild(tr);
    });
    on($('#btnNewPlan'),'click',()=>toast('新規作成ダイアログは次ステップで実装'));
  }
  async function initShip(){
    const {ship}=await loadAll();
    const tb=$('#shipBody'); if(!tb) return;
    tb.innerHTML='';
    (ship||[]).slice(-100).reverse().forEach(s=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.date||s['日付']||''}</td><td>${s.customer||s['得意先']||''}</td><td>${s.itemName||s['品名']||''}</td><td>${s.itemNo||s['品番']||''}</td><td>${s.qty||s['数量']||0}</td><td>${s.status||s['ステータス']||''}</td><td>${s.note||s['備考']||''}</td><td class="text-xs u-muted">${s.updated||s['更新']||''}</td>`;
      tb.appendChild(tr);
    });
  }
  function initConfirm(){ /* layout/print akan kita sesuaikan berkas Anda selanjutnya */ }
  function initTicket(){ /* generator QR & layout akan kita samakan dgn format yg Anda kirim */ }
  function initMaster(){ /* CRUD & paging akan kita isi setelah endpoint MASTER Anda siap dipakai */ }
  function initScan(){ /* kamera/mobile compat akan dilanjutkan step berikut */ }
  function initCharts(){ /* pie/pareto bulanan-tahunan next step */ }

  /* ====== PUBLIC ====== */
  function initPage(page){
    guard(page);
    if(page!=='login') initShell();

    switch(page){
      case 'login':     return initLogin();
      case 'dashboard': return initDashboard();
      case 'plan':      return initPlan();
      case 'ship':      return initShip();
      case 'confirm':   return initConfirm();
      case 'ticket':    return initTicket();
      case 'master':    return initMaster();
      case 'scan':      return initScan();
      case 'charts':    return initCharts();
    }
  }

  return { initPage };
})();
