"use strict";
/* ================= ПЕЧАТНЫЕ ФОРМЫ ================= */
const orgLine = () => esc(db.settings.orgName || "___________________________________________");
const okpoLine = () => esc(db.settings.okpo || "__________");
const respLine = () => esc(db.settings.responsible || "____________________");
const storekLine = () => esc(db.settings.storekeeper || "____________________");
const empShort = e => { const p = e.fio.trim().split(/\s+/); return p[0] + (p[1] ? " " + p[1][0] + "." : "") + (p[2] ? p[2][0] + "." : ""); };

function signRow(a, b){
  return `<div class="sign-row">
    <span style="white-space:nowrap">${a}</span>
    <span class="w"><span class="u" style="display:block;width:100%">&nbsp;</span><span class="cap">подпись</span></span>
    <span class="w"><span class="u" style="display:block;width:100%">${b || "&nbsp;"}</span><span class="cap">фамилия, инициалы</span></span>
  </div>`;
}

/* ---------- Личная карточка по приказу Минтруда № 766н, приложение № 2 ---------- */
function form766Front(e){
  const norms = new Map(); // itemId -> последняя выдача
  for(const l of holdingsDetailed()) if(l.empId === e.id){
    const it = itemById(l.itemId);
    if(it && !norms.has(l.itemId)) norms.set(l.itemId, { it, qty: l.qty });
  }
  const normRows = [...norms.values()].map(({it, qty}) => `<tr>
    <td>${esc(it.name)}</td>
    <td style="text-align:center">${esc(it.normPoint || "")}</td>
    <td style="text-align:center">${esc(it.unit)}, 1 раз в ${it.sockMonths} мес.</td>
    <td style="text-align:center">${qty}</td></tr>`).join("");
  return `
  <table class="nb"><tr>
    <td style="width:55%"></td>
    <td class="f-right">Приложение № 2<br>к Правилам обеспечения работников<br>средствами индивидуальной защиты<br>и смывающими средствами, утвержденным<br>приказом Минтруда России<br>от 29 октября 2021 г. № 766н</td>
  </tr></table>
  <div class="f-right" style="margin-top:6px">Рекомендуемый образец</div>
  <div class="f-right" style="margin:8px 0 2px"><b>Лицевая сторона личной карточки</b></div>
  <h3 class="tt">Личная карточка № <span class="u">${esc(e.tabnum || "")}</span><br>учета выдачи СИЗ</h3>
  <div class="sub-c">Организация: <span class="u" style="min-width:300px">${orgLine()}</span></div>
  <table style="margin-top:6px">
    <tr>
      <td style="width:24%">Фамилия</td><td style="width:30%">${esc(e.fio.split(/\s+/)[0] || "")}</td>
      <td style="width:14%">Пол</td><td>${esc(e.pol || "")}</td>
    </tr>
    <tr>
      <td>Имя, отчество (при наличии)</td><td>${esc(e.fio.split(/\s+/).slice(1).join(" "))}</td>
      <td>Рост</td><td>${esc(e.rost || "")}</td>
    </tr>
    <tr><td>Табельный номер</td><td>${esc(e.tabnum || "")}</td><td><b>Размер:</b></td><td></td></tr>
    <tr><td>Структурное подразделение</td><td>${esc(e.dept || "")}</td><td>одежды</td><td>${esc(e.sizeOdezhda || "")}</td></tr>
    <tr><td>Профессия (должность)</td><td>${esc(e.position || "")}</td><td>обуви</td><td>${esc(e.sizeObuv || "")}</td></tr>
    <tr><td>Дата поступления на работу</td><td>${fmtDate(e.hiredDate)}</td><td>головного убора</td><td>${esc(e.sizeGolovnoi || "")}</td></tr>
    <tr><td>Дата изменения профессии (должности) или перевода в другое структурное подразделение</td><td></td><td>СИЗОД</td><td>${esc(e.sizeSIZOD || "")}</td></tr>
    <tr><td></td><td></td><td>СИЗ рук</td><td>${esc(e.sizeRuk || "")}</td></tr>
  </table>
  <table style="margin-top:8px">
    <thead><tr>
      <th style="width:46%">Наименование СИЗ</th>
      <th style="width:14%">Пункт Норм</th>
      <th>Единица измерения, периодичность выдачи</th>
      <th style="width:14%">Количество на период</th>
    </tr></thead>
    <tbody>${normRows || `<tr><td style="height:120px">&nbsp;</td><td></td><td></td><td></td></tr>`}</tbody>
  </table>
  <div style="margin-top:16px">Ответственное лицо за ведение карточек<br>учета выдачи СИЗ</div>
  ${signRow("", respLine())}
  <div class="foot-note">Карточка ведётся в электронном виде в соответствии с п. 25–27 Правил № 766н. Лицевая таблица заполнена по фактическим выдачам и данным справочника (пункт норм и периодичность указываются в карточке позиции СИЗ). Сформирована ${fmtDate(todayISO())}.</div>`;
}

function form766Back(e){
  const rows = holdingsDetailed().filter(l => l.empId === e.id).sort((a,b)=>a.date.localeCompare(b.date));
  const body = rows.map(l => {
    const it = itemById(l.itemId);
    const rets = l.returns.map(r => `${fmtDate(r.date)}`).join("; ");
    const retQ = l.returns.map(r => `${r.qty}`).join("; ");
    const acts = l.returns.map(r => `СП-${String(r.docNum).padStart(4,"0")} от ${fmtDate(r.date)}`).join("; ");
    return `<tr>
      <td>${esc(it ? it.name : "(удалено)")}${l.size ? `, р. ${esc(l.size)}` : ""}</td>
      <td>${esc(it && it.model || "")}</td>
      <td style="text-align:center">${fmtDate(l.date)}</td>
      <td style="text-align:center">${l.qty}</td>
      <td style="text-align:center">${it && it.type === "Смывающие средства" ? "" : ""}</td>
      <td></td>
      <td style="text-align:center">${rets}</td>
      <td style="text-align:center">${retQ}</td>
      <td></td>
      <td style="text-align:center">${esc(acts)}</td>
    </tr>`;
  }).join("");
  return `
  <div class="f-right"><b>Оборотная сторона личной карточки</b></div>
  <div class="sub-c" style="margin-top:4px">Личная карточка № <b>${esc(e.tabnum || "")}</b> — ${esc(e.fio)}</div>
  <table style="margin-top:6px">
    <thead>
      <tr>
        <th rowspan="2" style="width:16%">Наименование СИЗ</th>
        <th rowspan="2" style="width:15%">Модель, марка, артикул, класс защиты СИЗ, дерматологических СИЗ</th>
        <th colspan="4">Выдано</th>
        <th colspan="3">Возвращено **</th>
        <th rowspan="2" style="width:11%">Акт списания (дата, номер)</th>
      </tr>
      <tr>
        <th style="width:8%">дата</th>
        <th style="width:6%">коли-чество</th>
        <th style="width:7%">Лично/ дозатор *</th>
        <th style="width:10%">подпись получившего СИЗ</th>
        <th style="width:8%">дата</th>
        <th style="width:6%">коли-чество</th>
        <th style="width:10%">подпись сдавшего СИЗ</th>
      </tr>
      <tr>
        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="10" style="text-align:center">Выданных СИЗ нет</td></tr>`}</tbody>
  </table>
  <div class="foot-note">* — информация указывается только для дерматологических СИЗ.<br>
  ** — информация указывается для всех СИЗ, кроме дерматологических СИЗ и СИЗ однократного применения.<br>
  Карточка ведётся в электронном виде (п. 26 Правил № 766н): вместо личной подписи работника указываются номер и дата документа бухгалтерского учета о получении СИЗ — ВД-№ документа выдачи.</div>`;
}

/* ---------- МБ-6: Личная карточка учета средств индивидуальной защиты ---------- */
function formMB6(e){
  const rows = holdingsDetailed().filter(l => l.empId === e.id).sort((a,b)=>a.date.localeCompare(b.date));
  const body = rows.map(l => {
    const it = itemById(l.itemId);
    const rets = l.returns.map(r => fmtDate(r.date)).join("; ");
    const retQ = l.returns.map(r => String(r.qty)).join("; ");
    return `<tr>
      <td>${esc(it ? it.name : "(удалено)")}${l.size ? `, р. ${esc(l.size)}` : ""}</td>
      <td style="text-align:center">${esc(it && it.normPoint || "")}</td>
      <td style="text-align:center">${l.qty}</td>
      <td style="text-align:center">${fmtDate(l.date)}</td>
      <td style="text-align:center">${l.qty}</td>
      <td></td>
      <td style="text-align:center">${rets}</td>
      <td style="text-align:center">${retQ}</td>
      <td></td>
      <td style="text-align:center">${l.returns.length ? esc(l.returns.map(r=>`СП-${String(r.docNum).padStart(4,"0")}`).join("; ")) : ""}</td>
    </tr>`;
  }).join("");
  return `
  <div class="f-right">Типовая межотраслевая форма № МБ-6<br>Утверждена постановлением Госкомстата России<br>от 30.10.97 № 71а</div>
  <table class="nb" style="margin-top:4px"><tr>
    <td style="width:70%"></td>
    <td style="width:30%;padding:0">
      <table>
        <tr><td style="width:55%">Форма по ОКУД</td><td style="text-align:center">0320002</td></tr>
        <tr><td>по ОКПО</td><td style="text-align:center">${okpoLine()}</td></tr>
      </table>
    </td>
  </tr></table>
  <div style="margin:4px 0">Организация <span class="u" style="min-width:340px">${orgLine()}</span></div>
  <div style="margin:4px 0">Структурное подразделение <span class="u" style="min-width:280px">${esc(e.dept || "")}</span></div>
  <h3 class="tt" style="margin-top:6px">Личная карточка № <span class="u">${esc(e.tabnum || "")}</span><br>учета средств индивидуальной защиты</h3>
  <table style="margin-top:6px">
    <tr>
      <td style="width:22%">Фамилия, имя, отчество</td><td style="width:34%">${esc(e.fio)}</td>
      <td style="width:16%">Табельный номер</td><td>${esc(e.tabnum || "")}</td>
    </tr>
    <tr>
      <td>Профессия (должность)</td><td>${esc(e.position || "")}</td>
      <td>Дата поступления на работу</td><td>${fmtDate(e.hiredDate)}</td>
    </tr>
  </table>
  <table style="margin-top:4px">
    <thead><tr>
      <th>Размер одежды</th><th>Размер обуви</th><th>Размер головного убора</th>
      <th>Размер СИЗОД</th><th>Размер СИЗ рук</th>
    </tr></thead>
    <tbody><tr>
      <td style="text-align:center">${esc(e.sizeOdezhda || "")}</td>
      <td style="text-align:center">${esc(e.sizeObuv || "")}</td>
      <td style="text-align:center">${esc(e.sizeGolovnoi || "")}</td>
      <td style="text-align:center">${esc(e.sizeSIZOD || "")}</td>
      <td style="text-align:center">${esc(e.sizeRuk || "")}</td>
    </tr></tbody>
  </table>
  <table style="margin-top:6px">
    <thead>
      <tr>
        <th rowspan="2" style="width:20%">Наименование средств индивидуальной защиты</th>
        <th rowspan="2" style="width:8%">Номер по норме</th>
        <th rowspan="2" style="width:7%">Коли-чество на срок</th>
        <th colspan="3">Выдано</th>
        <th colspan="3">Сдано (возвращено)</th>
        <th rowspan="2" style="width:10%">Примечание</th>
      </tr>
      <tr>
        <th style="width:9%">дата</th><th style="width:6%">кол-во</th><th style="width:10%">подпись работника</th>
        <th style="width:9%">дата</th><th style="width:6%">кол-во</th><th style="width:10%">подпись кладовщика</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="10" style="text-align:center">Записей нет</td></tr>`}</tbody>
  </table>
  <div style="margin-top:14px">Ответственный за ведение личных карточек</div>
  ${signRow("", respLine())}
  <div class="foot-note">С 01.01.2013 форма МБ-6 не является обязательной (402-ФЗ) и применяется как удобный шаблон. Сформирована ${fmtDate(todayISO())}.</div>`;
}

/* ---------- МБ-7: Ведомость учета выдачи ---------- */
function formMB7(doc){
  const e = empById(doc.employeeId);
  const body = doc.lines.map((l, idx) => {
    const it = itemById(l.itemId);
    return `<tr>
      <td style="text-align:center">${doc.lines.indexOf(l) + 1}</td>
      <td>${esc(e ? e.fio : "(удалён)")}</td>
      <td style="text-align:center">${esc(e && e.tabnum || "")}</td>
      <td>${esc(it ? it.name : "(удалено)")}${l.size ? `, р. ${esc(l.size)}` : ""}</td>
      <td style="text-align:center"></td>
      <td style="text-align:center">${esc(it ? it.unit : "")}</td>
      <td style="text-align:center">${l.qty}</td>
      <td style="text-align:center">${fmtDate(doc.date)}</td>
      <td style="text-align:center">${l.sockMonths} мес.</td>
      <td></td>
    </tr>`;
  }).join("");
  const total = doc.lines.reduce((s,l)=>s+(+l.qty||0),0);
  return `
  <div class="f-right">Типовая межотраслевая форма № МБ-7<br>Утверждена постановлением Госкомстата России<br>от 30.10.97 № 71а</div>
  <table class="nb" style="margin-top:4px"><tr>
    <td style="width:64%"></td>
    <td style="width:36%;padding:0">
      <table>
        <tr><td style="width:60%">Форма по ОКУД</td><td style="text-align:center">0320003</td></tr>
        <tr><td>Дата составления</td><td style="text-align:center">${fmtDate(doc.date)}</td></tr>
        <tr><td>Организация по ОКПО</td><td style="text-align:center">${okpoLine()}</td></tr>
      </table>
    </td>
  </tr></table>
  <div style="margin:4px 0">Организация <span class="u" style="min-width:340px">${orgLine()}</span></div>
  <div style="margin:4px 0">Структурное подразделение <span class="u" style="min-width:280px">${esc(e && e.dept || "")}</span></div>
  <h3 class="tt" style="margin-top:6px">Ведомость № ${doc.num}<br>учета выдачи спецодежды, спецобуви<br>и предохранительных приспособлений</h3>
  <div class="sub-c">документ выдачи ВД-${String(doc.num).padStart(4,"0")} от ${fmtDate(doc.date)}</div>
  <table style="margin-top:6px">
    <thead>
      <tr>
        <th rowspan="2" style="width:4%">Номер по порядку</th>
        <th rowspan="2" style="width:16%">Фамилия, имя, отчество</th>
        <th rowspan="2" style="width:7%">Табельный номер</th>
        <th colspan="2">Спецодежда, спецобувь и предохранительные приспособления</th>
        <th rowspan="2" style="width:7%">Единица измерения</th>
        <th rowspan="2" style="width:6%">Коли-чество</th>
        <th rowspan="2" style="width:9%">Дата поступления в эксплуатацию</th>
        <th rowspan="2" style="width:7%">Срок службы</th>
        <th rowspan="2" style="width:12%">Подпись в получении (сдаче)</th>
      </tr>
      <tr>
        <th style="width:20%">наименование</th>
        <th style="width:8%">номенклатурный номер</th>
      </tr>
      <tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th></tr>
    </thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td colspan="6" style="text-align:right;font-weight:700">Итого</td>
      <td style="text-align:center;font-weight:700">${total}</td><td colspan="3"></td>
    </tr></tfoot>
  </table>
  <div style="margin-top:16px">Выдал:</div>
  ${signRow("кладовщик (ответственный за выдачу)", storekLine())}
  <div class="foot-note">С 01.01.2013 форма МБ-7 не является обязательной (402-ФЗ) и применяется как удобный шаблон. Сформирована ${fmtDate(todayISO())}.</div>`;
}

/* ---------- Ведомость выдачи за период (произвольная форма) ---------- */
function formPeriodSheet(rows, from, to){
  const body = rows.map((r, idx) => {
    const e = db.employees.find(x => x.fio === r.emp);
    return `<tr>
      <td style="text-align:center">${idx+1}</td>
      <td style="text-align:center">${fmtDate(r.date)}</td>
      <td style="text-align:center">ВД-${String(r.num).padStart(4,"0")}</td>
      <td>${esc(r.emp)}</td>
      <td style="text-align:center">${esc(e && e.tabnum || "")}</td>
      <td>${esc(e && e.dept || "")}</td>
      <td>${esc(r.name)}${r.size ? `, р. ${esc(r.size)}` : ""}</td>
      <td style="text-align:center">${r.qty}</td>
      <td style="text-align:center">${r.sock} мес.</td>
      <td style="text-align:center">${fmtDate(r.end)}</td>
      <td></td>
    </tr>`;
  }).join("");
  const total = rows.reduce((s,r)=>s+(+r.qty||0),0);
  return `
  <h3 class="tt">Ведомость выдачи средств индивидуальной защиты<br>за период с ${fmtDate(from)} по ${fmtDate(to)}</h3>
  <div class="sub-c">Организация: <span class="u" style="min-width:300px">${orgLine()}</span></div>
  <table style="margin-top:8px">
    <thead><tr>
      <th style="width:4%">№ п/п</th><th style="width:7%">Дата</th><th style="width:8%">Документ</th>
      <th style="width:16%">Сотрудник</th><th style="width:6%">Таб. №</th><th style="width:12%">Подразделение</th>
      <th>Наименование СИЗ</th><th style="width:6%">Кол-во</th><th style="width:7%">Срок носки</th>
      <th style="width:8%">Срок до</th><th style="width:10%">Подпись работника</th>
    </tr></thead>
    <tbody>${body || `<tr><td colspan="11" style="text-align:center">За период выдач не найдено</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="7" style="text-align:right;font-weight:700">Итого</td>
      <td style="text-align:center;font-weight:700">${total}</td><td colspan="3"></td>
    </tr></tfoot>
  </table>
  <div style="margin-top:16px">Составил:</div>
  ${signRow("ответственный за выдачу СИЗ", respLine())}
  <div style="margin-top:10px">Проверил:</div>
  ${signRow("специалист по охране труда", "")}
  <div class="foot-note">Форма произвольная, содержит обязательные реквизиты первичного учетного документа (ст. 9 402-ФЗ). Сформирована ${fmtDate(todayISO())}.</div>`;
}

/* ---------- МБ-8: Акт на списание ---------- */
function formMB8(w){
  const body = w.lines.map((l, idx) => {
    const it = itemById(l.itemId);
    return `<tr>
      <td style="text-align:center">${idx+1}</td>
      <td>${esc(it ? it.name : "(удалено)")}${l.size ? `, р. ${esc(l.size)}` : ""}</td>
      <td style="text-align:center"></td>
      <td style="text-align:center">${esc(it ? it.unit : "")}</td>
      <td style="text-align:center">${l.qty}</td>
      <td>${esc(w.reason)}</td>
    </tr>`;
  }).join("");
  const total = w.lines.reduce((s,l)=>s+(+l.qty||0),0);
  const fromWhom = w.scope === "stock" ? "склад" : empName(w.employeeId);
  return `
  <div class="f-right">Типовая межотраслевая форма № МБ-8<br>Утверждена постановлением Госкомстата России<br>от 30.10.97 № 71а</div>
  <table class="nb" style="margin-top:4px"><tr>
    <td style="width:64%"></td>
    <td style="width:36%;padding:0">
      <table>
        <tr><td style="width:60%">Форма по ОКУД</td><td style="text-align:center">0320004</td></tr>
        <tr><td>Дата составления</td><td style="text-align:center">${fmtDate(w.date)}</td></tr>
        <tr><td>Организация по ОКПО</td><td style="text-align:center">${okpoLine()}</td></tr>
      </table>
    </td>
  </tr></table>
  <div style="margin:4px 0">Организация <span class="u" style="min-width:340px">${orgLine()}</span></div>
  <h3 class="tt" style="margin-top:6px">Акт № СП-${String(w.num).padStart(4,"0")}<br>на списание средств индивидуальной защиты</h3>
  <div class="sub-c">от ${fmtDate(w.date)} · основание: документ списания СП-${String(w.num).padStart(4,"0")} · откуда: ${esc(fromWhom)}</div>
  <table style="margin-top:6px">
    <thead><tr>
      <th style="width:4%">№ п/п</th>
      <th>Наименование СИЗ</th>
      <th style="width:9%">Номен-клатурный номер</th>
      <th style="width:8%">Единица измерения</th>
      <th style="width:7%">Коли-чество</th>
      <th style="width:22%">Причина списания</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right;font-weight:700">Итого</td>
      <td style="text-align:center;font-weight:700">${total}</td><td></td>
    </tr></tfoot>
  </table>
  <div style="margin-top:16px">Председатель комиссии:</div>
  ${signRow("", respLine())}
  <div style="margin-top:10px">Члены комиссии:</div>
  ${signRow("", "")}
  ${signRow("", "")}
  <div class="foot-note">С 01.01.2013 форма МБ-8 не является обязательной (402-ФЗ) и применяется как удобный шаблон. Сформирована ${fmtDate(todayISO())}.</div>`;
}

/* ---------- Акт продления срока носки (произвольная форма) ---------- */
function formExtAct(num){
  const xs = db.extensions.filter(x=>x.num===num).sort((a,b)=>empName(a.employeeId).localeCompare(empName(b.employeeId),"ru"));
  if(!xs.length) return "<p>Акт не найден</p>";
  const body = xs.map((x, idx) => {
    const issue = db.issues.find(i=>i.id===x.docId);
    const oldEnd = addMonthsToISO(x.newEndDate, -x.addMonths);
    return `<tr>
      <td style="text-align:center">${idx+1}</td>
      <td>${esc(empName(x.employeeId))}</td>
      <td>${esc(itemName(x.itemId))}${x.size ? `, р. ${esc(x.size)}` : ""}</td>
      <td style="text-align:center">${issue ? "ВД-"+String(issue.num).padStart(4,"0")+" от "+fmtDate(issue.date) : "—"}</td>
      <td style="text-align:center">${fmtDate(oldEnd)}</td>
      <td style="text-align:center">${x.addMonths} мес.</td>
      <td style="text-align:center"><b>${fmtDate(x.newEndDate)}</b></td>
    </tr>`;
  }).join("");
  return `
  <h3 class="tt">Акт № ПР-${String(num).padStart(4,"0")}<br>продления срока носки средств индивидуальной защиты</h3>
  <div class="sub-c">Организация: <span class="u" style="min-width:300px">${orgLine()}</span> · от ${fmtDate(xs[0].date)}</div>
  <p style="font-size:12pt;margin:10px 0 6px">Комиссия проверила состояние выданных СИЗ и установила, что они пригодны
  к дальнейшему использованию (п. 38 Правил № 766н). Основание: ${esc(xs[0].reason || "состояние годное")}.
  Сроки носки продлены:</p>
  <table style="margin-top:6px">
    <thead><tr>
      <th style="width:4%">№ п/п</th><th style="width:18%">Сотрудник</th><th>Наименование СИЗ</th>
      <th style="width:16%">Документ выдачи</th><th style="width:10%">Прежний срок до</th>
      <th style="width:9%">Продление</th><th style="width:10%">Новый срок до</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div style="margin-top:16px">Председатель комиссии:</div>
  ${signRow("", respLine())}
  <div style="margin-top:10px">Члены комиссии:</div>
  ${signRow("", "")}
  <div class="foot-note">Форма произвольная, содержит обязательные реквизиты первичного учетного документа (ст. 9 402-ФЗ). Сформирована ${fmtDate(todayISO())}.</div>`;
}

/* ---------- Заявка на закупку СИЗ (произвольная форма) ---------- */
function formPurchaseRequest(rows, horizon){
  const body = rows.filter(r=>r.buy>0).map((r, idx) => `<tr>
    <td style="text-align:center">${idx+1}</td>
    <td>${esc(r.name)}</td>
    <td style="text-align:center">${esc(r.size||"—")}</td>
    <td style="text-align:center">${esc(r.unit)}</td>
    <td style="text-align:center"><b>${r.buy}</b></td>
    <td style="text-align:center">${r.need}</td>
    <td style="text-align:center">${r.stock}</td>
    <td></td>
  </tr>`).join("");
  const total = rows.reduce((s,r)=>s+r.buy,0);
  return `
  <h3 class="tt">Заявка на закупку средств индивидуальной защиты</h3>
  <div class="sub-c">Организация: <span class="u" style="min-width:300px">${orgLine()}</span> · от ${fmtDate(todayISO())}</div>
  <p style="font-size:12pt;margin:10px 0 6px">Потребность рассчитана по нормам выдачи с учётом СИЗ на руках,
  замены позиций, срок которых истекает в ближайшие ${horizon} дн., и складских остатков.</p>
  <table style="margin-top:6px">
    <thead><tr>
      <th style="width:4%">№ п/п</th><th>Наименование СИЗ</th><th style="width:9%">Размер</th>
      <th style="width:8%">Ед.</th><th style="width:9%">К закупке</th>
      <th style="width:10%">Потребность</th><th style="width:9%">На складе</th><th style="width:14%">Примечание</th>
    </tr></thead>
    <tbody>${body || `<tr><td colspan="8" style="text-align:center">Закупка не требуется — потребность покрыта</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right;font-weight:700">Итого к закупке</td>
      <td style="text-align:center;font-weight:700">${total}</td><td colspan="3"></td>
    </tr></tfoot>
  </table>
  <div style="margin-top:16px">Составил:</div>
  ${signRow("ответственный за выдачу СИЗ", respLine())}
  <div style="margin-top:10px">Согласовал:</div>
  ${signRow("специалист по охране труда", "")}
  <div class="foot-note">Форма произвольная, содержит обязательные реквизиты первичного учетного документа (ст. 9 402-ФЗ). Сформирована ${fmtDate(todayISO())}.</div>`;
}
