/* ===========================================================
   TSH Mini-ERP • app.js (front-end utama / Multi-page)
   Halaman yang memakai file ini:
   - index.html   → App.initPage('dashboard')
   - plan.html    → App.initPage('plan')
   - ship.html    → App.initPage('ship')
   - ticket.html  → App.initPage('ticket')
   - scan.html    → App.initPage('scan')
   =========================================================== */

const App = (function () {
  // ================= Konstanta & State =================
  var PROCESS_LIST = [
    "レーザ工程","曲げ工程","外枠組立工程","シャッター組立工程",
    "シャッター溶接工程","コーキング工程","外枠塗装工程","組立工程","検査工程"
  ];

  // === Ganti dengan URL Apps Script kamu (semua boleh sama) ===
  var SHEET_ENDPOINT = {
    PLAN_POST: "https://script.google.com/macros/s/AKfycbwlSzA-9aT_9OPvgcuyq8CDG-exBuuTSICY5q4gQXYTR-Won5mcquGCLLNcci7aWGo5/exec",   // e.g. https://script.google.com/macros/s/XXXX/exec
    PLAN_GET:  "",
    SHIP_POST: "",
    SHIP_GET:  ""
  };

  // State global (disimpan di localStorage juga)
  var state = {
    user: localStorage.getItem('tsh_user') || "",
    role: localStorage.getItem('tsh_role') || "",
    plan: JSON.parse(localStorage.getItem('tsh_plan') || "[]"),
    ship: JSON.parse(localStorage.getItem('tsh_ship') || "[]"),
    _interval: null
  };

  // ================= Util =================
  function $(q) { return document.querySelector(q); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function stamp() { return new Date().toLocaleString() + " | " + (state.user || "-"); }
  function save() {
    localStorage.setItem('tsh_plan', JSON.stringify(state.plan));
    localStorage.setItem('tsh_ship', JSON.stringify(state.ship));
  }
  function logSync(msg) { var el = $("#syncLog"); if (el) el.textContent = msg; }

  // ================= Login Gate =================
  function ensureLogin() {
    var bar = $("#loginBar");
    if (!bar) return; // jika halaman tidak punya overlay
    if (!state.user) {
      bar.style.display = "flex";
      bar.innerHTML =
        '<div class="login-card">' +
        '<h3 class="text-lg font-semibold mb-2">TSH ミニERP ログイン</h3>' +
        '<div class="grid gap-2">' +
        '<input id="loginName" class="inp" placeholder="ユーザー名"/>' +
        '<select id="loginRole" class="inp">' +
        '<option>PPIC</option><option>生産</option><option>検査</option><option>物流</option><option>管理者</option>' +
        '</select>' +
        '<button id="enter" class="btn primary">入室</button>' +
        "</div></div>";

      $("#enter").onclick = function () {
        var n = $("#loginName").value.trim();
        var r = $("#loginRole").value;
        if (!n) { alert("ユーザー名を入力してください。"); return; }
        state.user = n; state.role = r;
        localStorage.setItem('tsh_user', n);
        localStorage.setItem('tsh_role', r);
        bar.style.display = "none";
        location.reload();
      };
    } else {
      bar.style.display = "none";
    }
  }

  // ================= Komponen kecil =================
  function fillProcessSelect(sel) {
    if (!sel) return;
    var opts = '<option value="">工程（全て）</option>';
    for (var i = 0; i < PROCESS_LIST.length; i++) {
      opts += "<option>" + PROCESS_LIST[i] + "</option>";
    }
    sel.innerHTML = opts;
  }

  // ================= Dashboard =================
  function pageDashboard() {
    ensureLogin();

    // Kartu proses berjalan
    var nowList = $("#nowList");
    if (nowList) {
      var items = state.plan.slice(0, 8).map(function (p) {
        return "<div class='flex items-center justify-between border rounded-lg p-2'>" +
          "<div><div class='font-medium'>" + (p.itemName || "-") +
          " <span class='text-slate-500'>(" + (p.itemNo || "") + ")</span></div>" +
          "<div class='text-xs text-slate-500'>得意先:" + (p.customer || "-") +
          " ・ 製造番号:" + (p.prodNo || "-") +
          " ・ 開始:" + (p.start || "-") + "</div></div>" +
          "<div class='text-right'><div class='badge status-chip'>" + (p.process || "-") +
          " / " + (p.status || "-") + "</div><div class='text-xs text-slate-500'>" +
          (p.updated || "") + "</div></div></div>";
      }).join("");
      nowList.innerHTML = items || '<div class="text-sm text-slate-500">データがありません。</div>';
    }

    // Chart per proses
    var ctxEl = $("#byProcessChart");
    if (ctxEl && window.Chart) {
      var counts = PROCESS_LIST.map(function (proc) {
        return state.plan.filter(function (p) { return p.process === proc; }).length;
      });
      var ctx = ctxEl.getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: { labels: PROCESS_LIST, datasets: [{ label: '件数', data: counts }] },
        options: { plugins: { legend: { display: false } } }
      });
    }

    // Ship today
    var todayStr = today();
    var elShipToday = $("#shipToday");
    if (elShipToday) {
      var list = state.ship.filter(function (s) { return s.date === todayStr; })
        .map(function (s) {
          return "<div class='flex items-center justify-between border rounded-lg p-2'>" +
            "<div><div class='font-medium'>" + (s.itemName || "") + "</div>" +
            "<div class='text-xs text-slate-500'>" + (s.customer || "") + " ・ 数量:" + (s.qty || 0) + "</div></div>" +
            "<div><span class='badge status-chip'>" + (s.status || "") + "</span>" +
            "<div class='text-xs text-slate-500 text-right'>" + (s.updated || "") + "</div></div></div>";
        }).join("");
      elShipToday.innerHTML = list || '<div class="text-sm text-slate-500">本日の出荷予定はありません。</div>';
    }

    // Stok
    var stockBody = $("#stockBody");
    if (stockBody) {
      var map = {};
      for (var i = 0; i < state.plan.length; i++) {
        var p = state.plan[i];
        var k = p.itemNo || p.itemName;
        if (!map[k]) map[k] = { itemName: p.itemName, itemNo: p.itemNo, qtyDone: 0, qtyShip: 0 };
        map[k].qtyDone += Number(p.qtyDone || 0);
        // total ship by itemNo and status
        var shipped = 0;
        for (var j = 0; j < state.ship.length; j++) {
          var s = state.ship[j];
          if (s.itemNo === p.itemNo && s.status === "出荷済") {
            shipped += Number(s.qty || 0);
          }
        }
        map[k].qtyShip = shipped;
      }
      var rows = Object.keys(map).map(function (k) {
        var r = map[k];
        return "<tr><td>" + (r.itemName || "-") + "</td><td>" + (r.itemNo || "-") + "</td>" +
          "<td class='text-right'>" + (r.qtyDone || 0) + "</td>" +
          "<td class='text-right'>" + (r.qtyShip || 0) + "</td>" +
          "<td class='text-right font-semibold'>" + ((r.qtyDone || 0) - (r.qtyShip || 0)) + "</td></tr>";
      }).join("");
      stockBody.innerHTML = rows;
    }

    // Sinkron tombol
    var pull = $("#btnPull"), push = $("#btnPush"), auto = $("#autoSync");
    if (pull) pull.onclick = pullSheet;
    if (push) push.onclick = pushSheet;
    if (auto) {
      auto.onchange = function () {
        if (auto.checked) { state._interval = setInterval(pullSheet, 30000); }
        else { clearInterval(state._interval); }
      };
    }
  }

  // ================= 生産計画 =================
  function pagePlan() {
    ensureLogin();

    var fltP = $("#fltProcess");
    fillProcessSelect(fltP);
    var fltStatus = $("#fltStatus");
    if (fltStatus) fltStatus.value = "";

    var btnClear = $("#btnClearFilter");
    if (btnClear) {
      btnClear.onclick = function () {
        var q = $("#q"); if (q) q.value = "";
        if (fltP) fltP.value = "";
        if (fltStatus) fltStatus.value = "";
        renderPlanTable();
      };
    }

    var btnAdd = $("#btnAddPlan");
    if (btnAdd) btnAdd.onclick = function () { openPlanModal(); };

    // event filter
    var ids = ['#q', '#fltProcess', '#fltStatus'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) el.addEventListener('input', renderPlanTable);
    }

    var pull = $("#btnPull"), push = $("#btnPush");
    if (pull) pull.onclick = pullSheet;
    if (push) push.onclick = pushSheet;

    renderPlanTable();
  }

  function filtered() {
    var qEl = $("#q"), prEl = $("#fltProcess"), stEl = $("#fltStatus");
    var q = qEl ? qEl.value.toLowerCase() : "";
    var pr = prEl ? prEl.value : "";
    var st = stEl ? stEl.value : "";
    return state.plan.filter(function (p) {
      var hit =
        (p.itemName || "").toLowerCase().indexOf(q) >= 0 ||
        (p.itemNo || "").toLowerCase().indexOf(q) >= 0 ||
        (p.customer || "").toLowerCase().indexOf(q) >= 0 ||
        (p.prodNo || "").toLowerCase().indexOf(q) >= 0;
      if (q && !hit) return false;
      if (pr && p.process !== pr) return false;
      if (st && p.status !== st) return false;
      return true;
    });
  }

  function renderPlanTable() {
    var body = $("#planBody");
    if (!body) return;
    var rows = filtered().map(function (p) {
      var idx = state.plan.indexOf(p);
      return "<tr>" +
        "<td>" + (p.customer || "") + "</td>" +
        "<td>" + (p.prodNo || "") + "</td>" +
        "<td>" + (p.itemName || "") + "</td>" +
        "<td>" + (p.itemNo || "") + "</td>" +
        "<td>" + (p.start || "") + "</td>" +
        "<td>" + (p.process || "") + "</td>" +
        "<td>" + (p.location || "") + "</td>" +
        "<td>" + (p.status || "") + "</td>" +
        "<td class='text-xs'>" + (p.updated || "") + "</td>" +
        "<td><button class='btn' onclick='App.editPlan(" + idx + ")'>編集</button> " +
        "<a class='btn' href='ticket.html?prodNo=" + encodeURIComponent(p.prodNo || "") +
        "&itemNo=" + encodeURIComponent(p.itemNo || "") + "'>票</a></td></tr>";
    }).join("");
    body.innerHTML = rows || "<tr><td colspan='10' class='text-slate-500'>データがありません。</td></tr>";
  }

  function openPlanModal(idx) {
    var m = $("#planModal");
    if (!m) return;
    m.classList.remove("hidden");

    var isEdit = (idx !== null && idx !== undefined);
    var title = $("#planModalTitle");
    if (title) title.textContent = isEdit ? "生産計画：編集" : "生産計画：追加";

    var p = isEdit ? state.plan[idx] : {
      customer: "", prodNo: "", itemName: "", itemNo: "",
      start: today(), process: PROCESS_LIST[0], location: "PPIC", status: "計画"
    };

    $("#fCustomer").value = p.customer || "";
    $("#fProdNo").value = p.prodNo || "";
    $("#fItemName").value = p.itemName || "";
    $("#fItemNo").value = p.itemNo || "";
    $("#fStart").value = p.start || today();

    var sel = $("#fProcess");
    if (sel) sel.innerHTML = PROCESS_LIST.map(function (x) { return "<option>" + x + "</option>"; }).join("");
    sel.value = p.process || PROCESS_LIST[0];

    $("#fLocation").value = p.location || "PPIC";
    $("#fStatus").value = p.status || "計画";

    $("#btnPlanSave").onclick = function () {
      var rec = {
        customer: $("#fCustomer").value.trim(),
        prodNo: $("#fProdNo").value.trim(),
        itemName: $("#fItemName").value.trim(),
        itemNo: $("#fItemNo").value.trim(),
        start: $("#fStart").value,
        process: $("#fProcess").value,
        location: $("#fLocation").value.trim(),
        status: $("#fStatus").value,
        updated: stamp(),
        qtyDone: p.qtyDone || 0,
        qtyShip: p.qtyShip || 0
      };
      if (isEdit) { state.plan[idx] = Object.assign({}, state.plan[idx], rec); }
      else { state.plan.unshift(rec); }
      save();
      m.classList.add("hidden");
      renderPlanTable();
      pushPlan(rec);
    };

    var close = $("#planModalClose");
    if (close) close.onclick = function () { m.classList.add("hidden"); };
  }

  function editPlan(idx) { openPlanModal(idx); }

  // ================= 出荷計画 =================
  function pageShip() {
    ensureLogin();

    var add = $("#btnAddShip");
    if (add) add.onclick = function () { openShipModal(); };

    var mark = $("#btnMarkShipped");
    if (mark) mark.onclick = function () {
      for (var i = 0; i < state.ship.length; i++) {
        if (state.ship[i].status === "出荷準備") {
          state.ship[i].status = "出荷済";
          state.ship[i].updated = stamp();
        }
      }
      save(); renderShipTable(); syncQtyShip();
    };

    var pull = $("#btnPull"), push = $("#btnPush");
    if (pull) pull.onclick = pullSheet;
    if (push) push.onclick = pushSheet;

    renderShipTable();
  }

  function renderShipTable() {
    var body = $("#shipBody");
    if (!body) return;
    var rows = state.ship.map(function (s, idx) {
      return "<tr>" +
        "<td>" + (s.date || "") + "</td>" +
        "<td>" + (s.customer || "") + "</td>" +
        "<td>" + (s.itemName || "") + "</td>" +
        "<td>" + (s.itemNo || "") + "</td>" +
        "<td class='text-right'>" + (s.qty || 0) + "</td>" +
        "<td>" + (s.status || "") + "</td>" +
        "<td>" + (s.note || "") + "</td>" +
        "<td class='text-xs'>" + (s.updated || "") + "</td>" +
        "<td><button class='btn' onclick='App.editShip(" + idx + ")'>編集</button></td></tr>";
    }).join("");
    body.innerHTML = rows || "<tr><td colspan='9' class='text-slate-500'>データがありません。</td></tr>";
  }

  function openShipModal(idx) {
    var m = $("#shipModal");
    if (!m) return;
    m.classList.remove("hidden");

    var isEdit = (idx !== null && idx !== undefined);
    var s = isEdit ? state.ship[idx] : {
      date: today(), customer: "", itemName: "", itemNo: "",
      qty: 0, status: "出荷準備", note: ""
    };

    $("#shipModalTitle").textContent = isEdit ? "出荷計画：編集" : "出荷計画：追加";
    $("#sDate").value = s.date || today();
    $("#sCustomer").value = s.customer || "";
    $("#sItemName").value = s.itemName || "";
    $("#sItemNo").value = s.itemNo || "";
    $("#sQty").value = s.qty || 0;
    $("#sStatus").value = s.status || "出荷準備";
    $("#sNote").value = s.note || "";

    $("#btnShipSave").onclick = function () {
      var rec = {
        date: $("#sDate").value,
        customer: $("#sCustomer").value.trim(),
        itemName: $("#sItemName").value.trim(),
        itemNo: $("#sItemNo").value.trim(),
        qty: Number($("#sQty").value || 0),
        status: $("#sStatus").value,
        note: $("#sNote").value.trim(),
        updated: stamp()
      };
      if (isEdit) { state.ship[idx] = Object.assign({}, state.ship[idx], rec); }
      else { state.ship.unshift(rec); }
      save();
      m.classList.add("hidden");
      renderShipTable();
      syncQtyShip();
      pushShip(rec);
    };

    $("#shipModalClose").onclick = function () { m.classList.add("hidden"); };
  }

  function editShip(idx) { openShipModal(idx); }

  function syncQtyShip() {
    for (var i = 0; i < state.plan.length; i++) {
      var p = state.plan[i];
      var shipped = 0;
      for (var j = 0; j < state.ship.length; j++) {
        var s = state.ship[j];
        if (s.itemNo === p.itemNo && s.status === "出荷済") {
          shipped += Number(s.qty || 0);
        }
      }
      p.qtyShip = shipped;
    }
    save();
  }

  // ================= 生産現品票 =================
  function pageTicket() {
    ensureLogin();

    var qs = new URLSearchParams(location.search);
    var prodNo = qs.get('prodNo') || "";
    var itemNo = qs.get('itemNo') || "";
    if (prodNo) $("#ticketProdNo").value = prodNo;
    if (itemNo) $("#ticketItemNo").value = itemNo;

    var btnLoad = $("#btnLoadTicket");
    if (btnLoad) btnLoad.onclick = loadTicket;

    var btnPrint = $("#btnPrint");
    if (btnPrint) btnPrint.onclick = function () { window.print(); };

    if (prodNo || itemNo) loadTicket();
  }

  function loadTicket() {
    var prod = ($("#ticketProdNo") ? $("#ticketProdNo").value.trim() : "");
    var ino = ($("#ticketItemNo") ? $("#ticketItemNo").value.trim() : "");
    var p = null;
    for (var i = 0; i < state.plan.length; i++) {
      var x = state.plan[i];
      var hit = true;
      if (prod && x.prodNo !== prod) hit = false;
      if (ino && x.itemNo !== ino) hit = false;
      if (hit) { p = x; break; }
    }
    if (!p) { alert("計画が見つかりません"); return; }

    $("#tCustomer").textContent = p.customer || "";
    $("#tProdNo").textContent   = p.prodNo   || "";
    $("#tStart").textContent    = p.start    || "";
    $("#tItemNo").textContent   = p.itemNo   || "";
    $("#tItemName").textContent = p.itemName || "";
    $("#tUser").textContent     = state.user || "";

    // Tabel proses ringkas (bisa disesuaikan 1:1 layout)
    var imp = ['表面のキズ/変色/サビ','曲げ角度・割れ','外枠組付け','シャッター組立','溶接状態','コーキング','塗装','組立仕上げ','最終検査'];
    var rows = PROCESS_LIST.map(function (name, i) {
      return "<tr><td>" + name + "</td><td>" + (imp[i] || "") + "</td><td></td><td></td><td></td><td></td><td></td></tr>";
    }).join("");
    var cont = $("#tProcessRows"); if (cont) cont.innerHTML = rows;

    // QRコード
    var q = $("#tQR"); if (q) { q.innerHTML = ""; new QRCode(q, { text: (p.prodNo + "|" + p.itemNo), width: 80, height: 80 }); }
  }

  // ================= QRスキャン =================
  function pageScan() {
    ensureLogin();

    // isi dropdown proses
    var selP = $("#scanProcess");
    if (selP) selP.innerHTML = PROCESS_LIST.map(function (p) { return "<option>" + p + "</option>"; }).join("");

    // start kamera
    if (window.Html5Qrcode) {
      var html5QrCode = new Html5Qrcode("reader");
      Html5Qrcode.getCameras().then(function (devs) {
        var cam = devs && devs[0] ? devs[0].id : null;
        if (!cam) { alert("Camera tidak ditemukan"); return; }
        html5QrCode.start(cam, { fps: 10, qrbox: 250 }, onScan, function (err) {});
      });
    }

    var last = { prodNo: "", itemNo: "" };

    function onScan(txt) {
      // Format: 製造番号|品番
      var parts = (txt || "").split("|");
      if (parts.length < 2) return;
      last.prodNo = parts[0]; last.itemNo = parts[1];
      var info = $("#scanInfo");
      if (info) info.textContent = "読み取り: " + last.prodNo + " | " + last.itemNo;
    }

    var btnApply = $("#btnApplyScan");
    if (btnApply) btnApply.onclick = function () {
      if (!last.prodNo) { alert("QRを読み取ってください"); return; }
      var p = null;
      for (var i = 0; i < state.plan.length; i++) {
        var x = state.plan[i];
        if (x.prodNo === last.prodNo && x.itemNo === last.itemNo) { p = x; break; }
      }
      if (!p) { alert("計画なし"); return; }

      p.process = $("#scanProcess").value;
      p.status  = $("#scanStatus").value;
      p.updated = stamp();
      save();
      pushPlan(p);
      alert("更新しました");
    };
  }

  // ================= Sheets (2 arah) =================
  function pushPlan(p) {
    if (!SHEET_ENDPOINT.PLAN_POST) return;
    fetch(SHEET_ENDPOINT.PLAN_POST, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, p, { user: state.user }))
    }).then(function () { logSync("PLAN送信完了"); })
      .catch(function () { logSync("PLAN送信失敗"); });
  }

  function pushShip(s) {
    if (!SHEET_ENDPOINT.SHIP_POST) return;
    fetch(SHEET_ENDPOINT.SHIP_POST, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, s, { user: state.user }))
    }).then(function () { logSync("SHIP送信完了"); })
      .catch(function () { logSync("SHIP送信失敗"); });
  }

  function pullSheet() {
    // Asumsi doGet mengembalikan { plan:[], ship:[] }
    var urlPlan = SHEET_ENDPOINT.PLAN_GET;
    var urlShip = SHEET_ENDPOINT.SHIP_GET || urlPlan;
    if (!urlPlan) { logSync("GET URL kosong"); return; }

    Promise.all([ fetch(urlPlan), fetch(urlShip) ])
      .then(function (r) { return Promise.all(r.map(function (x) { return x.json().catch(function(){return {};}); })); })
      .then(function (arr) {
        var a = arr[0] || {};
        var b = arr[1] || {};
        // Jika endpoint sama, gunakan nilai dari properti a
        if (a.plan || a.ship) {
          state.plan = a.plan || state.plan;
          state.ship = a.ship || state.ship;
        }
        // Jika endpoint berbeda dan b juga punya data, merge
        if (urlShip !== urlPlan) {
          if (b.plan || b.ship) {
            if (b.plan) state.plan = b.plan;
            if (b.ship) state.ship = b.ship;
          }
        }
        save();
        logSync("取得完了");
        // reload agar tabel/graph segar
        location.reload();
      })
      .catch(function () { logSync("同期失敗"); });
  }

  function pushSheet() {
    // kirim semua record (Apps Script akan append)
    var chain = Promise.resolve();
    for (var i = 0; i < state.plan.length; i++) {
      (function (p) { chain = chain.then(function () { return new Promise(function (res) { pushPlan(p); setTimeout(res, 80); }); }); })(state.plan[i]);
    }
    for (var j = 0; j < state.ship.length; j++) {
      (function (s) { chain = chain.then(function () { return new Promise(function (res) { pushShip(s); setTimeout(res, 80); }); }); })(state.ship[j]);
    }
    chain.then(function () { logSync("全件送信完了"); });
  }

  // ================= Bootstrap per halaman =================
  function initPage(page) {
    if (page === 'dashboard') pageDashboard();
    if (page === 'plan')      pagePlan();
    if (page === 'ship')      pageShip();
    if (page === 'ticket')    pageTicket();
    if (page === 'scan')      pageScan();
  }

  // Ekspos API yang dipakai di HTML (onclick)
  return { initPage: initPage, editPlan: editPlan, editShip: editShip };
})();
