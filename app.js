<script>
/* ========= Core App ========= */
const App = {
  CONFIG:{
    GAS_URL: 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec', // ganti milik Anda bila perlu
    PAGE_SIZE: 10
  },
  state:{
    user:null, role:null, pic:null, token:null,
    plan:[], ship:[], master:[], // master: {customer,drawNo,itemNo,itemName}
  },
  ROLES:['管理者','生産管理部','製造部','検査部'],
  PICS:{
    '生産管理部':['田村','南部','瀬野'],
    '製造部':['白石','青木','松川'],
    '検査部':['石橋','長谷部','都合']
  },

  /* ====== Boot ====== */
  initPage(page){
    this.mountHeader(page);
    this.restoreSession();
    this.applyRoleUI(page);
    this.attachBurger();
    this.bindGlobalEnter();
    if(page==='dashboard') this.pageDashboard();
    if(page==='plan')       this.pagePlan();
    if(page==='ship')       this.pageShip();
    if(page==='ticket')     this.pageTicket();
    if(page==='scan')       this.pageScan();
    if(page==='confirm')    this.pageConfirm();
    if(page==='master')     this.pageMaster();
  },

  /* ====== Header & Login ====== */
  mountHeader(page){
    const hdr = document.querySelector('.topbar');
    if(!hdr) return;
    // Login chip
    const bar = document.getElementById('loginBar');
    const renderLogin = ()=>{
      bar.innerHTML = '';
      if(this.state.user){
        const div = document.createElement('div');
        div.className = 'login-chip';
        div.innerHTML = `<span class="badge gray">${this.state.role||'-'}</span><strong>${this.state.user}</strong><button class="btn outline" id="btnLogout">ログアウト</button>`;
        bar.appendChild(div);
        document.getElementById('btnLogout').onclick = ()=>this.logout();
      }else{
        const row = document.createElement('div');
        row.className = 'row wrap';
        row.innerHTML = `
          <input id="u" class="input" placeholder="ユーザー 例: admin" style="max-width:220px">
          <input id="p" class="input" placeholder="パスワード" type="password" style="max-width:220px">
          <select id="r" class="input" style="max-width:180px">
            ${this.ROLES.map(x=>`<option>${x}</option>`).join('')}
          </select>
          <select id="pic" class="input" style="max-width:180px"></select>
          <button id="btnLogin" class="btn">ログイン</button>`;
        bar.appendChild(row);
        const rSel = row.querySelector('#r');
        const picSel = row.querySelector('#pic');
        const refreshPIC = ()=>{
          const list = this.PICS[rSel.value]||[];
          picSel.innerHTML = list.map(n=>`<option>${n}</option>`).join('');
        };
        rSel.onchange=refreshPIC; refreshPIC();
        row.querySelector('#btnLogin').onclick = ()=> this.login(
          row.querySelector('#u').value.trim(),
          row.querySelector('#p').value,
          rSel.value,
          picSel.value
        );
      }
    };
    renderLogin();
    this._renderLogin = renderLogin; // keep
  },
  bindGlobalEnter(){
    document.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        const btn = document.getElementById('btnLogin');
        if(btn && !this.state.user) btn.click();
      }
    });
  },
  restoreSession(){
    const s = localStorage.getItem('erp-session');
    if(!s) return;
    try{
      const obj = JSON.parse(s);
      this.state.user = obj.user; this.state.role=obj.role; this.state.pic=obj.pic; this.state.token=obj.token;
      this._renderLogin?.();
    }catch{}
  },
  persist(){ localStorage.setItem('erp-session', JSON.stringify({user:this.state.user,role:this.state.role,pic:this.state.pic,token:this.state.token})); },
  logout(){ this.state.user=null; this.state.role=null; this.state.pic=null; this.state.token=null; this.persist(); this._renderLogin?.(); this.applyRoleUI(); },

  async login(user,pass,role,pic){
    if(!user||!pass){ alert('ユーザー/パスワードを入力'); return; }
    try{
      const url=this.CONFIG.GAS_URL+`?action=login&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
      const r=await fetch(url,{cache:'no-store'}); const j=await r.json();
      if(!j.ok){ alert('ログイン失敗: '+(j.error||'')); return; }
      this.state.user=user; this.state.role=role||'生産管理部'; this.state.pic=pic||''; this.state.token=j.token||'';
      this.persist(); this._renderLogin?.(); this.applyRoleUI();
      // prefetch
      this.pullSheet();
    }catch(e){ alert('サーバー通信エラー'); }
  },

  /* ====== Role guard ====== */
  guard(allow){
    if(!this.state.user){ alert('ログインが必要です'); location.href='index.html'; return false; }
    if(allow && !allow.includes(this.state.role)){ alert('権限がありません'); location.href='index.html'; return false; }
    return true;
  },
  applyRoleUI(page){
    // Hide sync for non-admin
    document.querySelectorAll('.sync-section').forEach(el=>{
      if(this.state.role!=='管理者') el.classList.add('hidden'); else el.classList.remove('hidden');
    });
    // Hide login inputs if logged in
    const bar=document.getElementById('loginBar');
    if(this.state.user){ bar.classList.remove('login-form'); } else { bar.classList.add('login-form'); }
  },

  /* ====== Burger ====== */
  attachBurger(){
    const btn=document.getElementById('burgerBtn');
    const nav=document.getElementById('mainNav');
    if(!btn||!nav) return;
    btn.onclick=()=> nav.classList.toggle('show');
    // auto-close on click
    nav.querySelectorAll('a').forEach(a=> a.addEventListener('click',()=>nav.classList.remove('show')));
  },

  /* ====== GAS data ====== */
  async pullSheet(){
    try{
      const r=await fetch(this.CONFIG.GAS_URL,{cache:'no-store'}); const j=await r.json();
      this.state.plan=j.plan||[]; this.state.ship=j.ship||[];
      this.syncLog('取得しました。');
      this._refreshPage?.();
    }catch(e){ this.syncLog('取得失敗'); }
  },
  async pushPlan(rec){ try{
    await fetch(this.CONFIG.GAS_URL,{method:'POST',body:JSON.stringify(rec)});
    this.syncLog('送信しました。');
  }catch{ this.syncLog('送信失敗'); } },
  syncLog(msg){ const el=document.getElementById('syncLog'); if(el) el.textContent= new Date().toLocaleString()+' • '+msg; },

  /* ====== Small utilities ====== */
  today(){ const d=new Date(); return d.toISOString().slice(0,10); },
  stamp(){ return new Date().toLocaleString(); },

  /* ====== Pagination helper ====== */
  buildPager(total, page, perPage, onJump){
    const pages = Math.max(1, Math.ceil(total/perPage));
    const wrap=document.createElement('div'); wrap.className='pager';
    const make=(lbl,p)=>{
      const b=document.createElement('button'); b.textContent=lbl; if(p===page) b.classList.add('on'); b.onclick=()=>onJump(p);
      wrap.appendChild(b);
    };
    make('«',1); make('‹',Math.max(1,page-1));
    for(let i=Math.max(1,page-2); i<=Math.min(pages,page+2); i++) make(String(i),i);
    make('›',Math.min(pages,page+1)); make('»',pages);
    const info=document.createElement('span'); info.className='text-muted'; info.style.marginLeft='8px';
    info.textContent=`${total}件`;
    wrap.appendChild(info);
    return wrap;
  },

  /* ====== Dashboard ====== */
  pageDashboard(){
    this.guard(null);
    this._refreshPage=()=>this.pageDashboard();
    // now list
    const nowDiv=document.getElementById('nowList');
    const list = (this.state.plan||[]).slice(0,8);
    nowDiv.innerHTML = list.map(p=>`
      <div class="row wrap" style="justify-content:space-between;border:1px solid var(--ring);border-radius:12px;padding:10px">
        <div>
          <div><strong>${p.itemName||'-'}</strong> <span class="text-muted">(${p.itemNo||''})</span></div>
          <div class="text-muted" style="font-size:12px">得意先:${p.customer||'-'} ・ 製造番号:${p.prodNo||'-'} ・ 開始:${p.start||'-'}</div>
        </div>
        <div class="t-right" style="min-width:140px">
          <div class="badge gray">${p.process||'-'} / ${p.status||'-'}</div>
          <div class="text-muted" style="font-size:12px">${p.updated||''}</div>
        </div>
      </div>`).join('') || `<div class='text-muted'>データがありません。</div>`;

    // chart by process
    const counts = ['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程']
      .map(proc => (this.state.plan||[]).filter(p=>p.process===proc).length );
    const ctx=document.getElementById('byProcessChart').getContext('2d');
    if(window._chart1) window._chart1.destroy();
    window._chart1=new Chart(ctx,{type:'bar',data:{labels:['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程'],datasets:[{label:'件数',data:counts}]},options:{plugins:{legend:{display:false}}}});

    // ship today
    const t=this.today();
    document.getElementById('shipToday').innerHTML =
      (this.state.ship||[]).filter(s=>s.date===t).map(s=>`
        <div class="row wrap" style="justify-content:space-between;border:1px solid var(--ring);border-radius:12px;padding:10px">
          <div><strong>${s.itemName}</strong><div class="text-muted" style="font-size:12px">${s.customer} ・ 数量:${s.qty}</div></div>
          <div class="t-right"><span class="badge green">${s.status}</span><div class="text-muted" style="font-size:12px">${s.updated||''}</div></div>
        </div>`).join('') || `<div class="text-muted">本日の出荷予定はありません。</div>`;

    // stock table
    const stock = Object.values((this.state.plan||[]).reduce((a,p)=>{
      const k=p.itemNo||p.itemName; a[k] ||= {itemName:p.itemName,itemNo:p.itemNo,qtyDone:0,qtyShip:0};
      a[k].qtyDone += Number(p.qtyDone||0);
      a[k].qtyShip += Number(p.qtyShip||0);
      return a;
    },{}));
    document.getElementById('stockBody').innerHTML =
      stock.map(r=>`<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td><td class='t-right'>${r.qtyDone||0}</td><td class='t-right'>${r.qtyShip||0}</td><td class='t-right'><strong>${(r.qtyDone||0)-(r.qtyShip||0)}</strong></td></tr>`).join('');

    // sync buttons (admin only)
    const pull=document.getElementById('btnPull'); const push=document.getElementById('btnPush'); const auto=document.getElementById('autoSync');
    if(pull){ pull.onclick=()=>this.pullSheet(); }
    if(push){ push.onclick=()=>{ alert('デモ：送信はPLAN/SHIP追加時に自動送信'); }; }
    if(auto){ auto.onchange=()=>{ if(auto.checked){ this._timer=setInterval(()=>this.pullSheet(),30000);} else clearInterval(this._timer); }; }
  },

  /* ====== PLAN ====== */
  pagePlan(){
    this.guard(['管理者','生産管理部']);
    this._refreshPage=()=>this.pagePlan();
    const q = document.getElementById('q');
    const statusSel=document.getElementById('fltStatus');
    const procSel=document.getElementById('fltProcess');
    const sizeSel=document.getElementById('pageSize');
    const body=document.getElementById('planBody'); const pager=document.getElementById('planPager');

    const PROC = ['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程','外注'];

    procSel.innerHTML = `<option value="">(すべて)</option>` + PROC.map(x=>`<option>${x}</option>`).join('');

    let page=1, per=Number(sizeSel.value||this.CONFIG.PAGE_SIZE);
    const render=()=>{
      const kw=(q.value||'').toLowerCase(); const pr=procSel.value||''; const st=statusSel.value||'';
      const src = (this.state.plan||[]).filter(p=>{
        const hit = [p.customer,p.itemName,p.itemNo,p.prodNo].join(' ').toLowerCase().includes(kw);
        return (!kw||hit)&&(!pr||p.process===pr)&&(!st||p.status===st);
      });
      const pages=Math.max(1,Math.ceil(src.length/per)); if(page>pages) page=pages;
      const slice=src.slice((page-1)*per, page*per);
      body.innerHTML = slice.map((p,idx)=>`
        <tr>
          <td>${p.customer||''}</td><td>${p.prodNo||''}</td><td>${p.itemName||''}</td><td>${p.itemNo||''}</td>
          <td>${p.start||''}</td><td><span class="badge gray">${p.process||''}</span></td>
          <td>${p.location||''}</td><td>${p.status||''}</td><td class="text-muted" style="font-size:12px">${p.updated||''}</td>
        </tr>`).join('') || `<tr><td colspan="9" class="text-muted">データがありません。</td></tr>`;
      pager.innerHTML=''; pager.appendChild(this.buildPager(src.length,page,per,(p)=>{page=p; render();}));
    };
    [q,statusSel,procSel,sizeSel].forEach(el=> el.addEventListener('input',()=>{ per=Number(sizeSel.value||10); page=1; render(); }));
    document.getElementById('btnClearFilter').onclick=()=>{ q.value=''; procSel.value=''; statusSel.value=''; page=1; render(); };
    render();
  },

  /* ====== SHIP ====== */
  pageShip(){
    this.guard(['管理者','生産管理部']);
    this._refreshPage=()=>this.pageShip();
    const body=document.getElementById('shipBody'); const pager=document.getElementById('shipPager');
    const q=document.getElementById('sq'); const sizeSel=document.getElementById('sp');
    let page=1, per=Number(sizeSel.value||this.CONFIG.PAGE_SIZE);
    const render=()=>{
      const kw=(q.value||'').toLowerCase();
      const src=(this.state.ship||[]).filter(s=> [s.customer,s.itemName,s.itemNo,s.note].join(' ').toLowerCase().includes(kw));
      const pages=Math.max(1,Math.ceil(src.length/per)); if(page>pages) page=pages;
      const slice=src.slice((page-1)*per, page*per);
      body.innerHTML = slice.map(s=>`
        <tr><td>${s.date||''}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td>
        <td class="t-right">${s.qty||0}</td><td>${s.status||''}</td><td>${s.note||''}</td><td class="text-muted" style="font-size:12px">${s.updated||''}</td></tr>`).join('') || `<tr><td colspan="8" class="text-muted">データがありません。</td></tr>`;
      pager.innerHTML=''; pager.appendChild(this.buildPager(src.length,page,per,(p)=>{page=p; render();}));
    };
    [q,sizeSel].forEach(el=>el.addEventListener('input',()=>{ per=Number(sizeSel.value||10); page=1; render(); }));
    render();
  },

  /* ====== Ticket ====== */
  pageTicket(){
    this.guard(['管理者','生産管理部','製造部','検査部']);
    const prod=document.getElementById('ticketProdNo'); const ino=document.getElementById('ticketItemNo');
    const load=()=>{
      const p=(this.state.plan||[]).find(x=>(!prod.value||x.prodNo===prod.value)&&(!ino.value||x.itemNo===ino.value));
      if(!p){ alert('計画が見つかりません'); return; }
      ['tCustomer','tProdNo','tStart','tItemNo','tItemName','tUser'].forEach(id=>document.getElementById(id).textContent='');
      tCustomer.textContent=p.customer; tProdNo.textContent=p.prodNo; tStart.textContent=p.start; tItemNo.textContent=p.itemNo; tItemName.textContent=p.itemName; tUser.textContent=this.state.user||'';
      // QR
      const q=document.getElementById('tQR'); q.innerHTML=''; new QRCode(q,{text:`${p.prodNo}|${p.itemNo}`,width:96,height:96});
    };
    document.getElementById('btnLoadTicket').onclick=load;
    document.getElementById('btnPrint').onclick=()=>window.print();
  },

  /* ====== Scan ====== */
  pageScan(){
    this.guard(['管理者','生産管理部','製造部','検査部']);
    // manual input (selain kamera)
    document.getElementById('btnApplyScan').onclick=()=>{
      const txt=(document.getElementById('scanText').value||'').trim();
      if(!txt){ alert('QR/テキストを入力'); return; }
      const [prodNo,itemNo]=txt.split('|');
      const p=(this.state.plan||[]).find(x=>x.prodNo===prodNo&&x.itemNo===itemNo);
      if(!p){ alert('計画なし'); return; }
      p.process = document.getElementById('scanProcess').value;
      p.status  = document.getElementById('scanStatus').value;
      p.updated = this.stamp();
      this.pushPlan(p);
      alert('更新しました');
    };
  },

  /* ====== Confirm (出荷確認書) ====== */
  pageConfirm(){
    this.guard(['管理者','生産管理部','検査部']);
    const date=document.getElementById('cDate'); const cust=document.getElementById('cCust');
    const tbody=document.getElementById('confirmBody');
    const build=()=>{
      const src=(this.state.ship||[]).filter(s=>{
        const okDate = !date.value || s.date===date.value;
        const okCust = !cust.value || s.customer===cust.value;
        return okDate && okCust;
      });
      tbody.innerHTML= src.map((s,i)=>`
        <tr><td>${i+1}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td><td class="t-right">${s.qty||0}</td><td>${s.note||''}</td></tr>`).join('') || `<tr><td colspan="6" class="text-muted">作成してください。</td></tr>`;
    };
    document.getElementById('btnMake').onclick=build;
    document.getElementById('btnPrintConfirm').onclick=()=>window.print();
    document.getElementById('btnExportXlsx').onclick=()=>this.exportTableToCSV('confirm.csv','#confirmTable');
  },
  exportTableToCSV(filename, sel){
    const rows=[...document.querySelector(sel).querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.innerText.replace(/\n/g,' ').trim()));
    const csv=rows.map(r=>r.map(v=>(/,|"/.test(v)?`"${v.replace(/"/g,'""')}"`:v)).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  },

  /* ====== MASTER ====== */
  pageMaster(){
    this.guard(['管理者','生産管理部']);
    this._refreshPage=()=>this.pageMaster();
    const q=document.getElementById('mq'); const sizeSel=document.getElementById('mp');
    const body=document.getElementById('masterBody'); const pager=document.getElementById('masterPager');
    let data=this.state.master; if(!Array.isArray(data)||!data.length){ // seed from PLAN if sheet belum ada
      data = this.state.master = Array.from(new Map((this.state.plan||[]).map(p=>[`${p.customer}|${p.itemNo}`,{customer:p.customer||'',drawNo:p.itemNo||'',itemName:p.itemName||'',itemNo:p.itemNo||''}])).values());
    }
    let page=1, per=Number(sizeSel.value||10);
    const render=()=>{
      const kw=(q.value||'').toLowerCase();
      const src=(this.state.master||[]).filter(m=>([m.customer,m.drawNo,m.itemName,m.itemNo].join(' ').toLowerCase().includes(kw)));
      const pages=Math.max(1,Math.ceil(src.length/per)); if(page>pages) page=pages;
      const slice=src.slice((page-1)*per, page*per);
      body.innerHTML = slice.map((m,i)=>`
        <tr>
          <td>${m.customer||''}</td><td>${m.drawNo||''}</td><td>${m.itemName||''}</td><td>${m.itemNo||''}</td>
          <td class="t-right">
            <button class="btn ghost" data-ed="${m.itemNo}">編集</button>
            <button class="btn outline" style="margin-left:6px" data-del="${m.itemNo}">削除</button>
          </td>
        </tr>`).join('') || `<tr><td colspan="5" class="text-muted">データがありません。</td></tr>`;
      pager.innerHTML=''; pager.appendChild(this.buildPager(src.length,page,per,(p)=>{page=p; render();}));
      // bind
      body.querySelectorAll('[data-ed]').forEach(b=> b.onclick=()=> openForm(src.find(x=>x.itemNo===b.dataset.ed)) );
      body.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>{ if(confirm('削除しますか？')){ const idx=this.state.master.findIndex(x=>x.itemNo===b.dataset.del); if(idx>-1){ this.state.master.splice(idx,1); render(); } }});
    };
    const openForm=(row={customer:'',drawNo:'',itemName:'',itemNo:''})=>{
      const f=document.getElementById('masterForm'); f.classList.remove('hidden');
      f.querySelector('#mfCustomer').value=row.customer||''; f.querySelector('#mfDraw').value=row.drawNo||''; f.querySelector('#mfName').value=row.itemName||''; f.querySelector('#mfNo').value=row.itemNo||'';
      f.querySelector('#btnSaveMaster').onclick=()=>{
        const rec={customer:mfCustomer.value.trim(),drawNo:mfDraw.value.trim(),itemName:mfName.value.trim(),itemNo:mfNo.value.trim()};
        const i=this.state.master.findIndex(x=>x.itemNo===rec.itemNo);
        if(i>-1) this.state.master[i]=rec; else this.state.master.unshift(rec);
        f.classList.add('hidden'); render();
      };
      f.querySelector('#btnCancelMaster').onclick=()=> f.classList.add('hidden');
    };
    document.getElementById('btnAddMaster').onclick=()=>openForm();
    [q,sizeSel].forEach(el=> el.addEventListener('input',()=>{ per=Number(sizeSel.value||10); page=1; render(); }));
    render();
  }
};
</script>
