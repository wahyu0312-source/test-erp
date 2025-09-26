/* ===========================================================
   ERP Mini-ERP (TSH) • app.js
=========================================================== */
const App = (function(){
  // ==== KONFIG ====
  const PROCESS_LIST = ["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];

  // GANTI URL BERIKUT
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec";
  const ENDPOINT={
    ROOT:GAS_URL,
    AUTH:GAS_URL,
    MASTER:GAS_URL+"?action=master",
    PICS:GAS_URL+"?action=pics",
    PING:GAS_URL+"?action=ping"
  };

  // Role / izin
  const PERMS={
    "管理者":{all:true},
    "生産管理部":{view_all:true,edit_plan:true,delete_plan:true,edit_ship:true,mark_shipped:true,push:true,pull:true,confirm_export:true},
    "製造部":{view_all:true,scan_update:true},
    "検査部":{view_all:true,scan_update:true}
  };

  // util
  const can=(a)=>state.dept && (PERMS[state.dept]?.all || PERMS[state.dept]?.[a]);
  const $=(q)=>document.querySelector(q);
  const today=()=>new Date().toISOString().slice(0,10);
  const stamp=()=>new Date().toLocaleString()+" | "+(state.user||"-")+(state.pic?(" / "+state.pic):"");

  // state
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
  function save(){
    localStorage.setItem('tsh_plan',JSON.stringify(state.plan));
    localStorage.setItem('tsh_ship',JSON.stringify(state.ship));
    localStorage.setItem('tsh_master',JSON.stringify(state.master));
    localStorage.setItem('tsh_pics',JSON.stringify(state.pics));
  }
  function clearLocal(){
    ['tsh_user','tsh_dept','tsh_token','tsh_pic','tsh_plan','tsh_ship','tsh_master','tsh_pics'].forEach(k=>localStorage.removeItem(k));
    location.reload();
  }
  function logSync(m){ $("#syncLog") && ($("#syncLog").textContent = m); }

  // ===== Login =====
  function ensureLogin(){
    const bar=$("#loginBar"); if(!bar) return;
    if(!state.user || !state.token){
      bar.style.display="flex";
      bar.innerHTML=`<form class="login-card" autocomplete="off">
        <div class="login-title">ERPシステム 東京精密発條株式会社</div>
        <div class="login-row">
          <input id="loginName" class="inp" placeholder="ユーザー名" name="username" autocomplete="username"/>
          <input id="loginPass" type="password" class="inp" placeholder="パスワード" name="current-password" autocomplete="current-password"/>
          <button id="enter" type="button" class="btn btn-primary">入室</button>
        </div>
        <div class="text-muted" style="margin-top:6px">部署：管理者 / 生産管理部 / 製造部 / 検査部</div>
        <div id="loginErr" class="text-xs" style="color:#ef4444;margin-top:6px"></div>
      </form>`;
      const name=$("#loginName"), pass=$("#loginPass"), btn=$("#enter"), out=$("#loginErr");
      const doLogin=()=>{
        out.textContent="";
        const n=(name.value||"").trim(), p=pass.value||"";
        if(!n||!p){ out.textContent="ユーザー名とパスワードを入力してください。"; return; }
        btn.disabled=true; const prev=btn.textContent; btn.textContent="ログイン中…";
        fetch(ENDPOINT.PING).then(r=>r.json()).then(_=>{
          return fetch(ENDPOINT.AUTH+`?action=login&username=${encodeURIComponent(n)}&password=${encodeURIComponent(p)}&t=${Date.now()}`);
        }).then(r=>r.json()).then(resp=>{
          if(!resp.ok){ out.textContent="ログイン失敗: "+(resp.error||""); btn.disabled=false; btn.textContent=prev; return; }
          state.user=resp.user; state.dept=resp.dept; state.token=resp.token;
          localStorage.setItem('tsh_user',resp.user);
          localStorage.setItem('tsh_dept',resp.dept);
          localStorage.setItem('tsh_token',resp.token);
          state.master=resp.master||[]; state.pics=resp.pics||[]; save();
          location.reload();
        }).catch(err=>{
          out.textContent="サーバー通信エラー: "+err;
          btn.disabled=false; btn.textContent=prev;
        });
      };
      btn.onclick=doLogin;
      [name,pass].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()}));
    } else { bar.style.display="none"; }
  }
  function bindLogout(){ $("#btnLogout")?.addEventListener('click',clearLocal); }

  // ====== 共通 ======
  function fillProcessSelect(sel){ sel.innerHTML=`<option value="">工程（全て）</option>`+PROCESS_LIST.map(p=>`<option>${p}</option>`).join(''); }
  function fillMasterSelects(){
    const cus=document.querySelectorAll('#fCustomer,#sCustomer');
    cus.forEach(c=>{
      const list=[...new Set(state.master.map(m=>m.customer))].filter(x=>x).sort();
      c.innerHTML = `<option value="">得意先を選択</option>` + list.map(x=>`<option>${x}</option>`).join('');
    });
    const itemNoSel=document.querySelectorAll('#fItemNo,#sItemNo');
    itemNoSel.forEach(s=> s.innerHTML = `<option value="">図番/品番を選択</option>` );
  }
  function mapMasterAutoFill(){
    const fC=$("#fCustomer"), fN=$("#fItemNo"), fName=$("#fItemName");
    const sC=$("#sCustomer"), sN=$("#sItemNo"), sName=$("#sItemName");
    function bind(cSel, nSel, nameInp){
      if(!cSel||!nSel||!nameInp) return;
      cSel.onchange=()=>{
        const items=[...new Set(state.master.filter(m=>m.customer===cSel.value).map(m=>m.itemNo))];
        nSel.innerHTML = `<option value="">図番/品番を選択</option>` + items.map(x=>`<option>${x}</option>`).join('');
        nameInp.value='';
      };
      nSel.onchange=()=>{
        const hit=state.master.find(m=>m.customer===cSel.value && m.itemNo===nSel.value);
        if(hit) nameInp.value=hit.itemName||'';
      };
    }
    bind(fC,fN,fName); bind(sC,sN,sName);
  }

  // ====== Dashboard ======
  function pageDashboard(){ ensureLogin(); bindLogout();
    // daftar proses saat ini
    const nowList=$("#nowList");
    const items=state.plan.slice(0,8).map(p=>`
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

    // chart
    const counts=PROCESS_LIST.map(proc=>state.plan.filter(p=>p.process===proc).length);
    const ctx=document.getElementById('byProcessChart').getContext('2d');
    new Chart(ctx,{type:'bar',data:{labels:PROCESS_LIST,datasets:[{label:'件数',data:counts}]} ,options:{plugins:{legend:{display:false}}}});

    // ship today
    const t=today();
    const list=state.ship.filter(s=>s.date===t).map(s=>`
      <div class='card' style="padding:8px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-weight:600">${s.itemName}</div><div class='text-muted' style="font-size:12px">${s.customer} ・ 数量:${s.qty}</div></div>
        <div><span class='badge'>${s.status}</span><div class='text-muted' style="font-size:12px;text-align:right">${s.updated||''}</div></div>
      </div>`).join('');
    $("#shipToday").innerHTML=list||'<div class="text-muted">本日の出荷予定はありません。</div>';

    // stock
    const stock=Object.values(state.plan.reduce((a,p)=>{
      const k=p.itemNo||p.itemName; a[k] ||= {itemName:p.itemName,itemNo:p.itemNo,qtyDone:0,qtyShip:0};
      a[k].qtyDone += Number(p.qtyDone||0);
      a[k].qtyShip = state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((x,y)=>x+Number(y.qty||0),0);
      return a;
    },{}));
    $("#stockBody").innerHTML = stock.map(r=>`<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td><td style="text-align:right">${r.qtyDone||0}</td><td style="text-align:right">${r.qtyShip||0}</td><td style="text-align:right;font-weight:600">${(r.qtyDone||0)-(r.qtyShip||0)}</td></tr>`).join('');

    // sync controls
    $("#btnPull")?.addEventListener('click',pullSheet);
    $("#btnPush")?.addEventListener('click',pushSheet);
    $("#btnClearLocal")?.addEventListener('click',clearLocal);
    const auto=$("#autoSync"); if(auto){ auto.onchange=()=>{ if(auto.checked){ state._interval=setInterval(pullSheet,30000);} else { clearInterval(state._interval); } } }
  }

  // ====== 生産計画 ======
  let editIndex = null;
  function pagePlan(){ ensureLogin(); bindLogout();
    fillProcessSelect($("#fltProcess")); fillMasterSelects(); mapMasterAutoFill();
    $("#fltStatus").value='';
    $("#btnClearFilter").onclick=()=>{ $("#q").value=''; $("#fltProcess").value=''; $("#fltStatus").value=''; renderPlanTable(); };
    $("#btnAddPlan").onclick=()=> openPlanModal();
    ;['q','fltProcess','fltStatus'].forEach(id=> $("#"+id).addEventListener('input', renderPlanTable));
    $("#btnPull").onclick=pullSheet; $("#btnPush").onclick=pushSheet;
    renderPlanTable();
  }
  function filtered(){
    const q=($("#q")?.value||'').toLowerCase(); const pr=$("#fltProcess")?.value||''; const st=$("#fltStatus")?.value||'';
    return state.plan.filter(p=>{
      const hit=(p.itemName||'').toLowerCase().includes(q)||(p.itemNo||'').toLowerCase().includes(q)||(p.customer||'').toLowerCase().includes(q)||(p.prodNo||'').toLowerCase().includes(q);
      return (!q||hit)&&(!pr||p.process===pr)&&(!st||p.status===st);
    });
  }
  function renderPlanTable(){
    const body=$("#planBody"); if(!body) return;
    body.innerHTML = filtered().map((p)=>`<tr>
      <td>${p.customer||''}</td><td>${p.prodNo||''}</td><td>${p.itemName||''}</td><td>${p.itemNo||''}</td>
      <td>${p.start||''}</td><td>${p.process||''}</td><td>${p.location||''}</td><td>${p.status||''}</td><td style="font-size:12px">${p.updated||''}</td>
      <td>
        ${can('edit_plan')?`<button class='btn btn-outline' data-edit='${state.plan.indexOf(p)}'>編集</button>`:''}
        <a class='btn btn-outline' href='ticket.html?prodNo=${encodeURIComponent(p.prodNo)}&itemNo=${encodeURIComponent(p.itemNo)}'>票</a>
      </td></tr>`).join('') || `<tr><td colspan='10' class='text-muted'>データがありません。</td></tr>`;
    body.querySelectorAll("[data-edit]").forEach(b=> b.onclick=()=> openPlanModal(Number(b.dataset.edit)));
  }
  function openPlanModal(idx=null){
    const m=$("#planModal"); m.classList.remove('hidden'); m.style.display='flex';
    const isEdit=(idx!=null); editIndex = idx;
    $("#planModalTitle").textContent = isEdit?'生産計画：編集':'生産計画：追加';

    fillMasterSelects(); mapMasterAutoFill(); // dropdown master

    const p = isEdit? state.plan[idx] : {customer:'',prodNo:'',itemName:'',itemNo:'',start:today(),process:PROCESS_LIST[0],location:'PPIC',status:'計画'};
    $("#fCustomer").value=p.customer; $("#fProdNo").value=p.prodNo; $("#fItemName").value=p.itemName; $("#fStart").value=p.start; $("#fLocation").value=p.location; $("#fStatus").value=p.status;
    // set proses
    $("#fProcess").innerHTML=PROCESS_LIST.map(x=>`<option>${x}</option>`).join(''); $("#fProcess").value=p.process;
    // siapkan itemNo berdasarkan customer
    const items=[...new Set(state.master.filter(m=>m.customer===p.customer).map(m=>m.itemNo))];
    $("#fItemNo").innerHTML = `<option value="">図番/品番を選択</option>` + items.map(x=>`<option>${x}</option>`).join(''); $("#fItemNo").value=p.itemNo;

    $("#btnPlanSave").onclick=()=>{
      if(!can('edit_plan') && !isEdit){ alert('権限がありません'); return; }
      const rec={
        customer:$("#fCustomer").value.trim(),
        prodNo:$("#fProdNo").value.trim(),
        itemName:$("#fItemName").value.trim(),
        itemNo:$("#fItemNo").value.trim(),
        start:$("#fStart").value,
        process:$("#fProcess").value,
        location:$("#fLocation").value.trim(),
        status:$("#fStatus").value,
        updated:stamp(),
        qtyDone:p.qtyDone||0, qtyShip:p.qtyShip||0
      };
      if(isEdit){ state.plan[idx]={...state.plan[idx],...rec}; }
      else { state.plan.unshift(rec); }
      save(); m.style.display='none'; renderPlanTable(); pushPlan(rec);
    };
    $("#btnPlanDel").onclick=()=>{
      if(!can('delete_plan') || !isEdit) return;
      if(confirm('この計画を削除しますか？')){ state.plan.splice(idx,1); save(); m.style.display='none'; renderPlanTable(); }
    }
    $("#planModalClose").onclick=()=> m.style.display='none';
  }

  // ====== 出荷計画 ======
  function pageShip(){ ensureLogin(); bindLogout(); fillMasterSelects(); mapMasterAutoFill();
    $("#btnAddShip").onclick=()=> openShipModal();
    $("#btnMarkShipped").onclick=()=>{ if(!can('mark_shipped'))return;
      state.ship.forEach(s=>{ if(s.status==='出荷準備') { s.status='出荷済'; s.updated=stamp(); } }); save(); renderShipTable(); syncQtyShip(); };
    $("#btnPull").onclick=pullSheet; $("#btnPush").onclick=pushSheet; renderShipTable();
  }
  function renderShipTable(){
    const body=$("#shipBody");
    body.innerHTML = state.ship.map((s,idx)=>`<tr>
      <td>${s.date||''}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td>
      <td style="text-align:right">${s.qty||0}</td><td>${s.status||''}</td><td>${s.note||''}</td><td style="font-size:12px">${s.updated||''}</td>
      <td>${can('edit_ship')?`<button class='btn btn-outline' data-s='${idx}'>編集</button>`:''}</td></tr>`).join('') || `<tr><td colspan='9' class='text-muted'>データがありません。</td></tr>`;
    body.querySelectorAll("[data-s]").forEach(b=> b.onclick=()=> openShipModal(Number(b.dataset.s)));
  }
  function openShipModal(idx=null){
    const m=$("#shipModal"); m.style.display='flex';
    const isEdit=idx!=null;
    const s=isEdit? state.ship[idx] : {date:today(),customer:'',itemName:'',itemNo:'',qty:0,status:'出荷準備',note:''};
    $("#sDate").value=s.date; $("#sCustomer").value=s.customer; $("#sItemName").value=s.itemName; $("#sQty").value=s.qty; $("#sStatus").value=s.status; $("#sNote").value=s.note;
    const items=[...new Set(state.master.filter(m=>m.customer===s.customer).map(m=>m.itemNo))];
    $("#sItemNo").innerHTML = `<option value="">図番/品番を選択</option>` + items.map(x=>`<option>${x}</option>`).join(''); $("#sItemNo").value=s.itemNo;

    $("#btnShipSave").onclick=()=>{
      const rec={ date:$("#sDate").value, customer:$("#sCustomer").value.trim(), itemName:$("#sItemName").value.trim(),
        itemNo:$("#sItemNo").value.trim(), qty:Number($("#sQty").value||0), status:$("#sStatus").value, note:$("#sNote").value.trim(), updated:stamp() };
      if(isEdit){ state.ship[idx]={...state.ship[idx],...rec}; } else { state.ship.unshift(rec); }
      save(); m.style.display='none'; renderShipTable(); syncQtyShip(); pushShip(rec);
    };
    $("#shipModalClose").onclick=()=> m.style.display='none';
  }
  function syncQtyShip(){
    state.plan.forEach(p=>{
      const shipped=state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((a,b)=>a+Number(b.qty||0),0);
      p.qtyShip=shipped;
    }); save();
  }

  // ====== Ticket ======
  function pageTicket(){ ensureLogin(); bindLogout();
    const qs=new URLSearchParams(location.search);
    const prodNo=qs.get('prodNo')||''; const itemNo=qs.get('itemNo')||'';
    if(prodNo) $("#ticketProdNo").value=prodNo; if(itemNo) $("#ticketItemNo").value=itemNo;
    $("#btnLoadTicket").onclick=loadTicket; $("#btnPrint").onclick=()=>window.print();
    if(prodNo||itemNo) loadTicket();
  }
  function loadTicket(){
    const prod=$("#ticketProdNo").value.trim(); const ino=$("#ticketItemNo").value.trim();
    const p=state.plan.find(x=>(!prod||x.prodNo===prod)&&(!ino||x.itemNo===ino));
    if(!p){ alert('計画が見つかりません'); return; }
    $("#tCustomer").textContent=p.customer; $("#tProdNo").textContent=p.prodNo; $("#tStart").textContent=p.start; $("#tItemNo").textContent=p.itemNo; $("#tItemName").textContent=p.itemName; $("#tUser").textContent=state.user;
    const imp=['表面のキズ/変色/サビ','曲げ角度・割れ','外枠組付け','シャッター組立','溶接状態','コーキング','塗装','組立仕上げ','最終検査'];
    $("#tProcessRows").innerHTML = PROCESS_LIST.map((name,i)=>`<tr><td>${name}</td><td>${imp[i]||''}</td><td></td><td></td></tr>`).join('');
    const q=$("#tQR"); q.innerHTML=''; new QRCode(q,{text:`${p.prodNo}|${p.itemNo}`,width:90,height:90});
  }

  // ====== Scan ======
  function pageScan(){ ensureLogin(); bindLogout();
    $("#scanProcess").innerHTML=PROCESS_LIST.map(p=>`<option>${p}</option>`).join('');
    // start camera
    const r=document.getElementById('reader'); if(r && window.Html5Qrcode){
      const html5QrCode = new Html5Qrcode("reader");
      Html5Qrcode.getCameras().then(devs=>{ const cam=devs[0]?.id; if(!cam) return;
        html5QrCode.start(cam,{fps:10, qrbox:250},onScan,err=>{});
      });
    }
    function onScan(txt){ // format: 製造番号|品番
      const [prodNo,itemNo] = (txt||'').split('|'); $("#scanInfo").textContent=`読み取り: ${prodNo||''} | ${itemNo||''}`;
      $("#manualProd").value = prodNo||''; $("#manualItem").value=itemNo||'';
    }
    $("#btnApplyScan").onclick=()=>{
      const prodNo=$("#manualProd").value.trim(); const itemNo=$("#manualItem").value.trim();
      if(!prodNo || !itemNo) return alert('製造番号と品番を入力/スキャンしてください');
      const p=state.plan.find(x=>x.prodNo===prodNo && x.itemNo===itemNo);
      if(!p) return alert('計画なし');
      p.process = $("#scanProcess").value; p.status = $("#scanStatus").value; p.updated=stamp();
      save(); pushPlan(p); alert('更新しました');
    }
  }

  // ====== Confirm (出荷確認書) ======
  function pageConfirm(){ ensureLogin(); bindLogout(); fillMasterSelects();
    $("#btnBuildConfirm").onclick=buildConfirm;
    $("#btnPrintConfirm").onclick=()=>window.print();
    $("#btnExportXlsx").onclick=exportXlsx;
  }
  function buildConfirm(){
    const d=$("#cDate").value||today(); const cus=$("#cCustomer").value||'';
    const rows = state.ship.filter(s=>(!cus||s.customer===cus) && s.date===d).map((s,i)=>[i+1,s.customer,s.itemName,s.itemNo,s.qty,s.note||'']);
    const body=$("#confirmTable tbody"); body.innerHTML = rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="6" class="text-muted">作成してください。</td></tr>`;
    $("#confirmUser").textContent = state.user;
  }
  function exportXlsx(){
    const table=document.getElementById('confirmTable');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, '出荷確認書');
    XLSX.writeFile(wb, `出荷確認書_${today()}.xlsx`);
  }

  // ====== 連携（2方向） ======
  async function pushPlan(p){ try{ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...p,user:state.user})}); logSync('PLAN送信完了'); }catch(e){ logSync('送信エラー'); } }
  async function pushShip(s){ try{ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...s,user:state.user})}); logSync('SHIP送信完了'); }catch(e){ logSync('送信エラー'); } }
  async function pullSheet(){
    try{
      const r=await fetch(ENDPOINT.ROOT); const j=await r.json();
      if(j.plan) state.plan=j.plan; if(j.ship) state.ship=j.ship; if(j.master) state.master=j.master; if(j.pics) state.pics=j.pics;
      save(); location.reload();
    }catch(e){ logSync('同期失敗: '+e); }
  }
  async function pushSheet(){ try{ for(const p of state.plan) await pushPlan(p); for(const s of state.ship) await pushShip(s); logSync('全件送信完了'); }catch(e){ logSync('送信エラー'); } }

  // ====== init ======
  function initPage(page){
    if(page==='dashboard') pageDashboard();
    if(page==='plan') pagePlan();
    if(page==='ship') pageShip();
    if(page==='ticket') pageTicket();
    if(page==='scan') pageScan();
    if(page==='confirm') pageConfirm();
  }
  return { initPage };
})();
