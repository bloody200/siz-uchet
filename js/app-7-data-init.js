"use strict";
/* ================= ДАННЫЕ И НАСТРОЙКИ ================= */
function renderData(v){
  const fsPart = fsAccessOK ? `
      <button class="btn primary" id="s-db-create" type="button">Создать файл базы</button>
      <button class="btn" id="s-db-open" type="button">Открыть файл базы</button>
      ${lastKnownHandle && persistMode==="memory" ? `<button class="btn" id="s-db-reconnect" type="button">Подключить «${esc(lastKnownHandle.name)}»</button>` : ""}`
    : `
      <button class="btn" id="s-db-open-legacy" type="button">Открыть файл базы (.db)</button>
      <button class="btn" id="s-db-new" type="button">Начать с пустой базы</button>
      <p style="font-size:13px;color:var(--ink-2);margin-top:8px">В этом браузере нет автозаписи в файл.
      После работы нажимайте «Скачать файл базы». Для автосохранения используйте Chrome или Edge.</p>`;

  v.innerHTML = `
  <div class="view-head"><h2>Данные и настройки</h2></div>
  <div class="panel">
    <h3>Файл базы данных (SQLite)</h3>
    <p style="font-size:14px;color:var(--ink-2);margin-bottom:12px" id="s-db-info"></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${fsPart}
      <button class="btn" id="s-db-download" type="button" ${sqdb?"":"disabled"}>Скачать копию базы (.db)</button>
    </div>
    <p style="font-size:13px;color:var(--ink-2);margin-top:10px">
      Файл .db — обычная база SQLite: её можно копировать, класть в общую папку, открывать программой
      DB Browser for SQLite. Резервная копия = просто копия файла.</p>
  </div>
  <div class="panel">
    <h3>Настройки</h3>
    <div class="form-row">
      <div class="field"><label>Название организации (для печатных форм)</label>
        <input id="s-org" value="${esc(db.settings.orgName)}" placeholder="ООО «Агрокомплекс»"></div>
      <div class="field"><label>ОКПО</label>
        <input id="s-okpo" class="num" value="${esc(db.settings.okpo||"")}" placeholder="12345678"></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Ответственный за ведение карточек (ФИО)</label>
        <input id="s-resp" value="${esc(db.settings.responsible||"")}" placeholder="Смирнова О. В."></div>
      <div class="field"><label>Кладовщик (для МБ-7)</label>
        <input id="s-storek" value="${esc(db.settings.storekeeper||"")}" placeholder="Козлов И. П."></div>
      <div class="field"><label>Порог предупреждения, дней</label>
        <input id="s-warn" class="num" type="number" min="1" max="180" value="${db.settings.warnDays}"></div>
    </div>
    <button class="btn primary" id="s-save" type="button">Сохранить настройки</button>
  </div>
  <div class="panel">
    <h3>Перенос данных (JSON)</h3>
    <p style="font-size:14px;color:var(--ink-2);margin-bottom:12px">
      JSON-выгрузка удобна для просмотра данных или переноса в другие программы. Основной формат хранения — файл базы .db.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" id="s-export" type="button">Выгрузить базу (JSON)</button>
      <label class="btn" for="s-import">Загрузить базу (JSON)</label>
      <input id="s-import" type="file" accept=".json,application/json" style="display:none">
    </div>
  </div>
  <div class="panel">
    <h3>Демонстрационные данные</h3>
    <p style="font-size:14px;color:var(--ink-2);margin-bottom:12px">
      Заполнит базу примером: 3 сотрудника, 5 позиций СИЗ, поступления (включая просроченную партию),
      выдачи с разными сроками — сразу видно цветовую индикацию, блокировки и можно напечатать все формы.</p>
    <button class="btn" id="s-demo" type="button">Загрузить демо-данные</button>
  </div>
  <div class="panel" style="border-color:var(--red)">
    <h3 style="color:var(--red)">Опасная зона</h3>
    <button class="btn danger" id="s-wipe" type="button">Удалить все данные</button>
  </div>`;

  const info = document.getElementById("s-db-info");
  if(persistMode === "fs" && dbHandle) info.textContent = `Подключён файл «${dbFileName}» — все изменения сохраняются автоматически.`;
  else if(persistMode === "download") info.textContent = `База открыта${dbFileName ? ` из файла «${dbFileName}»` : " (новая, в памяти)"} — скачивайте файл после работы.`;
  else info.textContent = "Файл базы не подключён — данные будут потеряны при закрытии вкладки.";

  const bCreate = document.getElementById("s-db-create"); if(bCreate) bCreate.onclick = createDbFile;
  const bOpen = document.getElementById("s-db-open"); if(bOpen) bOpen.onclick = openDbFile;
  const bRec = document.getElementById("s-db-reconnect"); if(bRec) bRec.onclick = reconnectHandle;
  const bLeg = document.getElementById("s-db-open-legacy");
  if(bLeg) bLeg.onclick = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".db,.sqlite,application/octet-stream";
    inp.onchange = () => openDbFileLegacy(inp);
    inp.click();
  };
  const bNew = document.getElementById("s-db-new");
  if(bNew) bNew.onclick = () => {
    sqdb = new SQL.Database(); createSchema(); db = EMPTY_DB(); syncToSql();
    persistMode = "download"; dbFileName = "";
    updateDbStatus(); render();
    toast("Пустая база создана в памяти. Скачайте файл после работы!","warn");
  };
  document.getElementById("s-db-download").onclick = downloadDbFile;

  document.getElementById("s-save").onclick = () => {
    db.settings.orgName = document.getElementById("s-org").value.trim();
    db.settings.okpo = document.getElementById("s-okpo").value.trim();
    db.settings.responsible = document.getElementById("s-resp").value.trim();
    db.settings.storekeeper = document.getElementById("s-storek").value.trim();
    db.settings.warnDays = Math.max(1, +document.getElementById("s-warn").value || 30);
    save(); updateWarnBadge(); toast("Настройки сохранены");
  };
  document.getElementById("s-export").onclick = () => {
    const blob = new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `учет_сиз_выгрузка_${todayISO()}.json`; a.click();
    URL.revokeObjectURL(a.href); toast("Файл выгрузки сохранён");
  };
  document.getElementById("s-import").addEventListener("change", ev => {
    const f = ev.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try{
        const d = JSON.parse(rd.result);
        if(!d.items || !d.employees) throw new Error("формат");
        db = Object.assign(EMPTY_DB(), d);
        save(); render(); updateWarnBadge();
        toast("База загружена: " + db.items.length + " позиций, " + db.employees.length + " сотрудников");
      }catch(e){ toast("Не удалось прочитать файл — неверный формат","err"); }
    };
    rd.readAsText(f);
    ev.target.value = "";
  });
  document.getElementById("s-demo").onclick = () => {
    if(!confirm("Текущие данные будут заменены демонстрационными. Продолжить?")) return;
    loadDemo(); save(); showView("dashboard"); toast("Демо-данные загружены");
  };
  document.getElementById("s-wipe").onclick = () => {
    if(confirm("Удалить ВСЕ данные безвозвратно?")){ db = EMPTY_DB(); save(); render(); updateWarnBadge(); toast("База очищена"); }
  };
}

function loadDemo(){
  db = EMPTY_DB();
  const e1={id:uid(),fio:"Иванов Сергей Петрович",tabnum:"0012",position:"Тракторист",dept:"Мехотряд №1",
    pol:"мужской",rost:"182",hiredDate:"2019-03-12",
    sizeOdezhda:"52-54",sizeObuv:"43",sizeGolovnoi:"58",sizeSIZOD:"2",sizeRuk:"9"};
  const e2={id:uid(),fio:"Петрова Анна Владимировна",tabnum:"0031",position:"Лаборант",dept:"Лаборатория",
    pol:"женский",rost:"168",hiredDate:"2021-06-01",
    sizeOdezhda:"44-46",sizeObuv:"37",sizeGolovnoi:"56",sizeSIZOD:"1",sizeRuk:"7"};
  const e3={id:uid(),fio:"Сидоров Олег Николаевич",tabnum:"0045",position:"Сварщик",dept:"Ремонтная мастерская",
    pol:"мужской",rost:"176",hiredDate:"2015-09-20",
    sizeOdezhda:"56-58",sizeObuv:"45",sizeGolovnoi:"60",sizeSIZOD:"3",sizeRuk:"10"};
  db.employees.push(e1,e2,e3);
  const i1={id:uid(),name:"Костюм х/б",type:"Спецодежда",unit:"шт",sockMonths:12,normPoint:"п. 44 табл. 1 ЕТН",model:"Костюм «Агро», ТУ 8572-001-…"};
  const i2={id:uid(),name:"Ботинки кожаные",type:"Спецобувь",unit:"пара",sockMonths:12,normPoint:"п. 45 табл. 1 ЕТН",model:"ПУ/нитрил, М2"};
  const i3={id:uid(),name:"Перчатки комбинированные",type:"Средства защиты рук",unit:"пара",sockMonths:1,normPoint:"п. 46 табл. 1 ЕТН",model:"Спилок + х/б"};
  const i4={id:uid(),name:"Каска защитная",type:"Головной убор",unit:"шт",sockMonths:24,normPoint:"п. 44 табл. 1 ЕТН",model:"РОСОМЗ СОМЗ-55"};
  const i5={id:uid(),name:"Маска сварщика",type:"Средства защиты глаз",unit:"шт",sockMonths:12,normPoint:"п. 89 табл. 1 ЕТН",model:"НН-10 «Горизонт»"};
  db.items.push(i1,i2,i3,i4,i5);

  const d = n => toISO(new Date(Date.now() + n*86400000));
  db.seq.receipt = 2;
  db.receipts.push(
    {id:uid(),num:1,date:d(-40),supplier:"ООО «Спецодежда-Поволжье»",lines:[
      {itemId:i1.id,size:"52-54",qty:5,expiry:d(700)},{itemId:i1.id,size:"44-46",qty:3,expiry:d(700)},
      {itemId:i2.id,size:"43",qty:4,expiry:d(-5)},{itemId:i2.id,size:"45",qty:2,expiry:d(-5)},
      {itemId:i3.id,size:"",qty:30,expiry:d(20)}]},
    {id:uid(),num:2,date:d(-10),supplier:"АО «Защита»",lines:[
      {itemId:i4.id,size:"",qty:6,expiry:""},{itemId:i5.id,size:"",qty:3,expiry:d(400)}]}
  );
  db.seq.issue = 3;
  db.issues.push(
    {id:uid(),num:1,date:d(-45),employeeId:e1.id,manual:false,lines:[
      {itemId:i1.id,size:"52-54",qty:1,sockMonths:12,endDate:endDateOf(d(-45),12)},
      {itemId:i3.id,size:"",qty:2,sockMonths:1,endDate:endDateOf(d(-45),1)}]},
    {id:uid(),num:2,date:d(-8),employeeId:e2.id,manual:false,lines:[
      {itemId:i1.id,size:"44-46",qty:1,sockMonths:12,endDate:endDateOf(d(-8),12)},
      {itemId:i3.id,size:"",qty:4,sockMonths:1,endDate:endDateOf(d(-8),1)}]},
    {id:uid(),num:3,date:d(-200),employeeId:e3.id,manual:true,lines:[
      {itemId:i5.id,size:"",qty:1,sockMonths:12,endDate:endDateOf(d(-200),12)},
      {itemId:i4.id,size:"",qty:1,sockMonths:24,endDate:endDateOf(d(-200),24)}]}
  );
  db.seq.writeoff = 1;
  db.writeoffs.push({id:uid(),num:1,date:d(-30),scope:"employee",employeeId:e1.id,
    reason:"Износ",lines:[{itemId:i3.id,size:"",qty:1}]});
}

/* ================= ЗАПУСК ================= */
(async function init(){
  const v = document.getElementById("view");
  v.innerHTML = `<div class="empty">Загрузка движка базы данных SQLite…</div>`;
  try{
    await initSql();
  }catch(e){
    v.innerHTML = `<div class="empty" style="border-color:var(--red);color:var(--red)">
      Не удалось запустить движок SQLite: ${esc(e.message)}<br>
      Проверьте подключение к интернету (нужен доступ к cdn.jsdelivr.net) и обновите страницу.</div>`;
    return;
  }
  sqdb = new SQL.Database();
  createSchema();
  await autoReconnect();
  const h = (location.hash||"").replace("#","");
  if(VIEWS.some(v=>v.id===h)) currentView = h;
  showView(currentView);
  updateDbStatus();
})();
