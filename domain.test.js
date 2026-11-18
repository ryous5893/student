const test = require("node:test");
const assert = require("node:assert/strict");
const shop = require("./domain.js");

test("差し戻し中は製造進行に表示せず、承認後は表示する", () => {
  const order = { id: 1, status: "returned" };

  assert.deepEqual(shop.manufacturingOrders([order]), []);

  order.status = "proof";
  assert.deepEqual(shop.manufacturingOrders([order]), []);

  order.status = "ready";
  assert.deepEqual(shop.manufacturingOrders([order]), [order]);
});
