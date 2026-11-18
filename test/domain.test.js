const test = require("node:test");
const assert = require("node:assert/strict");
const { manufacturingOrders, seed } = require("../domain.js");

test("a returned order stays out of manufacturing after intake reopens and state is restored", () => {
  const orders = JSON.parse(JSON.stringify(seed().orders));
  const returnedOrder = orders.find(order => order.id === 103);

  assert.equal(returnedOrder.status, "returned");
  assert.equal(manufacturingOrders(orders).some(order => order.id === 103), false);

  returnedOrder.status = "proof";
  const reopenedOrders = JSON.parse(JSON.stringify(orders));
  assert.equal(manufacturingOrders(reopenedOrders).some(order => order.id === 103), false);
  assert.deepEqual(manufacturingOrders(reopenedOrders).map(order => order.id), [105, 106]);

  reopenedOrders.find(order => order.id === 103).status = "ready";
  assert.equal(manufacturingOrders(reopenedOrders).some(order => order.id === 103), true);
});
