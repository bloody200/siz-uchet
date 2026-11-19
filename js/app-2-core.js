"use strict";
/* ---------- утилиты ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const todayISO = () => { const d = new Date(); return toISO(d); };
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fmtDate = iso => {
  if(!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
const daysUntil = iso => {
  if(!iso) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d - t) / 86400000);
};
// Дата окончания = дата выдачи + срок (мес.) − 1 день
function endDateOf(issueDateISO, months){
  if(!issueDateISO || !months) return "";
  const [y,m,d] = issueDateISO.split("-").map(Number);
  const dt = new Date(y, m - 1 + Number(months), d);
  dt.setDate(dt.getDate() - 1);
  return toISO(dt);
}
function itemById(id){ return db.items.find(i => i.id === id); }
function empById(id){ return db.employees.find(e => e.id === id); }
const itemName = id => { const i = itemById(id); return i ? i.name : "(удалено)"; };
const empName = id => { const e = empById(id); return e ? e.fio : "(удалён)"; };
function normById(id){ return db.norms.find(n => n.id === id); }
const normName = id => { const n = normById(id); return n ? n.name : "—"; };
// Прибавить месяцы к дате ISO (с защитой от переполнения месяца)
function addMonthsToISO(iso, months){
  if(!iso || !months) return iso;
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + Number(months), d);
  if(dt.getDate() !== d) dt.setDate(0); // напр. 31.01 + 1 мес -> последний день февраля
  return toISO(dt);
}

/* Статус срока: expired / warn / ok */
function statusOf(endISO){
  const n = daysUntil(endISO);
  if(n === null) return { code:"none", label:"Без срока", cls:"b-gray" };
  if(n < 0) return { code:"expired", label:"Просрочено", cls:"b-red" };
  if(n <= db.settings.warnDays) return { code:"warn", label:`Истекает (${n} дн.)`, cls:"b-amber" };
  return { code:"ok", label:`Действует (${n} дн.)`, cls:"b-green" };
}

/* ---------- учётные вычисления ---------- */
const key = (itemId,size) => itemId + "|" + (size||"");

// Остаток на складе по позициям
function stockMap(){
  const m = new Map();
  const add = (k,q) => m.set(k,(m.get(k)||0)+q);
  for(const r of db.receipts) for(const l of r.lines) add(key(l.itemId,l.size), +l.qty||0);
  for(const i of db.issues) if(!i.manual) for(const l of i.lines) add(key(l.itemId,l.size), -(+l.qty||0));
  for(const w of db.writeoffs) if(w.scope==="stock") for(const l of w.lines) add(key(l.itemId,l.size), -(+l.qty||0));
  return m;
}
// Срок годности по позиции — из последнего поступления
function expiryMap(){
  const m = new Map();
  const docs = [...db.receipts].sort((a,b)=> a.date.localeCompare(b.date) || a.num - b.num);
  for(const r of docs) for(const l of r.lines){
    if(l.expiry) m.set(key(l.itemId,l.size), l.expiry);
  }
  return m;
}
// СИЗ у сотрудников: по строкам выдачи с FIFO-списанием;
// возвраты (списания у сотрудника) привязываются к строкам выдачи для печатных форм
function holdingsDetailed(){
  const groups = new Map(); // empId|item|size -> lines
  for(const i of db.issues){
    i.lines.forEach((l, idx) => {
      const k = i.employeeId + "|" + key(l.itemId,l.size);
      if(!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ empId:i.employeeId, itemId:l.itemId, size:l.size||"",
        date:i.date, endDate:l.endDate, qty:+l.qty||0, left:+l.qty||0, docNum:i.num,
        docId:i.id, lineIdx:idx, returns: [], exts: [] });
    });
  }
  for(const w of db.writeoffs){
    if(w.scope !== "employee") continue;
    for(const l of w.lines){
      const k = w.employeeId + "|" + key(l.itemId,l.size);
      let toCancel = +l.qty||0;
      const lines = (groups.get(k)||[]).sort((a,b)=> a.date.localeCompare(b.date));
      for(const ln of lines){
        if(toCancel <= 0) break;
        const take = Math.min(ln.left, toCancel);
        ln.left -= take; toCancel -= take;
        ln.returns.push({ date:w.date, qty:take, docNum:w.num, reason:w.reason });
      }
    }
  }
  // Продления срока носки: применяются по привязке к строке выдачи (по возрастанию номера)
  for(const x of [...db.extensions].sort((a,b)=>a.num-b.num)){
    for(const lines of groups.values()) for(const ln of lines){
      if(ln.docId === x.docId && ln.lineIdx === x.lineIdx){
        ln.endDate = x.newEndDate;
        ln.exts.push(x);
      }
    }
  }
  const out = [];
  for(const lines of groups.values()) for(const ln of lines) out.push(ln);
  return out;
}
function holdingsLines(){
  return holdingsDetailed().filter(l => l.left > 0);
}
// Сводно: сколько числится за сотрудником по позиции
function holdingQty(empId, itemId, size){
  return holdingsLines()
    .filter(l => l.empId===empId && l.itemId===itemId && (l.size||"")===(size||""))
    .reduce((s,l)=> s + l.left, 0);
}

/* ---------- тосты ---------- */
function toast(msg, kind){
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast" + (kind==="err" ? " err" : kind==="warn" ? " warn" : "");
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .25s"; setTimeout(()=>el.remove(),260); }, 3600);
}

/* ---------- модальное окно ---------- */
function openModal(title, bodyHTML, onOk, okLabel){
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>
      <div class="modal-body">${bodyHTML}</div>
      <div class="actions">
        <button class="btn" type="button" data-close>Отмена</button>
        <button class="btn primary" type="button" data-ok>${esc(okLabel||"Сохранить")}</button>
      </div>
    </div>`;
  root.classList.add("open");
  const close = () => { root.classList.remove("open"); root.innerHTML=""; document.removeEventListener("keydown", onKey); };
  const onKey = e => { if(e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
  root.querySelector("[data-ok]").addEventListener("click", () => {
    const res = onOk(root.querySelector(".modal"));
    if(res !== false) close();
  });
  const first = root.querySelector("input,select");
  if(first) first.focus();
  return close;
}

/* ---------- CSV ---------- */
function downloadCSV(filename, rows){
  const q = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const csv = rows.map(r => r.map(q).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- печать ---------- */
function doPrint(html, pageClass){
  const r = document.getElementById("print-root");
  r.innerHTML = `<div class="doc ${pageClass}">${html}</div>`;
  const cleanup = () => { r.innerHTML = ""; window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

/* ---------- навигация ---------- */
const VIEWS = [
  {id:"dashboard", sec:"Обзор",    label:"Главная"},
  {id:"employees", sec:"Справочники", label:"Сотрудники"},
  {id:"items",     sec:"Справочники", label:"Номенклатура СИЗ"},
  {id:"norms",     sec:"Справочники", label:"Нормы выдачи"},
  {id:"receipts",  sec:"Документы", label:"Поступление (приёмка)"},
  {id:"issues",    sec:"Документы", label:"Выдача СИЗ"},
  {id:"writeoffs", sec:"Документы", label:"Списание (возврат)"},
  {id:"extensions",sec:"Документы", label:"Продление срока"},
  {id:"cards",     sec:"Учёт",     label:"Личные карточки"},
  {id:"reports",   sec:"Учёт",     label:"Отчёты и ведомости"},
  {id:"data",      sec:"Сервис",   label:"Данные и настройки"},
];
let currentView = "dashboard";

function renderNav(){
  const nav = document.getElementById("nav");
  let html = "", lastSec = null;
  for(const v of VIEWS){
    if(v.sec !== lastSec){ html += `<div class="nav-sec">${esc(v.sec)}</div>`; lastSec = v.sec; }
    html += `<button type="button" data-view="${v.id}" class="${v.id===currentView?"active":""}">${esc(v.label)}</button>`;
  }
  nav.innerHTML = html;
  nav.querySelectorAll("button[data-view]").forEach(b =>
    b.addEventListener("click", () => showView(b.dataset.view)));
}
function showView(id){
  currentView = id;
  const meta = VIEWS.find(v=>v.id===id);
  document.getElementById("topbar-title").textContent = meta ? meta.label : "";
  renderNav(); render(); updateWarnBadge();
  if(location.hash !== "#"+id) history.replaceState(null,"","#"+id);
}
window.addEventListener("hashchange", () => {
  const h = (location.hash||"").replace("#","");
  if(VIEWS.some(v=>v.id===h) && h !== currentView) showView(h);
});

/* Бейдж предупреждений в шапке */
function updateWarnBadge(){
  const badge = document.getElementById("warn-badge");
  const exp = holdingsLines().filter(l => statusOf(l.endDate).code === "expired");
  const stockExp = [...expiryMap().entries()].filter(([k,dt]) => (stockMap().get(k)||0) > 0 && statusOf(dt).code === "expired");
  const total = exp.length + stockExp.length;
  if(total > 0){
    badge.classList.add("show");
    badge.textContent = `Просрочено: ${total} поз. — использовать нельзя`;
    badge.onclick = () => { showView("reports"); setTimeout(()=>switchReportTab("expiring"),0); };
  }else{
    badge.classList.remove("show");
  }
}

/* Баннер подключения базы (показывается во всех разделах, пока файла нет) */
function dbBannerHTML(){
  if(persistMode !== "memory") return "";
  const hasHandle = !!lastKnownHandle;
  if(fsAccessOK){
    return `<div class="db-banner no-print">
      <p><b>Файл базы данных не подключён.</b><br>
      Данные сейчас не сохраняются. Создайте новый файл базы (.db) или откройте существующий —
      дальше программа будет сохранять всё автоматически.</p>
      ${hasHandle ? `<button class="btn primary" id="db-reconnect" type="button">Подключить «${esc(lastKnownHandle.name)}»</button>` : ""}
      <button class="btn ${hasHandle?"":"primary"}" id="db-create" type="button">Создать базу</button>
      <button class="btn" id="db-open" type="button">Открыть файл базы</button>
    </div>`;
  }
  return `<div class="db-banner no-print">
    <p><b>Файл базы данных не подключён.</b><br>
    Этот браузер не поддерживает автоматическую запись в файл. Откройте существующий файл базы (.db)
    или начните с пустой базы, а после работы скачивайте файл кнопкой «Скачать файл базы» в разделе
    «Данные и настройки». Для автосохранения используйте Chrome или Edge.</p>
    <button class="btn primary" id="db-open-legacy" type="button">Открыть файл базы</button>
    <button class="btn" id="db-new-memory" type="button">Начать с пустой базы</button>
  </div>`;
}
let lastKnownHandle = null;
function bindDbBanner(v){
  const b1 = v.querySelector("#db-create"); if(b1) b1.onclick = createDbFile;
  const b2 = v.querySelector("#db-open"); if(b2) b2.onclick = openDbFile;
  const b3 = v.querySelector("#db-reconnect"); if(b3) b3.onclick = reconnectHandle;
  const b4 = v.querySelector("#db-open-legacy");
  if(b4) b4.onclick = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".db,.sqlite,application/octet-stream";
    inp.onchange = () => openDbFileLegacy(inp);
    inp.click();
  };
  const b5 = v.querySelector("#db-new-memory");
  if(b5) b5.onclick = () => {
    sqdb = new SQL.Database(); createSchema(); db = EMPTY_DB(); syncToSql();
    persistMode = "download"; dbFileName = "";
    updateDbStatus(); render();
    toast("Пустая база создана в памяти. Не забудьте скачать файл после работы!","warn");
  };
}

/* ---------- корневой рендер ---------- */
function render(){
  const v = document.getElementById("view");
  ({ dashboard:renderDashboard, employees:renderEmployees, items:renderItems, norms:renderNorms,
     receipts:renderReceipts, issues:renderIssues, writeoffs:renderWriteoffs, extensions:renderExtensions,
     cards:renderCards, reports:renderReports, data:renderData }[currentView] || renderDashboard)(v);
  if(persistMode === "memory"){
    const banner = dbBannerHTML();
    if(banner){ v.insertAdjacentHTML("afterbegin", banner); bindDbBanner(v); }
  }
}
