// 実行: node --test domain.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { quote, seed, revertInspection, canChangeProductionDue, changeProductionDue } = require("./domain.js");

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

test("要望の確認ケース: 片面1,000部は割引あり、両面999部は割引なし", () => {
  const single1000 = quote(flyer({ quantity: 1000, double: false }), rates);
  assert.deepEqual(single1000, { printing: 10000, paperCost: 2000, finishing: 0, rush: 0, discount: 1000, total: 11000 });

  const double999 = quote(flyer({ quantity: 999, double: true }), rates);
  assert.deepEqual(double999, { printing: 19980, paperCost: 1998, finishing: 0, rush: 0, discount: 0, total: 21978 });
});

test("納期変更: 印刷開始後の各工程で変更前後と日時を残し、確定見積を保持する", () => {
  for (const status of ["printing", "finishing", "inspected"]) {
    const order = { ...seed().orders.find(item => item.id === 106), status };
    const snapshot = structuredClone(order.quoteSnapshot);
    assert.equal(canChangeProductionDue(order), true);
    assert.equal(changeProductionDue(order, "2026-12-05", "2026-11-18T08:00:00.000Z"), true);
    assert.equal(order.due, "2026-12-05");
    assert.equal(order.status, status);
    assert.deepEqual(order.quoteSnapshot, snapshot);
    assert.deepEqual(order.productionDueHistory, [{ at: "2026-11-18T08:00:00.000Z", from: "2026-12-04", to: "2026-12-05" }]);
  }
});

test("納期変更: 印刷前や納品済みの注文は変更しない", () => {
  for (const status of ["received", "quoted", "proof", "returned", "ready", "delivered"]) {
    const order = { ...seed().orders[0], status };
    const before = structuredClone(order);
    assert.equal(canChangeProductionDue(order), false);
    assert.equal(changeProductionDue(order, "2026-12-05"), false);
    assert.deepEqual(order, before);
  }
});

test("納期変更: 不正な日付と同じ日付は保存せず、うるう日は正しく扱う", () => {
  const order = seed().orders.find(item => item.id === 106);
  const before = structuredClone(order);
  for (const due of ["", "invalid", "2026-02-29", "2026-02-30", "2026-13-01", "2026-11-3", order.due, null]) {
    assert.equal(changeProductionDue(order, due), false);
    assert.deepEqual(order, before);
  }
  assert.equal(changeProductionDue(order, "2028-02-29"), true);
});

test("納期変更: 複数回の変更履歴を保持する", () => {
  const order = seed().orders.find(item => item.id === 106);
  changeProductionDue(order, "2026-12-05", "2026-11-18T08:00:00.000Z");
  changeProductionDue(order, "2026-12-03", "2026-11-18T09:00:00.000Z");
  assert.equal(order.due, "2026-12-03");
  assert.deepEqual(order.productionDueHistory.map(entry => [entry.from, entry.to]), [
    ["2026-12-04", "2026-12-05"], ["2026-12-05", "2026-12-03"]
  ]);
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
