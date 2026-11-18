(() => {
  "use strict";
  const status = {
    received: "受付済", quoted: "見積確定", proof: "入稿確認",
    returned: "差し戻し", ready: "製造待ち", printing: "印刷中",
    finishing: "加工中", inspected: "検品済", delivered: "納品済"
  };
  const products = {
    flyer: { name: "チラシ", unit: 10 },
    poster: { name: "ポスター", unit: 120 },
    card: { name: "カード", unit: 16 }
  };
  const paper = { standard: { name: "標準紙", unit: 2 }, coated: { name: "光沢紙", unit: 4 }, heavy: { name: "厚紙", unit: 6 } };
  const finish = { none: { name: "なし", fee: 0 }, fold: { name: "折り加工", fee: 500 }, laminate: { name: "ラミネート", fee: 1000 } };
  const delivery = { pickup: "店頭受取", ship: "配送" };

  function quote(order, rates) {
    const floorYen = value => Math.floor(Number(value));
    const printing = floorYen(Number(rates[order.product]) * order.quantity * (order.double ? 2 : 1));
    const finishing = floorYen(finish[order.finish].fee);
    const rush = floorYen(order.rush ? 1000 : 0);
    const paperCost = floorYen(paper[order.paper].unit * order.quantity);
    const discount = order.quantity >= 1000 ? floorYen(printing * 0.1) : 0;
    const subtotal = printing + paperCost + finishing + rush;
    return { printing, paperCost, finishing, rush, discount, total: subtotal - discount };
  }

  function manufacturingOrders(orders) {
    return orders.filter(order => ["returned", "ready", "printing", "finishing", "inspected"].includes(order.status));
  }

  function revertInspection(order, at = new Date().toISOString()) {
    if (order.status !== "inspected") return false;
    const history = Array.isArray(order.inspectionHistory) ? order.inspectionHistory : [];
    order.inspectionHistory = [...history, { at, from: "inspected", to: "finishing" }];
    order.status = "finishing";
    return true;
  }

  function canChangeProductionDue(order) {
    return ["printing", "finishing", "inspected"].includes(order.status);
  }

  function changeProductionDue(order, due, at = new Date().toISOString()) {
    if (!canChangeProductionDue(order) || typeof due !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
    const date = new Date(due + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== due || due === order.due) return false;
    const history = Array.isArray(order.productionDueHistory) ? order.productionDueHistory : [];
    order.productionDueHistory = [...history, { at, from: order.due, to: due }];
    order.due = due;
    return true;
  }

  function recordStageOwner(order, at) {
    const owner = String(order.workOwner ?? "").trim();
    if (!owner) return;
    const history = Array.isArray(order.workOwnerHistory) ? order.workOwnerHistory : [];
    const latest = history[history.length - 1];
    if (latest?.stage === order.status && latest.owner === owner) return;
    order.workOwnerHistory = [...history, { stage: order.status, owner, at }];
  }

  function assignWorkOwner(order, owner, at = new Date().toISOString()) {
    if (!["returned", "ready", "printing", "finishing", "inspected"].includes(order.status) || typeof owner !== "string") return false;
    owner = owner.trim();
    if (!owner || owner.length > 50) return false;
    recordStageOwner(order, at);
    order.workOwner = owner;
    recordStageOwner(order, at);
    return true;
  }

  function advanceWork(order, at = new Date().toISOString()) {
    const next = { ready: "printing", printing: "finishing", finishing: "inspected" }[order.status];
    if (typeof next !== "string") return false;
    recordStageOwner(order, at);
    order.status = next;
    recordStageOwner(order, at);
    return true;
  }

  function seed() {
    const common = {
      product: "flyer", quantity: 300, paper: "standard", double: false, finish: "none",
      rush: false, due: "2026-12-04", delivery: "pickup", address: "", reviewMemo: "", returnReasons: [],
      proofFile: "", revision: 0, proofUpdatedAt: null, workOwner: "", quoteSnapshot: null
    };
    const orders = [
      { id: 101, customer: "駅前書店", status: "received" },
      { id: 102, customer: "市民ホール", status: "proof", product: "poster", quantity: 30, proofFile: "hall-v1.pdf", revision: 1 },
      { id: 103, customer: "朝市実行委員会", status: "returned", proofFile: "market-v1.pdf", revision: 1,
        returnReasons: [{ revision: 1, reason: "開催時刻を修正してください" }] },
      { id: 104, customer: "青葉商店会", status: "received", quantity: 1000, double: true },
      { id: 105, customer: "北通りカフェ", status: "ready", product: "card", proofFile: "cafe-v1.pdf", revision: 1 },
      { id: 106, customer: "まちなか図書室", status: "inspected", product: "poster", quantity: 12, delivery: "ship", address: "中央通り2-8", proofFile: "library-v1.pdf", revision: 1 }
    ].map(order => ({ ...common, ...order, returnReasons: [...(order.returnReasons ?? [])] }));
    const rates = Object.fromEntries(Object.entries(products).map(([key, value]) => [key, value.unit]));
    for (const order of orders) {
      if (order.status !== "received") order.quoteSnapshot = quote(order, rates);
    }
    return { orders, rates, nextId: 107 };
  }

  const api = { status, products, paper, finish, delivery, quote, manufacturingOrders, revertInspection, canChangeProductionDue, changeProductionDue, assignWorkOwner, advanceWork, seed };
  globalThis.PrintShop = api;
  if (typeof module !== "undefined") module.exports = api;
})();
