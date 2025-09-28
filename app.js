/* ===============================
   ERP Frontend Core (API + UI)
   =============================== */

/** Ganti jika Deploy ID berubah */
const API_BASE = 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec';

const App = {
  state: { user:null, role:null },
  cache: { master:[] },

  initPage(page){
    // restore session
    try{ const raw = localStorage.getItem('erp-session'); if(raw) this.state = JSON.parse(raw)||{}; }catch(_){}
    // header
    this.wireBurger();
    this.renderAuthButtons();
    this.hideLoginBarIfLoggedIn();
    this.markActiveNav();

    // page-specific
    if(page==='dashboard') this.pageDashboard();
    if(page==='plan') this.pagePlan();
  },

  /* -------- Header UI -------- */
  wireBurger(){
    const btn = document.getElementById('burgerBtn');
    const mobile = document.getElementById('mobileMenu');
    if(!btn || !mobile) return;
    btn.onclick = ()=> mobile.classList.toggle('open');
    mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mobile.classList.remove('open')));
  },
  markActiveNav(){
    const p = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a').forEach(a=>{
      if(a.getAttribute('href')===p) a.classList.add('active');
    });
  },
  renderAuthButtons(){
    const slot = document.getElementById('authSlot');
    const slotMob = document.getElementById('authSlotMobile');
    const html = this.state?.user
      ? `<button id="btnLogout" class="btn outline">ログアウト</button>`
      : '';
    if(slot) slot.innerHTML = html;
    if(slotMob) slotMob.innerHTML = html;
    if(this.state?.user){
      document.getElementById('btnLogout')?.addEventListener('click', ()=>this.logout());
    }
  },
  hideLoginBarIfLoggedIn(){
    const lb = document.getElementById('loginBar');
    if(lb && this.state?.user) lb.classList.add('hidden');
  },
  logout(){
    try{ localStorage.removeItem('erp-session'); }catch(_){}
    this.state = {};
    location.href='index.html';
  },

  /* -------- Login -------- */
  async login(u,p){
    const url = `${API_BASE}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`;
    const res = await fetch(url, {cache:'no-store'});
    const js = await res.json();
    if(js && js.ok){
      localStorage.setItem('erp-session', JSON.stringify({user:js.user, role:js.role}));
      return {ok:true};
    }
    return {ok:false, error:js?.error||'LOGIN_FAILED'};
  },

  /* -------- Dashboard -------- */
  async pageDashboard(){
    // Ambil plan/ship/master (GET default)
    let data=null;
    try{
      const res = await fetch(API_BASE, {cache:'no-store'});
      data = await res.json();
    }catch(_){}
    // Render ringan
    if(!data?.ok){
      // biarkan placeholder bawaan HTML
      return;
    }
    // contoh: tampilkan jumlah plan hari ini, dll. (ringkas)
    // Anda bisa melanjutkan sesuai kebutuhan
  },

  /* -------- PLAN -------- */
  async pagePlan(){
    // Master untuk dropdown (agar auto-fill stabil)
    await this.loadMaster();
    // tombol tambah
    document.getElementById('btnPlanNew')?.addEventListener('click', ()=> this.openPlanModal());
    // render table
    await this.refreshPlanTable();
  },

  async loadMaster(){
    try{
      const res = await fetch(`${API_BASE}?action=master`, {cache:'no-store'});
      const js = await res.json();
      if(js?.ok) this.cache.master = js.master || [];
    }catch(_){}
  },

  async refreshPlanTable(){
    const wrap = document.getElementById('planTableWrap');
    if(!wrap) return;
    wrap.innerHTML = `<div class="card"><div class="text-muted">読み込み中…</div></div>`;
    let rows=[];
    try{
      const res = await fetch(API_BASE, {cache:'no-store'});
      const js = await res.json();
      if(js?.ok) rows = js.plan || [];
    }catch(_){}
    wrap.innerHTML = this.renderPlanTable(rows);
    // Karena Code.gs belum punya edit/delete, tombol tidak ditampilkan
  },

  renderPlanTable(rows){
    rows = rows || [];
    if(!rows.length) return `<div class="card"><div class="text-muted">データがありません。</div></div>`;
    const tr = rows.map(r=>`
      <tr>
        <td>${r.customer||''}</td>
        <td>${r.itemNo||''}</td>
        <td>${r.itemName||''}</td>
        <td>${r.process||''}</td>
        <td>${r.start||''}</td>
        <td class="text-muted">${r.updated||''}</td>
      </tr>
    `).join('');
    return `
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>得意先</th><th>図番</th><th>品名</th><th>工程</th><th>開始</th><th>更新</th></tr>
          </thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
  },

  /* -------- Modal PLAN (Create only sesuai Code.gs) -------- */
  openModal(id){ const m=document.getElementById(id); if(!m) return; m.classList.add('open'); document.body.style.overflow='hidden'; }
  closeModal(id){ const m=document.getElementById(id); if(!m) return; m.classList.remove('open'); document.body.style.overflow=''; }

  ,
  openPlanModal(){
    this.openModal('planModal');
    const host = document.getElementById('planModalBody');
    host.innerHTML = this.renderPlanFormHtml();

    // isi dropdown MASTER
    const uniqCustomers = [...new Set(this.cache.master.map(m=>m.customer).filter(Boolean))];
    const selCust = host.querySelector('#fCustomer');
    selCust.innerHTML = `<option value="">選択</option>` + uniqCustomers.map(c=>`<option>${c}</option>`).join('');

    const selDraw = host.querySelector('#fItemNo');
    selCust.addEventListener('change', ()=>{
      const list = this.cache.master.filter(m=>m.customer===selCust.value);
      const uniqDraw = [...new Set(list.map(x=>x.drawing).filter(Boolean))];
      selDraw.innerHTML = `<option value="">選択</option>` + uniqDraw.map(d=>`<option>${d}</option>`).join('');
      host.querySelector('#fItemName').value='';
    });
    selDraw.addEventListener('change', ()=>{
      const found = this.cache.master.find(m=>m.customer===selCust.value && m.drawing===selDraw.value);
      host.querySelector('#fItemName').value = found?.itemName || '';
    });

    // tombol
    host.querySelector('[data-close]')?.addEventListener('click', ()=> this.closeModal('planModal'));
    host.querySelector('#btnPlanSave')?.addEventListener('click', async ()=>{
      const data = this.readPlanForm(host);
      const ok = await this.savePlanToServer(data);
      if(ok){ this.closeModal('planModal'); this.refreshPlanTable(); }
      else{ alert('保存に失敗しました。'); }
    });
  },

  renderPlanFormHtml(){
    return `
      <div class="row">
        <div class="col">
          <label>得意先（MASTER）</label>
          <select id="fCustomer" class="input"><option value="">選択</option></select>
        </div>
        <div class="col">
          <label>図番（MASTER）</label>
          <select id="fItemNo" class="input"><option value="">選択</option></select>
        </div>
      </div>
      <div class="row">
        <div class="col"><label>品名</label><input id="fItemName" class="input" placeholder="MASTER選択で自動入力"></div>
        <div class="col"><label>製造番号</label><input id="fProdNo" class="input" placeholder=""></div>
      </div>
      <div class="row">
        <div class="col"><label>開始</label><input id="fStart" type="date" class="input"></div>
        <div class="col"><label>工程</label><input id="fProcess" class="input" placeholder="例）レーザ工程"></div>
      </div>
      <div class="row">
        <div class="col"><label>場所</label><input id="fLocation" class="input" value="PPIC/現場など"></div>
        <div class="col"><label>ステータス</label>
          <select id="fStatus" class="input">
            <option>計画</option><option>進行中</option><option>完了</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <div class="col">
          <button class="btn" id="btnPlanSave">保存</button>
          <button class="btn outline" data-close="1">閉じる</button>
        </div>
      </div>
    `;
  },

  readPlanForm(host){
    const get = id => host.querySelector(id).value.trim();
    return {
      customer: get('#fCustomer'),
      itemNo:   get('#fItemNo'),
      itemName: get('#fItemName'),
      prodNo:   get('#fProdNo'),
      start:    get('#fStart'),
      process:  get('#fProcess'),
      location: get('#fLocation'),
      status:   get('#fStatus'),
      updated:  new Date().toISOString(),
      user:     this.state?.user||''
    };
  },

  async savePlanToServer(data){
    // doPost (kompatibel dgn Code.gs Anda)
    try{
      const res = await fetch(API_BASE, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          '得意先': data.customer,
          '製造番号': data.prodNo,
          '品名': data.itemName,
          '品番': data.itemNo,
          '開始': data.start,
          'プロセス': data.process,
          '場所': data.location,
          'ステータス': data.status,
          '更新': data.updated,
          'ユザー': data.user
        })
      });
      const txt = await res.text();
      return (txt||'').trim().toLowerCase()==='ok';
    }catch(_){ return false; }
  }
};
/* ====== Tambahan Halaman: ship / confirm / ticket / charts / master / scan ====== */

Object.assign(App, {
  /* ------------------- SHIP ------------------- */
  async pageShip(){
    document.getElementById('btnShipNew')?.addEventListener('click', ()=> this.openShipModal());
    await this.refreshShipToday();
  },
  async refreshShipToday(){
    const pane = document.getElementById('shipTodayWrap'); if(!pane) return;
    pane.innerHTML = `<div class="card"><div class="text-muted">読み込み中…</div></div>`;
    let rows=[];
    try{
      const res=await fetch(API_BASE,{cache:'no-store'}); const js=await res.json();
      if(js?.ok) rows = js.ship||[];
    }catch(_){}
    const today = new Date().toISOString().slice(0,10);
    const list = rows.filter(r=>(r.date||'').slice(0,10)===today);
    if(!list.length){ pane.innerHTML=`<div class="card"><div class="text-muted">本日の出荷予定はありません。</div></div>`; return; }
    const tr=list.map(r=>`<tr><td>${r.date||''}</td><td>${r.customer||''}</td><td>${r.itemNo||''}</td><td>${r.itemName||''}</td><td>${r.qty||0}</td><td>${r.status||''}</td></tr>`).join('');
    pane.innerHTML = `
      <div class="card">
        <table class="table">
          <thead><tr><th>日付</th><th>得意先</th><th>図番</th><th>品名</th><th>数量</th><th>ステータス</th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
      </div>`;
  },
  openShipModal(){
    this.openModal('shipModal');
    const host=document.getElementById('shipModalBody');
    host.innerHTML=`
      <div class="row">
        <div class="col"><label>日付</label><input id="sDate" type="date" class="input"></div>
        <div class="col"><label>得意先</label><input id="sCustomer" class="input"></div>
      </div>
      <div class="row">
        <div class="col"><label>図番</label><input id="sItemNo" class="input"></div>
        <div class="col"><label>品名</label><input id="sItemName" class="input"></div>
      </div>
      <div class="row">
        <div class="col"><label>数量</label><input id="sQty" type="number" step="1" class="input" value="0"></div>
        <div class="col"><label>ステータス</label><select id="sStatus" class="input"><option>出荷予定</option><option>出荷完了</option></select></div>
      </div>
      <div class="row"><div class="col"><label>備考</label><input id="sNote" class="input"></div></div>
      <div class="row" style="margin-top:10px"><div class="col">
        <button id="btnShipSave" class="btn">保存</button>
        <button class="btn outline" data-close="1">閉じる</button>
      </div></div>`;
    host.querySelector('#btnShipSave').onclick = async ()=>{
      const payload={
        '日付': host.querySelector('#sDate').value,
        '得意先': host.querySelector('#sCustomer').value,
        '品名': host.querySelector('#sItemName').value,
        '品番': host.querySelector('#sItemNo').value,
        '数量': Number(host.querySelector('#sQty').value||0),
        'ステータス': host.querySelector('#sStatus').value,
        '備考': host.querySelector('#sNote').value,
        '更新': new Date().toISOString(),
        'ユザー': this.state?.user||''
      };
      try{
        const res=await fetch(API_BASE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const txt=await res.text();
        if((txt||'').trim().toLowerCase()==='ok'){ this.closeModal('shipModal'); this.refreshShipToday(); }
        else alert('保存に失敗しました。');
      }catch(_){ alert('通信エラー'); }
    };
  },

  /* ------------------- CONFIRM (出荷確認書) ------------------- */
  async pageConfirm(){
    document.getElementById('btnConfirmMake')?.addEventListener('click', ()=> this.buildConfirmTable());
    document.getElementById('btnConfirmPrint')?.addEventListener('click', ()=> window.print());
    document.getElementById('btnConfirmCsv')?.addEventListener('click', ()=> this.exportConfirmCSV());
  },
  async buildConfirmTable(){
    const d = document.getElementById('cfDate').value;
    const c = document.getElementById('cfCustomer').value.trim();
    const wrap = document.getElementById('confirmTable'); wrap.innerHTML='作成中…';
    let rows=[];
    try{ const res=await fetch(API_BASE,{cache:'no-store'}); const js=await res.json(); if(js?.ok) rows=js.ship||[]; }catch(_){}
    const list = rows.filter(r=>{
      const okDate = !d || (r.date||'').slice(0,10)===d;
      const okCust = !c || (r.customer||'').includes(c);
      return okDate && okCust;
    });
    const tr=list.map((r,i)=>`<tr><td>${i+1}</td><td>${r.customer||''}</td><td>${r.itemName||''}</td><td>${r.itemNo||''}</td><td>${r.qty||0}</td><td>${r.note||''}</td></tr>`).join('');
    wrap.innerHTML = `
      <table class="table printable">
        <thead><tr><th>No</th><th>得意先</th><th>品名</th><th>図番</th><th>数量</th><th>備考</th></tr></thead>
        <tbody>${tr||`<tr><td colspan="6" class="text-muted">作成してください。</td></tr>`}</tbody>
      </table>
    `;
    window._CONFIRM_LAST = list;
  },
  exportConfirmCSV(){
    const list = window._CONFIRM_LAST||[];
    const header = ['No','得意先','品名','図番','数量','備考'];
    const rows = [header].concat(list.map((r,i)=>[i+1,r.customer||'',r.itemName||'',r.itemNo||'',r.qty||0,r.note||'']));
    const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='出荷確認書.csv'; a.click();
  },

  /* ------------------- TICKET（生産現品票：テンプレート印刷） ------------------- */
  pageTicket(){
    document.getElementById('btnTicketPrint')?.addEventListener('click', ()=> window.print());
  },

  /* ------------------- CHARTS ------------------- */
  async pageCharts(){
    // pakai Chart.js via CDN (sudah di charts.html)
    let data=null;
    try{ const res=await fetch(API_BASE,{cache:'no-store'}); data=await res.json(); }catch(_){}
    if(!data?.ok) return;

    // pie: stok barang jadi (= sum qtyDone-qtyShip per itemName)
    const mapStock = {};
    (data.plan||[]).forEach(r=>{
      const key=r.itemName||'(無題)'; const val=(Number(r.qtyDone||0)-Number(r.qtyShip||0))||0;
      mapStock[key]=(mapStock[key]||0)+val;
    });
    const labels1=Object.keys(mapStock), values1=labels1.map(k=>mapStock[k]);
    new Chart(document.getElementById('chartStock'),{type:'pie',data:{labels:labels1,datasets:[{data:values1}]}});
    // pareto: total kirim per customer (descending + kumulatif)
    const mapShip={}; (data.ship||[]).forEach(s=>{ const k=s.customer||'(無名)'; mapShip[k]=(mapShip[k]||0)+Number(s.qty||0); });
    const entries=Object.entries(mapShip).sort((a,b)=>b[1]-a[1]);
    const labels2=entries.map(e=>e[0]); const vals2=entries.map(e=>e[1]);
    const total=vals2.reduce((a,b)=>a+b,0); let running=0; const cum=vals2.map(v=>{ running+=v; return Math.round(running/Math.max(total,1)*100); });
    new Chart(document.getElementById('chartPareto'),{
      type:'bar', data:{labels:labels2,datasets:[{label:'出荷数量',data:vals2}]},
      options:{scales:{y:{beginAtZero:true}},plugins:{legend:{display:false}}},
      plugins:[{id:'pareto',afterDatasetsDraw(chart,args,plg){ // garis kumulatif %
        const {ctx,chartArea:{top,bottom,left,right}}=chart; const y=chart.scales.y;
        const step=(right-left)/Math.max(vals2.length-1,1); ctx.save(); ctx.strokeStyle='#ef4444'; ctx.beginPath();
        cum.forEach((p,i)=>{ const xx=left+i*step; const yy=top+(100-p)/100*(bottom-top); if(i) ctx.lineTo(xx,yy); else ctx.moveTo(xx,yy); });
        ctx.stroke(); ctx.restore();
      }}]
    });
  },

  /* ------------------- MASTER（CRUD シンプル） ------------------- */
  async pageMaster(){
    document.getElementById('btnMNew')?.addEventListener('click', ()=> this.openMasterModal());
    this._mSearch = ''; this._mPage = 1;
    await this.refreshMaster();
    document.getElementById('mSearch').addEventListener('input', (e)=>{ this._mSearch=e.target.value.trim(); this._mPage=1; this.refreshMaster(); });
    document.getElementById('mPrev').addEventListener('click', ()=>{ if(this._mPage>1){ this._mPage--; this.refreshMaster(); }});
    document.getElementById('mNext').addEventListener('click', ()=>{ this._mPage++; this.refreshMaster(); });
  },
  async refreshMaster(){
    await this.loadMaster();
    let list=[...this.cache.master];
    if(this._mSearch){ const q=this._mSearch; list=list.filter(m=>[m.customer,m.drawing,m.itemName,m.itemNo].join(' ').includes(q)); }
    const pageSize=10, start=(this._mPage-1)*pageSize; const page=list.slice(start,start+pageSize);
    const tbody=document.getElementById('mBody'); tbody.innerHTML=page.map(m=>`
      <tr>
        <td class="text-muted">${m.id||''}</td>
        <td>${m.customer||''}</td><td>${m.drawing||''}</td><td>${m.itemName||''}</td><td>${m.itemNo||''}</td>
        <td>
          <button class="btn outline" data-edit="${m.id}">編集</button>
          <button class="btn outline" data-del="${m.id}">削除</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="text-muted">データがありません。</td></tr>`;
    tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>this.openMasterModal(b.dataset.edit)));
    tbody.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>this.deleteMaster(b.dataset.del)));
    document.getElementById('mPageInfo').textContent=`${this._mPage}`;
  },
  openMasterModal(id){
    this.openModal('mModal');
    const host=document.getElementById('mModalBody');
    const cur = id ? this.cache.master.find(x=>String(x.id)===String(id)) : null;
    host.innerHTML=`
      <div class="row">
        <div class="col"><label>得意先</label><input id="mmCustomer" class="input" value="${cur?.customer||''}"></div>
        <div class="col"><label>図番</label><input id="mmDrawing" class="input" value="${cur?.drawing||''}"></div>
      </div>
      <div class="row">
        <div class="col"><label>品名</label><input id="mmItemName" class="input" value="${cur?.itemName||''}"></div>
        <div class="col"><label>品番</label><input id="mmItemNo" class="input" value="${cur?.itemNo||''}"></div>
      </div>
      <div class="row" style="margin-top:10px"><div class="col">
        <button id="mmSave" class="btn">保存</button>
        <button class="btn outline" data-close="1">閉じる</button>
      </div></div>`;
    host.querySelector('#mmSave').onclick = async ()=>{
      const payload={
        action:'MASTER_UPSERT',
        id: cur?.id || '',
        customer: host.querySelector('#mmCustomer').value,
        drawing:  host.querySelector('#mmDrawing').value,
        itemName: host.querySelector('#mmItemName').value,
        itemNo:   host.querySelector('#mmItemNo').value
      };
      const ok = await this.postJson(payload);
      if(ok?.ok){ this.closeModal('mModal'); this.refreshMaster(); } else alert('保存失敗');
    };
  },
  async deleteMaster(id){
    if(!confirm('削除しますか？')) return;
    const ok = await this.postJson({action:'MASTER_DELETE', id});
    if(ok?.ok) this.refreshMaster(); else alert('削除失敗');
  },
  async postJson(obj){
    try{ const res=await fetch(API_BASE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}); return await res.json(); }
    catch(_){ return null; }
  },

  /* ------------------- SCAN（ZXing + manual） ------------------- */
  pageScan(){
    const selDev=document.getElementById('videoSource');
    const video=document.getElementById('preview');
    const resBox=document.getElementById('scanResult');
    const btnStart=document.getElementById('btnScanStart');
    const btnStop=document.getElementById('btnScanStop');
    const btnManual=document.getElementById('btnManualCommit');

    // Manual input fallback
    btnManual?.addEventListener('click', ()=>{
      const v=document.getElementById('manualCode').value.trim();
      if(v){ resBox.textContent=`MANUAL: ${v}`; alert('受け取りました（更新API未実装）'); }
    });

    // ZXing
    if(!window.ZXing) return; // lib belum dimuat
    const codeReader = new ZXing.BrowserMultiFormatReader();
    async function listDevices(){
      try{
        const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
        selDev.innerHTML = devices.map(d=>`<option value="${d.deviceId}">${d.label||d.deviceId}</option>`).join('');
      }catch(_){}
    }
    btnStart?.addEventListener('click', async ()=>{
      try{
        await listDevices();
        const id = selDev.value;
        await codeReader.decodeFromVideoDevice(id, 'preview', (result,err)=>{
          if(result){ resBox.textContent=result.getText(); /* TODO: call update endpoint here */ }
        });
      }catch(e){ alert('カメラにアクセスできません: '+e); }
    });
    btnStop?.addEventListener('click', ()=>{ try{ codeReader.reset(); }catch(_){} });
    listDevices();
  }
});

window.App = App;
