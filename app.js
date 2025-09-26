const App = (()=>{
  const PROCESS_LIST=["レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程","シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"];
  const SHEET_ENDPOINT={ PLAN_POST:"", PLAN_GET:"", SHIP_POST:"", SHIP_GET:"" };
  let state={ user:localStorage.getItem('tsh_user')||'', role:localStorage.getItem('tsh_role')||'', plan:JSON.parse(localStorage.getItem('tsh_plan')||'[]'), ship:JSON.parse(localStorage.getItem('tsh_ship')||'[]') };
  const today=()=>new Date().toISOString().slice(0,10);
  const stamp=()=>`${new Date().toLocaleString()} | ${state.user||'-'}`;
  const save=()=>{ localStorage.setItem('tsh_plan',JSON.stringify(state.plan)); localStorage.setItem('tsh_ship',JSON.stringify(state.ship)); };
  const log=(s)=>{ const el=document.getElementById('syncLog'); if(el) el.textContent=s; };

  function ensureLogin(){
    const bar=document.getElementById('loginBar');
    if(!state.user){
      bar.style.display='flex';
      bar.innerHTML=`<div class="login-card"><h3 class="text-lg font-semibold mb-2">TSH ミニERP ログイン</h3>
        <div class="grid gap-2"><input id="loginName" class="inp" placeholder="ユーザー名"/>
        <select id="loginRole" class="inp"><option>PPIC</option><option>生産</option><option>検査</option><option>物流</option><option>管理者</option></select>
        <button id="enter" class="btn primary">入室</button></div></div>`;
      document.getElementById('enter').onclick=()=>{ const n=document.getElementById('loginName').value.trim(); const r=document.getElementById('loginRole').value; if(!n) return alert('ユーザー名'); state.user=n; state.role=r; localStorage.setItem('tsh_user',n); localStorage.setItem('tsh_role',r); bar.style.display='none'; location.reload(); };
    }
  }

