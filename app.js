/* ===========================================================
   ERP Mini-ERP (TSH) • app.js (dashboard/plan/ship/confirm/scan/ticket/charts)
=========================================================== */
const App = (function(){
  // ==== KONFIG ====
  const PROCESS_LIST = ["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];

  // GANTI URL BERIKUT (Web App GAS)
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
  function clearLocal(){
    ['tsh_user','tsh_dept','tsh_token','tsh_pic','tsh_plan','tsh_ship','tsh_master','tsh_pics','tsh_ng'].forEach(k=>localStorage.removeItem(k));
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

  // ====== Burger menu ======
  function initBurger(){
    const burger=$("#burger"), nav=$("#mainNav");
    if(burger && nav){
      burger.onclick=()=> nav.classList.toggle('open');
      // close on click link (mobile)
      nav.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> nav.classList.remove('open')));
    }
  }

  // ====== Common helpers ======
  function fillProcessSelect(sel){ if(!sel) return; sel.innerHTML=`<option value="">工程（全て）</option>`+PROCESS_LIST.map(p=>`<option>${p}</option>`).join(''); }
  function fillMasterSelects(){
    // Customers
    const customers=[...new Set(state.master.map(m=>m.customer))].filter(Boolean).sort();
    document.querySelectorAll('#fCustomer,#sCustomer,#cCustomer').forEach(sel=>{
      if(!sel) return;
      const head = sel.id==='cCustomer' ? '<option value="">（空白＝全て）</option>' : '<option value="">得意先を選択</option>';
      sel.innerHTML = head + customers.map(c=>`<option>${c}</option>`).join('');
    });
  }
  function bindMasterCascade(){
    // Plan modal
    const fC=$("#fCustomer"), fNo=$("#fItemNo"), fName=$("#fItemName");
    if(fC && fNo && fName){
      fC.onchange=()=>{ const list=[...new Set(state.master.filter(m=>m.customer===fC.value).map(m=>m.itemNo))]; fNo.innerHTML=`<option value="">図番/品番を選択</option>`+list.map(x=>`<option>${x}</option>`).join(''); fName.value=''; };
      fNo.onchange=()=>{ const hit=state.master.find(m=>m.customer===fC.value && m.itemNo===fNo.value); fName.value=hit?hit.itemName:''; };
    }
    // Ship modal
    const sC=$("#sCustomer"), sNo=$("#sItemNo"), sName=$("#sItemName");
    if(sC && sNo && sName){
      sC.onchange=()=>{ const list=[...new Set(state.master.filter(m=>m.customer===sC.value).map(m=>m.itemNo))]; sNo.innerHTML=`<option value="">図番/品番を選択</option>`+list.map(x=>`<option>${x}</option>`).join(''); sName.value=''; };
      sNo.onchange=()=>{ const hit=state.master.find(m=>m.customer===sC.value && m.itemNo===sNo.value); sName.value=hit?hit.itemName:''; };
    }
  }

  /* =======================================================
     DASHBOARD
  ======================================================= */
  function pageDashboard(){ ensureLogin(); bindLogout(); initBurger();
    // now list
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

    // chart process
    const counts=PROCESS_LIST.map(proc=>state.plan.filter(p=>p.process===proc).length);
    const ctx=document.getElementById('byProcessChart'); if(ctx && window.Chart){
      new Chart(ctx.getContext('2d'),{type:'bar',data:{labels:PROCESS_LIST,datasets:[{label:'件数',data:counts}]},options:{plugins:{legend:{display:false}}}});
    }

    // ship today
    const t=today(), list=state.ship.filter(s=>s.date===t).map(s=>`
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
    $("#stockBody")?.insertAdjacentHTML('beforeend', stock.map(r=>`<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td><td style="text-align:right">${r.qtyDone||0}</td><td style="text-align:right">${r.qtyShip||0}</td><td style="text-align:right;font-weight:600">${(r.qtyDone||0)-(r.qtyShip||0)}</td></tr>`).join(''));

    // sync
    $("#btnPull")?.addEventListener('click',pullSheet);
    $("#btnPush")?.addEventListener('click',pushSheet);
    $("#btnClearLocal")?.addEventListener('click',clearLocal);
    const auto=$("#autoSync"); if(auto){ auto.onchange=()=>{ if(auto.checked){ state._interval=setInterval(pullSheet,30000);} else { clearInterval(state._interval); } } }
  }

  /* =======================================================
     PLAN / SHIP  (pakai versi Anda sebelumnya)
     ——— (fungsi inti tetap; hanya panggil pull/push)
  ======================================================= */

  /* =======================================================
     CONFIRM (出荷予定＝紙)
  ======================================================= */
  function pageConfirm(){ ensureLogin(); bindLogout(); initBurger(); fillMasterSelects();
    $("#btnBuildConfirm").onclick=makeConfirm;
    $("#btnPrintConfirm").onclick=()=>window.print();
    $("#btnExportXlsx").onclick=exportConfirmXlsx;
  }
  function makeConfirm(){
    const d=$("#cDate").value||today(); const cust=$("#cCustomer").value||'';
    $("#cDateView").textContent=d; $("#confirmUser").textContent=state.user;
    const list = state.ship.filter(x=> (x.date===d) && (!cust || x.customer===cust));
    const body=$("#cBody");
    if(!list.length){ body.innerHTML=`<tr><td colspan="8" class="text-muted">該当データなし。</td></tr>`; return; }
    body.innerHTML = list.map((s,i)=> `<tr>
      <td style="text-align:right">${i+1}</td>
      <td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td>
      <td style="text-align:right">${s.qty||0}</td><td>${s.status||''}</td>
      <td colspan="2">${s.note||''}</td>
    </tr>`).join('');
  }
  function exportConfirmXlsx(){
    const table=document.querySelector('.shipdoc table'); if(!table) return alert('先に作成してください');
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "出荷予定");
    const d=$("#cDate").value||today();
    XLSX.writeFile(wb, `出荷予定_${d}.xlsx`);
  }

  /* =======================================================
     TICKET（生産現品票）
  ======================================================= */
  function pageTicket(){ ensureLogin(); bindLogout(); initBurger();
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
    $("#tProcessRows").innerHTML = PROCESS_LIST.map((name,i)=>`<tr><td>${name}</td><td>${imp[i]||''}</td><td style="height:46px"></td><td></td></tr>`).join('');
    const q=$("#tQR"); q.innerHTML=''; new QRCode(q,{text:`${p.prodNo}|${p.itemNo}`,width:100,height:100}); // QR otomatis
  }

  /* =======================================================
     SCAN（QR＋手入力、NG登録）
  ======================================================= */
  function pageScan(){ ensureLogin(); bindLogout(); initBurger();
    $("#scanProcess").innerHTML=PROCESS_LIST.map(p=>`<option>${p}</option>`).join('');
    if(window.Html5Qrcode){
      const html5QrCode = new Html5Qrcode("reader");
      Html5Qrcode.getCameras().then(devs=>{ const cam=devs[0]?.id; if(!cam) return;
        html5QrCode.start(cam,{fps:10, qrbox:250},onScan,()=>{});
      });
    }
    function onScan(txt){ const [prodNo,itemNo] = (txt||'').split('|'); $("#scanInfo").textContent=`読み取り: ${prodNo||''} | ${itemNo||''}`; $("#manualProd").value=prodNo||''; $("#manualItem").value=itemNo||''; }
    $("#btnApplyScan").onclick=()=>{
      const prodNo=$("#manualProd").value.trim(), itemNo=$("#manualItem").value.trim();
      if(!prodNo||!itemNo) return alert('製造番号と品番を入力/スキャンしてください');
      const p=state.plan.find(x=>x.prodNo===prodNo && x.itemNo===itemNo); if(!p) return alert('計画なし');
      p.process=$("#scanProcess").value; p.status=$("#scanStatus").value; p.updated=stamp();
      save(); pushPlan(p); alert('更新しました');
    };
    // NG save
    $("#btnSaveNG").onclick=()=>{
      const prodNo=$("#manualProd").value.trim(), itemNo=$("#manualItem").value.trim();
      if(!prodNo||!itemNo) return alert('製造番号と品番を入力/スキャンしてください');
      const qty=Number($("#ngQty").value||0); const reason=$("#ngReason").value.trim();
      if(qty<=0) return alert('NG数量を入力してください');
      const p=state.plan.find(x=>x.prodNo===prodNo && x.itemNo===itemNo); if(!p) return alert('計画なし');
      const rec={ng:true, date:today(), customer:p.customer||'', itemName:p.itemName||'', itemNo:p.itemNo||itemNo, qty:qty, reason:reason, updated:stamp(), user:state.user};
      state.ng.unshift(rec); save(); pushNG(rec); alert('NG登録しました');
    };
  }

  /* =======================================================
     CHARTS（在庫、NG、出荷 顧客別）
  ======================================================= */
  function pageCharts(){ ensureLogin(); bindLogout(); initBurger();
    // STOCK: itemNo => qtyDone-qtyShip
    const stockMap={};
    state.plan.forEach(p=>{
      const k=p.itemNo||p.itemName; stockMap[k] ||= {label:(p.itemName||p.itemNo||'-'), qty:0};
      const done=Number(p.qtyDone||0);
      const shipped=state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((a,b)=>a+Number(b.qty||0),0);
      stockMap[k].qty += (done - shipped);
    });
    const stockArr=Object.values(stockMap).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty);
    drawPiePareto('stockPie','stockPareto',stockArr,'qty','label','在庫');

    // NG: by item/customer (gunakan customer)
    const ngMap={};
    state.ng.forEach(n=>{ const k=n.customer||'-'; ngMap[k]=(ngMap[k]||0)+Number(n.qty||0); });
    const ngArr=Object.keys(ngMap).map(k=>({label:k, qty:ngMap[k]})).sort((a,b)=>b.qty-a.qty);
    drawPiePareto('ngPie','ngPareto',ngArr,'qty','label','NG');

    // SHIP per customer (monthly this year / yearly all)
    const aggSel=$("#shipAgg");
    const buildShip=()=>{
      const mode=aggSel.value; const map={};
      if(mode==='year'){
        state.ship.filter(s=>s.status==='出荷済').forEach(s=>{
          const y=(s.date||'').slice(0,4)||'----'; const k=s.customer||'-';
          map[k]=(map[k]||0)+Number(s.qty||0);
        });
      }else{
        const y=(new Date()).getFullYear().toString();
        state.ship.filter(s=>(s.status==='出荷済') && (s.date||'').startsWith(y)).forEach(s=>{
          const k=s.customer||'-'; map[k]=(map[k]||0)+Number(s.qty||0);
        });
      }
      const arr=Object.keys(map).map(k=>({label:k, qty:map[k]})).sort((a,b)=>b.qty-a.qty);
      drawPiePareto('shipPie','shipPareto',arr,'qty','label','出荷');
    };
    aggSel.onchange=buildShip; buildShip();
  }

  function drawPiePareto(pieId, paretoId, data, valKey, labelKey, title){
    const labels=data.map(x=>x[labelKey]); const values=data.map(x=>x[valKey]);
    // PIE
    const ctx1=document.getElementById(pieId); if(ctx1){
      new Chart(ctx1.getContext('2d'),{type:'pie',data:{labels,datasets:[{data:values}]},options:{plugins:{legend:{position:'bottom'},title:{display:true,text:title+'：Pie'}}});
    }
    // PARETO: bar + cumulative line
    const sum = values.reduce((a,b)=>a+b,0)||1;
    const cumulative = values.map((v,i)=> values.slice(0,i+1).reduce((a,b)=>a+b,0)/sum*100 );
    const ctx2=document.getElementById(paretoId); if(ctx2){
      new Chart(ctx2.getContext('2d'),{
        data:{
          labels,
          datasets:[
            {type:'bar', label:title, data:values, yAxisID:'y'},
            {type:'line', label:'累積%', data:cumulative, yAxisID:'y1', tension:.2}
          ]
        },
        options:{
          plugins:{legend:{position:'bottom'},title:{display:true,text:title+'：Pareto'}},
          scales:{ y:{beginAtZero:true}, y1:{beginAtZero:true, max:100, ticks:{callback:(v)=>v+'%'} } }
        }
      });
    }
  }

  /* =======================================================
     連携（2方向）— tambah NG
  ======================================================= */
  async function pushPlan(p){ try{ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...p,user:state.user})}); logSync('PLAN送信完了'); }catch(e){ logSync('送信エラー'); } }
  async function pushShip(s){ try{ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({...s,user:state.user})}); logSync('SHIP送信完了'); }catch(e){ logSync('送信エラー'); } }
  async function pushNG(n){ try{ await fetch(ENDPOINT.ROOT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(n)}); logSync('NG送信完了'); }catch(e){ logSync('送信エラー'); } }

  async function pullSheet(){
    try{
      const r=await fetch(ENDPOINT.ROOT); const j=await r.json();
      if(j.plan) state.plan=j.plan; if(j.ship) state.ship=j.ship; if(j.master) state.master=j.master; if(j.pics) state.pics=j.pics; if(j.ng) state.ng=j.ng;
      save(); location.reload();
    }catch(e){ logSync('同期失敗: '+e); }
  }
  async function pushSheet(){ try{ for(const p of state.plan) await pushPlan(p); for(const s of state.ship) await pushShip(s); for(const n of state.ng) await pushNG(n); logSync('全件送信完了'); }catch(e){ logSync('送信エラー'); } }

  // ====== init ======
  function initPage(page){
    if(page==='dashboard') pageDashboard();
    if(page==='plan') { /* gunakan file plan.html Anda sebelumnya */ }
    if(page==='ship') { /* gunakan file ship.html Anda sebelumnya */ }
    if(page==='confirm') pageConfirm();
    if(page==='ticket') pageTicket();
    if(page==='scan') pageScan();
    if(page==='charts') pageCharts();
    // umum
    ensureLogin(); bindLogout(); initBurger();
  }
  return { initPage };
})();
