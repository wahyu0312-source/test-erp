<script>
/* ========= CONFIG ========= */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxmpC6UA1ixJLLDy3kCa6RPT9D-s2pV4L2UEsvy21gR5klqLpGGQbfSbYkNqWaHnRId/exec'; // ganti jika perlu

/* ========= HELPERS ========= */
const $=(s,r)=> (r||document).querySelector(s);
const $$=(s,r)=> [...(r||document).querySelectorAll(s)];
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.classList.add('show')); setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),220)},2600); }
function today(){ const d=new Date(); return d.toISOString().slice(0,10); }

/* ========= API ========= */
async function apiGet(qs){ const r=await fetch(GAS_URL+(qs?('?'+qs):''),{cache:'no-store'}); return r.json(); }
async function apiPost(body){ const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return r.json(); }

/* ========= AUTH ========= */
function getSession(){ try{ return JSON.parse(localStorage.getItem('erpUser')||'null'); }catch{return null} }
function setSession(o){ localStorage.setItem('erpUser', JSON.stringify(o)); }
function clearSession(){ localStorage.removeItem('erpUser'); }
function roleAllow(role, allowList){ return allowList.includes(role); }

/* ========= GUARD ========= */
async function guard(page){
  const s=getSession();
  if(!s && page!=='login'){ location.href='login.html'; return false; }
  if(s){
    try{
      const w=await apiGet('action=who&token='+encodeURIComponent(s.token));
      if(!w.ok) throw 0;
      // paint header
      const uEl=$('#topUser'); if(uEl) uEl.textContent = `${w.user}（${w.role}）`;
      $('#btnLogout')?.addEventListener('click',()=>{ clearSession(); location.href='login.html'; });
      const b=$('#burger'), m=$('#navMenu'); b?.addEventListener('click', ()=> m?.classList.toggle('open'));
      // role lock menu Master
      if(!roleAllow(w.role, ['管理者','生産管理部'])) {
        $$('a[href="master.html"]').forEach(a=>{ a.classList.add('hidden'); });
      }
    }catch{
      clearSession(); location.href='login.html'; return false;
    }
  }
  return true;
}

/* ========= PAGING ========= */
function makePager(data, pageSize, cbRender, elWrap){
  let cur=1; const total=Math.max(1, Math.ceil(data.length/pageSize));
  function render(){
    const start=(cur-1)*pageSize, end=start+pageSize;
    cbRender(data.slice(start,end));
    elWrap.querySelector('.info').textContent = `${cur}/${total}頁（${data.length}件）`;
  }
  elWrap.querySelector('.prev').onclick=()=>{ cur=Math.max(1,cur-1); render(); };
  elWrap.querySelector('.next').onclick=()=>{ cur=Math.min(total,cur+1); render(); };
  render();
}

/* ========= PAGES ========= */
const App={
  /* ---------- Login ---------- */
  async initLogin(){
    $('#lgPass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') $('#btnLogin')?.click(); });
    $('#btnLogin')?.addEventListener('click', async ()=>{
      const u=$('#lgUser').value.trim(), p=$('#lgPass').value.trim();
      if(!u||!p){ toast('ユーザーとパスワードを入力'); return; }
      try{
        const r=await apiGet('action=login&username='+encodeURIComponent(u)+'&password='+encodeURIComponent(p));
        if(r.ok){ setSession({user:r.user,role:r.role,token:r.token}); location.href='index.html'; }
        else{
          const map={USER_OR_PASS_EMPTY:'未入力',USER_NOT_FOUND:'ユーザー無し',USER_INACTIVE:'無効ユーザー',WRONG_PASSWORD:'パスワード違い'};
          toast('ログイン失敗：'+(map[r.error]||'不明'));
        }
      }catch{ toast('サーバー通信エラー'); }
    });
  },

  /* ---------- Dashboard ---------- */
  async initDashboard(){
    if(!(await guard('dashboard'))) return;
    try{
      const r=await apiGet('action=data'); if(!r.ok) throw 0;

      // 生産状況 (進行中 8件)
      const now=$('#nowList');
      const running=r.plan.filter(p=>(p.status||'').includes('進行')).slice(0,8);
      now.innerHTML = running.length ? running.map(p=>`
        <div class="card" style="margin:8px 0;padding:10px">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div>
              <div><b>${p.itemName||'-'}</b> <span class="muted" style="color:#64748b">(${p.itemNo||''})</span></div>
              <div class="muted" style="color:#64748b;font-size:12px">得意先:${p.customer||'-'} ・ 製造番号:${p.prodNo||'-'} ・ 開始:${p.start||'-'}</div>
            </div>
            <div style="text-align:right">
              <span class="badge">${p.process||'-'} / ${p.status||'-'}</span>
              <div class="muted" style="font-size:12px;color:#64748b">${p.updated||''}</div>
            </div>
          </div>
        </div>
      `).join('') : 'データがありません。';

      // 本日の出荷
      const list=$('#shipToday');
      const t=today();
      const todayShip=r.ship.filter(s=> (s.date||'').slice(0,10)===t);
      list.innerHTML = todayShip.length ? todayShip.map(s=>`
        <div class="card" style="margin:8px 0;padding:10px;display:flex;justify-content:space-between">
          <div><b>${s.itemName||'-'}</b><div class="muted" style="font-size:12px;color:#64748b">${s.customer||''} ・ 数量:${s.qty||0}</div></div>
          <div style="text-align:right"><span class="badge">${s.status||''}</span><div class="muted" style="font-size:12px;color:#64748b">${s.updated||''}</div></div>
        </div>`).join('') : '本日の出荷予定はありません。';

      // 在庫集計
      const map={};
      r.plan.forEach(p=>{
        const k=(p.itemNo||'')+'|'+(p.itemName||'');
        if(!map[k]) map[k]={name:p.itemName,no:p.itemNo,done:0,ship:0};
        map[k].done+=Number(p.qtyDone||0);
        map[k].ship+=Number(p.qtyShip||0);
      });
      const tbody=$('#stockBody'); tbody.innerHTML='';
      Object.values(map).forEach(a=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${a.name||'-'}</td><td>${a.no||'-'}</td><td class="num">${a.done}</td><td class="num">${a.ship}</td><td class="num"><b>${a.done-a.ship}</b></td>`;
        tbody.appendChild(tr);
      });
    }catch{ toast('ダッシュボード読み込み失敗'); }
  },

  /* ---------- Plan ---------- */
  async initPlan(){
    if(!(await guard('plan'))) return;

    // load MASTER
    let master=[];
    try{ const m=await apiGet('action=master'); master=m.master||[]; }catch{}
    const selC=$('#selCust'), selD=$('#selDraw');
    const cust=[...new Set(master.map(x=>x.customer))];
    selC.innerHTML='<option value="">選択</option>'+cust.map(c=>`<option>${c}</option>`).join('');
    selC.addEventListener('change',()=>{
      const ds=[...new Set(master.filter(x=>x.customer===selC.value).map(x=>x.drawing))];
      selD.innerHTML='<option value="">選択</option>'+ds.map(d=>`<option>${d}</option>`).join('');
    });
    selD.addEventListener('change',()=>{
      const hit=master.find(x=>x.customer===selC.value && x.drawing===selD.value);
      if(hit){ $('#itemName').value=hit.itemName||''; $('#itemNo').value=hit.itemNo||''; }
    });

    // save
    $('#start').value = today();
    $('#btnSavePlan')?.addEventListener('click', async ()=>{
      const s=getSession();
      const body={
        action:'PLAN_APPEND',
        customer:$('#selCust').value, prodNo:$('#prodNo').value,
        itemName:$('#itemName').value, itemNo:$('#itemNo').value,
        start:$('#start').value, process:$('#process').value,
        location:$('#loc').value, status:$('#status').value, user:s?.user||''
      };
      if(!body.customer || !body.prodNo){ toast('得意先/製造番号は必須'); return; }
      const r=await apiPost(body); r.ok?toast('保存しました'):toast('保存エラー');
    });

    // search + paging (read PLAN)
    try{
      const d=await apiGet('action=data'); const all=d.plan||[];
      const q=$('#q'); const tbody=$('#planBody'); const pager=$('#planPager');
      function draw(rows){
        tbody.innerHTML = rows.map(p=>`
          <tr>
            <td>${p.customer||''}</td><td>${p.prodNo||''}</td><td>${p.itemName||''}</td><td>${p.itemNo||''}</td>
            <td>${p.start||''}</td><td>${p.process||''}</td><td>${p.location||''}</td><td>${p.status||''}</td>
            <td>${p.updated||''}</td>
          </tr>`).join('') || `<tr><td colspan="9" class="muted">データがありません</td></tr>`;
      }
      function filter(){
        const s=(q.value||'').toLowerCase();
        return all.filter(p=>[p.customer,p.prodNo,p.itemName,p.itemNo,p.process,p.status].join('|').toLowerCase().includes(s));
      }
      makePager(filter(), 10, draw, pager);
      q.addEventListener('input', ()=> makePager(filter(), 10, draw, pager));
    }catch{}
  },

  /* ---------- Ship ---------- */
  async initShip(){
    if(!(await guard('ship'))) return;
    $('#date').value=today();
    $('#btnSaveShip')?.addEventListener('click', async ()=>{
      const s=getSession();
      const body={action:'SHIP_APPEND',date:$('#date').value,customer:$('#scust').value,itemName:$('#sname').value,itemNo:$('#sno').value,qty:$('#sqty').value,status:$('#sstat').value,note:$('#snote').value,user:s?.user||''};
      if(!body.date||!body.customer){ toast('日付/得意先 必須'); return; }
      const r=await apiPost(body); r.ok?toast('保存しました'):toast('保存エラー');
    });
  },

  /* ---------- Master ---------- */
  async initMaster(){
    if(!(await guard('master'))) return;
    // role protect
    const s=getSession();
    if(!s){ location.href='login.html'; return; }
    const who=await apiGet('action=who&token='+encodeURIComponent(s.token));
    if(!who.ok || !['管理者','生産管理部'].includes(who.role)){ toast('権限がありません'); location.href='index.html'; return; }

    let cache=[];
    async function load(){ const r=await apiGet('action=master'); cache=r.master||[]; render(cache); }
    function render(list){
      const tbody=$('#mBody');
      tbody.innerHTML = list.map(x=>`
        <tr>
          <td>${x.customer||''}</td><td>${x.drawing||''}</td><td>${x.itemName||''}</td><td>${x.itemNo||''}</td>
          <td class="w-28">
            <button class="btn-outline sm" data-ed="${x.id}">編集</button>
            <button class="btn-danger sm" data-del="${x.id}">削除</button>
          </td>
        </tr>`).join('') || `<tr><td colspan="5" class="muted">データがありません</td></tr>`;
    }
    // search + paging
    const q=$('#mq'); const pager=$('#mPager'); const tbody=$('#mBody');
    function draw(rows){
      tbody.innerHTML = rows.map(x=>`
        <tr>
          <td>${x.customer||''}</td><td>${x.drawing||''}</td><td>${x.itemName||''}</td><td>${x.itemNo||''}</td>
          <td><button class="btn-outline sm" data-ed="${x.id}">編集</button> <button class="btn-danger sm" data-del="${x.id}">削除</button></td>
        </tr>`).join('');
      if(!rows.length) tbody.innerHTML=`<tr><td colspan="5" class="muted">該当なし</td></tr>`;
    }
    function filter(){ const s=(q.value||'').toLowerCase(); return cache.filter(x=>[x.customer,x.drawing,x.itemName,x.itemNo].join('|').toLowerCase().includes(s)); }
    // events
    $('#mAdd')?.addEventListener('click', async ()=>{
      const c=prompt('得意先?'); if(!c) return;
      const d=prompt('図番?')||''; const n=prompt('品名?')||''; const no=prompt('品番?')||'';
      const r=await apiPost({action:'MASTER_UPSERT',customer:c,drawing:d,itemName:n,itemNo:no});
      r.ok?toast('追加'):toast('失敗'); load();
    });
    $('#mTable')?.addEventListener('click', async e=>{
      const id=e.target.getAttribute('data-del'); const ed=e.target.getAttribute('data-ed');
      if(id){ if(confirm('削除しますか？')){ const r=await apiPost({action:'MASTER_DELETE',id}); r.ok?toast('削除'):toast('失敗'); load(); } }
      if(ed){ const row=cache.find(x=>x.id===ed); if(!row) return;
        const c=prompt('得意先',row.customer)||row.customer;
        const d=prompt('図番',row.drawing)||row.drawing;
        const n=prompt('品名',row.itemName)||row.itemName;
        const no=prompt('品番',row.itemNo)||row.itemNo;
        const r=await apiPost({action:'MASTER_UPSERT',id:ed,customer:c,drawing:d,itemName:n,itemNo:no});
        r.ok?toast('更新'):toast('失敗'); load();
      }
    });
    // initial load + pager
    await load();
    makePager(filter(), 10, draw, pager);
    q.addEventListener('input', ()=> makePager(filter(), 10, draw, pager));
  },

  /* ---------- Scan ---------- */
  async initScan(){
    if(!(await guard('scan'))) return;
    // fallback manual
    $('#prodNo')?.focus();
    $('#btnApply')?.addEventListener('click', ()=> toast('更新（デモ）'));
  },

  async initConfirm(){ if(!(await guard('confirm'))) return; /* TODO: implement form + print */ },
  async initTicket(){ if(!(await guard('ticket'))) return; /* TODO: implement print 票 */ },
  async initCharts(){ if(!(await guard('charts'))) return; /* TODO: draw charts */ },
};
</script>
