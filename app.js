/* ===========================================================
   ERP Mini-ERP (TSH) • app.js
   - Dashboard like Figma/Tailwind
   - Login (GET) + Enter key + spinner
   - Datalist dropdown for 得意先/図番(品番)/品名
   - 出荷確認書 confirm.html
   - QR Scan, Ticket, Plan/Ship, 2-way Sheets
=========================================================== */
const App = (function () {
  const PROCESS_LIST = [
    "レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程",
    "シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"
  ];

  // GANTI dengan URL Web App /exec kamu
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec";
  const ENDPOINT = {
    PLAN_POST: GAS_URL, PLAN_GET: GAS_URL,
    SHIP_POST: GAS_URL, SHIP_GET: GAS_URL,
    AUTH: GAS_URL
  };

  const state = {
    user:  localStorage.getItem('tsh_user')  || "",
    role:  localStorage.getItem('tsh_role')  || "",
    token: localStorage.getItem('tsh_token') || "",
    plan:  JSON.parse(localStorage.getItem('tsh_plan') || "[]"),
    ship:  JSON.parse(localStorage.getItem('tsh_ship') || "[]"),
    masters: { customers:[], itemNos:[], itemNames:[] },
    _interval:null
  };

  const $ = (q)=>document.querySelector(q);
  const today = ()=> new Date().toISOString().slice(0,10);
  const stamp = ()=> new Date().toLocaleString()+" | "+(state.user||"-");
  function save(){ localStorage.setItem('tsh_plan',JSON.stringify(state.plan)); localStorage.setItem('tsh_ship',JSON.stringify(state.ship)); }
  function logSync(m){ const el=$("#syncLog"); if(el) el.textContent=m; }

  /* ---------- Masters ---------- */
  function buildMasters(){
    const c=new Set(), n=new Set(), nm=new Set();
    state.plan.forEach(p=>{ if(p.customer) c.add(p.customer); if(p.itemNo) n.add(p.itemNo); if(p.itemName) nm.add(p.itemName); });
    state.ship.forEach(s=>{ if(s.customer) c.add(s.customer); if(s.itemNo) n.add(s.itemNo); if(s.itemName) nm.add(s.itemName); });
    state.masters.customers=[...c].sort(); state.masters.itemNos=[...n].sort(); state.masters.itemNames=[...nm].sort();
  }
  function fillDatalist(id, arr){ const dl=$(id); if(!dl) return; dl.innerHTML = arr.map(v=>`<option value="${v}">`).join(''); }

  /* ---------- Login (GET + Enter + Spinner) ---------- */
  function ensureLogin(){
    const bar=$("#loginBar"); if(!bar) return;
    if(!state.user || !state.token){
      bar.style.display="flex";
      bar.innerHTML =
        `<div class="login-card">
          <div class="login-title">TSH ミニERP ログイン</div>
          <div class="login-note">ユーザー名とパスワードを入力してください。</div>
          <div class="login-row">
            <input id="loginName" class="inp" placeholder="ユーザー名"/>
            <input id="loginPass" type="password" class="inp" placeholder="パスワード"/>
            <button id="enter" class="btn btn-primary">入室</button>
          </div>
        </div>`;
      const name=$("#loginName"), pass=$("#loginPass"), btn=$("#enter");
      const doLogin=()=>{
        const n=(name.value||"").trim(), p=pass.value||"";
        if(!n||!p){ alert("ユーザー名とパスワードを入力してください。"); return; }
        btn.disabled=true; const prev=btn.textContent; btn.textContent="ログイン中…";
        const url = ENDPOINT.AUTH+`?action=login&username=${encodeURIComponent(n)}&password=${encodeURIComponent(p)}&t=${Date.now()}`;
        fetch(url,{method:"GET",cache:"no-store"})
          .then(r=>r.text()).then(t=>{ try{return JSON.parse(t);}catch(e){throw 0;} })
          .then(resp=>{
            if(!resp.ok){ alert("ログイン失敗: "+(resp.error||"")); btn.disabled=false; btn.textContent=prev; return; }
            state.user=resp.user; state.role=resp.role; state.token=resp.token;
            localStorage.setItem('tsh_user',resp.user); localStorage.setItem('tsh_role',resp.role); localStorage.setItem('tsh_token',resp.token);
            bar.style.display="none"; location.reload();
          })
          .catch(()=>{ alert("サーバー通信エラー"); btn.disabled=false; btn.textContent=prev; });
      };
      btn.onclick=doLogin;
      [name,pass].forEach(el=> el.addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); }));
    }else{
      bar.style.display="none";
    }
  }
  function bindLogout(){ const b=$("#btnLogout"); if(b) b.onclick=()=>{ localStorage.removeItem('tsh_user'); localStorage.removeItem('tsh_role'); localStorage.removeItem('tsh_token'); alert('ログアウトしました'); location.reload(); }; }

  function fillProcessSelect(sel){ if(!sel) return; sel.innerHTML = '<option value="">工程（全て）</option>' + PROCESS_LIST.map(p=>`<option>${p}</option>`).join(''); }

  /* =======================================================
     Dashboard
  ======================================================= */
  function pageDashboard(){
    ensureLogin(); bindLogout(); buildMasters();

    // now list
    const nowList=$("#nowList");
    if(nowList){
      const items=state.plan.slice(0,10).map(p=>`
        <div class="list-item">
          <div>
            <div class="font-medium">${p.itemName||'-'} <span class="meta">(${p.itemNo||''})</span></div>
            <div class="meta">得意先:${p.customer||'-'} ・ 製造番号:${p.prodNo||'-'} ・ 開始:${p.start||'-'}</div>
          </div>
          <div class="text-right">
            <div class="status-chip">${p.process||'-'} / ${p.status||'-'}</div>
            <div class="meta">${p.updated||''}</div>
          </div>
        </div>`).join('');
      nowList.innerHTML = items || '<div class="meta">データがありません。</div>';
    }

    // chart
    const ctx=$("#byProcessChart");
    if(ctx && window.Chart){
      const data=PROCESS_LIST.map(proc=>state.plan.filter(p=>p.process===proc).length);
      new Chart(ctx.getContext('2d'),{type:'bar',data:{labels:PROCESS_LIST,datasets:[{label:'件数',data}]},options:{plugins:{legend:{display:false}}}});
    }

    // ship today
    const t=today(), shipEl=$("#shipToday");
    if(shipEl){
      const list=state.ship.filter(s=>s.date===t).map(s=>`
        <div class="list-item">
          <div><div class="font-medium">${s.itemName||''}</div><div class="meta">${s.customer||''} ・ 数量:${s.qty||0}</div></div>
          <div><span class="status-chip">${s.status||''}</span><div class="meta text-right">${s.updated||''}</div></div>
        </div>`).join('');
      shipEl.innerHTML=list||'<div class="meta">本日の出荷予定はありません。</div>';
    }

    // stock
    const body=$("#stockBody");
    if(body){
      const map={};
      state.plan.forEach(p=>{
        const k=p.itemNo||p.itemName;
        if(!map[k]) map[k]={itemName:p.itemName,itemNo:p.itemNo,qtyDone:0,qtyShip:0};
        map[k].qtyDone += Number(p.qtyDone||0);
        map[k].qtyShip  = state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((a,b)=>a+Number(b.qty||0),0);
      });
      body.innerHTML = Object.values(map).map(r=>
        `<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td>
             <td class="text-right">${r.qtyDone||0}</td>
             <td class="text-right">${r.qtyShip||0}</td>
             <td class="text-right font-semibold">${(r.qtyDone||0)-(r.qtyShip||0)}</td></tr>`).join('');
    }

    $("#btnPull")?.addEventListener('click',pullSheet);
    $("#btnPush")?.addEventListener('click',pushSheet);
    $("#autoSync")?.addEventListener('change',e=>{
      if(e.target.checked){ state._interval=setInterval(pullSheet,30000);} else { clearInterval(state._interval); }
    });
  }

  /* =======================================================
     生産計画（datalist）
  ======================================================= */
  function pagePlan(){
    ensureLogin(); bindLogout(); buildMasters();
    fillProcessSelect($("#fltProcess"));
    fillDatalist("#dlCustomers", state.masters.customers);
    fillDatalist("#dlItemNos", state.masters.itemNos);
    fillDatalist("#dlItemNames", state.masters.itemNames);

    const st=$("#fltStatus"); if(st) st.value='';
    const btnClr=$("#btnClearFilter"); if(btnClr){ btnClr.type='button'; btnClr.onclick=()=>{ $("#q").value=''; $("#fltProcess").value=''; $("#fltStatus").value=''; renderPlanTable(); }; }
    $("#btnAddPlan")?.addEventListener('click',()=> openPlanModal());
    ['#q','#fltProcess','#fltStatus'].forEach(id=> $(id)?.addEventListener('input', renderPlanTable));
    $("#btnPull")?.addEventListener('click',pullSheet);
    $("#btnPush")?.addEventListener('click',pushSheet);
    renderPlanTable();
  }
  function filtered(){
    const q=($("#q")?.value||'').toLowerCase(), pr=$("#fltProcess")?.value||'', st=$("#fltStatus")?.value||'';
    return state.plan.filter(p=>{
      const hit=(p.itemName||'').toLowerCase().includes(q)||(p.itemNo||'').toLowerCase().includes(q)||(p.customer||'').toLowerCase().includes(q)||(p.prodNo||'').toLowerCase().includes(q);
      return (!q||hit)&&(!pr||p.process===pr)&&(!st||p.status===st);
    });
  }
  function renderPlanTable(){
    const body=$("#planBody"); if(!body) return;
    body.innerHTML = filtered().map(p=>{
      const idx=state.plan.indexOf(p);
      return `<tr>
        <td>${p.customer||''}</td><td>${p.prodNo||''}</td><td>${p.itemName||''}</td><td>${p.itemNo||''}</td>
        <td>${p.start||''}</td><td>${p.process||''}</td><td>${p.location||''}</td><td>${p.status||''}</td>
        <td class="text-xs">${p.updated||''}</td>
        <td>
          <button class="btn btn-ghost" onclick="App.editPlan(${idx})">編集</button>
          <button class="btn btn-ghost" onclick="App.deletePlan(${idx})">削除</button>
          <a class="btn btn-outline" href="ticket.html?prodNo=${encodeURIComponent(p.prodNo||'')}&itemNo=${encodeURIComponent(p.itemNo||'')}">票</a>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="10" class="text-slate-500">データがありません。</td></tr>`;
  }
  function openPlanModal(idx=null){
    const m=$("#planModal"); if(!m) return; m.classList.remove('hidden');
    const isEdit=idx!=null; $("#planModalTitle").textContent=isEdit?'生産計画：編集':'生産計画：追加';
    const p=isEdit? state.plan[idx] : {customer:'',prodNo:'',itemName:'',itemNo:'',start:today(),process:PROCESS_LIST[0],location:'PPIC',status:'計画'};
    $("#fCustomer").value=p.customer||''; $("#fProdNo").value=p.prodNo||'';
    $("#fItemName").value=p.itemName||''; $("#fItemNo").value=p.itemNo||'';
    $("#fStart").value=p.start||today(); const sel=$("#fProcess"); sel.innerHTML=PROCESS_LIST.map(x=>`<option>${x}</option>`).join(''); sel.value=p.process||PROCESS_LIST[0];
    $("#fLocation").value=p.location||'PPIC'; $("#fStatus").value=p.status||'計画';
    // datalist refresh (in case new builds)
    fillDatalist("#dlCustomers", state.masters.customers);
    fillDatalist("#dlItemNos", state.masters.itemNos);
    fillDatalist("#dlItemNames", state.masters.itemNames);

    $("#btnPlanSave").onclick=()=>{
      const rec={ customer:$("#fCustomer").value.trim(), prodNo:$("#fProdNo").value.trim(),
        itemName:$("#fItemName").value.trim(), itemNo:$("#fItemNo").value.trim(),
        start:$("#fStart").value, process:$("#fProcess").value, location:$("#fLocation").value.trim(),
        status:$("#fStatus").value, updated:stamp(), qtyDone:p.qtyDone||0, qtyShip:p.qtyShip||0 };
      if(isEdit){ state.plan[idx]=Object.assign({},state.plan[idx],rec);} else { state.plan.unshift(rec); }
      save(); buildMasters(); m.classList.add('hidden'); renderPlanTable(); pushPlan(rec);
    };
    $("#planModalClose").onclick=()=> m.classList.add('hidden');
  }
  function editPlan(idx){ openPlanModal(idx); }
  function deletePlan(idx){
    const p=state.plan[idx]; if(!p) return;
    if(!confirm(`この計画を削除しますか？\n製造番号: ${p.prodNo}\n品番: ${p.itemNo}`)) return;
    const rec={...p,status:'取消',updated:stamp()};
    state.plan.splice(idx,1); save(); buildMasters(); renderPlanTable(); pushPlan(rec);
  }

  /* =======================================================
     出荷計画
  ======================================================= */
  function pageShip(){
    ensureLogin(); bindLogout(); buildMasters();
    $("#btnAddShip")?.addEventListener('click',()=> openShipModal());
    $("#btnMarkShipped")?.addEventListener('click',()=>{
      state.ship.forEach(s=>{ if(s.status==='出荷準備') { s.status='出荷済'; s.updated=stamp(); }});
      save(); renderShipTable(); syncQtyShip();
    });
    $("#btnPull")?.addEventListener('click',pullSheet);
    $("#btnPush")?.addEventListener('click',pushSheet);
    renderShipTable();
  }
  function renderShipTable(){
    const body=$("#shipBody"); if(!body) return;
    body.innerHTML = state.ship.map((s,idx)=>`
      <tr><td>${s.date||''}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td>
      <td class="text-right">${s.qty||0}</td><td>${s.status||''}</td><td>${s.note||''}</td><td class="text-xs">${s.updated||''}</td>
      <td><button class="btn btn-ghost" onclick="App.editShip(${idx})">編集</button></td></tr>`
    ).join('') || `<tr><td colspan="9" class="text-slate-500">データがありません。</td></tr>`;
  }
  function openShipModal(idx=null){
    const m=$("#shipModal"); if(!m) return; m.classList.remove('hidden');
    const isEdit=idx!=null;
    const s=isEdit? state.ship[idx] : {date:today(),customer:'',itemName:'',itemNo:'',qty:0,status:'出荷準備',note:''};
    $("#shipModalTitle").textContent=isEdit?'出荷計画：編集':'出荷計画：追加';
    $("#sDate").value=s.date||today(); $("#sCustomer").value=s.customer||'';
    $("#sItemName").value=s.itemName||''; $("#sItemNo").value=s.itemNo||'';
    $("#sQty").value=s.qty||0; $("#sStatus").value=s.status||'出荷準備'; $("#sNote").value=s.note||'';
    $("#btnShipSave").onclick=()=>{
      const rec={ date:$("#sDate").value, customer:$("#sCustomer").value.trim(), itemName:$("#sItemName").value.trim(), itemNo:$("#sItemNo").value.trim(),
        qty:Number($("#sQty").value||0), status:$("#sStatus").value, note:$("#sNote").value.trim(), updated:stamp() };
      if(isEdit){ state.ship[idx]=Object.assign({},state.ship[idx],rec);} else { state.ship.unshift(rec); }
      save(); m.classList.add('hidden'); renderShipTable(); syncQtyShip(); pushShip(rec);
    };
    $("#shipModalClose").onclick=()=> m.classList.add('hidden');
  }
  function editShip(idx){ openShipModal(idx); }
  function syncQtyShip(){
    state.plan.forEach(p=>{
      const shipped=state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((a,b)=>a+Number(b.qty||0),0);
      p.qtyShip=shipped;
    }); save();
  }

  /* =======================================================
     出荷確認書
  ======================================================= */
  function pageConfirm(){
    ensureLogin(); bindLogout();
    $("#btnPrint")?.addEventListener('click',()=>window.print());
    $("#btnMakeConfirm")?.addEventListener('click',()=>{
      const d=$("#cDate").value || today(); const cust=$("#cCustomer").value.trim();
      const list = state.ship.filter(x=> (x.date===d) && (!cust || x.customer===cust));
      $("#cInfo").textContent = `日付：${d}　件数：${list.length}`;
      $("#cUser").textContent = state.user || '';
      const body=$("#cBody");
      if(!list.length){ body.innerHTML=`<tr><td colspan="6" class="text-center text-slate-500">該当データなし。</td></tr>`; return; }
      body.innerHTML = list.map((s,i)=> `<tr>
        <td class="text-right">${i+1}</td><td>${s.customer||''}</td>
        <td>${s.itemName||''}</td><td>${s.itemNo||''}</td>
        <td class="text-right">${s.qty||0}</td><td>${s.note||''}</td>
      </tr>`).join('');
    });
  }

  /* =======================================================
     生産現品票
  ======================================================= */
  function pageTicket(){
    ensureLogin(); bindLogout();
    const qs=new URLSearchParams(location.search);
    const prodNo=qs.get('prodNo')||'', itemNo=qs.get('itemNo')||'';
    if(prodNo) $("#ticketProdNo").value=prodNo;
    if(itemNo) $("#ticketItemNo").value=itemNo;
    $("#btnLoadTicket")?.addEventListener('click',loadTicket);
    $("#btnPrint")?.addEventListener('click',()=>window.print());
    if(prodNo||itemNo) loadTicket();
  }
  function loadTicket(){
    const prod=$("#ticketProdNo")?.value.trim()||'', ino=$("#ticketItemNo")?.value.trim()||'';
    const p=state.plan.find(x=>(!prod||x.prodNo===prod)&&(!ino||x.itemNo===ino));
    if(!p){ alert('計画が見つかりません'); return; }
    $("#tCustomer").textContent=p.customer||''; $("#tProdNo").textContent=p.prodNo||'';
    $("#tStart").textContent=p.start||''; $("#tItemNo").textContent=p.itemNo||'';
    $("#tItemName").textContent=p.itemName||''; $("#tUser").textContent=state.user||'';
    const imp=['表面のキズ/変色/サビ','曲げ角度・割れ','外枠組付け','シャッター組立','溶接状態','コーキング','塗装','組立仕上げ','最終検査'];
    $("#tProcessRows").innerHTML = PROCESS_LIST.map((name,i)=>`<tr><td>${name}</td><td>${imp[i]||''}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('');
    const q=$("#tQR"); if(q){ q.innerHTML=''; new QRCode(q,{text:`${p.prodNo}|${p.itemNo}`,width:80,height:80}); }
  }

  /* =======================================================
     QRスキャン
  ======================================================= */
  function pageScan(){
    ensureLogin(); bindLogout();
    const sel=$("#scanProcess"); if(sel) sel.innerHTML=PROCESS_LIST.map(p=>`<option>${p}</option>`).join('');
    let last={prodNo:"",itemNo:""};
    if(window.Html5Qrcode){
      const h = new Html5Qrcode("reader");
      Html5Qrcode.getCameras().then(devs=>{
        const cam=devs?.[0]?.id; if(!cam){ alert('カメラが見つかりません'); return; }
        h.start(cam,{fps:10,qrbox:280}, onScan, ()=>{});
      });
    }
    function onScan(txt){ const [a,b]=(txt||'').split('|'); if(!a||!b) return; last={prodNo:a,itemNo:b}; $("#scanInfo").textContent=`読み取り: ${a} | ${b}`; }
    $("#btnApplyScan")?.addEventListener('click',()=>{
      if(!last.prodNo) return alert('QRを読み取ってください');
      const p=state.plan.find(x=>x.prodNo===last.prodNo && x.itemNo===last.itemNo); if(!p) return alert('計画なし');
      p.process=$("#scanProcess").value; p.status=$("#scanStatus").value; p.updated=stamp();
      save(); pushPlan(p); alert('更新しました');
    });
  }

  /* =======================================================
     Sheets 2-way
  ======================================================= */
  function pushPlan(p){
    if(!ENDPOINT.PLAN_POST) return;
    fetch(ENDPOINT.PLAN_POST,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(state.token||'')},body:JSON.stringify({...p,user:state.user})})
      .then(()=>logSync('PLAN送信完了')).catch(()=>logSync('PLAN送信失敗'));
  }
  function pushShip(s){
    if(!ENDPOINT.SHIP_POST) return;
    fetch(ENDPOINT.SHIP_POST,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(state.token||'')},body:JSON.stringify({...s,user:state.user})})
      .then(()=>logSync('SHIP送信完了')).catch(()=>logSync('SHIP送信失敗'));
  }
  function pullSheet(){
    Promise.all([fetch(ENDPOINT.PLAN_GET), fetch(ENDPOINT.SHIP_GET||ENDPOINT.PLAN_GET)])
      .then(r=>Promise.all(r.map(x=>x.json().catch(()=>({})))))
      .then(arr=>{
        const a=arr[0]||{}, b=arr[1]||{};
        if(a.plan) state.plan=a.plan; if(a.ship) state.ship=a.ship;
        if(ENDPOINT.SHIP_GET!==ENDPOINT.PLAN_GET){ if(b.plan) state.plan=b.plan; if(b.ship) state.ship=b.ship; }
        save(); buildMasters(); logSync('取得完了'); location.reload();
      }).catch(()=>logSync('同期失敗'));
  }
  function pushSheet(){
    let chain=Promise.resolve();
    state.plan.forEach(p=>{ chain=chain.then(()=>new Promise(res=>{ pushPlan(p); setTimeout(res,80);})); });
    state.ship.forEach(s=>{ chain=chain.then(()=>new Promise(res=>{ pushShip(s); setTimeout(res,80);})); });
    chain.then(()=>logSync('全件送信完了'));
  }

  /* bootstrap */
  function initPage(page){
    if(page==='dashboard') pageDashboard();
    if(page==='plan')      pagePlan();
    if(page==='ship')      pageShip();
    if(page==='confirm')   pageConfirm();
    if(page==='ticket')    pageTicket();
    if(page==='scan')      pageScan();
  }

  return { initPage, editPlan: openPlanModal, editShip: openShipModal, deletePlan };
})();
