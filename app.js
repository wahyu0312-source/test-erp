const App = (()=>{

  /* ===== Config ===== */
  const API_URL = window.APP_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec';

  /* ===== State ===== */
  const store = {
    get(){ try{ return JSON.parse(localStorage.getItem('erp_auth')||'null'); }catch{ return null; } },
    set(val){ localStorage.setItem('erp_auth', JSON.stringify(val)); },
    clear(){ localStorage.removeItem('erp_auth'); }
  };

  /* ===== Helpers ===== */
  const $  = (sel,root=document)=> root.querySelector(sel);
  const $$ = (sel,root=document)=> [...root.querySelectorAll(sel)];
  const on = (el,ev,fn)=> el && el.addEventListener(ev,fn,{passive:false});

  function toast(msg){
    const x=document.createElement('div');
    x.textContent=msg; x.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;z-index:70;opacity:.98';
    document.body.appendChild(x); setTimeout(()=>x.remove(),2500);
  }

  function fetchJSON(url){
    return fetch(url,{cache:'no-store'}).then(r=>r.json());
  }

  /* ===== Header / Drawer ===== */
  function initHeader(){
    const drawer = $('#drawer');
    const scrim  = $('#scrim');
    const btn    = $('#btnBurger');
    const logout = $('#btnLogout');

    const open = ()=>{ drawer.classList.add('is-open'); scrim.hidden=false; btn.setAttribute('aria-expanded','true'); };
    const close= ()=>{ drawer.classList.remove('is-open'); scrim.hidden=true; btn.setAttribute('aria-expanded','false'); };

    on(btn,'click', ()=> drawer.classList.contains('is-open')? close() : open());
    on(scrim,'click', close);
    on(document,'keydown', (e)=>{ if(e.key==='Escape') close(); });

    // logout visibility
    const auth=store.get();
    if(auth){ logout.hidden=false; } else { logout.hidden=true; }
    on(logout,'click', ()=>{ store.clear(); location.reload(); });
  }

  /* ===== Login Bar ===== */
  function initLoginBar(){
    const bar = $('#loginBar');
    const form= $('#loginForm');
    const u   = $('#lgUser');
    const p   = $('#lgPass');

    const auth = store.get();
    if(auth){ bar.style.display='none'; return; }

    on(form,'submit', async (e)=>{
      e.preventDefault();
      const user=u.value.trim(), pass=p.value.trim();
      if(!user||!pass){ toast('ユーザー/パスワードを入力'); return; }
      $('#btnLogin').disabled=true;
      try{
        const q = new URLSearchParams({ action:'login', username:user, password:pass });
        const r = await fetchJSON(`${API_URL}?${q.toString()}`);
        if(r.ok){
          store.set({user:r.user,role:r.role,token:r.token});
          toast('ログイン成功');
          bar.style.display='none';
          $('#btnLogout').hidden=false;
          // untuk dashboard, langsung muat data
          if(window.__afterLogin) window.__afterLogin();
        }else{
          toast('ログイン失敗');
        }
      }catch(_){ toast('サーバー通信エラー'); }
      finally{ $('#btnLogin').disabled=false; }
    });

    // Enter to submit
    on(p,'keydown', e=>{ if(e.key==='Enter') form.requestSubmit(); });
  }

  /* ===== Role Helpers ===== */
  function isAdmin(){ return (store.get()?.role||'')==='管理者'; }
  function showSyncPanel(){
    const det = $('#syncPanel');
    if(!det) return;
    // Sebaiknya hanya Admin yang melihat panel sync
    det.style.display = isAdmin() ? '' : 'none';
  }

  /* ===== Dashboard data/render ===== */
  async function loadAll(){
    const r = await fetchJSON(API_URL);
    return r.ok ? r : {plan:[],ship:[],master:[]};
  }

  function renderNow(plan){
    const wrap = $('#nowList');
    if(!wrap) return;
    if(!plan.length){ wrap.textContent='データがありません。'; return; }
    wrap.classList.remove('u-muted');
    wrap.innerHTML='';
    // ringkas: tampilkan 3 terbaru
    plan.slice(-3).reverse().forEach(x=>{
      const div=document.createElement('div');
      div.className='row wrap';
      div.innerHTML = `
        <span class="text-xs u-muted">${x['更新']||x.updated||''}</span>
        <strong>${x['得意先']||x.customer||''}</strong>
        <span>${x['品名']||x.itemName||''}</span>
        <span class="text-xs">[${x['プロセス']||x.process||''}]</span>
        <span class="text-xs u-muted">${x['場所']||x.location||''}</span>
      `;
      wrap.appendChild(div);
    });
  }

  function renderShipToday(ship){
    const wrap = $('#shipToday');
    if(!wrap) return;
    const today = new Date().toISOString().slice(0,10);
    const list = ship.filter(s => String(s['日付']||s.date||'').startsWith(today));
    if(!list.length){ wrap.textContent='本日の出荷予定はありません。'; return; }
    wrap.classList.remove('u-muted');
    wrap.innerHTML='';
    list.forEach(s=>{
      const li=document.createElement('div');
      li.textContent = `${s['得意先']||s.customer||''} ／ ${s['品名']||s.itemName||''} × ${s['数量']||s.qty||0}`;
      wrap.appendChild(li);
    });
  }

  function renderStock(plan){
    const tb = $('#stockBody');
    if(!tb) return;
    if(!plan.length){ tb.innerHTML = `<tr><td colspan="5" class="u-muted">データがありません。</td></tr>`; return; }

    // aggregate by (itemName,itemNo)
    const map=new Map();
    plan.forEach(r=>{
      const key = `${r['品名']||r.itemName||''}||${r['品番']||r.itemNo||''}`;
      const done = Number(r['完成数量']||r.qtyDone||0);
      const ship = Number(r['出荷数量']||r.qtyShip||0);
      const prev = map.get(key)||{done:0,ship:0};
      map.set(key,{done:prev.done+done, ship:prev.ship+ship});
    });
    tb.innerHTML='';
    [...map.entries()].forEach(([k,v])=>{
      const [name,no]=k.split('||');
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${name}</td><td>${no}</td><td>${v.done}</td><td>${v.ship}</td><td>${v.done - v.ship}</td>`;
      tb.appendChild(tr);
    });
  }

  function renderProcessChart(plan){
    const el = $('#byProcessChart');
    if(!el) return;

    const labels = ['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程'];
    const count = new Array(labels.length).fill(0);

    plan.forEach(r=>{
      const p = r['プロセス']||r.process||'';
      const idx = labels.findIndex(s=> s===p);
      if(idx>=0) count[idx]++;
    });

    // destroy old
    if(el._chart){ el._chart.destroy(); }

    el._chart = new Chart(el.getContext('2d'),{
      type:'bar',
      data:{ labels, datasets:[{ label:'在庫', data:count, borderWidth:1 }] },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        scales:{ y:{ beginAtZero:true } },
        plugins:{ legend:{ display:false } }
      }
    });
  }

  /* ===== Page bootstrap ===== */
  async function initDashboard(){
    showSyncPanel();
    const doLoad = async ()=>{
      const {plan,ship} = await loadAll();
      renderNow(plan||[]);
      renderShipToday(ship||[]);
      renderStock(plan||[]);
      renderProcessChart(plan||[]);
    };
    // first load
    await doLoad();
    // afterLogin hook
    window.__afterLogin = doLoad;

    // dummy handlers sync
    on($('#btnPull'),'click', async ()=>{ await doLoad(); toast('取得しました'); });
    on($('#btnPush'),'click', ()=> toast('送信APIは別途実装/管理者専用です'));
    on($('#autoSync'),'change', e=>{
      if(e.target.checked){
        e.target._timer = setInterval(()=> $('#btnPull')?.click(), 30000);
      }else{
        clearInterval(e.target._timer);
      }
    });
  }

  /* ===== Public ===== */
  function initPage(page){
    initHeader();
    initLoginBar();
    if(page==='dashboard') initDashboard();
  }

  return { initPage };
})();
