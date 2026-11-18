// 実行: node --test domain.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { quote, seed, revertInspection } = require("./domain.js");

const rates = { flyer: 10, poster: 120, card: 16 };
const flyer = (overrides) => ({
  product: "flyer", quantity: 1000, paper: "standard", double: false,
  finish: "none", rush: false, ...overrides
});

test("104番（青葉商店会・両面チラシ1,000部）: 割引2,000円、合計20,000円", () => {
  const { orders, rates: seedRates } = seed();
  const order = orders.find(o => o.id === 104);
  const result = quote(order, seedRates);
  assert.equal(result.printing, 20000);
  assert.equal(result.paperCost, 2000);
  assert.equal(result.discount, 2000);
  assert.equal(result.total, 20000);
});

test("割引境界: 999部は割引なし", () => {
  for (const double of [false, true]) {
    const result = quote(flyer({ quantity: 999, double }), rates);
    assert.equal(result.discount, 0);
    assert.equal(result.total, result.printing + result.paperCost);
  }
});

test("割引境界: 1,000部は印刷代の10%", () => {
  assert.equal(quote(flyer({ quantity: 1000, double: false }), rates).discount, 1000);
  assert.equal(quote(flyer({ quantity: 1000, double: true }), rates).discount, 2000);
});

test("割引境界: 1,001部も印刷代の10%（両面でも率は変わらない）", () => {
  assert.equal(quote(flyer({ quantity: 1001, double: false }), rates).discount, 1001);
  assert.equal(quote(flyer({ quantity: 1001, double: true }), rates).discount, 2002);
});

test("割引対象は印刷代のみ（用紙・加工・特急は対象外）", () => {
  const result = quote(flyer({ quantity: 1000, double: true, paper: "heavy", finish: "laminate", rush: true }), rates);
  assert.equal(result.discount, 2000);
  assert.equal(result.total, 20000 + 6000 + 1000 + 1000 - 2000);
});

test("端数は切り捨て", () => {
  const result = quote(flyer({ quantity: 1003, double: false }), { ...rates, flyer: 3 });
  assert.equal(result.printing, 3009);
  assert.equal(result.discount, 300);
});

test("検品取り消し: 加工中に戻し、日時と状態変更を記録する", () => {
  const order = seed().orders.find(item => item.id === 106);
  const snapshot = structuredClone(order.quoteSnapshot);
  const at = "2026-11-18T08:00:00.000Z";
  assert.equal(revertInspection(order, at), true);
  assert.equal(order.status, "finishing");
  assert.deepEqual(order.inspectionHistory, [{ at, from: "inspected", to: "finishing" }]);
  assert.deepEqual(order.quoteSnapshot, snapshot);
  assert.equal(order.quantity, 12);
});

test("検品取り消し: 納品済みを含む検品済み以外の注文は変更しない", () => {
  for (const status of ["received", "quoted", "proof", "returned", "ready", "printing", "finishing", "delivered"]) {
    const order = { ...seed().orders[0], status };
    const before = structuredClone(order);
    assert.equal(revertInspection(order), false);
    assert.deepEqual(order, before);
  }
});

test("検品取り消し: 二重実行を防ぎ、再検品後も以前の履歴を保持する", () => {
  const order = seed().orders.find(item => item.id === 106);
  assert.equal(revertInspection(order, "2026-11-18T08:00:00.000Z"), true);
  const firstEntry = structuredClone(order.inspectionHistory[0]);
  assert.equal(revertInspection(order), false);
  assert.equal(order.inspectionHistory.length, 1);
  order.status = "inspected";
  assert.equal(revertInspection(order, "2026-11-18T09:00:00.000Z"), true);
  assert.equal(order.inspectionHistory.length, 2);
  assert.deepEqual(order.inspectionHistory[0], firstEntry);
  assert.equal(order.inspectionHistory[1].at, "2026-11-18T09:00:00.000Z");
});
