"use strict";
/* ================= ЛИЧНЫЕ КАРТОЧКИ (печатные формы) ================= */
let cardEmployeeId = null;
let cardForm = "766front"; // 766front | 766back | mb6

function renderCards(v){
  const e = cardEmployeeId ? empById(cardEmployeeId) : db.employees[0];
  if(e) cardEmployeeId = e.id;
  const empOpts = db.employees.map(x=>`<option value="${x.id}"${e&&x.id===e.id?" selected":""}>${esc(x.fio)}</option>`).join("");

  let formHTML = "", pageClass = "pg-portrait";
  if(e){
    if(cardForm === "766front"){ formHTML = form766Front(e); pageClass = "pg-portrait"; }
    else if(cardForm === "766back"){ formHTML = form766Back(e); pageClass = "pg-land"; }
    else { formHTML = formMB6(e); pageClass = "pg-portrait"; }
  }

  v.innerHTML = `
  <div class="view-head"><h2>Личные карточки</h2>
    <span class="hint">рекомендуемый образец — приложение № 2 к приказу Минтруда № 766н; МБ-6 — типовая межотраслевая форма</span></div>
  <div class="filters no-print">
    <div class="field"><label>Сотрудник</label><select id="c-emp" style="min-width:280px">${empOpts}</select></div>
    <div class="field"><label>Форма</label><select id="c-form">
      <option value="766front"${cardForm==="766front"?" selected":""}>Карточка № 766н — лицевая сторона</option>
      <option value="766back"${cardForm==="766back"?" selected":""}>Карточка № 766н — оборотная сторона</option>
      <option value="mb6"${cardForm==="mb6"?" selected":""}>МБ-6 — личная карточка учёта СИЗ</option>
    </select></div>
    <button class="btn primary" id="c-print" type="button" ${e?"":"disabled"}>Печать</button>
    <button class="btn" id="c-csv" type="button" ${e?"":"disabled"}>Выгрузить в CSV</button>
  </div>
  ${e ? `<div class="card-doc ${cardForm==="766back"?"land":""}"><div class="doc">${formHTML}</div></div>`
      : `<div class="empty">Нет сотрудников. Сначала добавьте сотрудников в справочнике.</div>`}
  <p style="font-size:13px;color:var(--ink-2)" class="no-print">
    Совет: лицевую и оборотную стороны карточки № 766н печатайте на одном листе с двух сторон
    (в диалоге печати выберите «двусторонняя печать»).</p>`;

  const sel = document.getElementById("c-emp");
  if(sel) sel.addEventListener("change", () => { cardEmployeeId = sel.value; render(); });
  const sf = document.getElementById("c-form");
  if(sf) sf.addEventListener("change", () => { cardForm = sf.value; render(); });
  const bp = document.getElementById("c-print");
  if(bp && e) bp.onclick = () => doPrint(formHTML, pageClass);
  const bc = document.getElementById("c-csv");
  if(bc && e) bc.onclick = () => {
    const hold = holdingsLines().filter(l=>l.empId===e.id);
    downloadCSV(`личная_карточка_${e.fio.replace(/\s+/g,"_")}.csv`,
      [["Наименование","Размер","Дата выдачи","Количество","Срок до","Состояние","Документ"],
       ...hold.map(l=>[itemName(l.itemId), l.size||"", fmtDate(l.date), l.left, fmtDate(l.endDate),
         statusOf(l.endDate).label, `ВД-${String(l.docNum).padStart(4,"0")}`])]);
    toast("CSV сохранён");
  };
}

/* ================= ОТЧЁТЫ ================= */
let reportTab = "issues";
let lastPeriodRows = [];
let lastPeriodFrom = "", lastPeriodTo = "";
function switchReportTab(t){ reportTab = t; render(); }
function renderReports(v){
  v.innerHTML = `
  <div class="view-head"><h2>Отчёты и ведомости</h2><span class="hint">все отчёты выгружаются в CSV (открывается в Excel)</span></div>
  <div class="tabs">
    <button type="button" data-tab="issues" class="${reportTab==="issues"?"active":""}">Выдача за период</button>
    <button type="button" data-tab="expiring" class="${reportTab==="expiring"?"active":""}">Истекающие сроки</button>
    <button type="button" data-tab="stock" class="${reportTab==="stock"?"active":""}">Остатки на складе</button>
  </div>
  <div id="rep-body"></div>`;
  v.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => switchReportTab(b.dataset.tab));
  ({ issues:repIssues, expiring:repExpiring, stock:repStock })[reportTab](document.getElementById("rep-body"));
}

function repIssues(el){
  const to = todayISO();
  const from = toISO(new Date(Date.now() - 90*86400000));
  el.innerHTML = `
  <div class="filters">
    <div class="field"><label>Период с</label><input id="p-from" class="num" type="date" value="${from}"></div>
    <div class="field"><label>по</label><input id="p-to" class="num" type="date" value="${to}"></div>
    <div class="field"><label>Сотрудник</label><select id="p-emp"><option value="">Все</option>${
      db.employees.map(e=>`<option value="${e.id}">${esc(e.fio)}</option>`).join("")}</select></div>
    <button class="btn primary" id="p-run" type="button">Сформировать</button>
    <button class="btn" id="p-csv" type="button">В CSV</button>
    <button class="btn" id="p-print" type="button">Печать ведомости</button>
  </div>
  <div class="panel" style="padding:0;overflow-x:auto" id="p-out"></div>`;
  const run = () => {
    const f = document.getElementById("p-from").value, t = document.getElementById("p-to").value;
    const empId = document.getElementById("p-emp").value;
    const rows = [];
    for(const i of db.issues){
      if(i.date < f || i.date > t) continue;
      if(empId && i.employeeId !== empId) continue;
      for(const l of i.lines) rows.push({ date:i.date, num:i.num, emp:empName(i.employeeId),
        name:itemName(l.itemId), size:l.size||"", qty:l.qty, sock:l.sockMonths, end:l.endDate });
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date));
    lastPeriodRows = rows; lastPeriodFrom = f; lastPeriodTo = t;
    const total = rows.reduce((s,r)=>s+(+r.qty||0),0);
    document.getElementById("p-out").innerHTML = `<table>
      <thead><tr><th>Дата</th><th>Документ</th><th>Сотрудник</th><th>СИЗ</th><th>Размер</th><th>Кол-во</th><th>Срок носки</th><th>Годно до</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td class="num">${fmtDate(r.date)}</td><td class="num">ВД-${String(r.num).padStart(4,"0")}</td>
        <td>${esc(r.emp)}</td><td>${esc(r.name)}</td><td class="num">${esc(r.size||"—")}</td>
        <td class="num">${r.qty}</td><td class="num">${r.sock} мес.</td><td class="num">${fmtDate(r.end)}</td></tr>`).join("") ||
        `<tr><td colspan="8" style="color:var(--ink-2)">За период выдач не найдено</td></tr>`}</tbody>
      <tfoot><tr><td colspan="5" style="padding:8px 10px;font-weight:700">Итого</td><td class="num" style="font-weight:700">${total}</td><td colspan="2"></td></tr></tfoot></table>`;
    document.getElementById("p-csv").onclick = () => {
      downloadCSV("выдача_СИЗ_за_период.csv",
        [["Дата","Документ","Сотрудник","СИЗ","Размер","Количество","Срок носки (мес.)","Годно до"],
         ...rows.map(r=>[fmtDate(r.date),`ВД-${String(r.num).padStart(4,"0")}`,r.emp,r.name,r.size,r.qty,r.sock,fmtDate(r.end)])]);
      toast("CSV сохранён");
    };
    document.getElementById("p-print").onclick = () => {
      if(!rows.length){ toast("За период выдач не найдено — нечего печатать","err"); return; }
      doPrint(formPeriodSheet(rows, f, t), "pg-land");
    };
  };
  document.getElementById("p-run").onclick = run; run();
}

function repExpiring(el){
  el.innerHTML = `
  <div class="filters">
    <div class="field"><label>Истекают в ближайшие</label><select id="e-days" class="num">
      <option value="30">30 дней</option><option value="60" selected>60 дней</option><option value="90">90 дней</option>
    </select></div>
    <button class="btn primary" id="e-run" type="button">Сформировать</button>
    <button class="btn" id="e-csv" type="button">В CSV</button>
  </div>
  <div class="panel" style="padding:0;overflow-x:auto" id="e-out"></div>`;
  const run = () => {
    const days = +document.getElementById("e-days").value;
    const rows = [];
    for(const l of holdingsLines()){
      const n = daysUntil(l.endDate);
      if(n !== null && n <= days) rows.push({ where:empName(l.empId), name:itemName(l.itemId),
        size:l.size||"", qty:l.left, end:l.endDate, n, src:"выдано" });
    }
    const stock = stockMap();
    for(const [k,dt] of expiryMap()){
      const q = stock.get(k)||0; if(q <= 0) continue;
      const n = daysUntil(dt);
      if(n !== null && n <= days){
        const [iid,sz] = k.split("|");
        rows.push({ where:"Склад", name:itemName(iid), size:sz, qty:q, end:dt, n, src:"склад" });
      }
    }
    rows.sort((a,b)=>a.n-b.n);
    document.getElementById("e-out").innerHTML = `<table>
      <thead><tr><th>Где</th><th>СИЗ</th><th>Размер</th><th>Кол-во</th><th>Срок до</th><th>Осталось дней</th><th>Статус</th></tr></thead>
      <tbody>${rows.map(r=>{
        const st = statusOf(r.end);
        const cls = st.code==="expired"?"expired":st.code==="warn"?"warn":"x";
        return `<tr class="st-${cls}"><td>${esc(r.where)}</td><td>${esc(r.name)}</td><td class="num">${esc(r.size||"—")}</td>
          <td class="num">${r.qty}</td><td class="num">${fmtDate(r.end)}</td>
          <td class="num">${r.n<0?"просрочено "+(-r.n)+" дн.":r.n}</td>
          <td><span class="badge ${st.cls}">${st.code==="expired"?"Просрочено — нельзя использовать":st.label}</span></td></tr>`;
      }).join("") || `<tr><td colspan="7" style="color:var(--ink-2)">В горизонте ${days} дней истекающих сроков нет</td></tr>`}</tbody></table>`;
    document.getElementById("e-csv").onclick = () => {
      downloadCSV(`истекающие_сроки_${days}_дней.csv`,
        [["Где","СИЗ","Размер","Количество","Срок до","Осталось дней","Статус"],
         ...rows.map(r=>[r.where,r.name,r.size,r.qty,fmtDate(r.end),r.n,statusOf(r.end).label])]);
      toast("CSV сохранён");
    };
  };
  document.getElementById("e-run").onclick = run; run();
}

function repStock(el){
  const stock = stockMap(), expMap = expiryMap();
  const rows = [...stock.entries()].map(([k,q])=>{
    const [iid,sz] = k.split("|");
    const exp = expMap.get(k)||"";
    return { name:itemName(iid), size:sz, qty:q, exp };
  }).filter(r=>r.qty>0).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  el.innerHTML = `
  <div class="filters"><button class="btn" id="s-csv" type="button">В CSV</button></div>
  <div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>СИЗ</th><th>Размер</th><th>Остаток</th><th>Срок годности</th><th>Статус</th></tr></thead>
    <tbody>${rows.map(r=>{
      const st = statusOf(r.exp);
      const cls = st.code==="expired"?"expired":st.code==="warn"?"warn":"x";
      return `<tr class="st-${cls}"><td>${esc(r.name)}</td><td class="num">${esc(r.size||"—")}</td>
        <td class="num"><b>${r.qty}</b></td><td class="num">${fmtDate(r.exp)}</td>
        <td><span class="badge ${st.cls}">${r.exp?st.label:"Без срока"}</span></td></tr>`;
    }).join("") || `<tr><td colspan="5" style="color:var(--ink-2)">Склад пуст — оформите поступление</td></tr>`}</tbody></table></div>`;
  document.getElementById("s-csv").onclick = () => {
    downloadCSV("остатки_СИЗ_на_складе.csv",
      [["СИЗ","Размер","Остаток","Срок годности","Статус"],
       ...rows.map(r=>[r.name,r.size,r.qty,fmtDate(r.exp),r.exp?statusOf(r.exp).label:"Без срока"])]);
    toast("CSV сохранён");
  };
}
