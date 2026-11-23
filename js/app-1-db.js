"use strict";
/* ============================================================
   Учёт СИЗ — локальная программа v0.3.
   Движок базы данных: SQLite (sql.js 1.12.0, загружается с CDN jsDelivr).
   Файл базы (.db) хранится на диске пользователя.
   ============================================================ */

// Движок SQLite (sql.js 1.12.0) загружается с CDN — онлайн-вариант для GitHub Pages.
const LS_OLD_KEY = "sizApp.v1";          // данные прототипа v0.1 (миграция)
const IDB_NAME = "sizApp.handles";       // хранилище дескриптора файла БД

const EMPTY_DB = () => ({
  employees: [],   // {id,fio,tabnum,position,dept,pol,rost,hiredDate,sizeOdezhda,sizeObuv,sizeGolovnoi,sizeSIZOD,sizeRuk,normId}
  items: [],       // {id,name,type,unit,sockMonths,normPoint,model}
  norms: [],       // {id,num,name,normPoint,note,lines:[{itemId,qty}]}
  receipts: [],    // {id,num,date,supplier,lines:[{itemId,size,qty,expiry}]}
  issues: [],      // {id,num,date,employeeId,manual,lines:[{itemId,size,qty,sockMonths,endDate}]}
  writeoffs: [],   // {id,num,date,scope:'stock'|'employee',employeeId,reason,lines:[{itemId,size,qty}]}
  extensions: [],  // {id,num,date,docId,lineIdx,employeeId,itemId,size,addMonths,newEndDate,reason}
  settings: { warnDays: 30, orgName: "", okpo: "", responsible: "", storekeeper: "" },
  seq: { receipt: 0, issue: 0, writeoff: 0, norm: 0, ext: 0 }
});

let db = EMPTY_DB();
let SQL = null;          // модуль sql.js
let sqdb = null;         // экземпляр SQLite
let dbHandle = null;     // FileSystemFileHandle (Chrome/Edge)
let dbFileName = "";
let persistMode = "memory"; // 'fs' | 'download' | 'memory'
let persistTimer = null;
let lastSavedAt = "";

/* ---------- Инициализация SQLite ---------- */
function b64ToBytes(b64){
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) a[i] = s.charCodeAt(i);
  return a;
}
// Онлайн-вариант (GitHub Pages): движок sql.js подгружается с CDN; если один недоступен — пробуем следующий
const SQL_CDNS = [
  "https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/",
  "https://unpkg.com/sql.js@1.12.0/dist/",
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/"
];
async function initSql(){
  let lastErr = new Error("все CDN недоступны");
  for(const base of SQL_CDNS){
    try{
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = base + "sql-wasm.js";
        s.onload = res;
        s.onerror = () => rej(new Error("нет доступа к " + base));
        document.head.appendChild(s);
      });
      SQL = await initSqlJs({ locateFile: f => base + f });
      return;
    }catch(e){ lastErr = e; }
  }
  throw lastErr;
}

/* ---------- Схема ---------- */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS employees(
  id TEXT PRIMARY KEY, fio TEXT, tabnum TEXT, position TEXT, dept TEXT,
  pol TEXT, rost TEXT, hiredDate TEXT,
  sizeOdezhda TEXT, sizeObuv TEXT, sizeGolovnoi TEXT, sizeSIZOD TEXT, sizeRuk TEXT, normId TEXT);
CREATE TABLE IF NOT EXISTS norms(id TEXT PRIMARY KEY, num INTEGER, name TEXT, normPoint TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS norm_lines(
  id TEXT PRIMARY KEY, docId TEXT, itemId TEXT, qty REAL);
CREATE TABLE IF NOT EXISTS extensions(
  id TEXT PRIMARY KEY, num INTEGER, date TEXT, docId TEXT, lineIdx INTEGER,
  employeeId TEXT, itemId TEXT, size TEXT, addMonths REAL, newEndDate TEXT, reason TEXT);

CREATE TABLE IF NOT EXISTS items(
  id TEXT PRIMARY KEY, name TEXT, type TEXT, unit TEXT, sockMonths INTEGER,
  normPoint TEXT, model TEXT);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, num INTEGER, date TEXT, supplier TEXT);
CREATE TABLE IF NOT EXISTS receipt_lines(
  id TEXT PRIMARY KEY, docId TEXT, itemId TEXT, size TEXT, qty REAL, expiry TEXT);
CREATE TABLE IF NOT EXISTS issues(id TEXT PRIMARY KEY, num INTEGER, date TEXT, employeeId TEXT, manual INTEGER);
CREATE TABLE IF NOT EXISTS issue_lines(
  id TEXT PRIMARY KEY, docId TEXT, itemId TEXT, size TEXT, qty REAL, sockMonths INTEGER, endDate TEXT);
CREATE TABLE IF NOT EXISTS writeoffs(id TEXT PRIMARY KEY, num INTEGER, date TEXT, scope TEXT, employeeId TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS writeoff_lines(
  id TEXT PRIMARY KEY, docId TEXT, itemId TEXT, size TEXT, qty REAL);
`;

function createSchema(){
  sqdb.run(SCHEMA);
  // Миграция баз v0.2: добавить колонку normId, если её нет
  const cols = sqdb.exec("PRAGMA table_info(employees)");
  if(cols.length && !cols[0].values.some(r => r[1] === "normId"))
    sqdb.run("ALTER TABLE employees ADD COLUMN normId TEXT");
}

/* ---------- Чтение БД -> память ---------- */
function rowsOf(sql){
  const res = sqdb.exec(sql);
  if(!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(v => Object.fromEntries(cols.map((c,i)=>[c, v[i]])));
}
function loadFromSql(){
  const d = EMPTY_DB();
  d.employees = rowsOf("SELECT * FROM employees");
  d.items = rowsOf("SELECT * FROM items");
  d.receipts = rowsOf("SELECT * FROM receipts").map(r => ({...r,
    lines: rowsOf(`SELECT itemId,size,qty,expiry FROM receipt_lines WHERE docId='${r.id}'`)}));
  d.issues = rowsOf("SELECT * FROM issues").map(i => ({...i, manual: !!i.manual,
    lines: rowsOf(`SELECT itemId,size,qty,sockMonths,endDate FROM issue_lines WHERE docId='${i.id}'`)}));
  d.writeoffs = rowsOf("SELECT * FROM writeoffs").map(w => ({...w,
    lines: rowsOf(`SELECT itemId,size,qty FROM writeoff_lines WHERE docId='${w.id}'`)}));
  d.norms = rowsOf("SELECT * FROM norms").map(n => ({...n,
    lines: rowsOf(`SELECT itemId,qty FROM norm_lines WHERE docId='${n.id}'`)}));
  d.extensions = rowsOf("SELECT * FROM extensions");
  for(const r of rowsOf("SELECT value FROM meta WHERE key='settings'")){
    try{ Object.assign(d.settings, JSON.parse(r.value)); }catch(e){}
  }
  for(const r of rowsOf("SELECT value FROM meta WHERE key='seq'")){
    try{ Object.assign(d.seq, JSON.parse(r.value)); }catch(e){}
  }
  db = d;
}

/* ---------- Запись память -> БД -> файл ---------- */
const escSql = v => v === null || v === undefined ? "NULL" : "'" + String(v).replace(/'/g,"''") + "'";
function syncToSql(){
  sqdb.run("BEGIN");
  try{
    sqdb.run("DELETE FROM employees;DELETE FROM items;DELETE FROM receipts;DELETE FROM receipt_lines;DELETE FROM issues;DELETE FROM issue_lines;DELETE FROM writeoffs;DELETE FROM writeoff_lines;DELETE FROM norms;DELETE FROM norm_lines;DELETE FROM extensions;DELETE FROM meta;");
    for(const e of db.employees)
      sqdb.run(`INSERT INTO employees VALUES(${[e.id,e.fio,e.tabnum||"",e.position||"",e.dept||"",e.pol||"",e.rost||"",e.hiredDate||"",e.sizeOdezhda||"",e.sizeObuv||"",e.sizeGolovnoi||"",e.sizeSIZOD||"",e.sizeRuk||"",e.normId||""].map(escSql).join(",")})`);
    for(const n of db.norms){
      sqdb.run(`INSERT INTO norms VALUES(${[n.id,n.num,n.name,n.normPoint||"",n.note||""].map(escSql).join(",")})`);
      for(const l of n.lines)
        sqdb.run(`INSERT INTO norm_lines VALUES(${[uid(),n.id,l.itemId,l.qty].map(escSql).join(",")})`);
    }
    for(const x of db.extensions)
      sqdb.run(`INSERT INTO extensions VALUES(${[x.id,x.num,x.date,x.docId,x.lineIdx,x.employeeId||"",x.itemId,x.size||"",x.addMonths,x.newEndDate||"",x.reason||""].map(escSql).join(",")})`);
    for(const i of db.items)
      sqdb.run(`INSERT INTO items VALUES(${[i.id,i.name,i.type,i.unit,i.sockMonths,i.normPoint||"",i.model||""].map(escSql).join(",")})`);
    for(const r of db.receipts){
      sqdb.run(`INSERT INTO receipts VALUES(${[r.id,r.num,r.date,r.supplier||""].map(escSql).join(",")})`);
      for(const l of r.lines)
        sqdb.run(`INSERT INTO receipt_lines VALUES(${[uid(),r.id,l.itemId,l.size||"",l.qty,l.expiry||""].map(escSql).join(",")})`);
    }
    for(const i of db.issues){
      sqdb.run(`INSERT INTO issues VALUES(${[i.id,i.num,i.date,i.employeeId,i.manual?1:0].map(escSql).join(",")})`);
      for(const l of i.lines)
        sqdb.run(`INSERT INTO issue_lines VALUES(${[uid(),i.id,l.itemId,l.size||"",l.qty,l.sockMonths||0,l.endDate||""].map(escSql).join(",")})`);
    }
    for(const w of db.writeoffs){
      sqdb.run(`INSERT INTO writeoffs VALUES(${[w.id,w.num,w.date,w.scope,w.employeeId||"",w.reason||""].map(escSql).join(",")})`);
      for(const l of w.lines)
        sqdb.run(`INSERT INTO writeoff_lines VALUES(${[uid(),w.id,l.itemId,l.size||"",l.qty].map(escSql).join(",")})`);
    }
    sqdb.run(`INSERT INTO meta VALUES('settings',${escSql(JSON.stringify(db.settings))})`);
    sqdb.run(`INSERT INTO meta VALUES('seq',${escSql(JSON.stringify(db.seq))})`);
    sqdb.run("COMMIT");
  }catch(e){
    sqdb.run("ROLLBACK");
    throw e;
  }
}

/* Запись файла базы на диск (Chrome/Edge) */
async function persistNow(){
  if(!sqdb) return;
  syncToSql();
  if(persistMode === "fs" && dbHandle){
    const bytes = sqdb.export();
    const w = await dbHandle.createWritable();
    await w.write(bytes);
    await w.close();
    lastSavedAt = new Date().toLocaleTimeString("ru-RU");
  }else if(persistMode === "download"){
    lastSavedAt = "";
  }
  updateDbStatus();
}
function save(){
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistNow().catch(e => { console.error(e); toast("Ошибка записи файла базы: " + e.message, "err"); });
  }, 400);
}

/* ---------- Открытие / создание файла базы ---------- */
const fsAccessOK = "showSaveFilePicker" in window;

async function openDbFile(){
  try{
    const [h] = await showOpenFilePicker({
      types:[{ description:"База данных учёта СИЗ", accept:{ "application/octet-stream":[".db",".sqlite"] } }]
    });
    const f = await h.getFile();
    const buf = new Uint8Array(await f.arrayBuffer());
    if(buf.length > 0){
      sqdb = new SQL.Database(buf);
      createSchema();
      loadFromSql();
    }else{
      sqdb = new SQL.Database(); createSchema(); db = EMPTY_DB(); syncToSql();
    }
    dbHandle = h; dbFileName = f.name; persistMode = "fs"; lastKnownHandle = h;
    saveHandle(h);
    await persistNow();
    afterDbReady("База «" + f.name + "» открыта");
  }catch(e){ if(e.name !== "AbortError") toast("Не удалось открыть файл: " + e.message, "err"); }
}

async function createDbFile(){
  try{
    const h = await showSaveFilePicker({
      suggestedName:"учет_сиз.db",
      types:[{ description:"База данных учёта СИЗ", accept:{ "application/octet-stream":[".db"] } }]
    });
    sqdb = new SQL.Database(); createSchema(); db = EMPTY_DB();
    dbHandle = h; dbFileName = h.name; persistMode = "fs"; lastKnownHandle = h;
    saveHandle(h);
    await persistNow();
    afterDbReady("Создана новая база «" + h.name + "»");
  }catch(e){ if(e.name !== "AbortError") toast("Не удалось создать файл: " + e.message, "err"); }
}

/* Fallback (Firefox и др.): загрузка/скачивание файла */
function openDbFileLegacy(inputEl){
  const f = inputEl.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const buf = new Uint8Array(rd.result);
      sqdb = buf.length ? new SQL.Database(buf) : new SQL.Database();
      createSchema();
      if(buf.length) loadFromSql(); else { db = EMPTY_DB(); syncToSql(); }
      dbHandle = null; dbFileName = f.name; persistMode = "download";
      afterDbReady("База «" + f.name + "» открыта. Не забудьте скачивать файл после работы!");
    }catch(e){ toast("Не удалось прочитать файл базы: " + e.message, "err"); }
  };
  rd.readAsArrayBuffer(f);
  inputEl.value = "";
}
function downloadDbFile(){
  if(!sqdb) return;
  syncToSql();
  const bytes = sqdb.export();
  const blob = new Blob([bytes], { type:"application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dbFileName || ("учет_сиз_" + todayISO() + ".db");
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Файл базы скачан — сохраните его вместо старого");
}

/* Запоминание дескриптора файла в IndexedDB */
function idbOpen(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveHandle(h){
  try{
    const idb = await idbOpen();
    await new Promise((res, rej) => {
      const t = idb.transaction("kv","readwrite");
      t.objectStore("kv").put(h, "dbFile");
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }catch(e){ console.warn("handle not saved", e); }
}
async function loadHandle(){
  try{
    const idb = await idbOpen();
    return await new Promise((res, rej) => {
      const t = idb.transaction("kv","readonly");
      const q = t.objectStore("kv").get("dbFile");
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => rej(q.error);
    });
  }catch(e){ return null; }
}

/* Повторное подключение известного файла (нужен жест пользователя) */
async function reconnectHandle(){
  const h = await loadHandle();
  if(!h){ toast("Файл базы ещё не выбирался","err"); return; }
  try{
    const perm = await h.requestPermission({ mode:"readwrite" });
    if(perm !== "granted"){ toast("Доступ к файлу не разрешён","err"); return; }
    const f = await h.getFile();
    const buf = new Uint8Array(await f.arrayBuffer());
    sqdb = new SQL.Database(buf);
    createSchema(); loadFromSql();
    dbHandle = h; dbFileName = f.name; persistMode = "fs"; lastKnownHandle = h;
    await persistNow();
    afterDbReady("База «" + f.name + "» подключена");
  }catch(e){ toast("Не удалось открыть файл: " + e.message + ". Выберите файл заново.", "err"); }
}

function afterDbReady(msg){
  updateDbStatus();
  render(); updateWarnBadge();
  toast(msg);
  maybeOfferMigration();
}

function updateDbStatus(){
  const el = document.getElementById("db-status");
  const foot = document.getElementById("db-foot");
  if(persistMode === "fs" && dbHandle){
    el.className = "db-status ok";
    el.textContent = dbFileName + (lastSavedAt ? " · сохранено " + lastSavedAt : "");
    el.title = "База данных сохраняется автоматически в файл";
    foot.innerHTML = "База: " + esc(dbFileName) + "<br>автосохранение включено";
  }else if(persistMode === "download"){
    el.className = "db-status ok";
    el.textContent = dbFileName + " · скачивайте вручную";
    el.title = "Браузер не поддерживает прямую запись в файл. После работы скачивайте файл базы кнопкой в разделе «Данные и настройки».";
    foot.innerHTML = "База: " + esc(dbFileName) + "<br>ручное сохранение";
  }else{
    el.className = "db-status off";
    el.textContent = "База не подключена";
    el.title = "Данные не сохраняются. Подключите или создайте файл базы.";
    foot.innerHTML = "База данных не подключена<br>данные будут потеряны";
  }
}

/* Автоподключение при запуске, если разрешение уже дано */
async function autoReconnect(){
  if(!fsAccessOK) return;
  const h = await loadHandle();
  if(!h) return;
  lastKnownHandle = h;
  try{
    const perm = await h.queryPermission({ mode:"readwrite" });
    if(perm === "granted"){
      const f = await h.getFile();
      const buf = new Uint8Array(await f.arrayBuffer());
      sqdb = new SQL.Database(buf);
      createSchema(); loadFromSql();
      dbHandle = h; dbFileName = f.name; persistMode = "fs";
      updateDbStatus();
    }
  }catch(e){ console.warn(e); }
}

/* ---------- Миграция из прототипа v0.1 (localStorage) ---------- */
function maybeOfferMigration(){
  try{
    const raw = localStorage.getItem(LS_OLD_KEY);
    if(!raw) return;
    const old = JSON.parse(raw);
    if(!old.items || !old.items.length) return;
    if(db.items.length || db.employees.length) return; // база уже заполнена
    openModal("Найдены данные прототипа v0.1", `
      <p style="font-size:14px;margin-bottom:10px">В этом браузере найдены данные старой версии
      (${old.items.length} позиций СИЗ, ${old.employees.length} сотрудников,
      ${old.issues.length} документов выдачи).</p>
      <p style="font-size:14px">Перенести их в подключённую базу SQLite?</p>`,
      (m) => {
        db = Object.assign(EMPTY_DB(), old, { settings: Object.assign(EMPTY_DB().settings, old.settings||{}) });
        save(); render(); updateWarnBadge();
        toast("Данные перенесены в базу SQLite");
      }, "Перенести");
  }catch(e){ console.warn(e); }
}
