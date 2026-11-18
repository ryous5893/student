const test = require("node:test");
const assert = require("node:assert/strict");
const { manufacturingOrders, seed } = require("../domain.js");

test("a returned order stays out of manufacturing after persisted state is restored", () => {
  const restoredOrders = JSON.parse(JSON.stringify(seed().orders));
  const returnedOrder = restoredOrders.find(order => order.id === 103);

  assert.equal(returnedOrder.status, "returned");
  assert.equal(manufacturingOrders(restoredOrders).some(order => order.id === 103), false);

  returnedOrder.status = "proof";
  assert.equal(manufacturingOrders(restoredOrders).some(order => order.id === 103), false);

  returnedOrder.status = "ready";
  assert.equal(manufacturingOrders(restoredOrders).some(order => order.id === 103), true);
});
