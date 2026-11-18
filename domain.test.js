// 実行: node --test domain.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { quote, seed } = require("./domain.js");

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
