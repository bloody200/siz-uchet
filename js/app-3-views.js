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
        <tr><td class="num">2</td><td>Заполните справочники: номенклатура СИЗ (со сроками носки) и сотрудники (с размерами).</td></tr>
        <tr><td class="num">3</td><td>Оформите <b>Поступление</b> — приёмку СИЗ на склад (с датами сроков годности).</td></tr>
        <tr><td class="num">4</td><td>Оформляйте <b>Выдачу</b> — программа рассчитает срок окончания и не даст выдать просроченное. По документу выдачи печатается ведомость <b>МБ-7</b>.</td></tr>
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
    <thead><tr><th>ФИО</th><th>Таб. №</th><th>Должность</th><th>Подразделение</th><th>Размеры (од/об/гол)</th><th>СИЗ на руках</th><th></th></tr></thead>
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
  const e = id ? empById(id) : {fio:"",tabnum:"",position:"",dept:"",pol:"",rost:"",hiredDate:"",sizeOdezhda:"",sizeObuv:"",sizeGolovnoi:"",sizeSIZOD:"",sizeRuk:""};
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
        sizeRuk: m.querySelector("#f-sr").value.trim() };
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
