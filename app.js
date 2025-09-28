<script>
/* ======= CONFIG ======= */
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxdxK93a2UJFKg5mmLi_P7OrAWv4DMUbvWX3bHGEntndIEEHWZc_dqN-iyqarKQvIFS/exec',  // <= << GANTI INI >>
  BRAND: 'ERPシステム', COMPANY: '東京精密発條株式会社'
};

/* ======= tiny helpers ======= */
const $ = (s, r=document)=>r.querySelector(s);
const $$=(s, r=document)=>[...r.querySelectorAll(s)];
const qs = o => new URLSearchParams(o).toString();
const J  = v => JSON.stringify(v);

/* ======= State (localStorage) ======= */
const Auth = {
  key: 'erpUser',
  get(){ try{return JSON.parse(localStorage.getItem(this.key)||'null')}catch{ return null}},
  set(v){ localStorage.setItem(this.key, J(v)); },
  clear(){ localStorage.removeItem(this.key); }
};

/* ======= API ======= */
const Api = {
  async login(user, pass){
    const url = CONFIG.GAS_URL + '?' + qs({action:'login',username:user,password:pass});
    const res = await fetch(url, {cache:'no-store'});
    return res.json();
  },
  async pull(){
    const res = await fetch(CONFIG.GAS_URL, {cache:'no-store'});
    return res.json();
  },
  async masterUpsert(payload){
    const res = await fetch(CONFIG.GAS_URL, {method:'POST',body:J(payload)});
    return res.json();
  },
  async masterDelete(id){
    const res = await fetch(CONFIG.GAS_URL,{method:'POST',body:J({action:'MASTER_DELETE',id})});
    return res.json();
  }
};

/* ======= UI ======= */
function flash(msg){
  let el = $('#flash'); if(!el){ el = document.createElement('div'); el.id='flash'; el.className='flash'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800);
}

function guard(page){
  const u = Auth.get();
  if(page!=='login' && !u){ location.href='index.html?needLogin=1'; return false; }
  if(page==='login' && u){ location.href='dashboard.html'; return false; }
  return true;
}

function navbar(active=''){
  const u = Auth.get();
  return `
  <div class="app-topbar">
    <div class="app-shell" style="display:flex;align-items:center;justify-content:space-between;height:56px">
      <div class="brand"><img src="tsh.png" alt="TSH"><b>${CONFIG.BRAND}</b><span class="hidden sm:inline" style="color:#64748b">${CONFIG.COMPANY}</span></div>
      <button class="burger" id="btnBurger" aria-label="menu">☰</button>
      <nav class="nav" id="mainNav" style="display:none"></nav>
    </div>
  </div>
  <div class="app-shell">
    <nav class="nav" id="navDesktop"></nav>
  </div>
  `;
}

function buildMenus(active){
  const links = [
    ['dashboard.html','ダッシュボード'],
    ['plan.html','生産計画'],
    ['ship.html','出荷計画'],
    ['confirm.html','出荷確認書'],
    ['ticket.html','生産現品票'],
    ['scan.html','QRスキャン'],
    ['charts.html','分析チャート'],
    ['master.html','マスター']
  ];
  const user = Auth.get();
  const navHtml = links.map(([href,label])=>{
    const isAct = location.pathname.endsWith(href);
    return `<a href="${href}" class="${isAct?'active':''}">${label}</a>`;
  }).join('') + (user? `<a class="btn btn-ghost" id="btnLogout">ログアウト (${user.user})</a>` : '');
  $('#navDesktop').innerHTML = navHtml;
  const m = $('#mainNav'); if(m){ m.innerHTML = navHtml; }

  $('#btnBurger')?.addEventListener('click', ()=>{
    const mn = $('#mainNav');
    mn.style.display = (mn.style.display==='none'||!mn.style.display)?'flex':'none';
  });
  $('#btnLogout')?.addEventListener('click', ()=>{ Auth.clear(); location.href='index.html'; });
}

/* ======= Renderers per page ======= */
async function renderDashboard(){
  const box = $('#dashWrap');
  try{
    const data = await Api.pull();
    if(!data.ok){ box.innerHTML='<div class="card">同期に失敗しました。</div>'; return; }
    // contoh ringkas
    $('#nowList').textContent   = (data.plan||[]).length? '' : 'データがありません。';
    $('#shipToday').textContent = (data.ship||[]).length? '' : '本日の出荷予定はありません。';
    // stok sederhana
    const byItem = {};
    (data.plan||[]).forEach(p=>{
      const key = (p.itemName||'')+'|'+(p.itemNo||'');
      if(!byItem[key]) byItem[key]={done:0, ship:0};
      byItem[key].done += Number(p.qtyDone||0);
      byItem[key].ship += Number(p.qtyShip||0);
    });
    const tbody = $('#stockBody'); tbody.innerHTML='';
    Object.entries(byItem).forEach(([k,v])=>{
      const [nm,no] = k.split('|');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${nm||''}</td><td class="mono">${no||''}</td>
      <td class="mono">${v.done}</td><td class="mono">${v.ship}</td><td class="mono">${v.done - v.ship}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ box.innerHTML = `<div class="card">エラー: ${e}</div>`; }
}

async function renderMaster(){
  const box = $('#masterBox');
  box.innerHTML = '<div class="card">読込中...</div>';
  try{
    const data = await Api.pull();
    if(!data.ok){ box.innerHTML='<div class="card">取得失敗</div>'; return; }
    const list = data.master||[];
    const tbody = document.createElement('tbody');
    list.forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td class="mono">${r.id||''}</td><td>${r.customer||''}</td><td class="mono">${r.drawing||''}</td><td>${r.itemName||''}</td><td class="mono">${r.itemNo||''}</td>
      <td><button class="btn btn-ghost" data-edit="${r.id}">編集</button><button class="btn btn-danger" data-del="${r.id}">削除</button></td>`;
      tbody.appendChild(tr);
    });
    box.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:.6rem;font-weight:700">マスター</h3>
        <div class="grid">
          <div class="grid-2">
            <div>
              <label class="label">得意先</label><input id="mCustomer" class="input">
            </div>
            <div>
              <label class="label">図番</label><input id="mDrawing" class="input">
            </div>
          </div>
          <div class="grid-2">
            <div><label class="label">品名</label><input id="mItemName" class="input"></div>
            <div><label class="label">品番</label><input id="mItemNo" class="input"></div>
          </div>
          <div><button id="btnMasterSave" class="btn btn-primary">登録</button></div>
        </div>
      </div>

      <div class="card" style="margin-top:10px;overflow:auto">
        <table class="table">
          <thead><tr><th>ID</th><th>得意先</th><th>図番</th><th>品名</th><th>品番</th><th>操作</th></tr></thead>
        </table>
      </div>
    `;
    $('.table').appendChild(tbody);

    $('#btnMasterSave').addEventListener('click', async ()=>{
      const payload = {
        action:'MASTER_UPSERT',
        customer:$('#mCustomer').value.trim(),
        drawing:$('#mDrawing').value.trim(),
        itemName:$('#mItemName').value.trim(),
        itemNo:$('#mItemNo').value.trim()
      };
      if(!payload.customer){ flash('得意先を入力'); return; }
      const r = await Api.masterUpsert(payload);
      if(r.ok){ flash('保存しました'); renderMaster(); } else { flash('保存に失敗'); }
    });

    tbody.addEventListener('click', async e=>{
      const del = e.target.closest('[data-del]');
      if(del){ if(!confirm('削除しますか？')) return;
        const id = del.getAttribute('data-del'); const r = await Api.masterDelete(id);
        if(r.ok){ flash('削除しました'); renderMaster(); } else { flash('削除に失敗'); }
      }
      const ed = e.target.closest('[data-edit]');
      if(ed){
        const id=ed.getAttribute('data-edit'); const row=list.find(x=>x.id===id);
        if(row){ $('#mCustomer').value=row.customer||''; $('#mDrawing').value=row.drawing||'';
          $('#mItemName').value=row.itemName||''; $('#mItemNo').value=row.itemNo||'';
          flash('編集モード（上の入力を修正→登録）');
        }
      }
    });
  }catch(e){ box.innerHTML=`<div class="card">エラー: ${e}</div>`; }
}

/* ======= Page bootstrap ======= */
const App = {
  init(page){
    if(!guard(page)) return;

    // header (kecuali halaman login sudah punya header super ringkas – tetap boleh render nav)
    if(page!=='login'){
      document.body.insertAdjacentHTML('afterbegin', navbar());
      buildMenus(page);
    }

    if(page==='login'){
      const f = $('#loginForm');
      const u = $('#loginUser'), p = $('#loginPass'), m = $('#loginMsg');
      const doLogin = async ()=>{
        m.textContent = 'APIチェック中…';
        try{
          if(!u.value.trim() || !p.value.trim()){ m.textContent='ユーザー/パス空'; return; }
          const r = await Api.login(u.value.trim(), p.value.trim());
          if(r && r.ok){
            Auth.set({user:r.user, role:r.role, token:r.token});
            location.href='dashboard.html';
          }else{
            m.textContent = 'ログイン失敗 ('+(r?.error||'')+')';
            flash('ログイン失敗');
          }
        }catch(e){ m.textContent='接続エラー'; }
      };
      f?.addEventListener('submit', e=>{ e.preventDefault(); doLogin(); });
    }

    if(page==='dashboard') renderDashboard();
    if(page==='master') renderMaster();
    // halaman lain boleh diload ringan dulu; nanti tinggal tambah renderer spesifik
  }
};

window.App = App;
</script>
