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

window.App = App;
