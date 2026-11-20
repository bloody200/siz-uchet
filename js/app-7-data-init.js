
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
    <h3>Импорт из Excel (CSV)</h3>
    <p style="font-size:14px;color:var(--ink-2);margin-bottom:12px">
      В Excel: «Файл → Сохранить как → CSV (разделители — точка с запятой)», затем загрузите файл сюда.
      Уже существующие записи (сотрудники — по ФИО и таб. №, позиции — по наименованию) пропускаются.
      Кодировка UTF-8 и Windows-1251 определяется автоматически. Если срок носки не указан, позиция получит срок 12 мес. — отредактируйте потом в справочнике. Нормы выдачи загружаются отдельным файлом: колонки «Норма; Наименование СИЗ; Кол-во на срок носки; Срок носки (мес); Пункт ЕТН». Позиции из файла норм, которых нет в номенклатуре, создаются автоматически; чтобы привязать строку нормы к уже имеющейся позиции склада, впишите её наименование точно как в справочнике номенклатуры. Повторный импорт номенклатуры обновляет уже имеющиеся позиции: дозаполняет тип, пункт норм и модель, а срок носки меняет, только если он остался по умолчанию (12 мес.) — заполненное вами вручную не затирается.</p>
    <div class="form-row">
      <div class="field"><label>Что импортируем</label><select id="imp-kind">
        <option value="employees">Сотрудники</option>
        <option value="items">Номенклатура СИЗ</option>
        <option value="norms">Нормы выдачи (по ЕТН)</option>
      </select></div>
      <div class="field"><label>Файл CSV</label><input id="imp-file" type="file" accept=".csv,text/csv"></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" id="imp-tpl-emp" type="button">Шаблон: сотрудники</button>
      <button class="btn" id="imp-tpl-item" type="button">Шаблон: номенклатура</button>
      <button class="btn" id="imp-tpl-norm" type="button">Шаблон: нормы</button>
      <button class="btn primary" id="imp-run" type="button">Импортировать</button>
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
  document.getElementById("imp-tpl-emp").onclick = () => {
    downloadCSV("шаблон_сотрудники.csv",
      [["ФИО","Табельный №","Должность","Подразделение","Пол","Рост","Дата приёма","Размер одежды","Размер обуви","Головной убор","СИЗОД","СИЗ рук","Норма выдачи"],
       ["Иванов Иван Иванович","0001","Тракторист","Мехотряд №1","мужской","182","12.03.2019","52-54","43","58","2","9","Тракторист (п. 44–46 ЕТН)"]]);
  };
  document.getElementById("imp-tpl-item").onclick = () => {
    downloadCSV("шаблон_номенклатура.csv",
      [["Наименование","Тип","Единица","Срок носки (мес)","Пункт норм","Модель"],
       ["Костюм х/б","Спецодежда","шт","12","п. 44 табл. 1 ЕТН","ТУ 8572-001-…"]]);
  };
  document.getElementById("imp-tpl-norm").onclick = () => {
    downloadCSV("шаблон_нормы.csv",
      [["Норма (профессия)","Наименование СИЗ","Кол-во на срок носки","Срок носки (мес)","Пункт ЕТН"],
       ["Тракторист-машинист с/х производства (п. 4904 ЕТН)","Костюм для защиты от механических воздействий (истирания)","1","12","п. 4904 прил. 1 ЕТН"],
       ["Тракторист-машинист с/х производства (п. 4904 ЕТН)","Перчатки для защиты от механических воздействий (истирания)","1","1","п. 4904 прил. 1 ЕТН"]]);
  };
  document.getElementById("imp-run").onclick = () => {
    const f = document.getElementById("imp-file").files[0];
    if(!f){ toast("Выберите файл CSV","err"); return; }
    const kind = document.getElementById("imp-kind").value;
    const rd = new FileReader();
    rd.onload = () => {
      let text = rd.result;
      if(text.includes(String.fromCharCode(0xFFFD))){ // не UTF-8 — читаем как Windows-1251
        const rd2 = new FileReader();
        rd2.onload = () => importCSV(kind, rd2.result);
        rd2.readAsText(f, "windows-1251");
        return;
      }
      importCSV(kind, text);
    };
    rd.readAsText(f, "utf-8");
    document.getElementById("imp-file").value = "";
  };
  document.getElementById("s-demo").onclick = () => {
    if(!confirm("Текущие данные будут заменены демонстрационными. Продолжить?")) return;
    loadDemo(); save(); showView("dashboard"); toast("Демо-данные загружены");
  };
  document.getElementById("s-wipe").onclick = () => {
    if(confirm("Удалить ВСЕ данные безвозвратно?")){ db = EMPTY_DB(); save(); render(); updateWarnBadge(); toast("База очищена"); }
  };
}

/* ---------- Импорт CSV (Excel) ---------- */
function splitCSVLine(line, delim){
  const out = []; let cur = "", inQ = false;
  for(let i=0;i<line.length;i++){
    const c = line[i];
    if(inQ){
      if(c === '"'){ if(line[i+1] === '"'){ cur += '"'; i++; } else inQ = false; }
      else cur += c;
    }else{
      if(c === '"') inQ = true;
      else if(c === delim){ out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}
function parseCSV(text){
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // срезаем BOM
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if(!lines.length) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  return lines.map(l => splitCSVLine(l, delim));
}
function parseRuDate(s){
  s = (s||"").trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function guessItemType(name){
  const s = (name||"").toLowerCase();
  if(/привязь|пояс предохран|строп/.test(s)) return "Средства от падения";
  if(/комбинезон|костюм|куртк|брюк|пальто|полупальто|плащ|халат|фартук|жилет|бель[её]|полукомбинезон|нарукавник|накомарник|блуз|сарафан/.test(s)) return "Спецодежда";
  if(/ботинк|сапог|полусапог|обувь|галош|валенк|тапочк|бахил|наколенник/.test(s)) return "Спецобувь";
  if(/перчатк|рукавиц|наперсток|наладонник/.test(s)) return "Средства защиты рук";
  if(/каск|шлем|головн|подшлемник|шапк|берет|колпак/.test(s)) return "Головной убор";
  if(/очки|щиток|светофильтр|маска сварщика/.test(s)) return "Средства защиты глаз";
  if(/респиратор|противогаз|полумаск|самоспасател|сизод|дыхани/.test(s)) return "СИЗОД";
  if(/мыло|крем|паста|смывающ|очищающ/.test(s)) return "Смывающие средства";
  return "Прочее";
}
function importCSV(kind, text){
  const rows = parseCSV(text);
  if(rows.length < 2){ toast("Файл пуст или нет строк данных","err"); return; }
  const data = rows.slice(1); // первая строка — заголовок
  let added = 0, skipped = 0, defaulted = 0, updated = 0;
  if(kind === "employees"){
    for(const r of data){
      const fio = r[0]||"";
      if(!fio){ skipped++; continue; }
      const tabnum = r[1]||"";
      if(db.employees.some(e => e.fio.toLowerCase()===fio.toLowerCase() && (e.tabnum||"")===tabnum)){ skipped++; continue; }
      const normTitle = (r[12]||"").trim().toLowerCase();
      const norm = normTitle ? db.norms.find(n => n.name.trim().toLowerCase() === normTitle) : null;
      db.employees.push({ id:uid(), fio, tabnum,
        position: r[2]||"", dept: r[3]||"",
        pol: (r[4]||"").toLowerCase().startsWith("жен") ? "женский" : (r[4]||"").toLowerCase().startsWith("муж") ? "мужской" : "",
        rost: r[5]||"", hiredDate: parseRuDate(r[6]),
        sizeOdezhda: r[7]||"", sizeObuv: r[8]||"", sizeGolovnoi: r[9]||"",
        sizeSIZOD: r[10]||"", sizeRuk: r[11]||"",
        normId: norm ? norm.id : "" });
      added++;
    }
  }else if(kind === "norms"){
    let normsNew = 0, itemsNew = 0, addedLines = 0, dup = 0;
    for(const r of data){
      const normTitle = (r[0]||"").trim();
      const itemTitle = (r[1]||"").trim();
      if(!normTitle || !itemTitle){ dup++; continue; }
      const qty = parseFloat((r[2]||"").replace(",",".")) || 1;
      const sock = parseInt((r[3]||"").replace(",","."), 10);
      const point = (r[4]||"").trim();
      let norm = db.norms.find(n => n.name.trim().toLowerCase() === normTitle.toLowerCase());
      if(!norm){
        norm = { id:uid(), num:db.seq.norm++, name:normTitle, normPoint:point, note:"", lines:[] };
        db.norms.push(norm); normsNew++;
      }else if(point && !norm.normPoint){ norm.normPoint = point; }
      let item = db.items.find(i => i.name.trim().toLowerCase() === itemTitle.toLowerCase());
      if(!item){
        item = { id:uid(), name:itemTitle, type:guessItemType(itemTitle),
          unit:/перчатк|рукавиц|ботинк|сапог|обувь|галош|валенк|наколенник/i.test(itemTitle) ? "пара" : "шт",
          sockMonths: sock >= 1 ? sock : 12, normPoint:point, model:"" };
        db.items.push(item); itemsNew++;
      }else{
        if(sock >= 1 && item.sockMonths !== sock) item.sockMonths = sock;
        if(point && !item.normPoint) item.normPoint = point;
      }
      if(norm.lines.some(l => l.itemId === item.id)){ dup++; continue; }
      norm.lines.push({ itemId:item.id, qty }); addedLines++;
    }
    save(); render(); updateWarnBadge();
    toast(`Нормы: создано ${normsNew}; строк добавлено: ${addedLines}; новых позиций в номенклатуре: ${itemsNew}; пропущено (дубли/пустые): ${dup}`, addedLines ? "" : "warn");
    return;
  }else{
    for(const r of data){
      const name = r[0]||"";
      if(!name){ skipped++; continue; }
      const ex = db.items.find(i => i.name.toLowerCase()===name.toLowerCase());
      if(ex){
        let upd = false;
        if(ITEM_TYPES.includes(r[1]) && (!ex.type || ex.type === "Прочее") && ex.type !== r[1]){ ex.type = r[1]; upd = true; }
        const usock = parseInt((r[3]||"").replace(",","."), 10);
        if(usock >= 1 && ex.sockMonths === 12 && ex.sockMonths !== usock){ ex.sockMonths = usock; upd = true; }
        const uunit = (r[2]||"").trim();
        if(uunit && (!ex.unit || ex.unit === "шт") && ex.unit !== uunit){ ex.unit = uunit; upd = true; }
        if(r[4] && !ex.normPoint){ ex.normPoint = r[4]; upd = true; }
        if(r[5] && !ex.model){ ex.model = r[5]; upd = true; }
        if(upd){ updated++; }else{ skipped++; }
        continue;
      }
      let sock = parseInt((r[3]||"").replace(",","."), 10);
      if(!(sock >= 1)){ sock = 12; defaulted++; } // срок не указан — ставим 12 мес., правится в справочнике
      db.items.push({ id:uid(), name,
        type: ITEM_TYPES.includes(r[1]) ? r[1] : "Прочее",
        unit: r[2]||"шт", sockMonths: sock, normPoint: r[4]||"", model: r[5]||"" });
      added++;
    }
  }
  save(); render(); updateWarnBadge();
  toast(`Импортировано: ${added}` + (updated ? `; обновлено: ${updated}` : "") +
    `; пропущено (дубли/пустые строки): ${skipped}` +
    (defaulted ? `; без срока носки — установлен 12 мес.: ${defaulted}` : ""), (added || updated) ? "" : "warn");
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

  db.seq.norm = 1;
  const n1 = { id:uid(), num:1, name:"Тракторист (п. 44–46 ЕТН)", normPoint:"п. 44–46 табл. 1 ЕТН", note:"",
    lines:[{itemId:i1.id,qty:1},{itemId:i2.id,qty:1},{itemId:i3.id,qty:12}] };
  db.norms.push(n1);
  e1.normId = n1.id;

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
