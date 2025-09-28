<script>
const App = {
  CONFIG:{
    GAS_URL:'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec',
    PAGE_SIZE:10
  },
  state:{ user:null, role:null, pic:null, token:null, plan:[], ship:[], master:[] },
  ROLES:['管理者','生産管理部','製造部','検査部'],
  PICS:{ '生産管理部':['田村','南部','瀬野'], '製造部':['A班','B班','C班'], '検査部':['佐藤','山田','加藤'] },

  initPage(page){
    this.mountHeader();
    this.restoreSession();
    this.applyRoleUI();
    this.attachBurger();
    this.bindEnterLogin();
    this.pullSheet(); // muat data awal
    if(page==='dashboard') this.pageDashboard();
    if(page==='plan') this.pagePlan();
    if(page==='ship') this.pageShip();
    if(page==='confirm') this.pageConfirm();
    if(page==='ticket') this.pageTicket();
    if(page==='scan') this.pageScan();
    if(page==='master') this.pageMaster();
    if(page==='charts') this.pageCharts();
  },

  /* ===== Header + Login ===== */
  mountHeader(){
    const bar = document.getElementById('loginBar');
    const render=()=>{
      bar.innerHTML='';
      if(this.state.user){
        const d=document.createElement('div'); d.className='login-chip';
        d.innerHTML=`<span class="badge gray">${this.state.role||'-'}</span><strong>${this.state.user}${this.state.pic?('・'+this.state.pic):''}</strong><button id="btnLogout" class="btn outline">ログアウト</button>`;
        bar.appendChild(d);
        document.getElementById('btnLogout').onclick=()=>this.logout();
      }else{
        const r=document.createElement('div'); r.className='row wrap';
        r.innerHTML=`
          <input id="u" class="input" placeholder="ユーザー" style="max-width:220px">
          <input id="p" class="input" type="password" placeholder="パスワード" style="max-width:220px">
          <select id="r" class="input" style="max-width:180px">${this.ROLES.map(x=>`<option>${x}</option>`).join('')}</select>
          <select id="pic" class="input" style="max-width:180px"></select>
          <button id="btnLogin" class="btn icon">🔒 ログイン</button>`;
        bar.appendChild(r);
        const roleSel=r.querySelector('#r'), picSel=r.querySelector('#pic');
        const ref=()=>{ picSel.innerHTML=(this.PICS[roleSel.value]||[]).map(n=>`<option>${n}</option>`).join(''); }; roleSel.onchange=ref; ref();
        r.querySelector('#btnLogin').onclick=()=>this.login(u.value.trim(),p.value,roleSel.value,picSel.value);
      }
    };
    this._renderLogin=render; render();
  },
  bindEnterLogin(){
    document.addEventListener('keydown',(e)=>{ if(e.key==='Enter' && !this.state.user){ const b=document.getElementById('btnLogin'); if(b) b.click(); }});
  },
  restoreSession(){
    try{ const s=JSON.parse(localStorage.getItem('erp-session')||'{}'); if(s.user){ this.state={...this.state,...s}; this._renderLogin?.(); }}catch{}
  },
  persist(){ localStorage.setItem('erp-session', JSON.stringify({user:this.state.user,role:this.state.role,pic:this.state.pic,token:this.state.token})); },
  logout(){ this.state.user=null; this.state.role=null; this.state.pic=null; this.state.token=null; this.persist(); this._renderLogin?.(); this.applyRoleUI(); },

  /* ===== Role Guard ===== */
  guard(allow){ if(!this.state.user){ alert('ログインしてください'); location.href='index.html'; return false; } if(allow && !allow.includes(this.state.role)){ alert('権限がありません'); location.href='index.html'; return false; } return true; },
  applyRoleUI(){ document.querySelectorAll('.sync-section').forEach(el=> (this.state.role==='管理者')?el.classList.remove('hidden'):el.classList.add('hidden')); },

  /* ===== Nav / Burger ===== */
  attachBurger(){ const btn=document.getElementById('burgerBtn'); const nav=document.getElementById('mainNav'); if(!btn||!nav) return; btn.onclick=()=>nav.classList.toggle('show'); nav.querySelectorAll('a')?.forEach(a=>a.addEventListener('click',()=>nav.classList.remove('show'))); },

  /* ===== GAS ===== */
  async login(user,pass,role,pic){
    if(!user||!pass) return alert('ユーザー/パスを入力');
    try{
      const url=this.CONFIG.GAS_URL+`?action=login&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
      const r=await fetch(url,{cache:'no-store'}); const j=await r.json();
      if(!j.ok) return alert('ログイン失敗: '+(j.error||''));
      this.state.user=user; this.state.role=role||'生産管理部'; this.state.pic=pic||''; this.state.token=j.token||'';
      this.persist(); this._renderLogin?.(); this.applyRoleUI(); await this.pullSheet();
    }catch{ alert('サーバー通信エラー'); }
  },
  async pullSheet(){
    try{ const r=await fetch(this.CONFIG.GAS_URL,{cache:'no-store'}); const j=await r.json(); this.state.plan=j.plan||[]; this.state.ship=j.ship||[]; this._refreshPage?.(); }catch{}
  },
  async pushPlanRow(rec){ try{ await fetch(this.CONFIG.GAS_URL,{method:'POST',body:JSON.stringify(rec)});}catch{} },
  stamp(){ return new Date().toLocaleString(); },
  today(){ return new Date().toISOString().slice(0,10); },

  /* ===== Dashboard ===== */
  pageDashboard(){
    this.guard(null); this._refreshPage=()=>this.pageDashboard();
    const nowDiv=document.getElementById('nowList'); const list=(this.state.plan||[]).slice(0,8);
    nowDiv.innerHTML=list.map(p=>`
      <div class="row wrap" style="justify-content:space-between;border:1px solid var(--ring);border-radius:12px;padding:10px">
        <div><div><strong>${p.itemName||'-'}</strong> <span class="text-muted">(${p.itemNo||''})</span></div>
        <div class="text-muted" style="font-size:12px">得意先:${p.customer||'-'} ・ 製造番号:${p.prodNo||'-'} ・ 開始:${p.start||'-'}</div></div>
        <div class="t-right" style="min-width:140px"><div class="badge gray">${p.process||'-'} / ${p.status||'-'}</div><div class="text-muted" style="font-size:12px">${p.updated||''}</div></div>
      </div>`).join('') || `<div class='text-muted'>データがありません。</div>`;

    // chart
    if(window.Chart){
      const labels=['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程','外注'];
      const cnt=labels.map(proc=>(this.state.plan||[]).filter(p=>p.process===proc).length);
      const ctx=document.getElementById('byProcessChart').getContext('2d'); if(window._cProc) window._cProc.destroy();
      window._cProc=new Chart(ctx,{type:'bar',data:{labels,datasets:[{data:cnt}]},options:{plugins:{legend:{display:false}}}});
    }

    // ship today
    const t=this.today(); const todayList=(this.state.ship||[]).filter(s=>s.date===t);
    document.getElementById('shipToday').innerHTML=todayList.map(s=>`
      <div class="row wrap" style="justify-content:space-between;border:1px solid var(--ring);border-radius:12px;padding:10px">
        <div><strong>${s.itemName||''}</strong><div class="text-muted" style="font-size:12px">${s.customer||''} ・ 数量:${s.qty||0}</div></div>
        <div class="t-right"><span class="badge green">${s.status||''}</span><div class="text-muted" style="font-size:12px">${s.updated||''}</div></div>
      </div>`).join('') || `<div class="text-muted">本日の出荷予定はありません。</div>`;

    // stock
    const stock=Object.values((this.state.plan||[]).reduce((a,p)=>{const k=p.itemNo||p.itemName; a[k]??={itemName:p.itemName,itemNo:p.itemNo,done:0,ship:0}; a[k].done+=Number(p.qtyDone||0); a[k].ship+=Number(p.qtyShip||0); return a; },{}));
    document.getElementById('stockBody').innerHTML=stock.map(r=>`<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td><td class="t-right">${r.done||0}</td><td class="t-right">${r.ship||0}</td><td class="t-right"><strong>${(r.done||0)-(r.ship||0)}</strong></td></tr>`).join('');
  },

  /* ===== PLAN (CRUD + paging + search) ===== */
  pagePlan(){
    this.guard(['管理者','生産管理部']); this._refreshPage=()=>this.pagePlan();
    const PROC=['レーザ工程','曲げ工程','外枠組立工程','シャッター溶接工程','コーキング工程','外枠塗装工程','組立工程','検査工程','外注'];
    const q=$('#q'), procSel=$('#fltProcess'), stSel=$('#fltStatus'), perSel=$('#pageSize'), body=$('#planBody'), pager=$('#planPager');
    const fillProc=()=>{ procSel.innerHTML=`<option value="">(すべて)</option>`+PROC.map(x=>`<option>${x}</option>`).join(''); }; fillProc();
    let page=1, per=Number(perSel.value||this.CONFIG.PAGE_SIZE);

    const filtered=()=>{
      const kw=(q.value||'').toLowerCase(); const pr=procSel.value||''; const st=stSel.value||'';
      return (this.state.plan||[]).filter(p=>{
        const hit=[p.customer,p.itemName,p.itemNo,p.prodNo].join(' ').toLowerCase().includes(kw);
        return (!kw||hit)&&(!pr||p.process===pr)&&(!st||p.status===st);
      });
    };
    const render=()=>{
      const src=filtered(); const pages=Math.max(1,Math.ceil(src.length/per)); if(page>pages) page=pages;
      const list=src.slice((page-1)*per,page*per);
      body.innerHTML=list.map(p=>`
      <tr>
        <td>${p.customer||''}</td><td>${p.prodNo||''}</td><td>${p.itemName||''}</td><td>${p.itemNo||''}</td>
        <td>${p.start||''}</td><td><span class="badge gray">${p.process||''}</span></td>
        <td>${p.location||''}</td><td>${p.status||''}</td><td class="text-muted" style="font-size:12px">${p.updated||''}</td>
        <td class="t-right">
          <button class="btn ghost" data-ed="${p.prodNo}|${p.itemNo}">編集</button>
          <button class="btn outline" data-del="${p.prodNo}|${p.itemNo}">削除</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="10" class="text-muted">データがありません。</td></tr>`;
      pager.innerHTML=''; pager.appendChild(this.buildPager(src.length,page,per,(p)=>{page=p; render();}));
      // bind row actions
      body.querySelectorAll('[data-ed]').forEach(b=> b.onclick=()=>{ const [pn,inno]=b.dataset.ed.split('|'); const rec=(this.state.plan||[]).find(x=>x.prodNo===pn&&x.itemNo===inno); openPlanModal(rec); });
      body.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>{ if(!confirm('削除しますか？'))return; const [pn,inno]=b.dataset.del.split('|'); const i=this.state.plan.findIndex(x=>x.prodNo===pn&&x.itemNo===inno); if(i>-1){ this.state.plan.splice(i,1); render(); } });
    };
    ['input','change'].forEach(ev=>{ q.addEventListener(ev,()=>{page=1;render();}); procSel.addEventListener(ev,()=>{page=1;render();}); stSel.addEventListener(ev,()=>{page=1;render();}); perSel.addEventListener(ev,()=>{ per=Number(perSel.value||10); page=1; render();}); });
    $('#btnClearFilter').onclick=()=>{ q.value=''; procSel.value=''; stSel.value=''; page=1; render(); };
    $('#btnAddPlan').onclick=()=>openPlanModal();

    const openPlanModal=(rec=null)=>{
      const m=$('#planModal'); m.classList.remove('hidden');
      const isEdit=!!rec;
      $('#pmTitle').textContent = isEdit?'生産計画：編集':'生産計画：新規作成';
      $('#fCustomer').value=rec?.customer||''; $('#fProdNo').value=rec?.prodNo||''; $('#fItemName').value=rec?.itemName||''; $('#fItemNo').value=rec?.itemNo||''; $('#fStart').value=rec?.start||this.today();
      $('#fProcess').innerHTML=PROC.map(x=>`<option>${x}</option>`).join(''); $('#fProcess').value=rec?.process||PROC[0];
      $('#fLocation').value=rec?.location||'PPIC'; $('#fStatus').value=rec?.status||'計画';
      $('#btnPlanSave').onclick=()=>{
        const obj={ customer:val('#fCustomer'), prodNo:val('#fProdNo'), itemName:val('#fItemName'), itemNo:val('#fItemNo'),
          start:val('#fStart'), process:val('#fProcess'), location:val('#fLocation'), status:val('#fStatus'),
          updated:this.stamp(), qtyDone:Number(rec?.qtyDone||0), qtyShip:Number(rec?.qtyShip||0), user:this.state.user };
        if(isEdit){ const i=this.state.plan.findIndex(x=>x.prodNo===rec.prodNo&&x.itemNo===rec.itemNo); if(i>-1) this.state.plan[i]=obj; }
        else{ this.state.plan.unshift(obj); }
        this.pushPlanRow(obj); m.classList.add('hidden'); render();
      };
      $('#pmClose').onclick=()=> m.classList.add('hidden');
    };

    render();
  },

  /* ===== SHIP ===== */
  pageShip(){
    this.guard(['管理者','生産管理部']); this._refreshPage=()=>this.pageShip();
    const q=$('#sq'), perSel=$('#sp'), body=$('#shipBody'), pager=$('#shipPager'); let page=1, per=Number(perSel.value||this.CONFIG.PAGE_SIZE);
    const render=()=>{
      const kw=(q.value||'').toLowerCase();
      const src=(this.state.ship||[]).filter(s=>[s.customer,s.itemName,s.itemNo,s.note].join(' ').toLowerCase().includes(kw));
      const pages=Math.max(1,Math.ceil(src.length/per)); if(page>pages) page=pages;
      const list=src.slice((page-1)*per,page*per);
      body.innerHTML=list.map(s=>`<tr><td>${s.date||''}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td><td class="t-right">${s.qty||0}</td><td>${s.status||''}</td><td>${s.note||''}</td><td class="text-muted" style="font-size:12px">${s.updated||''}</td></tr>`).join('') || `<tr><td colspan="8" class="text-muted">データがありません。</td></tr>`;
      pager.innerHTML=''; pager.appendChild(this.buildPager(src.length,page,per,(p)=>{page=p; render();}));
    };
    ['input','change'].forEach(ev=>{ q.addEventListener(ev,()=>{page=1;render();}); perSel.addEventListener(ev,()=>{ per=Number(perSel.value||10); page=1; render(); });});
    render();
  },

  /* ===== Confirm ===== */
  pageConfirm(){
    this.guard(['管理者','生産管理部','検査部']);
    const date=$('#cDate'), cust=$('#cCust'), body=$('#confirmBody');
    const build=()=>{
      const src=(this.state.ship||[]).filter(s=> (!date.value || s.date===date.value) && (!cust.value || s.customer===cust.value) );
      body.innerHTML=src.map((s,i)=>`<tr><td>${i+1}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td><td class="t-right">${s.qty||0}</td><td>${s.note||''}</td></tr>`).join('') || `<tr><td colspan="6" class="text-muted">作成してください。</td></tr>`;
    };
    $('#btnMake').onclick=build;
    $('#btnPrintConfirm').onclick=()=>window.print();
    $('#btnExportXlsx').onclick=()=> this.exportTableToCSV('出荷確認書.csv','#confirmTable');
  },
  exportTableToCSV(filename, sel){
    const rows=[...document.querySelector(sel).querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.innerText.replace(/\n/g,' ').trim()));
    const csv=rows.map(r=>r.map(v=>(/,|"/.test(v)?`"${v.replace(/"/g,'""')}"`:v)).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  },

  /* ===== Ticket ===== */
  pageTicket(){
    this.guard(['管理者','生産管理部','製造部','検査部']);
    const load=()=>{
      const prod=val('#ticketProdNo').trim(); const ino=val('#ticketItemNo').trim();
      const p=(this.state.plan||[]).find(x=>(!prod||x.prodNo===prod)&&(!ino||x.itemNo===ino));
      if(!p) return alert('計画が見つかりません');
      setText('tCustomer',p.customer); setText('tProdNo',p.prodNo); setText('tStart',p.start); setText('tItemNo',p.itemNo); setText('tItemName',p.itemName); setText('tUser',this.state.user||'');
      const q=$('#tQR'); q.innerHTML=''; new QRCode(q,{text:`${p.prodNo}|${p.itemNo}`,width:96,height:96});
    };
    $('#btnLoadTicket').onclick=load;
    $('#btnPrint').onclick=()=>window.print();
  },

  /* ===== Scan ===== */
  pageScan(){
    this.guard(['管理者','生産管理部','製造部','検査部']);
    $('#btnApplyScan').onclick=()=>{
      const txt=val('#scanText').trim(); if(!txt) return alert('QR/テキストを入力');
      const [prodNo,itemNo]=txt.split('|'); const p=(this.state.plan||[]).find(x=>x.prodNo===prodNo&&x.itemNo===itemNo);
      if(!p) return alert('計画なし');
      p.process = val('#scanProcess'); p.status = val('#scanStatus'); p.updated = this.stamp();
      this.pushPlanRow({...p,user:this.state.user}); alert('更新しました');
    };
  },

  /* ===== Charts ===== */
  pageCharts(){
    this.guard(['管理者','生産管理部','製造部','検査部']); this._refreshPage=()=>this.pageCharts();
    const plan=this.state.plan||[], ship=this.state.ship||[];
    // Stock
    const agg = {}; plan.forEach(p=>{ const k=p.itemNo||p.itemName||'?'; agg[k]??={name:p.itemName||k, done:0, ship:0}; agg[k].done+=Number(p.qtyDone||0); agg[k].ship+=Number(p.qtyShip||0); });
    const stock=Object.values(agg).map(o=>({name:o.name,val:o.done-o.ship})).filter(o=>o.val>0).sort((a,b)=>b.val-a.val).slice(0,12);
    if(window.Chart){
      const c1=$('#chartStock')?.getContext?.('2d'); if(c1){ if(window._c1) _c1.destroy(); window._c1=new Chart(c1,{type:'bar',data:{labels:stock.map(x=>x.name),datasets:[{data:stock.map(x=>x.val)}]},options:{plugins:{legend:{display:false}}}}); }
      // NG pie
      const ngBy={}; plan.filter(p=>String(p.status||'')==='不良').forEach(p=> ngBy[p.process||'工程未設定']=(ngBy[p.process||'工程未設定']||0)+1 );
      const c2=$('#chartNG')?.getContext?.('2d'); if(c2){ if(window._c2) _c2.destroy(); window._c2=new Chart(c2,{type:'pie',data:{labels:Object.keys(ngBy),datasets:[{data:Object.values(ngBy)}]}}); }
      // Pareto (last month in data)
      const byMC={}; ship.forEach(s=>{ const m=(s.date||'').slice(0,7); if(!m) return; byMC[m]??={}; byMC[m][s.customer||'N/A']=(byMC[m][s.customer||'N/A']||0)+Number(s.qty||0); });
      const months=Object.keys(byMC).sort(); const latest=months.at(-1)||''; const pairs=Object.entries(byMC[latest]||{}).sort((a,b)=>b[1]-a[1]); let cum=0,total=pairs.reduce((t,[_c,v])=>t+v,0)||1; const cumPct=pairs.map(([c,v])=>{ cum+=v; return Math.round(100*cum/total); });
      const c3=$('#chartPareto')?.getContext?.('2d'); if(c3){ if(window._c3) _c3.destroy(); window._c3=new Chart(c3,{data:{labels:pairs.map(p=>p[0]),datasets:[{type:'bar',label:'数量',data:pairs.map(p=>p[1]),yAxisID:'y'},{type:'line',label:'累積(%)',data:cumPct,yAxisID:'y1'}]},options:{scales:{y:{beginAtZero:true},y1:{beginAtZero:true,max:100,position:'right'}},plugins:{title:{display:true,text:latest||'-'}}}); }
      // Year pie
      const years=Array.from(new Set(ship.map(s=>(s.date||'').slice(0,4)).filter(Boolean))).sort();
      const sel=$('#yearSel'); if(sel){ sel.innerHTML=years.map(y=>`<option>${y}</option>`).join(''); const draw=(y)=>{ const map={}; ship.filter(s=>(s.date||'').startsWith(y)).forEach(s=> map[s.customer||'N/A']=(map[s.customer||'N/A']||0)+Number(s.qty||0) ); const pr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12); const ctx=$('#chartYearPie').getContext('2d'); if(window._c4) _c4.destroy(); window._c4=new Chart(ctx,{type:'pie',data:{labels:pr.map(x=>x[0]),datasets:[{data:pr.map(x=>x[1])}]},options:{plugins:{title:{display:true,text:y}}}); }; if(years.length){ sel.value=years.at(-1); draw(sel.value);} sel.onchange=()=>draw(sel.value); }
    }
  },

  /* ===== Master (simple, tetap ada) ===== */
  pageMaster(){
    this.guard(['管理者','生産管理部']);
    // … (boleh tetap seperti versi sebelumnya; fokus perbaikan ada di Plan/Logout/Charts/Scan)
  },

  /* ===== Helpers ===== */
  buildPager(total, page, per, onJump){
    const pages = Math.max(1, Math.ceil(total/per));
    const wrap=document.createElement('div'); wrap.className='pager';
    const mk=(t,p)=>{ const b=document.createElement('button'); b.textContent=t; if(p===page) b.classList.add('on'); b.onclick=()=>onJump(p); wrap.appendChild(b); };
    mk('«',1); mk('‹',Math.max(1,page-1)); for(let i=Math.max(1,page-2); i<=Math.min(pages,page+2); i++) mk(String(i),i); mk('›',Math.min(pages,page+1)); mk('»',pages);
    const info=document.createElement('span'); info.className='text-muted'; info.style.marginLeft='8px'; info.textContent=`${total}件`; wrap.appendChild(info);
    return wrap;
  }
};

/* small DOM helpers */
function $(sel){ return document.querySelector(sel); }
function val(sel){ const el=$(sel); return el?el.value:''; }
function setText(id,txt){ const el=document.getElementById(id); if(el) el.textContent=txt; }
</script>
