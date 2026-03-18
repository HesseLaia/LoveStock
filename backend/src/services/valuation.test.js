import assert from 'node:assert/strict';
import test from 'node:test';

import { generateChartData } from './chart.js';
import {
  calculateBaseScore,
  calculateFinalPrice,
  calculateValuation,
  determineGrade,
  determineStockType,
  generateSpecialTag,
  generateTicker
} from './valuation.js';

test('determineStockType matches examples', () => {
  assert.equal(
    determineStockType(['A', 'A', 'A', 'A', 'A', 'B', 'B', 'B']),
    'Blue Chip'
  );
  assert.equal(
    determineStockType(['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A']),
    'Concept Stock'
  );
  assert.equal(
    determineStockType(['A', 'A', 'A', 'A', 'A', 'C', 'C', 'C']),
    'Defensive Stock'
  );
  assert.equal(
    determineStockType(['A', 'A', 'A', 'A', 'A', 'D', 'D', 'D']),
    'Growth Stock'
  );
});

test('generateSpecialTag rules and first-match behavior', () => {
  assert.equal(
    generateSpecialTag(['D', 'A', 'C', 'D', 'D', 'A', 'A', 'A']),
    'RARE FIND'
  );
  assert.equal(
    generateSpecialTag(['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A']),
    'HIGH LIQUIDITY'
  );
  assert.equal(
    generateSpecialTag(['A', 'D', 'A', 'A', 'A', 'A', 'A', 'A']),
    'LONG-TERM VALUE'
  );
  assert.equal(
    generateSpecialTag(['A', 'B', 'B', 'B', 'D', 'A', 'A', 'A']),
    'PRE-IPO ASSET'
  );
  assert.equal(generateSpecialTag(['A', 'B', 'B', 'B', 'B', 'A', 'A', 'A']), null);
});

test('generateTicker', () => {
  assert.equal(generateTicker('alex'), '$ALEX');
  assert.equal(generateTicker('a-l_e.x'), '$ALEX');
  assert.equal(generateTicker(''), '$USER');
  assert.equal(generateTicker(null), '$USER');
});

test('grade boundaries', () => {
  assert.equal(determineGrade(8000), 'A+');
  assert.equal(determineGrade(6000), 'A');
  assert.equal(determineGrade(4500), 'A-');
  assert.equal(determineGrade(500), 'C+');
  assert.equal(determineGrade(499.99), 'C-');
});

test('final price stays within range', () => {
  for (let i = 0; i < 50; i++) {
    const p1 = calculateFinalPrice(-50, 'Growth Stock');
    const p2 = calculateFinalPrice(75, 'Growth Stock');
    assert.ok(p1 >= 1 && p1 <= 9999);
    assert.ok(p2 >= 1 && p2 <= 9999);
  }
});

test('base score Q5-D is random-ish across runs', () => {
  const answers = ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'];
  const results = new Set();
  for (let i = 0; i < 10; i++) results.add(calculateBaseScore(answers));
  assert.ok(results.size > 1);
});

test('chart data length and range', () => {
  const data = generateChartData('Concept Stock');
  assert.equal(data.length, 30);
  data.forEach((n) => assert.ok(n >= 0 && n <= 52));
});

test('calculateValuation returns full object', () => {
  const v = calculateValuation(['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'], 'alex');
  assert.ok(v && typeof v === 'object');
  assert.equal(typeof v.ticker, 'string');
  assert.equal(typeof v.final_price, 'number');
  assert.equal(typeof v.change_percent, 'number');
  assert.equal(typeof v.stock_type, 'string');
  assert.equal(typeof v.grade, 'string');
  assert.ok(Array.isArray(v.chart_data));
});

