const test = require("node:test");
const assert = require("node:assert/strict");
const { quote } = require("../domain");

test("all quote lines are floored to whole yen", () => {
  const pricing = quote({
    product: "flyer",
    quantity: 1001,
    double: true,
    finish: "fold",
    rush: true,
    paper: "coated"
  }, { flyer: 10.99 });

  assert.equal(pricing.printing, Math.floor(10.99 * 1001 * 2));
  assert.equal(pricing.paperCost, Math.floor(4 * 1001));
  assert.equal(pricing.finishing, 500);
  assert.equal(pricing.rush, 1000);
  assert.equal(pricing.discount, Math.floor(pricing.printing * 0.2));
});

test("quote total equals the signed sum of all detail lines", () => {
  const pricing = quote({
    product: "poster",
    quantity: 333,
    double: false,
    finish: "laminate",
    rush: false,
    paper: "heavy"
  }, { poster: 120.75 });

  const detailSum = pricing.printing + pricing.paperCost + pricing.finishing + pricing.rush - pricing.discount;
  assert.equal(pricing.total, detailSum);
  assert.ok(Object.values(pricing).every(value => Number.isInteger(value)));
});
