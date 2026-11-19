"use strict";
/* ================= ГЛАВНАЯ ================= */
function renderDashboard(v){
  const stock = stockMap();
  const stockTotal = [...stock.values()].reduce((s,q)=>s+q,0);
  const holdings = holdingsLines();
  const holdTotal = holdings.reduce((s,l)=>s+l.left,0);

  const expHold = holdings.filter(l => statusOf(l.endDate).code==="expired");
  const warnHold = holdings.filter(l => statusOf(l.endDate).code==="warn");
  const expMap = expiryMap();
  const expStock = [...expMap.entries()].filter(([k,dt]) => (stock.get(k)||0)>0 && statusOf(dt).code==="expired");
  const warnStock = [...expMap.entries()].filter(([k,dt]) => (stock.get(k)||0)>0 && statusOf(dt).code==="warn");

  const alertRows = (list, isStock) => list.slice(0,6).map(l => {
    const st = statusOf(isStock ? l[1] : l.endDate);
    const name = isStock ? itemName(l[0].split("|")[0]) : itemName(l.itemId);
    const who = isStock ? "склад" : empName(l.empId);
    return `<tr><td>${esc(name)}</td><td>${esc(who)}</td>
      <td class="num">${fmtDate(isStock ? l[1] : l.endDate)}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td></tr>`;
  }).join("");

  v.innerHTML = `
  <div class="grid-stats">
    <div class="stat"><div class="v num">${db.employees.length}</div><div class="l">Сотрудников</div></div>
    <div class="stat"><div class="v num">${db.items.length}</div><div class="l">Позиций номенклатуры</div></div>
    <div class="stat"><div class="v num">${stockTotal}</div><div class="l">Единиц на складе</div></div>
    <div class="stat"><div class="v num">${holdTotal}</div><div class="l">Выдано сотрудникам</div></div>
    <div class="stat"><div class="v num" style="color:var(--red)">${expHold.length + expStock.length}</div><div class="l">Просрочено</div></div>
    <div class="stat"><div class="v num" style="color:var(--amber)">${warnHold.length + warnStock.length}</div><div class="l">Истекает ≤ ${db.settings.warnDays} дн.</div></div>
  </div>

  ${expHold.length + expStock.length ? `
  <div class="alert">
    <h4>Просроченные СИЗ — использовать нельзя</h4>
    <p>Требуется списание и замена. Полный список — в отчёте «Истекающие сроки».</p>
    <table><thead><tr><th>Позиция</th><th>Где</th><th>Срок истёк</th><th>Статус</th></tr></thead>
    <tbody>${alertRows(expHold,false)}${alertRows(expStock,true)}</tbody></table>
  </div>` : ""}

  ${warnHold.length + warnStock.length ? `
  <div class="alert amber">
    <h4>Срок истекает в ближайшие ${db.settings.warnDays} дней</h4>
    <p>Запланируйте выдачу новых СИЗ.</p>
    <table><thead><tr><th>Позиция</th><th>Где</th><th>Срок до</th><th>Статус</th></tr></thead>
    <tbody>${alertRows(warnHold,false)}${alertRows(warnStock,true)}</tbody></table>
  </div>` : ""}

  ${!db.items.length ? `
  <div class="empty">
    База пустая. Начните с раздела <b>«Данные и настройки»</b> — там можно загрузить демонстрационный набор,
    либо заполните справочники «Номенклатура СИЗ» и «Сотрудники» вручную.
  </div>` : ""}

  <div class="panel">
    <h3>Порядок работы</h3>
    <table>
      <tbody>
        <tr><td class="num" style="width:30px">1</td><td>Подключите или создайте <b>файл базы данных</b> — всё будет сохраняться автоматически.</td></tr>
        <tr><td class="num">2</td><td>Заполните справочники: номенклатура СИЗ (со сроками носки), <b>нормы выдачи</b> и сотрудники (с размерами и назначенной нормой).</td></tr>
        <tr><td class="num">3</td><td>Оформите <b>Поступление</b> — приёмку СИЗ на склад (с датами сроков годности).</td></tr>
        <tr><td class="num">4</td><td>Оформляйте <b>Выдачу</b> (можно заполнить по норме сотрудника) — программа рассчитает срок окончания и не даст выдать просроченное. По документу печатается ведомость <b>МБ-7</b>.</td></tr>
        <tr><td class="num">5</td><td>Печатайте <b>личные карточки</b> (приказ № 766н или МБ-6), следите за отчётом <b>«Истекающие сроки»</b> — просроченное списывайте документом «Списание».</td></tr>
      </tbody>
    </table>
  </div>`;
}

/* ================= СОТРУДНИКИ ================= */
function renderEmployees(v){
  const rows = db.employees.map(e => {
    const hold = holdingsLines().filter(l=>l.empId===e.id);
    const worst = hold.some(l=>statusOf(l.endDate).code==="expired") ? "expired"
                : hold.some(l=>statusOf(l.endDate).code==="warn") ? "warn" : "";
    return `<tr${worst?` class="st-${worst}"`:""}>
      <td><b>${esc(e.fio)}</b></td>
      <td class="num">${esc(e.tabnum||"—")}</td>
      <td>${esc(e.position||"")}</td>
      <td>${esc(e.dept||"")}</td>
      <td style="font-size:13px">${e.normId?esc(normName(e.normId)):"—"}</td>
      <td class="num">${esc(e.sizeOdezhda||"—")} / ${esc(e.sizeObuv||"—")} / ${esc(e.sizeGolovnoi||"—")}</td>
      <td class="num">${hold.reduce((s,l)=>s+l.left,0)||"—"}</td>
      <td style="white-space:nowrap">
        <button class="btn small ghost" data-card="${e.id}" type="button">Карточка</button>
        <button class="btn small ghost" data-edit="${e.id}" type="button">Изм.</button>
        <button class="btn small ghost" data-del="${e.id}" type="button" style="color:var(--red)">Удалить</button>
      </td></tr>`;
  }).join("");

  v.innerHTML = `
  <div class="view-head"><h2>Сотрудники</h2>
    <span class="hint">размеры: одежда / обувь / головной убор; пол, рост и дата приёма нужны для личной карточки № 766н</span>
    <div class="spacer" style="flex:1"></div>
    <button class="btn primary" id="add-emp" type="button">+ Добавить сотрудника</button>
  </div>
  ${db.employees.length ? `<div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>ФИО</th><th>Таб. №</th><th>Должность</th><th>Подразделение</th><th>Норма выдачи</th><th>Размеры (од/об/гол)</th><th>СИЗ на руках</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`
  : `<div class="empty">Сотрудников пока нет. Добавьте первого — понадобятся ФИО, должность и размеры.</div>`}`;

  document.getElementById("add-emp").onclick = () => empForm(null);
  v.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => empForm(b.dataset.edit));
  v.querySelectorAll("[data-card]").forEach(b => b.onclick = () => { showView("cards"); cardEmployeeId = b.dataset.card; setTimeout(render,0); });
  v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const e = empById(b.dataset.del);
    if(confirm(`Удалить сотрудника «${e.fio}»? Документы выдачи останутся в истории.`)){
      db.employees = db.employees.filter(x=>x.id!==e.id); save(); render();
      toast("Сотрудник удалён");
    }
  });
}

function empForm(id){
  const e = id ? empById(id) : {fio:"",tabnum:"",position:"",dept:"",pol:"",rost:"",hiredDate:"",sizeOdezhda:"",sizeObuv:"",sizeGolovnoi:"",sizeSIZOD:"",sizeRuk:"",normId:""};
  openModal(id ? "Изменить сотрудника" : "Новый сотрудник", `
    <div class="field"><label>ФИО *</label><input id="f-fio" value="${esc(e.fio)}"></div>
    <div class="form-row">
      <div class="field"><label>Табельный №</label><input id="f-tab" class="num" value="${esc(e.tabnum)}"></div>
      <div class="field"><label>Должность (профессия)</label><input id="f-pos" value="${esc(e.position)}"></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Подразделение</label><input id="f-dept" value="${esc(e.dept)}"></div>
      <div class="field"><label>Дата поступления на работу</label><input id="f-hired" class="num" type="date" value="${esc(e.hiredDate)}"></div>
    </div>
    <div class="field"><label>Норма выдачи (для автозаполнения выдачи и отчёта обеспеченности)</label>
      <select id="f-norm"><option value="">— не назначена —</option>${
        db.norms.map(n=>`<option value="${n.id}"${e.normId===n.id?" selected":""}>${esc(n.name)}</option>`).join("")}</select></div>
    <div class="form-row">
      <div class="field"><label>Пол</label><select id="f-pol">
        <option value="">—</option>
        <option${e.pol==="мужской"?" selected":""}>мужской</option>
        <option${e.pol==="женский"?" selected":""}>женский</option>
      </select></div>
      <div class="field"><label>Рост</label><input id="f-rost" class="num" value="${esc(e.rost)}" placeholder="176"></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Размер одежды</label><input id="f-so" value="${esc(e.sizeOdezhda)}" placeholder="52-54"></div>
      <div class="field"><label>Размер обуви</label><input id="f-sb" value="${esc(e.sizeObuv)}" placeholder="43"></div>
      <div class="field"><label>Головной убор</label><input id="f-sg" value="${esc(e.sizeGolovnoi)}" placeholder="58"></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Размер СИЗОД</label><input id="f-sd" value="${esc(e.sizeSIZOD)}" placeholder="2"></div>
      <div class="field"><label>Размер СИЗ рук</label><input id="f-sr" value="${esc(e.sizeRuk)}" placeholder="9"></div>
    </div>`,
    (m) => {
      const fio = m.querySelector("#f-fio").value.trim();
      if(!fio){ toast("Укажите ФИО","err"); return false; }
      const rec = { id: id||uid(), fio,
        tabnum: m.querySelector("#f-tab").value.trim(),
        position: m.querySelector("#f-pos").value.trim(),
        dept: m.querySelector("#f-dept").value.trim(),
        hiredDate: m.querySelector("#f-hired").value,
        pol: m.querySelector("#f-pol").value,
        rost: m.querySelector("#f-rost").value.trim(),
        sizeOdezhda: m.querySelector("#f-so").value.trim(),
        sizeObuv: m.querySelector("#f-sb").value.trim(),
        sizeGolovnoi: m.querySelector("#f-sg").value.trim(),
        sizeSIZOD: m.querySelector("#f-sd").value.trim(),
        sizeRuk: m.querySelector("#f-sr").value.trim(),
        normId: m.querySelector("#f-norm").value };
      if(id) Object.assign(empById(id), rec); else db.employees.push(rec);
      save(); render(); toast("Сохранено");
    });
}

/* ================= НОМЕНКЛАТУРА СИЗ ================= */
const ITEM_TYPES = ["Спецодежда","Спецобувь","Головной убор","Средства защиты рук","Средства защиты глаз","СИЗОД","Средства от падения","Смывающие средства","Прочее"];

function renderItems(v){
  const stock = stockMap();
  const rows = db.items.map(i => {
    const qty = [...stock.entries()].filter(([k])=>k.startsWith(i.id+"|")).reduce((s,[,q])=>s+q,0);
    return `<tr>
      <td><b>${esc(i.name)}</b><div style="font-size:12px;color:var(--ink-2)">${esc(i.model||"")}</div></td><td>${esc(i.type)}</td>
      <td class="num">${esc(i.normPoint||"—")}</td>
      <td class="num">${esc(i.unit)}</td>
      <td class="num">${i.sockMonths} мес.</td>
      <td class="num">${qty}</td>
      <td style="white-space:nowrap">
        <button class="btn small ghost" data-edit="${i.id}" type="button">Изм.</button>
        <button class="btn small ghost" data-del="${i.id}" type="button" style="color:var(--red)">Удалить</button>
      </td></tr>`;
  }).join("");

  v.innerHTML = `
  <div class="view-head"><h2>Номенклатура СИЗ</h2>
    <span class="hint">срок носки — для расчёта даты окончания; пункт норм и модель — для печатных форм</span>
    <div style="flex:1"></div>
    <button class="btn primary" id="add-item" type="button">+ Добавить позицию</button>
  </div>
  ${db.items.length ? `<div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>Наименование</th><th>Тип</th><th>Пункт норм</th><th>Ед.</th><th>Срок носки</th><th>На складе</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`
  : `<div class="empty">Номенклатура пуста. Добавьте позиции СИЗ с указанием срока носки в месяцах.</div>`}`;

  document.getElementById("add-item").onclick = () => itemForm(null);
  v.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => itemForm(b.dataset.edit));
  v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const i = itemById(b.dataset.del);
    if(confirm(`Удалить позицию «${i.name}»?`)){
      db.items = db.items.filter(x=>x.id!==i.id); save(); render(); toast("Позиция удалена");
    }
  });
}

function itemForm(id){
  const i = id ? itemById(id) : {name:"",type:ITEM_TYPES[0],unit:"шт",sockMonths:12,normPoint:"",model:""};
  openModal(id ? "Изменить позицию" : "Новая позиция СИЗ", `
    <div class="field"><label>Наименование *</label><input id="f-name" value="${esc(i.name)}"></div>
    <div class="form-row">
      <div class="field"><label>Тип СИЗ</label><select id="f-type">${ITEM_TYPES.map(t=>`<option${t===i.type?" selected":""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label>Единица</label><input id="f-unit" value="${esc(i.unit)}"></div>
      <div class="field"><label>Срок носки, мес. *</label><input id="f-sock" class="num" type="number" min="1" max="120" value="${i.sockMonths}"></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Пункт норм (ЕТН / локальные нормы)</label><input id="f-np" value="${esc(i.normPoint)}" placeholder="например, п. 44 таблицы 1 ЕТН"></div>
      <div class="field"><label>Модель, марка, артикул, класс защиты</label><input id="f-model" value="${esc(i.model)}"></div>
    </div>`,
    (m) => {
      const name = m.querySelector("#f-name").value.trim();
      const sock = +m.querySelector("#f-sock").value;
      if(!name){ toast("Укажите наименование","err"); return false; }
      if(!sock || sock < 1){ toast("Срок носки должен быть не менее 1 месяца","err"); return false; }
      const rec = { id: id||uid(), name, type:m.querySelector("#f-type").value,
        unit:m.querySelector("#f-unit").value.trim()||"шт", sockMonths:sock,
        normPoint:m.querySelector("#f-np").value.trim(), model:m.querySelector("#f-model").value.trim() };
      if(id) Object.assign(itemById(id), rec); else db.items.push(rec);
      save(); render(); toast("Сохранено");
    });
}

/* ================= НОРМЫ ВЫДАЧИ ================= */
let normEditId = null;   // null — новая норма
let normLines = [];

function normLinesDraw(){
  const tb = document.getElementById("n-lines-tbody");
  tb.innerHTML = normLines.map((l,idx) => `<tr>
    <td><select data-f="itemId">${itemOptions(l.itemId)}</select></td>
    <td style="width:110px"><input data-f="qty" class="num" type="number" min="0.5" step="0.5" value="${l.qty||1}"></td>
    <td style="width:36px"><button class="line-del" type="button" title="Удалить строку">×</button></td>
  </tr>`).join("");
  tb.querySelectorAll("tr").forEach((tr,idx) => {
    tr.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("input", () => {
      const f = inp.dataset.f;
      normLines[idx][f] = f==="qty" ? (+inp.value||0) : inp.value;
    }));
    tr.querySelector(".line-del").addEventListener("click", () => { normLines.splice(idx,1); normLinesDraw(); });
  });
}

function renderNorms(v){
  const editing = normEditId ? normById(normEditId) : null;
  if(editing && !normLines.length) normLines = editing.lines.map(l=>({...l}));
  if(!normEditId && !normLines.length) normLines = [{itemId:"",qty:1}];

  const rows = db.norms.map(n => {
    const used = db.employees.filter(e=>e.normId===n.id).length;
    return `<tr>
      <td><b>${esc(n.name)}</b><div style="font-size:12px;color:var(--ink-2)">${esc(n.note||"")}</div></td>
      <td class="num">${esc(n.normPoint||"—")}</td>
      <td>${n.lines.map(l=>esc(itemName(l.itemId))+` × ${l.qty}`).join("<br>")}</td>
      <td class="num">${used||"—"}</td>
      <td style="white-space:nowrap">
        <button class="btn small ghost" data-edit="${n.id}" type="button">Изм.</button>
        <button class="btn small ghost" data-del="${n.id}" type="button" style="color:var(--red)">Удалить</button>
      </td></tr>`;
  }).join("");

  v.innerHTML = `
  <div class="view-head"><h2>Нормы выдачи СИЗ</h2>
    <span class="hint">норма назначается сотруднику в его карточке; по норме автозаполняется документ выдачи и строится отчёт обеспеченности</span></div>
  <div class="panel">
    <h3>${editing ? "Изменение нормы: " + esc(editing.name) : "Новая норма"}</h3>
    <div class="form-row">
      <div class="field"><label>Название нормы *</label><input id="n-name" value="${esc(editing?editing.name:"")}" placeholder="Тракторист (п. 44–46 ЕТН)"></div>
      <div class="field"><label>Пункт норм</label><input id="n-np" value="${esc(editing?editing.normPoint||"":"")}" placeholder="п. 44–46 табл. 1 ЕТН"></div>
      <div class="field"><label>Примечание</label><input id="n-note" value="${esc(editing?editing.note||"":"")}"></div>
    </div>
    <div class="lines"><table>
      <thead><tr><th>Позиция СИЗ</th><th>Кол-во на срок носки</th><th></th></tr></thead>
      <tbody id="n-lines-tbody"></tbody></table></div>
    <div style="display:flex;gap:10px">
      <button class="btn" id="n-addline" type="button">+ Строка</button>
      <div style="flex:1"></div>
      ${editing?`<button class="btn" id="n-cancel" type="button">Отменить правку</button>`:""}
      <button class="btn primary" id="n-save" type="button">${editing?"Сохранить норму":"Добавить норму"}</button>
    </div>
  </div>
  ${db.norms.length ? `<div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>Норма</th><th>Пункт норм</th><th>Состав</th><th>Сотрудников</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`
  : `<div class="empty">Норм пока нет. Составьте норму из позиций номенклатуры — например, по ЕТН (приказ № 767н) или локальным нормам предприятия.</div>`}`;

  normLinesDraw();
  document.getElementById("n-addline").onclick = () => { normLines.push({itemId:"",qty:1}); normLinesDraw(); };
  const bc = document.getElementById("n-cancel");
  if(bc) bc.onclick = () => { normEditId = null; normLines = []; render(); };
  document.getElementById("n-save").onclick = () => {
    const name = document.getElementById("n-name").value.trim();
    const lines = normLines.filter(l=>l.itemId && l.qty>0).map(l=>({itemId:l.itemId, qty:l.qty}));
    if(!name){ toast("Укажите название нормы","err"); return; }
    if(!lines.length){ toast("Добавьте хотя бы одну позицию с количеством","err"); return; }
    if(editing){
      Object.assign(editing, { name, lines,
        normPoint: document.getElementById("n-np").value.trim(),
        note: document.getElementById("n-note").value.trim() });
      toast("Норма сохранена");
    }else{
      db.seq.norm++;
      db.norms.push({ id:uid(), num:db.seq.norm, name,
        normPoint: document.getElementById("n-np").value.trim(),
        note: document.getElementById("n-note").value.trim(), lines });
      toast("Норма добавлена");
    }
    normEditId = null; normLines = [];
    save(); render();
  };
  v.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    normEditId = b.dataset.edit; normLines = []; render();
  });
  v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const n = normById(b.dataset.del);
    const used = db.employees.filter(e=>e.normId===n.id).length;
    if(confirm(`Удалить норму «${n.name}»?${used?` Она назначена ${used} сотрудникам — привязка будет снята.`:""}`)){
      db.norms = db.norms.filter(x=>x.id!==n.id);
      for(const e of db.employees) if(e.normId===n.id) e.normId = "";
      if(normEditId===n.id){ normEditId = null; normLines = []; }
      save(); render(); toast("Норма удалена");
    }
  });
}
