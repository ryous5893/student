(() => {
  "use strict";

  const shop = PrintShop;
  const storageKey = "printshop-classroom-v1";
  // 納品取消に必要な管理者パスコード（簡易的な制限。画面のソースから読めるため運用で管理すること）
  const adminPasscode = "0000";
  const views = { orders: "注文受付", quotes: "見積", proof: "入稿確認", work: "製造進行", delivery: "納品", rates: "商品・料金設定" };
  const workflowCounts = document.querySelector("#workflow-counts");
  const nav = document.querySelector("#nav");
  const view = document.querySelector("#view");
  const notice = document.querySelector("#notice");
  const money = value => new Intl.NumberFormat("ja-JP").format(value) + " 円";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  function formatDateTime(value) {
    if (!value) return "未記録";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未記録";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).format(date);
  }
  let state = load();
  let page = "orders";
  let selection = null;
  let proofSelectionMode = "upload";
  let workEditor = "owner";
  let orderNumberFilter = "";
  let statusFilter = "all";
  let proofFilter = "all";

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.orders) && saved.rates && Number.isInteger(saved.nextId)) {
        saved.orders = saved.orders.map(order => {
          const returnReasons = Array.isArray(order.returnReasons) ? order.returnReasons : [];
          if (typeof order.note === "string" && order.note.trim()) {
            returnReasons.push({ revision: order.revision || 1, reason: order.note.trim() });
          }
          const { note, ...currentOrder } = order;
          return {
            ...currentOrder,
            reviewMemo: currentOrder.reviewMemo ?? "",
            returnReasons
          };
        });
        return saved;
      }
    } catch (error) {
      console.warn("保存データを読み込めませんでした", error);
    }
    return shop.seed();
  }

  function update(message) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      render();
      notice.textContent = message;
    } catch (error) {
      render();
      notice.textContent = "画面には反映しましたが、ブラウザに保存できませんでした。";
    }
  }

  function field(label, name, value = "", type = "text", attributes = "") {
    return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attributes}></label>`;
  }

  function select(label, name, values, selected) {
    const options = Object.entries(values).map(([key, item]) =>
      `<option value="${key}" ${key === selected ? "selected" : ""}>${esc(item.name ?? item)}</option>`
    ).join("");
    return `<label>${label}<select name="${name}">${options}</select></label>`;
  }

  function button(label, action, id) {
    return `<button type="button" data-action="${action}" data-id="${id}">${label}</button>`;
  }

  function table(headers, rows) {
    if (!rows.length) return "<p>対象の注文はありません。</p>";
    return `<div class="table"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${
      rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")
    }</tbody></table></div>`;
  }

  function orderCells(order) {
    return [order.id, esc(order.customer), esc(shop.products[order.product].name), order.quantity, shop.status[order.status]];
  }

  function renderOrders() {
    const order = state.orders.find(item => item.id === selection);
    const filteredOrders = state.orders.filter(item =>
      (!orderNumberFilter || String(item.id) === orderNumberFilter) && (statusFilter === "all" || item.status === statusFilter));
    const totalQuantity = filteredOrders.reduce((total, item) => total + Number(item.quantity), 0);
    return `<form class="panel" data-form="order"><h2>${order ? `注文 ${order.id} を編集` : "新規注文"}</h2>
      <p>カードの新規注文は50部以上で受け付けます。</p><div class="grid">
      ${field("注文者", "customer", order?.customer, "text", "required maxlength=100")}
      ${field("連絡先電話番号", "phone", order?.phone, "tel", "maxlength=30")}
      ${select("商品", "product", shop.products, order?.product)}
      ${field("部数", "quantity", order?.quantity ?? 100, "number", "required min=1 max=100000 step=1")}
      ${select("用紙", "paper", shop.paper, order?.paper)}
      ${select("印刷面", "sides", { single: "片面", double: "両面" }, order?.double ? "double" : "single")}
      ${select("加工", "finish", shop.finish, order?.finish)}
      ${select("納期区分", "speed", { standard: "通常", rush: "特急" }, order?.rush ? "rush" : "standard")}
      ${field("希望納期", "due", order?.due, "date", "required")}
      ${select("納品方法", "delivery", shop.delivery, order?.delivery)}
      ${field("配送先", "address", order?.address, "text", "maxlength=200")}
      </div><div class="actions"><button>注文を保存</button>${order ? button("編集を閉じる", "clear", order.id) : ""}</div></form>`
      + `<form class="panel" data-form="orderFilter"><h2>注文の絞り込み</h2><div class="grid">
        ${field("注文番号", "orderNumber", orderNumberFilter, "search", "inputmode=numeric")}
        ${select("状態", "statusFilter", { all: "すべて", ...shop.status }, statusFilter)}</div>
        <div class="actions"><button>絞り込む</button><button class="secondary" name="filterAction" value="clear">絞り込みを解除</button></div>
        </form><p role="status">表示件数：${filteredOrders.length}件</p>`
      + table(["注文", "注文者", "商品", "部数", "状態", "納期", "操作"], filteredOrders.map(item => [
        ...orderCells(item), esc(item.due),
        (item.status === "received" ? button("編集", "edit", item.id) : "") + button("見積へ", "quote", item.id)
      ])) + `<p class="summary" role="status">表示中の合計部数：${new Intl.NumberFormat("ja-JP").format(totalQuantity)}部</p>`;
  }

  // 自動計算の見積に、手入力値引き（金額と理由）を反映する
  function quoteWithManualDiscount(order) {
    const pricing = shop.quote(order, state.rates);
    const manual = order.manualDiscount;
    if (!manual?.amount) return pricing;
    return { ...pricing, manualDiscount: manual.amount, manualDiscountReason: manual.reason, total: pricing.total - manual.amount };
  }

  function renderQuotes() {
    const order = state.orders.find(item => item.id === selection);
    const pricing = order ? order.quoteSnapshot ?? quoteWithManualDiscount(order) : null;
    const manualRows = pricing?.manualDiscount
      ? [["手入力値引き", money(-pricing.manualDiscount)], ["値引き理由", esc(pricing.manualDiscountReason)]] : [];
    const manualForm = order?.status !== "received" ? "" : `<form class="panel" data-form="manualDiscount"><h2>手入力値引き</h2><div class="grid">
      ${field("値引き額（円）", "manualAmount", order.manualDiscount?.amount ?? "", "number", "required min=1 step=1")}
      ${field("値引き理由（必須）", "manualReason", order.manualDiscount?.reason ?? "", "text", "required maxlength=200")}
      </div><div class="actions"><button>値引きを保存</button>${
        order.manualDiscount ? `<button class="secondary" name="manualAction" value="clear" formnovalidate>値引きを取り消す</button>` : ""
      }</div></form>`;
    const blocks = !order ? "" : `<section class="panel"><h2>注文 ${order.id} ・ ${esc(order.customer)}</h2>${
      table(["項目", "金額"], [
        ["印刷代", money(pricing.printing)], ["用紙代", money(pricing.paperCost)],
        ["加工費", money(pricing.finishing)], ["特急料金", money(pricing.rush)], ["数量割引", money(pricing.discount ? -pricing.discount : 0)],
        ...manualRows
      ])
    }<p class="summary">合計 ${money(pricing.total)}</p>${
      order.status === "received" ? button("見積を確定", "confirmQuote", order.id) : "<p>確定済みの見積を表示しています。</p>"
    }</section>` + manualForm;
    return blocks + table(["注文", "注文者", "商品", "部数", "状態", "操作"], state.orders.map(item =>
      [...orderCells(item), button("見積を見る", "quote", item.id)]
    ));
  }

  function renderProof() {
    const candidates = state.orders.filter(order => ["quoted", "proof", "returned"].includes(order.status));
    const filtered = proofFilter === "missing"
      ? candidates.filter(item => item.quoteSnapshot != null && !String(item.proofFile ?? "").trim()) : candidates;
    const order = filtered.find(item => item.id === selection);
    const filterForm = `<form class="panel" data-form="proofFilter"><h2>表示条件</h2>
      ${select("表示対象", "proofScope", { all: "すべて", missing: "確定見積あり・原稿未提出のみ" }, proofFilter)}
      <div class="actions"><button>絞り込む</button></div></form>`;
    const form = order && proofSelectionMode === "memo"
      ? `<form class="panel" data-form="memo"><h2>注文 ${order.id} の確認メモ</h2>
        <label>確認メモ<textarea name="reviewMemo" maxlength="1000">${esc(order.reviewMemo)}</textarea></label>
        <div class="actions"><button>メモを保存</button></div></form>`
      : order ? `<form class="panel" data-form="proof"><h2>注文 ${order.id} の入稿</h2><div class="grid">
        ${field("原稿ファイル名", "file", "", "text", "required maxlength=150")}
        </div><div class="actions"><button>入稿を記録</button></div></form>` : "";
    return filterForm + form + `<p role="status">表示件数：${filtered.length}件</p>`
      + table(["注文", "注文者", "商品", "部数", "状態", "原稿", "直前の版", "版・確認状況", "入稿・差し替え日時", "確認メモ", "差し戻し履歴", "操作"], filtered.map(item => [
      ...orderCells(item), item.proofFile ? esc(item.proofFile) : "未入稿",
      item.proofHistory?.length ? (previous => `第${esc(previous.revision)}版 ・ ${esc(previous.file)}`)(item.proofHistory.at(-1)) : "—",
      item.proofFile ? `第${esc(item.revision)}版${item.status === "proof" ? "（確認中）" : item.status === "returned" ? "（差し戻し）" : ""}` : "—",
      esc(formatDateTime(item.proofUpdatedAt)), esc(item.reviewMemo),
      item.returnReasons.map(entry => `第${entry.revision}版: ${esc(entry.reason)}`).join("<br>") || "なし",
      button(item.status === "quoted" ? "入稿" : "再入稿", "choose", item.id) +
      button("メモ編集", "editMemo", item.id) +
      (item.status === "proof" ? button("承認", "approve", item.id) + button("差し戻す", "returnProof", item.id) : "")
    ]));
  }

  function renderInspectionHistory(order) {
    const history = Array.isArray(order.inspectionHistory) ? order.inspectionHistory : [];
    if (!history.length) return "—";
    return `<details><summary>${history.length}件</summary><ul>${history.map(entry => {
      const date = new Date(entry.at);
      const time = Number.isNaN(date.getTime()) ? "日時不明" : date.toLocaleString("ja-JP");
      return `<li>${esc(time)}：${esc(shop.status[entry.from] ?? entry.from)} → ${esc(shop.status[entry.to] ?? entry.to)}</li>`;
    }).join("")}</ul></details>`;
  }

  function renderProductionDue(order) {
    const history = Array.isArray(order.productionDueHistory) ? order.productionDueHistory : [];
    if (!history.length) return esc(order.due);
    const latest = history[history.length - 1];
    return `<div class="due-change"><strong>印刷開始後の納期変更</strong>
      <div>変更前：${esc(latest.from) || "未設定"}</div><div>変更後：${esc(order.due)}</div>
      <div>変更日時：${esc(formatDateTime(latest.at))}</div>
      <details><summary>変更履歴（${history.length}件）</summary><ul>${history.map(entry =>
        `<li>${esc(entry.from) || "未設定"} → ${esc(entry.to)}（${esc(formatDateTime(entry.at))}）</li>`
      ).join("")}</ul></details></div>`;
  }

  function canEditWorkInterruption(order) {
    return ["ready", "printing", "finishing"].includes(order.status);
  }

  function renderWorkInterruption(order) {
    const memo = order.workInterruption;
    if (!memo?.reason) return "—";
    return `<div>${esc(memo.reason)}</div><div>再開予定：${esc(memo.resumeDate) || "未定"}</div>`;
  }

  function renderApproval(order) {
    const approval = order.approvals?.at(-1);
    if (!approval) return "—";
    return `<div>第${esc(approval.revision)}版 ・ ${esc(approval.file)}</div>`
      + `<div>${approval.double ? "両面" : "片面"} ／ ${esc(shop.finish[approval.finish]?.name ?? approval.finish)}</div>`
      + `<div>${esc(formatDateTime(approval.at))}</div>`;
  }

  function renderWorkOwnerHistory(order) {
    const history = Array.isArray(order.workOwnerHistory) ? order.workOwnerHistory : [];
    const printing = history.slice().reverse().find(entry => entry.stage === "printing");
    const summary = `<div>印刷担当：${printing ? esc(printing.owner) : "未記録"}</div>`;
    if (!history.length) return summary;
    return summary + `<details><summary>担当履歴（${history.length}件）</summary><ul>${history.map(entry =>
      `<li>${esc(shop.status[entry.stage] ?? entry.stage)}：${esc(entry.owner)}（記録日時：${esc(formatDateTime(entry.at))}）</li>`
    ).join("")}</ul></details>`;
  }

  function renderWork() {
    const candidates = shop.manufacturingOrders(state.orders);
    const nextLabel = { ready: "印刷を開始", printing: "加工へ進む", finishing: "検品完了" };
    const order = candidates.find(item => item.id === selection);
    const form = order && workEditor === "interruption" ? `<form class="panel" data-form="workInterruption"><h2>注文 ${order.id} の作業中断メモ</h2><div class="grid">
      ${field("中断理由", "interruptionReason", order.workInterruption?.reason, "text", "required maxlength=300")}
      ${field("再開予定日（未定なら空欄）", "resumeDate", order.workInterruption?.resumeDate, "date")}
      </div><div class="actions"><button>メモを保存</button>${order.workInterruption ? button("メモを解除", "clearWorkInterruption", order.id) : ""}${button("閉じる", "clear", order.id)}</div></form>`
      : order && workEditor === "due" ? `<form class="panel" data-form="productionDue"><h2>注文 ${order.id} の納期変更</h2>
      <p>注文者：${esc(order.customer)} ／ 現在の納期：${esc(order.due)}</p>
      ${field("新しい希望納期", "due", order.due, "date", "required")}
      <div class="actions"><button>変更を保存</button>${button("閉じる", "clear", order.id)}</div></form>`
      : order ? `<form class="panel" data-form="owner"><h2>注文 ${order.id} の製造担当</h2><div class="grid">
      ${field("担当者", "owner", order.workOwner, "text", "required maxlength=50")}</div>
      <div class="actions"><button>担当を保存</button></div></form>` : "";
    return form + table(["注文", "注文者", "商品", "部数", "状態", "希望納期", "現在の担当", "工程ごとの担当履歴", "承認内容", "作業中断メモ", "検品取り消し履歴", "操作"], candidates.map(item => [
      ...orderCells(item), renderProductionDue(item), esc(item.workOwner) || "未割当", renderWorkOwnerHistory(item), renderApproval(item), renderWorkInterruption(item), renderInspectionHistory(item), button("担当を設定", "choose", item.id) +
      (canEditWorkInterruption(item) ? button("中断メモ", "editWorkInterruption", item.id) : "") +
      (shop.canChangeProductionDue(item) ? button("納期を変更", "editProductionDue", item.id) : "") +
      (nextLabel[item.status] ? button(nextLabel[item.status], "advance", item.id) : "") +
      (item.status === "inspected" ? button("加工中に戻す", "revertInspection", item.id) : "")
    ]));
  }

  function renderDelivery() {
    const candidates = state.orders.filter(order => ["inspected", "delivered"].includes(order.status));
    return table(["注文", "注文者", "商品", "部数", "状態", "納品方法", "希望納期", "配送先", "連絡先電話番号", "工程ごとの担当履歴", "承認内容", "取消履歴", "検品取り消し履歴", "操作"], candidates.map(item => [
      ...orderCells(item), shop.delivery[item.delivery], esc(item.due), esc(item.address), esc(item.phone) || "未登録", renderWorkOwnerHistory(item), renderApproval(item),
      (item.history ?? []).map(entry =>
        `${esc(formatDateTime(entry.at))} ${esc(entry.operator)}：${esc(entry.reason)}`).join("<br>"),
      renderInspectionHistory(item),
      item.status === "inspected" ? button("納品完了", "deliver", item.id) + button("加工中に戻す", "revertInspection", item.id)
        : item.status === "delivered" ? button("納品取消（管理者）", "undoDeliver", item.id) : ""
    ]));
  }

  function renderRates() {
    return `<form class="panel" data-form="rates"><h2>商品別の印刷単価</h2>
      <p>片面1部あたりの単価です。保存前に影響する未確定見積の件数を確認します。確定済みの見積には確定時点の金額を表示します。</p>
      <div class="grid">${Object.entries(shop.products).map(([key, product]) =>
        field(product.name + "（円）", key, state.rates[key], "number", "required min=0 max=100000 step=1")).join("")}</div>
      <div class="actions"><button>単価を保存</button></div></form>`
      + table(["用紙", "1部あたり"], Object.values(shop.paper).map(item => [esc(item.name), money(item.unit)]))
      + table(["加工", "1注文あたり"], Object.values(shop.finish).map(item => [esc(item.name), money(item.fee)]));
  }

  const renderers = { orders: renderOrders, quotes: renderQuotes, proof: renderProof, work: renderWork, delivery: renderDelivery, rates: renderRates };
  function render() {
    const counts = [
      { label: "製造待ち", value: state.orders.filter(order => order.status === "ready").length, detail: "印刷開始前" },
      { label: "入稿確認", value: state.orders.filter(order => ["quoted", "proof", "returned"].includes(order.status)).length, detail: "見積確定・確認中・差し戻し" },
      { label: "納品待ち", value: state.orders.filter(order => order.status === "inspected").length, detail: "検品済み・未納品" }
    ];
    workflowCounts.innerHTML = counts.map(item =>
      `<div><dt>${item.label}</dt><dd><strong>${new Intl.NumberFormat("ja-JP").format(item.value)}</strong>件<small>${item.detail}</small></dd></div>`
    ).join("");
    nav.innerHTML = Object.entries(views).map(([key, name]) =>
      `<button type="button" data-page="${key}" ${key === page ? 'aria-current="page"' : ""}>${name}</button>`
    ).join("");
    view.innerHTML = `<h1>${views[page]}</h1>` + renderers[page]();
  }

  nav.addEventListener("click", event => {
    const next = event.target.closest("button")?.dataset.page;
    if (!(next in views)) return;
    page = next;
    selection = null;
    notice.textContent = "";
    render();
    nav.querySelector('[aria-current="page"]').focus();
  });

  view.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const type = event.target.dataset.form;
    if (type === "orderFilter") {
      const clear = event.submitter?.value === "clear";
      orderNumberFilter = clear ? "" : data.get("orderNumber").trim();
      statusFilter = !clear && Object.hasOwn(shop.status, data.get("statusFilter")) ? data.get("statusFilter") : "all";
      render();
      return;
    }
    if (type === "proofFilter") {
      proofFilter = data.get("proofScope") === "missing" ? "missing" : "all";
      selection = null;
      render();
      return;
    }
    const order = state.orders.find(item => item.id === selection);
    if (type === "manualDiscount") {
      if (!order || order.status !== "received") { notice.textContent = "見積確定前の注文だけ値引きを設定できます。"; return; }
      if (event.submitter?.value === "clear") {
        delete order.manualDiscount;
        update("注文 " + order.id + " の手入力値引きを取り消しました。");
        return;
      }
      const amount = Number(data.get("manualAmount"));
      const reason = data.get("manualReason").trim();
      if (!Number.isInteger(amount) || amount < 1) { notice.textContent = "値引き額を1円以上の整数で入力してください。"; return; }
      if (!reason) { notice.textContent = "値引き理由を入力してください。理由がない値引きは保存できません。"; return; }
      if (amount > shop.quote(order, state.rates).total) { notice.textContent = "値引き額が見積の合計を超えています。"; return; }
      order.manualDiscount = { amount, reason, at: new Date().toISOString() };
      update("注文 " + order.id + " の手入力値引きを保存しました。");
      return;
    }
    if (type === "workInterruption") {
      if (!order || !canEditWorkInterruption(order)) { notice.textContent = "製造待ち・印刷中・加工中の注文だけ中断メモを編集できます。"; return; }
      const reason = data.get("interruptionReason").trim();
      const resumeDate = data.get("resumeDate");
      if (!reason || reason.length > 300) { notice.textContent = "中断理由を1〜300文字で入力してください。"; return; }
      if (resumeDate) {
        const date = new Date(resumeDate + "T00:00:00.000Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(resumeDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== resumeDate) {
          notice.textContent = "有効な再開予定日を入力してください。";
          return;
        }
      }
      order.workInterruption = { reason, resumeDate };
      selection = null;
      update("注文 " + order.id + " の作業中断メモを保存しました。");
      return;
    }
    if (type === "productionDue") {
      if (!order || !shop.canChangeProductionDue(order)) { notice.textContent = "印刷開始後・納品前の注文だけ納期を変更できます。"; return; }
      const due = data.get("due");
      if (due === order.due) { notice.textContent = "納期は変更されていません。"; return; }
      if (!window.confirm(`注文 ${order.id}（${order.customer}）の納期を ${order.due} から ${due} に変更しますか？`)) return;
      if (!shop.changeProductionDue(order, due)) { notice.textContent = "有効な希望納期を入力してください。"; return; }
      selection = null;
      update("注文 " + order.id + " の納期を変更しました。");
      return;
    }
    if (type === "order") {
      const fields = {
        customer: data.get("customer").trim(), product: data.get("product"), quantity: Number(data.get("quantity")),
        paper: data.get("paper"), double: data.get("sides") === "double", finish: data.get("finish"),
        rush: data.get("speed") === "rush", due: data.get("due"), delivery: data.get("delivery"), address: data.get("address").trim(), phone: data.get("phone").trim()
      };
      if (!fields.customer || (fields.delivery === "ship" && !fields.address)) {
        notice.textContent = "注文者と、配送の場合は配送先を入力してください。";
        return;
      }
      const keepsExistingQuantity = order?.status === "received" &&
        order.product === fields.product && order.quantity === fields.quantity;
      if (fields.product === "card" && fields.quantity < 50 && !keepsExistingQuantity) {
        notice.textContent = "カードの注文は50部以上で入力してください。";
        return;
      }
      if (order?.status === "received") Object.assign(order, fields);
      else state.orders.push({
        ...fields, id: state.nextId++, status: "received", proofFile: "", revision: 0, proofUpdatedAt: null,
        reviewMemo: "", returnReasons: [], workOwner: "", quoteSnapshot: null
      });
    }
    if (type === "proof" && order) {
      const file = data.get("file").trim();
      if (!file) { notice.textContent = "原稿ファイル名を入力してください。"; return; }
      if (order.proofFile) {
        order.proofHistory = [...(order.proofHistory ?? []), { revision: order.revision, file: order.proofFile, at: order.proofUpdatedAt ?? null }];
      }
      Object.assign(order, {
        proofFile: file, revision: order.revision + 1, proofUpdatedAt: new Date().toISOString(),
        status: "proof", reviewMemo: ""
      });
    }
    if (type === "memo" && order) {
      order.reviewMemo = data.get("reviewMemo").trim();
    }
    if (type === "owner" && order) {
      if (!shop.assignWorkOwner(order, data.get("owner"))) { notice.textContent = "担当者を1〜50文字で入力してください。"; return; }
    }
    if (type === "rates") {
      const nextRates = Object.fromEntries(Object.keys(shop.products).map(product => [product, Number(data.get(product))]));
      const changedProducts = Object.keys(shop.products).filter(product => nextRates[product] !== Number(state.rates[product]));
      if (!changedProducts.length) {
        notice.textContent = "単価は変更されていません。";
        return;
      }
      const affectedCount = state.orders.filter(item =>
        item.status === "received" && item.quoteSnapshot == null && changedProducts.includes(item.product)
      ).length;
      if (!window.confirm(`変更した商品の単価が適用される未確定見積は ${affectedCount} 件です。
確定済み見積の金額は変わりません。

単価を保存しますか？`)) return;
      Object.assign(state.rates, nextRates);
    }
    selection = null;
    update("保存しました。");
  });

  view.addEventListener("click", event => {
    const control = event.target.closest("button[data-action]");
    if (!control) return;
    const { action, id } = control.dataset;
    const order = state.orders.find(item => item.id === Number(id));
    if (!order) return;
    switch (action) {
      case "quote": page = "quotes"; selection = order.id; render(); view.focus(); return;
      case "edit":
      case "choose":
        selection = order.id;
        workEditor = "owner";
        proofSelectionMode = "upload";
        render();
        view.querySelector("form input")?.focus();
        return;
      case "editMemo":
        selection = order.id;
        proofSelectionMode = "memo";
        render();
        view.querySelector("form textarea")?.focus();
        return;
      case "editWorkInterruption":
        if (!canEditWorkInterruption(order)) return;
        selection = order.id; workEditor = "interruption"; render(); view.querySelector("form input")?.focus(); return;
      case "clearWorkInterruption":
        if (!canEditWorkInterruption(order) || !order.workInterruption) return;
        if (!window.confirm(`注文 ${order.id} の作業中断メモを解除しますか？`)) return;
        delete order.workInterruption;
        break;
      case "editProductionDue":
        if (!shop.canChangeProductionDue(order)) return;
        selection = order.id; workEditor = "due"; render(); view.querySelector("form input")?.focus(); return;
      case "clear": selection = null; render(); view.focus(); return;
      case "confirmQuote":
        if (order.manualDiscount && !order.manualDiscount.reason?.trim()) { notice.textContent = "値引き理由がないため確定できません。"; return; }
        if (quoteWithManualDiscount(order).total < 0) { notice.textContent = "手入力値引きが見積の合計を超えています。値引き額を見直してください。"; return; }
        order.quoteSnapshot = quoteWithManualDiscount(order);
        order.status = "quoted";
        break;
      case "approve":
        order.approvals = [...(order.approvals ?? []), {
          revision: order.revision, file: order.proofFile, double: order.double, finish: order.finish, at: new Date().toISOString()
        }];
        order.status = "ready";
        break;
      case "returnProof": {
        const note = window.prompt("差し戻し理由を入力してください");
        if (!note?.trim()) return;
        order.returnReasons.push({ revision: order.revision, reason: note.trim() });
        order.status = "returned";
        break;
      }
      case "advance":
        if (!shop.advanceWork(order)) return;
        break;
      case "revertInspection":
        if (order.status !== "inspected") return;
        if (!window.confirm(`注文 ${order.id}（${order.customer}）の検品完了を取り消し、加工中に戻しますか？`)) return;
        if (!shop.revertInspection(order)) return;
        break;
      case "deliver":
        if (order.status !== "inspected") return;
        if (!window.confirm(`注文番号: ${order.id}\n注文者名: ${order.customer}\n\nこの注文を納品完了にしますか？`)) return;
        order.status = "delivered";
        break;
      case "undoDeliver": {
        if (order.status !== "delivered") return;
        const operator = window.prompt(`注文 ${order.id} の納品済みを取り消します。\n管理者名を入力してください`)?.trim();
        if (!operator) { notice.textContent = "管理者名を入力してください。"; return; }
        if (window.prompt("管理者パスコードを入力してください") !== adminPasscode) {
          notice.textContent = "管理者パスコードが違うため、取り消しませんでした。";
          return;
        }
        const reason = window.prompt("取り消しの理由を入力してください")?.trim();
        if (!reason) { notice.textContent = "理由が未入力のため、取り消しませんでした。"; return; }
        order.history = [...(order.history ?? []), { action: "納品取消", operator, reason, at: new Date().toISOString() }];
        order.status = "inspected";
        break;
      }
      default: return;
    }
    if (page !== "quotes") selection = null;
    update("注文 " + order.id + " を更新しました。");
  });

  document.querySelector("#reset").addEventListener("click", () => {
    if (!window.confirm("このブラウザに保存されている次のデータをサンプルに戻します。\n\n・すべての注文（入力・編集した注文は削除されます）\n・商品・料金設定の印刷単価\n\n元に戻すことはできません。よろしいですか？")) return;
    state = shop.seed();
    orderNumberFilter = "";
    statusFilter = "all";
    proofFilter = "all";
    selection = null;
    update("サンプルに戻しました。");
  });

  render();
})();
