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
    const printing = Number(rates[order.product]) * order.quantity * (order.double ? 2 : 1);
    const finishing = finish[order.finish].fee;
    const rush = order.rush ? 1000 : 0;
    const paperCost = paper[order.paper].unit * order.quantity;
    const discount = order.quantity >= 1000 ? Math.floor(printing * (order.double ? 0.2 : 0.1)) : 0;
    const subtotal = printing + paperCost + finishing + rush;
    return { printing, paperCost, finishing, rush, discount, total: subtotal - discount };
  }

  function manufacturingOrders(orders) {
    return orders.filter(order => ["ready", "printing", "finishing", "inspected"].includes(order.status));
  }

  function seed() {
    const common = {
      product: "flyer", quantity: 300, paper: "standard", double: false, finish: "none",
      rush: false, due: "2026-12-04", delivery: "pickup", address: "", note: "",
      proofFile: "", revision: 0, workOwner: "", quoteSnapshot: null
    };
    const orders = [
      { id: 101, customer: "駅前書店", status: "received" },
      { id: 102, customer: "市民ホール", status: "proof", product: "poster", quantity: 30, proofFile: "hall-v1.pdf", revision: 1 },
      { id: 103, customer: "朝市実行委員会", status: "returned", proofFile: "market-v1.pdf", revision: 1, note: "開催時刻を修正してください" },
      { id: 104, customer: "青葉商店会", status: "received", quantity: 1000, double: true },
      { id: 105, customer: "北通りカフェ", status: "ready", product: "card", proofFile: "cafe-v1.pdf", revision: 1 },
      { id: 106, customer: "まちなか図書室", status: "inspected", product: "poster", quantity: 12, delivery: "ship", address: "中央通り2-8", proofFile: "library-v1.pdf", revision: 1 }
    ].map(order => ({ ...common, ...order }));
    const rates = Object.fromEntries(Object.entries(products).map(([key, value]) => [key, value.unit]));
    for (const order of orders) {
      if (order.status !== "received") order.quoteSnapshot = quote(order, rates);
    }
    return { orders, rates, nextId: 107 };
  }

  const api = { status, products, paper, finish, delivery, quote, manufacturingOrders, seed };
  globalThis.PrintShop = api;
  if (typeof module !== "undefined") module.exports = api;
})();
