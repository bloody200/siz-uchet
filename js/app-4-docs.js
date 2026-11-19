"use strict";
/* ================= Общий редактор строк документа ================= */
function itemOptions(selectedId){
  return `<option value="">— выберите —</option>` + db.items.map(i =>
    `<option value="${i.id}"${i.id===selectedId?" selected":""}>${esc(i.name)} (${i.sockMonths} мес.)</option>`).join("");
}
function linesTable(container, lines, cols){
  // cols: ['item','size','qty',('expiry'|'sock')]
  const head = `<tr><th style="width:38%">Позиция СИЗ</th><th>Размер</th><th style="width:90px">Кол-во</th>${
    cols.includes("expiry") ? `<th style="width:150px">Срок годности</th>` : ""}${
    cols.includes("sock") ? `<th style="width:110px">Срок носки</th>` : ""}<th style="width:36px"></th></tr>`;
  container.innerHTML = `<table><thead>${head}</thead><tbody></tbody></table>`;
  const tbody = container.querySelector("tbody");
  const draw = () => {
    tbody.innerHTML = lines.map((l,idx) => `<tr>
      <td><select data-f="itemId">${itemOptions(l.itemId)}</select></td>
      <td><input data-f="size" value="${esc(l.size||"")}" placeholder="—"></td>
      <td><input data-f="qty" class="num" type="number" min="0.5" step="0.5" value="${l.qty||1}"></td>
      ${cols.includes("expiry") ? `<td><input data-f="expiry" class="num" type="date" value="${l.expiry||""}"></td>` : ""}
      ${cols.includes("sock") ? `<td><input data-f="sockMonths" class="num" type="number" min="1" value="${l.sockMonths||""}"></td>` : ""}
      <td><button class="line-del" type="button" title="Удалить строку">×</button></td>
    </tr>`).join("");
    tbody.querySelectorAll("tr").forEach((tr,idx) => {
      tr.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("input", () => {
        const f = inp.dataset.f;
        lines[idx][f] = (f==="qty"||f==="sockMonths") ? (+inp.value||0) : inp.value;
        if(f==="itemId"){
          const it = itemById(inp.value);
          if(it && cols.includes("sock")){ lines[idx].sockMonths = it.sockMonths; tr.querySelector('[data-f="sockMonths"]').value = it.sockMonths; }
        }
      }));
      tr.querySelector(".line-del").addEventListener("click", () => { lines.splice(idx,1); draw(); });
    });
  };
  draw();
  return draw;
}

function docNumCell(prefix, num){ return `<span class="num">${prefix}-${String(num).padStart(4,"0")}</span>`; }

/* ================= ПОСТУПЛЕНИЕ (приёмка) ================= */
let receiptLines = [];
function renderReceipts(v){
  if(!receiptLines.length) receiptLines = [{itemId:"",size:"",qty:1,expiry:""}];
  v.innerHTML = `
  <div class="view-head"><h2>Поступление СИЗ (приёмка)</h2>
    <span class="hint">количественный учёт; срок годности — по последней партии</span></div>
  <div class="panel">
    <h3>Новый документ</h3>
    <div class="form-row">
      <div class="field"><label>Дата</label><input id="r-date" class="num" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Поставщик</label><input id="r-sup" placeholder="ООО «Поставщик»"></div>
    </div>
    <div class="lines" id="r-lines"></div>
    <div style="display:flex;gap:10px">
      <button class="btn" id="r-addline" type="button">+ Строка</button>
      <div style="flex:1"></div>
      <button class="btn primary" id="r-save" type="button">Провести поступление</button>
    </div>
  </div>
  <div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>Номер</th><th>Дата</th><th>Поставщик</th><th>Позиции</th><th>Кол-во</th></tr></thead>
    <tbody>${[...db.receipts].sort((a,b)=>b.num-a.num).map(r=>`<tr>
      <td>${docNumCell("ПС",r.num)}</td><td class="num">${fmtDate(r.date)}</td><td>${esc(r.supplier||"—")}</td>
      <td>${r.lines.map(l=>esc(itemName(l.itemId))+(l.size?` (${esc(l.size)})`:"")).join("<br>")}</td>
      <td class="num">${r.lines.reduce((s,l)=>s+(+l.qty||0),0)}</td></tr>`).join("") ||
      `<tr><td colspan="5" style="color:var(--ink-2)">Документов пока нет</td></tr>`}</tbody></table></div>`;

  linesTable(document.getElementById("r-lines"), receiptLines, ["item","size","qty","expiry"]);
  document.getElementById("r-addline").onclick = () => {
    receiptLines.push({itemId:"",size:"",qty:1,expiry:""});
    linesTable(document.getElementById("r-lines"), receiptLines, ["item","size","qty","expiry"]);
  };
  document.getElementById("r-save").onclick = () => {
    const date = document.getElementById("r-date").value;
    const lines = receiptLines.filter(l=>l.itemId && l.qty>0);
    if(!date){ toast("Укажите дату документа","err"); return; }
    if(!lines.length){ toast("Добавьте хотя бы одну строку с позицией и количеством","err"); return; }
    for(const l of lines){
      const it = itemById(l.itemId);
      if(l.expiry && it){
        const need = endDateOf(date, it.sockMonths);
        if(l.expiry < need) toast(`«${it.name}»: срок годности истекает раньше типового срока носки`,"warn");
      }
    }
    db.seq.receipt++;
    db.receipts.push({ id:uid(), num:db.seq.receipt, date,
      supplier:document.getElementById("r-sup").value.trim(), lines });
    receiptLines = [{itemId:"",size:"",qty:1,expiry:""}];
    save(); render(); updateWarnBadge();
    toast(`Поступление ПС-${String(db.seq.receipt).padStart(4,"0")} проведено`);
  };
}

/* ================= ВЫДАЧА СИЗ ================= */
let issueLines = [];
function renderIssues(v){
  if(!issueLines.length) issueLines = [{itemId:"",size:"",qty:1,sockMonths:""}];
  const empOpts = `<option value="">— выберите сотрудника —</option>` +
    db.employees.map(e=>`<option value="${e.id}">${esc(e.fio)}${e.position?` — ${esc(e.position)}`:""}</option>`).join("");

  v.innerHTML = `
  <div class="view-head"><h2>Выдача СИЗ</h2>
    <span class="hint">дата окончания срока рассчитывается автоматически; просроченное выдать нельзя; по документу печатается ведомость МБ-7</span></div>
  <div class="panel">
    <h3>Новый документ</h3>
    <div class="form-row">
      <div class="field"><label>Дата выдачи</label><input id="i-date" class="num" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Сотрудник</label><select id="i-emp">${empOpts}</select></div>
    </div>
    <div style="margin:-4px 0 10px"><button class="btn small" id="i-fillnorm" type="button">Заполнить по норме сотрудника</button></div>
    <div class="field"><label class="check"><input type="checkbox" id="i-manual">
      Ручной ввод истории (выдача прошлым периодом, остаток склада не затрагивается)</label></div>
    <div class="lines" id="i-lines"></div>
    <div style="display:flex;gap:10px;align-items:center">
      <button class="btn" id="i-addline" type="button">+ Строка</button>
      <div style="flex:1"></div>
      <button class="btn primary" id="i-save" type="button">Провести выдачу</button>
    </div>
  </div>
  <div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>Номер</th><th>Дата</th><th>Сотрудник</th><th>Позиции</th><th>Кол-во</th><th>Режим</th><th></th></tr></thead>
    <tbody>${[...db.issues].sort((a,b)=>b.num-a.num).map(i=>`<tr>
      <td>${docNumCell("ВД",i.num)}</td><td class="num">${fmtDate(i.date)}</td><td>${esc(empName(i.employeeId))}</td>
      <td>${i.lines.map(l=>esc(itemName(l.itemId))+(l.size?` (${esc(l.size)})`:"")+` <span class="num" style="color:var(--ink-2)">до ${fmtDate(l.endDate)}</span>`).join("<br>")}</td>
      <td class="num">${i.lines.reduce((s,l)=>s+(+l.qty||0),0)}</td>
      <td>${i.manual?`<span class="badge b-gray">история</span>`:`<span class="badge b-green">склад</span>`}</td>
      <td><button class="btn small ghost" data-mb7="${i.id}" type="button" title="Печать ведомости МБ-7">МБ-7</button></td></tr>`).join("") ||
      `<tr><td colspan="7" style="color:var(--ink-2)">Документов пока нет</td></tr>`}</tbody></table></div>`;

  v.querySelectorAll("[data-mb7]").forEach(b => b.onclick = () => {
    const doc = db.issues.find(x=>x.id===b.dataset.mb7);
    if(doc) doPrint(formMB7(doc), "pg-land");
  });

  linesTable(document.getElementById("i-lines"), issueLines, ["item","size","qty","sock"]);
  document.getElementById("i-addline").onclick = () => {
    issueLines.push({itemId:"",size:"",qty:1,sockMonths:""});
    linesTable(document.getElementById("i-lines"), issueLines, ["item","size","qty","sock"]);
  };
  // Автоподстановка размера из карточки сотрудника
  document.getElementById("i-emp").addEventListener("change", () => {
    const e = empById(document.getElementById("i-emp").value);
    if(!e) return;
    for(const l of issueLines){
      const it = itemById(l.itemId);
      if(!it || l.size) continue;
      if(it.type==="Спецодежда" && e.sizeOdezhda) l.size = e.sizeOdezhda;
      if(it.type==="Спецобувь" && e.sizeObuv) l.size = e.sizeObuv;
      if(it.type==="Головной убор" && e.sizeGolovnoi) l.size = e.sizeGolovnoi;
      if(it.type==="Средства защиты рук" && e.sizeRuk) l.size = e.sizeRuk;
      if(it.type==="СИЗОД" && e.sizeSIZOD) l.size = e.sizeSIZOD;
    }
    linesTable(document.getElementById("i-lines"), issueLines, ["item","size","qty","sock"]);
  });

  document.getElementById("i-fillnorm").onclick = () => {
    const e = empById(document.getElementById("i-emp").value);
    if(!e){ toast("Сначала выберите сотрудника","err"); return; }
    const n = normById(e.normId);
    if(!n){ toast("Сотруднику не назначена норма выдачи — задайте её в карточке сотрудника","err"); return; }
    issueLines = n.lines.map(l => {
      const it = itemById(l.itemId);
      const row = { itemId:l.itemId, size:"", qty:l.qty, sockMonths: it ? it.sockMonths : "" };
      if(it){
        if(it.type==="Спецодежда" && e.sizeOdezhda) row.size = e.sizeOdezhda;
        if(it.type==="Спецобувь" && e.sizeObuv) row.size = e.sizeObuv;
        if(it.type==="Головной убор" && e.sizeGolovnoi) row.size = e.sizeGolovnoi;
        if(it.type==="Средства защиты рук" && e.sizeRuk) row.size = e.sizeRuk;
        if(it.type==="СИЗОД" && e.sizeSIZOD) row.size = e.sizeSIZOD;
      }
      return row;
    });
    linesTable(document.getElementById("i-lines"), issueLines, ["item","size","qty","sock"]);
    toast(`Строки заполнены по норме «${n.name}» — проверьте перед проведением`);
  };

  document.getElementById("i-save").onclick = () => {
    const date = document.getElementById("i-date").value;
    const empId = document.getElementById("i-emp").value;
    const manual = document.getElementById("i-manual").checked;
    const lines = issueLines.filter(l=>l.itemId && l.qty>0).map(l=>({...l}));
    if(!date){ toast("Укажите дату выдачи","err"); return; }
    if(!empId){ toast("Выберите сотрудника","err"); return; }
    if(!lines.length){ toast("Добавьте хотя бы одну строку","err"); return; }

    const expMap = expiryMap(), stock = stockMap();
    const blocked = [], warned = [], noStock = [];
    const needMap = new Map();
    for(const l of lines){
      const k = key(l.itemId,l.size);
      needMap.set(k,(needMap.get(k)||0)+(+l.qty||0));
      const exp = expMap.get(k);
      if(exp){
        const n = daysUntil(exp);
        if(n < 0) blocked.push(`«${itemName(l.itemId)}»${l.size?` (${l.size})`:""} — срок годности истёк ${fmtDate(exp)}`);
        else if(n <= db.settings.warnDays) warned.push(`«${itemName(l.itemId)}»${l.size?` (${l.size})`:""} — годен до ${fmtDate(exp)}`);
      }
    }
    if(!manual) for(const [k,q] of needMap){
      if((stock.get(k)||0) < q){
        const [iid,sz] = k.split("|");
        noStock.push(`«${itemName(iid)}»${sz?` (${sz})`:""}: требуется ${q}, на складе ${stock.get(k)||0}`);
      }
    }
    if(blocked.length){
      toast("Выдача запрещена — просроченные СИЗ использовать нельзя","err");
      alert("СИЗ с истёкшим сроком использовать нельзя, выдача запрещена:\n\n• " + blocked.join("\n• "));
      return;
    }
    if(noStock.length){ alert("Недостаточно остатков на складе:\n\n• " + noStock.join("\n• ")); return; }
    if(warned.length && !confirm("Внимание — срок годности истекает скоро:\n\n• " + warned.join("\n• ") + "\n\nВсё равно провести выдачу?")) return;

    for(const l of lines){
      const it = itemById(l.itemId);
      const months = +l.sockMonths || (it ? it.sockMonths : 0);
      l.sockMonths = months;
      l.endDate = endDateOf(date, months);
    }
    db.seq.issue++;
    const newDoc = { id:uid(), num:db.seq.issue, date, employeeId:empId, manual, lines };
    db.issues.push(newDoc);
    issueLines = [{itemId:"",size:"",qty:1,sockMonths:""}];
    save(); render(); updateWarnBadge();
    toast(`Выдача ВД-${String(db.seq.issue).padStart(4,"0")} проведена`);
    if(confirm("Распечатать ведомость МБ-7 по этой выдаче?")) doPrint(formMB7(newDoc), "pg-land");
  };
}

/* ================= СПИСАНИЕ (в т.ч. возврат от сотрудника) ================= */
const REASONS = ["Окончание срока эксплуатации","Износ","Порча","Утеря","Увольнение сотрудника"];
let wLines = [];
function renderWriteoffs(v){
  if(!wLines.length) wLines = [{itemId:"",size:"",qty:1}];
  const empOpts = `<option value="">— выберите сотрудника —</option>` +
    db.employees.map(e=>`<option value="${e.id}">${esc(e.fio)}</option>`).join("");

  v.innerHTML = `
  <div class="view-head"><h2>Списание / возврат СИЗ</h2>
    <span class="hint">списание у сотрудника отражается в графе «Возвращено» личной карточки; просроченные СИЗ к выдаче не допускаются</span></div>
  <div class="panel">
    <h3>Новый документ</h3>
    <div class="form-row">
      <div class="field"><label>Дата</label><input id="w-date" class="num" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Откуда списываем</label><select id="w-scope">
        <option value="stock">Со склада</option><option value="employee">У сотрудника (возврат/списание)</option></select></div>
      <div class="field" id="w-emp-wrap" style="display:none"><label>Сотрудник</label><select id="w-emp">${empOpts}</select></div>
      <div class="field"><label>Причина</label><select id="w-reason">${REASONS.map(r=>`<option>${r}</option>`).join("")}</select></div>
    </div>
    <div class="lines" id="w-lines"></div>
    <div style="display:flex;gap:10px">
      <button class="btn" id="w-addline" type="button">+ Строка</button>
      <div style="flex:1"></div>
      <button class="btn primary" id="w-save" type="button">Провести списание</button>
    </div>
  </div>
  <div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>Номер</th><th>Дата</th><th>Откуда</th><th>Причина</th><th>Позиции</th><th>Кол-во</th><th></th></tr></thead>
    <tbody>${[...db.writeoffs].sort((a,b)=>b.num-a.num).map(w=>`<tr>
      <td>${docNumCell("СП",w.num)}</td><td class="num">${fmtDate(w.date)}</td>
      <td>${w.scope==="stock"?"Склад":esc(empName(w.employeeId))}</td><td>${esc(w.reason)}</td>
      <td>${w.lines.map(l=>esc(itemName(l.itemId))+(l.size?` (${esc(l.size)})`:"")).join("<br>")}</td>
      <td class="num">${w.lines.reduce((s,l)=>s+(+l.qty||0),0)}</td>
      <td><button class="btn small ghost" data-mb8="${w.id}" type="button" title="Печать акта списания МБ-8">МБ-8</button></td></tr>`).join("") ||
      `<tr><td colspan="7" style="color:var(--ink-2)">Документов пока нет</td></tr>`}</tbody></table></div>`;

  v.querySelectorAll("[data-mb8]").forEach(b => b.onclick = () => {
    const doc = db.writeoffs.find(x=>x.id===b.dataset.mb8);
    if(doc) doPrint(formMB8(doc), "pg-portrait");
  });

  document.getElementById("w-scope").addEventListener("change", e => {
    document.getElementById("w-emp-wrap").style.display = e.target.value==="employee" ? "" : "none";
  });
  linesTable(document.getElementById("w-lines"), wLines, ["item","size","qty"]);
  document.getElementById("w-addline").onclick = () => {
    wLines.push({itemId:"",size:"",qty:1});
    linesTable(document.getElementById("w-lines"), wLines, ["item","size","qty"]);
  };
  document.getElementById("w-save").onclick = () => {
    const date = document.getElementById("w-date").value;
    const scope = document.getElementById("w-scope").value;
    const empId = document.getElementById("w-emp").value;
    const lines = wLines.filter(l=>l.itemId && l.qty>0);
    if(!date){ toast("Укажите дату","err"); return; }
    if(scope==="employee" && !empId){ toast("Выберите сотрудника","err"); return; }
    if(!lines.length){ toast("Добавьте хотя бы одну строку","err"); return; }
    const problems = [];
    const stock = stockMap();
    for(const l of lines){
      const avail = scope==="stock" ? (stock.get(key(l.itemId,l.size))||0)
                                    : holdingQty(empId, l.itemId, l.size||"");
      if(avail < +l.qty) problems.push(`«${itemName(l.itemId)}»${l.size?` (${l.size})`:""}: доступно ${avail}, списывается ${l.qty}`);
    }
    if(problems.length){ alert("Нельзя списать больше, чем числится:\n\n• " + problems.join("\n• ")); return; }
    db.seq.writeoff++;
    db.writeoffs.push({ id:uid(), num:db.seq.writeoff, date, scope,
      employeeId: scope==="employee"?empId:null,
      reason: document.getElementById("w-reason").value, lines });
    wLines = [{itemId:"",size:"",qty:1}];
    save(); render(); updateWarnBadge();
    toast(`Списание СП-${String(db.seq.writeoff).padStart(4,"0")} проведено`);
  };
}

/* ================= ПРОДЛЕНИЕ СРОКА НОСКИ ================= */
let extEmpId = "";
function renderExtensions(v){
  const empOpts = `<option value="">— выберите сотрудника —</option>` +
    db.employees.map(e=>`<option value="${e.id}"${e.id===extEmpId?" selected":""}>${esc(e.fio)}</option>`).join("");

  // Журнал продлений (группировка по номеру акта)
  const byNum = new Map();
  for(const x of db.extensions){
    if(!byNum.has(x.num)) byNum.set(x.num, []);
    byNum.get(x.num).push(x);
  }
  const histRows = [...byNum.entries()].sort((a,b)=>b[0]-a[0]).map(([num, xs])=>{
    const emps = [...new Set(xs.map(x=>empName(x.employeeId)))].join(", ");
    return `<tr>
      <td>${docNumCell("ПР",num)}</td><td class="num">${fmtDate(xs[0].date)}</td>
      <td>${esc(emps)}</td>
      <td>${xs.map(x=>esc(itemName(x.itemId))+(x.size?` (${esc(x.size)})`:"")+` +${x.addMonths} мес.`).join("<br>")}</td>
      <td class="num">${xs.length}</td>
      <td><button class="btn small ghost" data-act="${num}" type="button" title="Печать акта продления">Акт</button></td></tr>`;
  }).join("");

  const e = extEmpId ? empById(extEmpId) : null;
  const hold = e ? holdingsLines().filter(l=>l.empId===e.id) : [];

  v.innerHTML = `
  <div class="view-head"><h2>Продление срока носки</h2>
    <span class="hint">пригодные СИЗ можно выдать повторно с продлением срока (п. 38 Правил № 766н); по операции печатается акт</span></div>
  <div class="panel">
    <h3>Новый акт продления</h3>
    <div class="form-row">
      <div class="field"><label>Дата</label><input id="x-date" class="num" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Сотрудник</label><select id="x-emp">${empOpts}</select></div>
      <div class="field"><label>Основание / причина</label><input id="x-reason" placeholder="износ незначителен, состояние годное"></div>
    </div>
    ${e ? (hold.length ? `<div class="lines"><table>
      <thead><tr><th>СИЗ</th><th>Размер</th><th>Выдано</th><th>Срок до</th><th>Статус</th><th style="width:130px">Продлить, мес.</th></tr></thead>
      <tbody>${hold.map((l,idx)=>{
        const st = statusOf(l.endDate);
        return `<tr>
          <td>${esc(itemName(l.itemId))}</td><td class="num">${esc(l.size||"—")}</td>
          <td class="num">${fmtDate(l.date)} (ВД-${String(l.docNum).padStart(4,"0")})</td>
          <td class="num">${fmtDate(l.endDate)}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td><input class="num" type="number" min="0" step="1" data-xline="${idx}" placeholder="0"></td></tr>`;
      }).join("")}</tbody></table></div>
      <div style="display:flex;gap:10px"><div style="flex:1"></div>
        <button class="btn primary" id="x-save" type="button">Оформить продление</button></div>`
      : `<div class="empty">У сотрудника нет выданных СИЗ.</div>`)
    : `<div class="empty">Выберите сотрудника — покажем его СИЗ на руках.</div>`}
  </div>
  <div class="panel" style="padding:0;overflow-x:auto"><table>
    <thead><tr><th>Акт</th><th>Дата</th><th>Сотрудник</th><th>Позиции</th><th>Кол-во строк</th><th></th></tr></thead>
    <tbody>${histRows || `<tr><td colspan="6" style="color:var(--ink-2)">Продлений пока не было</td></tr>`}</tbody></table></div>`;

  document.getElementById("x-emp").addEventListener("change", ev => { extEmpId = ev.target.value; render(); });
  v.querySelectorAll("[data-act]").forEach(b => b.onclick = () => doPrint(formExtAct(+b.dataset.act), "pg-portrait"));

  const bs = document.getElementById("x-save");
  if(bs) bs.onclick = () => {
    const date = document.getElementById("x-date").value;
    if(!date){ toast("Укажите дату","err"); return; }
    const rows = [];
    v.querySelectorAll("[data-xline]").forEach(inp => {
      const add = +inp.value||0;
      if(add > 0) rows.push({ ln: hold[+inp.dataset.xline], add });
    });
    if(!rows.length){ toast("Укажите срок продления хотя бы для одной позиции","err"); return; }
    const expiredRows = rows.filter(r => daysUntil(r.ln.endDate) !== null && daysUntil(r.ln.endDate) < 0);
    if(expiredRows.length && !confirm("Внимание: часть позиций уже просрочена. Продление не делает их годными — сначала проведите обслуживание/проверку. Всё равно продолжить?")) return;
    db.seq.ext++;
    const num = db.seq.ext;
    const reason = document.getElementById("x-reason").value.trim();
    for(const r of rows){
      db.extensions.push({ id:uid(), num, date,
        docId:r.ln.docId, lineIdx:r.ln.lineIdx, employeeId:e.id,
        itemId:r.ln.itemId, size:r.ln.size||"", addMonths:r.add,
        newEndDate: addMonthsToISO(r.ln.endDate, r.add), reason });
    }
    save(); render(); updateWarnBadge();
    toast(`Акт продления ПР-${String(num).padStart(4,"0")} оформлен`);
    if(confirm("Распечатать акт продления срока носки?")) doPrint(formExtAct(num), "pg-portrait");
  };
}
