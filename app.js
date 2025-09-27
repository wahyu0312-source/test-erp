/* =========================================================
   TSH Mini ERP • Frontend (MASTER CRUD + 外注)
   Design by Wahyu
   ========================================================= */
const SHEET_BASE = 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec';

const SHEET_ENDPOINT = {
  LOGIN: (u,p)=> `${SHEET_BASE}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`,
  PLAN_GET:  `${SHEET_BASE}`,
  SHIP_GET:  `${SHEET_BASE}`,
  PLAN_POST: `${SHEET_BASE}`,
  SHIP_POST: `${SHEET_BASE}`,
  MASTER_GET:`${SHEET_BASE}?action=master`,
  MASTER_POST:`${SHEET_BASE}?action=masterAdd`,
  MASTER_UPSERT:(id)=> `${SHEET_BASE}?action=masterUpsert&id=${encodeURIComponent(id)}`,
  MASTER_DELETE:(id)=> `${SHEET_BASE}?action=masterDelete&id=${encodeURIComponent(id)}`
};

const App = {
  state:{
    user: localStorage.getItem('erp_user') || '',
    role: localStorage.getItem('erp_role') || '',
    plan: JSON.parse(localStorage.getItem('erp_plan')||'[]'),
    ship: JSON.parse(localStorage.getItem('erp_ship')||'[]'),
    master: JSON.parse(localStorage.getItem('erp_master')||'[]') // [{id,customer,itemNo,itemName,note}]
  },
  PROCESS_LIST:[
    'レーザ工程','曲げ工程','外枠組立工程','シャッター組立工程','シャッター溶接工程',
    'コーキング工程','外枠塗装工程','組立工程','検査工程','外注'
  ],
  today(){ return new Date().toISOString().slice(0,10); },
  stamp(){ return new Date().toLocaleString('ja-JP'); },
  save(){ localStorage.setItem('erp_plan',JSON.stringify(this.state.plan));
          localStorage.setItem('erp_ship',JSON.stringify(this.state.ship));
          localStorage.setItem('erp_master',JSON.stringify(this.state.master)); },

  /* ---------- Navbar / Burger / Logout ---------- */
  initNavbar(){
    const $=sel=>document.querySelector(sel), $$=sel=>[...document.querySelectorAll(sel)];
    const btn = $('#btnBurger'), menu=$('#mobileMenu'), veil=$('#navOverlay'), close=$('#btnCloseMenu');
    const open=()=>{menu?.classList.remove('hidden'); veil?.classList.remove('hidden'); btn?.setAttribute('aria-expanded','true'); document.documentElement.classList.add('overflow-hidden');}
    const shut=()=>{menu?.classList.add('hidden'); veil?.classList.add('hidden'); btn?.setAttribute('aria-expanded','false'); document.documentElement.classList.remove('overflow-hidden');}
    ['click','touchstart'].forEach(evt=>{
      btn?.addEventListener(evt,(e)=>{e.preventDefault(); (menu?.classList.contains('hidden')?open:shut)();},{passive:false});
      veil?.addEventListener(evt,(e)=>{e.preventDefault(); shut();},{passive:false});
      close?.addEventListener(evt,(e)=>{e.preventDefault(); shut();},{passive:false});
    });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') shut();});
    $$('#mobileMenu [data-menu-link]').forEach(a=> a.addEventListener('click',shut));
    // active link
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    $$('.navlink,[data-menu-link]').forEach(a=>{
      if((a.getAttribute('href')||'').toLowerCase()===path) a.classList.add('active');
    });
    // logout
    const doLogout=()=>{ localStorage.removeItem('erp_user'); localStorage.removeItem('erp_role'); this.state.user=''; this.state.role=''; location.href='index.html'; };
    $('#btnLogout')?.addEventListener('click',doLogout);
    $('#btnLogoutMobile')?.addEventListener('click',doLogout);
    const bar = document.getElementById('loginBar');
    if(bar){ bar.innerHTML = this.state.user ? `ログイン中：<b>${this.state.user}</b>（${this.state.role||'-'}）` : `未ログイン`; }
  },
  useIcons(){ if(window.lucide){ lucide.createIcons({attrs:{'stroke-width':1.8,width:18,height:18}}); } },

  /* ---------- Login ---------- */
  attachLoginInline(){
    const form=document.getElementById('loginForm'); if(!form) return;
    const u=form.querySelector('#loginUser'), p=form.querySelector('#loginPass'), btn=form.querySelector('[data-login-btn]');
    const status=form.querySelector('#loginStatus');
    const go= async ()=>{
      status.textContent='ログイン中…'; btn.disabled=true;
      try{
        const url=SHEET_ENDPOINT.LOGIN(u.value.trim(), p.value.trim());
        const res=await fetch(url,{cache:'no-store'}); const j=await res.json();
        if(j.ok){
          this.state.user=j.user||u.value.trim(); this.state.role=j.role||'';
          localStorage.setItem('erp_user',this.state.user); localStorage.setItem('erp_role',this.state.role);
          status.textContent='成功。データ同期中…';
          await this.pullSheet(); location.reload();
        }else{ status.textContent= 'エラー：' + (j.error||'LOGIN_FAILED'); }
      }catch(e){ status.textContent='ネットワークエラー'; } finally { btn.disabled=false; }
    };
    btn?.addEventListener('click', go);
    form.addEventListener('keydown', (e)=>{ if(e.key==='Enter') go(); });
  },

  /* ---------- Sheets Sync ---------- */
  async pullSheet(){
    try{
      const [data, mres] = await Promise.all([
        fetch(SHEET_ENDPOINT.PLAN_GET,{cache:'no-store'}),
        fetch(SHEET_ENDPOINT.MASTER_GET,{cache:'no-store'})
      ]);
      const j=await data.json();
      const jm=await mres.json();
      this.state.plan = Array.isArray(j.plan)? j.plan : this.state.plan;
      this.state.ship = Array.isArray(j.ship)? j.ship : this.state.ship;
      this.state.master = (jm && jm.ok && Array.isArray(jm.master)) ? jm.master : this.state.master;
      this.save();
    }catch(e){ console.warn('Pull error',e); }
  },
  async pushPlan(p){
    const body={ '得意先':p.customer||'','製造番号':p.prodNo||'','品名':p.itemName||'','品番':p.itemNo||'','開始':p.start||'','プロセス':p.process||'','場所':p.location||'','ステータス':p.status||'','更新':p.updated||this.stamp(),'完成数量':Number(p.qtyDone||0)||0,'出荷数量':Number(p.qtyShip||0)||0,'ユザー':this.state.user||'' };
    await fetch(SHEET_ENDPOINT.PLAN_POST,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  },
  async pushShip(s){
    const body={ '日付':s.date||'','得意先':s.customer||'','品名':s.itemName||'','品番':s.itemNo||'','数量':Number(s.qty||0)||0,'ステータス':s.status||'','備考':s.note||'','更新':s.updated||this.stamp(),'ユザー':this.state.user||'' };
    await fetch(SHEET_ENDPOINT.SHIP_POST,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  },
  async addMaster(row){
    const body={ '得意先':row.customer||'','図番':row.itemNo||'','品名':row.itemName||'','備考':row.note||'' };
    await fetch(SHEET_ENDPOINT.MASTER_POST,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  },
  async upsertMaster(id,row){
    const body={ id, '得意先':row.customer||'','図番':row.itemNo||'','品名':row.itemName||'','備考':row.note||'' };
    await fetch(SHEET_ENDPOINT.MASTER_UPSERT(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  },
  async deleteMaster(id){
    await fetch(SHEET_ENDPOINT.MASTER_DELETE(id),{method:'POST'});
  },
  async pushAll(){
    try{
      for(const p of this.state.plan) await this.pushPlan(p);
      for(const s of this.state.ship) await this.pushShip(s);
      alert('シートへ送信完了');
    }catch{ alert('送信エラー'); }
  },

  /* ---------- Dashboard ---------- */
  pageDashboard(){
    const byId=id=>document.getElementById(id);
    const nowList=this.state.plan.slice(0,8).map(p=>`
      <div class="flex items-center justify-between border rounded-xl px-3 py-2">
        <div>
          <div class="font-medium">${p.itemName||'-'} <span class="text-sm text-slate-500">(${p.itemNo||''})</span></div>
          <div class="text-sm text-slate-500">${p.customer||'-'}・${p.prodNo||'-'}・開始 ${p.start||'-'}</div>
        </div>
        <div class="text-right">
          <span class="badge"><i data-lucide="factory"></i>${p.process||'-'} / ${p.status||'-'}</span>
          <div class="text-xs text-slate-500">${p.updated||''}</div>
        </div>
      </div>`).join('') || `<div class="text-sm text-slate-500">データがありません。</div>`;
    byId('nowList') && (byId('nowList').innerHTML=nowList);

    const t=this.today();
    const list= this.state.ship.filter(s=>s.date===t).map(s=>`
      <div class="flex items-center justify-between border rounded-xl px-3 py-2">
        <div><div class="font-medium">${s.itemName||''}</div>
        <div class="text-sm text-slate-500">${s.customer||''}・数量 ${s.qty||0}</div></div>
        <div class="text-right"><span class="badge"><i data-lucide="truck"></i>${s.status||''}</span>
        <div class="text-xs text-slate-500">${s.updated||''}</div></div>
      </div>`).join('') || `<div class="text-sm text-slate-500">本日の出荷予定はありません。</div>`;
    byId('shipToday') && (byId('shipToday').innerHTML=list);

    const stock=Object.values(this.state.plan.reduce((a,p)=>{
      const k=p.itemNo||p.itemName; a[k] ||= {itemName:p.itemName,itemNo:p.itemNo,done:0,ship:0};
      a[k].done+=Number(p.qtyDone||0);
      a[k].ship=this.state.ship.filter(s=>s.itemNo===p.itemNo && s.status==='出荷済').reduce((x,y)=>x+Number(y.qty||0),0);
      return a;
    },{}));
    const rows=stock.map(r=>`<tr><td>${r.itemName||'-'}</td><td>${r.itemNo||'-'}</td><td class="text-right">${r.done||0}</td><td class="text-right">${r.ship||0}</td><td class="text-right"><b>${(r.done||0)-(r.ship||0)}</b></td></tr>`).join('');
    const tb=byId('stockBody'); if(tb) tb.innerHTML=rows;

    try{
      const ctx=document.getElementById('byProcessChart')?.getContext('2d');
      if(ctx){
        const labels=this.PROCESS_LIST;
        const data=labels.map(p=> this.state.plan.filter(x=>x.process===p).length );
        new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'件数',data}]},options:{plugins:{legend:{display:false}},responsive:true}});
      }
    }catch{}

    document.getElementById('btnPull')?.addEventListener('click',()=>this.pullSheet().then(()=>location.reload()));
    document.getElementById('btnPush')?.addEventListener('click',()=>this.pushAll());
    this.attachLoginInline(); this.useIcons();
  },

  /* ---------- PLAN (pakai MASTER untuk dropdown) ---------- */
  _bindPlanModal(p={}, idx=null){
    const $=id=>document.getElementById(id);
    const uniqueCustomers=[...new Set(this.state.master.map(m=>m.customer).filter(Boolean))];
    $('fCustomer').innerHTML = `<option value="">選択</option>` + uniqueCustomers.map(c=>`<option>${c}</option>`).join('');
    const fillItems = ()=>{
      const c=$('fCustomer').value||'';
      const items=this.state.master.filter(m=>!c || m.customer===c);
      $('fItemNo').innerHTML = `<option value="">選択</option>` + items.map(m=>`<option value="${m.itemNo}">${m.itemNo}</option>`).join('');
    };
    $('fCustomer').onchange = ()=>{ fillItems(); $('fItemName').value=''; };
    $('fItemNo').onchange = ()=>{
      const c=$('fCustomer').value||''; const no=$('fItemNo').value||'';
      const hit=this.state.master.find(m=>m.customer===c && m.itemNo===no);
      $('fItemName').value = hit ? hit.itemName : '';
    };

    $('fCustomer').value=p.customer||''; fillItems();
    if(p.itemNo) $('fItemNo').value=p.itemNo;
    $('fItemName').value=p.itemName||'';
    $('fProdNo').value=p.prodNo||'';
    $('fStart').value=p.start||this.today();
    $('fLocation').value=p.location||'PPIC';
    $('fStatus').value=p.status||'計画';
    $('fProcess').innerHTML=this.PROCESS_LIST.map(x=>`<option>${x}</option>`).join('');
    $('fProcess').value=p.process||this.PROCESS_LIST[0];

    $('planModalTitle').textContent = (idx==null)?'生産計画：追加':'生産計画：編集';
    $('planModal').classList.remove('hidden');
    $('planModalClose').onclick=()=> $('planModal').classList.add('hidden');
    $('btnPlanSave').onclick = async ()=>{
      const rec={
        customer:$('fCustomer').value.trim(),
        prodNo:$('fProdNo').value.trim(),
        itemName:$('fItemName').value.trim(),
        itemNo:$('fItemNo').value.trim(),
        start:$('fStart').value,
        process:$('fProcess').value,
        location:$('fLocation').value.trim()||'PPIC',
        status:$('fStatus').value,
        updated:this.stamp(), qtyDone:p.qtyDone||0, qtyShip:p.qtyShip||0
      };
      if(idx==null){ this.state.plan.unshift(rec); } else { this.state.plan[idx]={...this.state.plan[idx],...rec}; }
      this.save(); await this.pushPlan(rec);
      $('planModal').classList.add('hidden'); this.pagePlan();
    };
  },
  pagePlan(){
    const $=id=>document.getElementById(id);
    const fill=()=>{ const sel=$('fltProcess'); if(sel) sel.innerHTML = `<option value="">工程（全て）</option>` + this.PROCESS_LIST.map(x=>`<option>${x}</option>`).join(''); }
    fill();
    const filtered=()=>{
      const q=($('q')?.value||'').toLowerCase(), pr=$('fltProcess')?.value||'', st=$('fltStatus')?.value||'';
      return this.state.plan.filter(p=>{
        const hit=(p.itemName||'').toLowerCase().includes(q)||(p.itemNo||'').toLowerCase().includes(q)||(p.customer||'').toLowerCase().includes(q)||(p.prodNo||'').toLowerCase().includes(q);
        return (!q||hit)&&(!pr||p.process===pr)&&(!st||p.status===st);
      });
    };
    const render=()=>{
      const body=$('planBody'); if(!body) return;
      body.innerHTML = filtered().map((p)=>`<tr>
        <td>${p.customer||''}</td><td>${p.prodNo||''}</td><td>${p.itemName||''}</td><td>${p.itemNo||''}</td><td>${p.start||''}</td>
        <td>${p.process||''}</td><td>${p.location||''}</td><td>${p.status||''}</td><td class="text-sm">${p.updated||''}</td>
        <td>
          <button class="btn-outline" onclick="App._editPlan(${this.state.plan.indexOf(p)})"><i data-lucide='edit-3'></i>編集</button>
          <a class="btn-outline" href="ticket.html?prodNo=${encodeURIComponent(p.prodNo)}&itemNo=${encodeURIComponent(p.itemNo)}"><i data-lucide='ticket'></i>票</a>
          <button class="btn-outline" onclick="App._delPlan(${this.state.plan.indexOf(p)})"><i data-lucide='trash-2'></i>削除</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="10" class="text-sm text-slate-500">データがありません。</td></tr>`;
      this.useIcons();
    };
    ['q','fltProcess','fltStatus'].forEach(id=> $(id)?.addEventListener('input',render));
    $('btnClearFilter')?.addEventListener('click',()=>{ ['q','fltProcess','fltStatus'].forEach(id=>{ const el=$(id); if(el) el.value=''; }); render(); });
    $('btnAddPlan')?.addEventListener('click',()=> this._bindPlanModal({}));
    render();
    document.getElementById('btnPull')?.addEventListener('click',()=>this.pullSheet().then(()=>location.reload()));
    document.getElementById('btnPush')?.addEventListener('click',()=>this.pushAll());
  },
  _editPlan(i){ this._bindPlanModal(this.state.plan[i], i); },
  _delPlan(i){ if(confirm('削除しますか？')){ this.state.plan.splice(i,1); this.save(); this.pagePlan(); } },

  /* ---------- SHIP ---------- */
  pageShip(){
    const body=document.getElementById('shipBody'); if(!body) return;
    const render=()=>{
      body.innerHTML=this.state.ship.map((s,i)=>`<tr>
        <td>${s.date||''}</td><td>${s.customer||''}</td><td>${s.itemName||''}</td><td>${s.itemNo||''}</td>
        <td class="text-right">${s.qty||0}</td><td>${s.status||''}</td><td>${s.note||''}</td><td class="text-sm">${s.updated||''}</td>
        <td><button class="btn-outline" onclick="App._editShip(${i})"><i data-lucide='edit-3'></i>編集</button></td>
      </tr>`).join('') || `<tr><td colspan="9" class="text-sm text-slate-500">データがありません。</td></tr>`;
      this.useIcons();
    };
    render();
    document.getElementById('btnAddShip')?.addEventListener('click', async ()=>{
      const rec={date:this.today(),customer:'',itemName:'',itemNo:'',qty:0,status:'出荷準備',note:'',updated:this.stamp()};
      this.state.ship.unshift(rec); this.save(); render(); await this.pushShip(rec);
    });
    document.getElementById('btnMarkShipped')?.addEventListener('click', async ()=>{
      this.state.ship.forEach(s=>{ if(s.status==='出荷準備'){ s.status='出荷済'; s.updated=this.stamp(); }});
      this.save(); render();
      for(const s of this.state.ship) if(s.status==='出荷済') await this.pushShip(s);
    });
    document.getElementById('btnPull')?.addEventListener('click',()=>this.pullSheet().then(()=>location.reload()));
    document.getElementById('btnPush')?.addEventListener('click',()=>this.pushAll());
  },
  _editShip(i){ alert('編集（簡易） index='+i); },

  /* ---------- CONFIRM / SCAN / TICKET tetap ---------- */
  pageConfirm(){
    const byId=id=>document.getElementById(id);
    byId('cfUser')?.append(this.state.user||'');
    byId('btnCfBuild')?.addEventListener('click',()=>{
      const d=byId('cfDate').value || this.today();
      const c=(byId('cfCustomer')?.value||'').trim().toLowerCase();
      const rows=this.state.ship.filter(s=> (s.date||'')===d && (!c || (s.customer||'').toLowerCase().includes(c)));
      const tb=document.querySelector('#cfTable tbody');
      tb.innerHTML = rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.customer||''}</td><td>${r.itemName||''}</td><td>${r.itemNo||''}</td><td class="text-right">${r.qty||0}</td><td>${r.note||''}</td></tr>`).join('')
        || `<tr><td colspan="6" class="text-sm text-slate-500">作成してください。</td></tr>`;
    });
    byId('btnCfExcel')?.addEventListener('click',()=>{
      const rows=[['No','得意先','品名','品番','数量','備考']];
      document.querySelectorAll('#cfTable tbody tr').forEach((tr,i)=>{
        const t=[...tr.children].map(td=>td.textContent||'');
        rows.push([(i+1), t[1], t[2], t[3], t[4], t[5]]);
      });
      const csv=rows.map(r=>r.map(x=>`"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=`出荷確認_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    });
  },
  pageScan(){
    const sel=document.getElementById('scanProcess'); if(sel) sel.innerHTML=this.PROCESS_LIST.map(p=>`<option>${p}</option>`).join('');
    try{
      const html5QrCode = new Html5Qrcode("reader");
      Html5Qrcode.getCameras().then(devs=>{
        const cam=devs?.[0]?.id; if(!cam) return;
        html5QrCode.start(cam,{fps:10,qrbox:250},txt=>{
          const [prodNo,itemNo]=String(txt||'').split('|');
          document.getElementById('scanInfo').textContent=`読み取り: ${prodNo||''} | ${itemNo||''}`;
        },()=>{});
      });
    }catch{}
    const apply=async ()=>{
      const info=document.getElementById('scanInfo')?.textContent||''; if(!info.includes('|')) return alert('QRを読み取ってください。');
      const prodNo=info.split(':').pop().split('|')[0].trim(); const itemNo=info.split('|')[1].trim();
      const p=this.state.plan.find(x=>x.prodNo===prodNo && x.itemNo===itemNo); if(!p){ alert('計画が見つかりません'); return;}
      p.process=document.getElementById('scanProcess').value; p.status=document.getElementById('scanStatus').value; p.updated=this.stamp();
      this.save(); await this.pushPlan(p); alert('更新しました');
    };
    document.getElementById('btnApplyManual')?.addEventListener('click',()=>{
      const t=document.getElementById('manualText')?.value||'';
      const [prodNo,itemNo]=t.split('|'); document.getElementById('scanInfo').textContent=`読み取り: ${prodNo||''} | ${itemNo||''}`;
    });
    document.getElementById('btnApplyScan')?.addEventListener('click',apply);
  },
  pageTicket(){
    const byId=id=>document.getElementById(id);
    document.getElementById('btnLoadTicket')?.addEventListener('click',()=>{
      const prod=byId('ticketProdNo')?.value.trim(); const ino=byId('ticketItemNo')?.value.trim();
      const p=this.state.plan.find(x=>(!prod||x.prodNo===prod)&&(!ino||x.itemNo===ino));
      if(!p) return alert('計画が見つかりません');
      byId('tCustomer').textContent=p.customer||''; byId('tProdNo').textContent=p.prodNo||''; byId('tStart').textContent=p.start||'';
      byId('tItemNo').textContent=p.itemNo||''; byId('tItemName').textContent=p.itemName||''; byId('tUser').textContent=this.state.user||'';
      const imp=['表面のキズ/変色/サビ','曲げ角度・割れ','外枠組付け','シャッター組立','溶接状態','コーキング','塗装','組立仕上げ','最終検査','外注品質確認'];
      byId('tProcessRows').innerHTML=this.PROCESS_LIST.map((name,i)=>`<tr><td>${name}</td><td>${imp[i]||''}</td><td></td><td></td><td></td></tr>`).join('');
      const q=byId('tQR'); q.innerHTML=''; new QRCode(q,{text:`${p.prodNo}|${p.itemNo}`,width:84,height:84});
    });
  },

  /* ---------- MASTER PAGE (CRUD) ---------- */
  pageMaster(){
    const wrap=document.getElementById('masterBody');
    const render=()=>{
      wrap.innerHTML = (this.state.master||[]).map((m)=>`<tr>
        <td>${m.customer||''}</td><td>${m.itemNo||''}</td><td>${m.itemName||''}</td><td>${m.note||''}</td>
        <td class="whitespace-nowrap">
          <button class="btn-outline" onclick="App._openMasterEdit(${m.id})"><i data-lucide='edit-3'></i>編集</button>
          <button class="btn-outline" onclick="App._delMaster(${m.id})"><i data-lucide='trash-2'></i>削除</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="5" class="text-sm text-slate-500">データがありません。</td></tr>`;
      this.useIcons();
    };
    render();

    document.getElementById('btnAddMaster')?.addEventListener('click', async ()=>{
      const c=document.getElementById('mCustomer').value.trim();
      const n=document.getElementById('mItemNo').value.trim();
      const nm=document.getElementById('mItemName').value.trim();
      const note=document.getElementById('mNote').value.trim();
      if(!c || !n) return alert('得意先と図番は必須です。');
      const row={customer:c,itemNo:n,itemName:nm,note};
      await this.addMaster(row); // simpan dulu agar dapat row id saat pull
      await this.pullSheet();     // refresh dari server supaya id terbarui
      document.getElementById('mCustomer').value='';
      document.getElementById('mItemNo').value='';
      document.getElementById('mItemName').value='';
      document.getElementById('mNote').value='';
      render();
      alert('MASTER 追加完了');
    });
    document.getElementById('btnPull')?.addEventListener('click',async ()=>{
      await this.pullSheet(); render();
    });

    // modal edit
    const modal=document.getElementById('mEditModal');
    const open=()=>modal.classList.remove('hidden');
    const close=()=>modal.classList.add('hidden');
    document.getElementById('mEditClose')?.addEventListener('click',close);
    document.getElementById('mEditSave')?.addEventListener('click', async ()=>{
      const id = parseInt(document.getElementById('mEditId').value,10);
      const row = {
        customer: document.getElementById('mEditCustomer').value.trim(),
        itemNo:   document.getElementById('mEditItemNo').value.trim(),
        itemName: document.getElementById('mEditItemName').value.trim(),
        note:     document.getElementById('mEditNote').value.trim()
      };
      if(!row.customer || !row.itemNo) return alert('得意先と図番は必須です。');
      await this.upsertMaster(id,row);
      await this.pullSheet();
      render(); close(); alert('更新しました');
    });
    this._openMasterEdit = (id)=>{
      const m = this.state.master.find(x=>x.id===id); if(!m) return;
      document.getElementById('mEditId').value=id;
      document.getElementById('mEditCustomer').value=m.customer||'';
      document.getElementById('mEditItemNo').value=m.itemNo||'';
      document.getElementById('mEditItemName').value=m.itemName||'';
      document.getElementById('mEditNote').value=m.note||'';
      open();
    };
    this._delMaster = async (id)=>{
      if(!confirm('削除しますか？')) return;
      await this.deleteMaster(id);
      await this.pullSheet();
      render();
    };
  },

  /* ---------- INIT ---------- */
  initPage(page){
    this.initNavbar(); this.useIcons(); this.attachLoginInline();
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    document.querySelectorAll('.navlink').forEach(a=>{ if((a.getAttribute('href')||'').toLowerCase()===path) a.classList.add('active'); });

    if(page==='dashboard') this.pageDashboard();
    if(page==='plan')      this.pagePlan();
    if(page==='ship')      this.pageShip();
    if(page==='scan')      this.pageScan();
    if(page==='ticket')    this.pageTicket();
    if(page==='confirm')   this.pageConfirm();
    if(page==='master')    this.pageMaster();
  }
};
window.App=App;
