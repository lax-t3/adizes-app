'use strict';

const assert = require('assert');
const {
  classifyTension,
  computeTensions,
  getTopTensions,
  computeActionPath,
  generateActionPathMessages,
  ROLE_NAMES,
  ROLE_COLORS,
  TYPE_LABELS,
} = require('./tensions');

// ── classifyTension ──────────────────────────────────────────────────────────
assert.strictEqual(classifyTension(0),  'aligned',  'gap=0 should be aligned');
assert.strictEqual(classifyTension(4),  'aligned',  'gap=4 should be aligned');
assert.strictEqual(classifyTension(5),  'moderate', 'gap=5 should be moderate');
assert.strictEqual(classifyTension(15), 'moderate', 'gap=15 should be moderate');
assert.strictEqual(classifyTension(16), 'high',     'gap=16 should be high');
assert.strictEqual(classifyTension(30), 'high',     'gap=30 should be high');

// ── computeTensions ──────────────────────────────────────────────────────────
const sample = {
  is:     { P: 28, A: 37, E: 34, I: 25 },
  should: { P: 22, A: 30, E: 42, I: 28 },
  want:   { P: 18, A: 42, E: 38, I: 30 },
};
const tensions = computeTensions(sample);

// P: rolePressure=|22-28|=6, energyTension=|18-22|=4, identityDrift=|18-28|=10 → peak=10 moderate
assert.strictEqual(tensions.P.rolePressure,      6);
assert.strictEqual(tensions.P.rolePressureDelta, -6);    // should-is = 22-28
assert.strictEqual(tensions.P.energyTension,     4);
assert.strictEqual(tensions.P.identityDrift,     10);
assert.strictEqual(tensions.P.primaryType,       'identityDrift');
assert.strictEqual(tensions.P.peakGap,           10);
assert.strictEqual(tensions.P.level,             'moderate');

// A: rolePressure=|30-37|=7, energyTension=|42-30|=12, identityDrift=|42-37|=5 → peak=12 moderate
assert.strictEqual(tensions.A.rolePressure,      7);
assert.strictEqual(tensions.A.energyTension,     12);
assert.strictEqual(tensions.A.energyTensionDelta, 12);   // want-should = 42-30
assert.strictEqual(tensions.A.identityDrift,     5);
assert.strictEqual(tensions.A.primaryType,       'energyTension');
assert.strictEqual(tensions.A.peakGap,           12);
assert.strictEqual(tensions.A.level,             'moderate');

// E: rolePressure=|42-34|=8, energyTension=|38-42|=4, identityDrift=|38-34|=4 → peak=8 moderate
assert.strictEqual(tensions.E.rolePressure,      8);
assert.strictEqual(tensions.E.rolePressureDelta, 8);     // should-is = 42-34
assert.strictEqual(tensions.E.primaryType,       'rolePressure');
assert.strictEqual(tensions.E.peakGap,           8);
assert.strictEqual(tensions.E.level,             'moderate');

// I: rolePressure=|28-25|=3, energyTension=|30-28|=2, identityDrift=|30-25|=5 → peak=5 moderate
assert.strictEqual(tensions.I.rolePressure,      3);
assert.strictEqual(tensions.I.identityDrift,     5);
assert.strictEqual(tensions.I.primaryType,       'identityDrift');
assert.strictEqual(tensions.I.peakGap,           5);
assert.strictEqual(tensions.I.level,             'moderate');

// ── getTopTensions ───────────────────────────────────────────────────────────
const top2 = getTopTensions(tensions, 2);
assert.strictEqual(top2.length, 2);
assert.strictEqual(top2[0].gap,  12);               // A energyTension = 12 (highest)
assert.strictEqual(top2[0].role, 'A');
assert.strictEqual(top2[0].type, 'energyTension');
assert.strictEqual(top2[1].gap,  10);               // P identityDrift = 10 (second)
assert.strictEqual(top2[1].role, 'P');
assert.strictEqual(top2[1].type, 'identityDrift');
assert.ok(typeof top2[0].level === 'string');
assert.ok(typeof top2[0].delta === 'number');

// ── computeActionPath ────────────────────────────────────────────────────────
const ap = computeActionPath(tensions);
assert.strictEqual(ap.stretchRole, 'E');  // highest rolePressure = E(8)
assert.strictEqual(ap.balanceRole, 'P');  // highest identityDrift = P(10)
assert.strictEqual(ap.protectRole, 'I');  // lowest peakGap = I(5)

// ── generateActionPathMessages ───────────────────────────────────────────────
const msgs = generateActionPathMessages(tensions, ap);
assert.ok(typeof msgs.stretch.description === 'string' && msgs.stretch.description.length > 10);
assert.ok(typeof msgs.stretch.action      === 'string' && msgs.stretch.action.length > 10);
assert.ok(typeof msgs.balance.description === 'string');
assert.ok(typeof msgs.protect.description === 'string');
assert.strictEqual(msgs.stretch.role, 'E');
assert.strictEqual(msgs.balance.role, 'P');
assert.strictEqual(msgs.protect.role, 'I');
assert.ok(typeof msgs.stretch.roleColor === 'string');

// ── constants exported ───────────────────────────────────────────────────────
assert.strictEqual(ROLE_NAMES.P, 'Producer');
assert.strictEqual(ROLE_COLORS.P, '#C8102E');
assert.strictEqual(TYPE_LABELS.rolePressure, 'Role Pressure');

console.log('All tensions tests passed ✓');
