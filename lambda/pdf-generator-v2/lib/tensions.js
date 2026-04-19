'use strict';

const ROLES = ['P', 'A', 'E', 'I'];

const ROLE_NAMES = {
  P: 'Producer',
  A: 'Administrator',
  E: 'Entrepreneur',
  I: 'Integrator',
};

const ROLE_COLORS = {
  P: '#C8102E',
  A: '#1D3557',
  E: '#E87722',
  I: '#2A9D8F',
};

// Light tint backgrounds for role card headers (used inline in EJS)
const ROLE_TINTS = {
  P: 'rgba(200,16,46,0.07)',
  A: 'rgba(29,53,87,0.07)',
  E: 'rgba(232,119,34,0.07)',
  I: 'rgba(42,157,143,0.07)',
};

const TYPE_LABELS = {
  rolePressure:  'Role Pressure',
  energyTension: 'Energy Tension',
  identityDrift: 'Identity Drift',
};

// Plain-language messages for Energy Tension (WANT vs SHOULD) — not in gaps payload
const ENERGY_TENSION_MESSAGES = {
  P: {
    high: "The role's demand for results outpaces your natural preference — sustaining this output will cost energy over time.",
    low:  "You have more results-drive than your role currently demands — channel this into areas where direct ownership adds the most value.",
  },
  A: {
    high: "Your role requires more structural rigour than feels natural — build routines and templates to carry the load.",
    low:  "You naturally gravitate toward more structure than your role requires — a strength, but avoid over-engineering what needs to stay fluid.",
  },
  E: {
    high: "Your role expects more creative and innovative thinking than you naturally lean toward — carve out deliberate exploration time.",
    low:  "You carry more entrepreneurial drive than your role currently channels — seek assignments that let you operate at that level.",
  },
  I: {
    high: "Your role demands more people-investment than feels instinctive — prioritise a small number of key relationships rather than spreading thin.",
    low:  "You have stronger integrative instincts than your role exercises — bring them into cross-functional or collaborative projects.",
  },
};

// One-line action cues per tension type, role, and direction
const ACTION_CUES = {
  rolePressure: {
    P: { high: "Take direct ownership of a critical deliverable this cycle — close the loop yourself.", low:  "Delegate execution on defined tasks and direct your energy toward the next priority." },
    A: { high: "Invest an hour this week building or refining a process your team will use repeatedly.",  low:  "Identify one area where you can reduce structural overhead to free up speed." },
    E: { high: "Propose one forward-looking idea or experiment this cycle — don't wait for permission.", low:  "Channel your entrepreneurial energy into a specific innovation project with a clear outcome." },
    I: { high: "Schedule one-to-ones with two stakeholders you have under-invested in this month.",      low:  "Balance relationship investment with task accountability — results need attention too." },
  },
  energyTension: {
    P: { high: "Look for tasks with longer time horizons that better match your natural energy.",            low:  "Direct your extra results-drive into areas where direct ownership adds the most value." },
    A: { high: "Use checklists and templates to carry the structural load — reduce the manual effort.",     low:  "Deliberately allow one area to run with less oversight this month." },
    E: { high: "Block 30 minutes per week for exploratory thinking — protect it from operational demands.", low:  "Channel your creative energy into a specific project with a clear outcome." },
    I: { high: "Prioritise two key relationships this month — depth over breadth.",                         low:  "Apply your people instincts in a cross-functional or collaborative context." },
  },
  identityDrift: {
    P: { high: "Look for ways to redirect effort toward longer-horizon work that energises you.",                    low:  "Find one project where direct execution is the right tool — own it fully and visibly." },
    A: { high: "Build systems and checklists that carry the structural load without constant manual effort.",         low:  "Bring your structural instincts to an area that currently operates without enough clarity." },
    E: { high: "Block 30 minutes per week for exploratory thinking — protect it from operational demands.",           low:  "Choose one initiative where you can operate at your natural strategic and creative level." },
    I: { high: "Invest in one meaningful team relationship that has been crowded out by delivery pressure.",          low:  "Seek a project where team cohesion is the critical success factor — your instincts are needed there." },
  },
};

// ── Core calculation ─────────────────────────────────────────────────────────

function classifyTension(gap) {
  if (gap < 5)   return 'aligned';
  if (gap <= 15) return 'moderate';
  return 'high';
}

function computeTensions(scaledScores) {
  const result = {};
  for (const role of ROLES) {
    const is     = scaledScores.is[role];
    const should = scaledScores.should[role];
    const want   = scaledScores.want[role];

    const rolePressureDelta   = should - is;   // positive = role demands more
    const energyTensionDelta  = want - should; // positive = want exceeds should
    const identityDriftDelta  = want - is;     // positive = want exceeds is

    const rolePressure  = Math.abs(rolePressureDelta);
    const energyTension = Math.abs(energyTensionDelta);
    const identityDrift = Math.abs(identityDriftDelta);

    const peakGap = Math.max(rolePressure, energyTension, identityDrift);

    let primaryType;
    if (peakGap === rolePressure)        primaryType = 'rolePressure';
    else if (peakGap === energyTension)  primaryType = 'energyTension';
    else                                  primaryType = 'identityDrift';

    // Energy tension direction: want < should means role drains; want > should means role energises
    const etDir = energyTensionDelta < 0 ? 'high' : 'low';

    result[role] = {
      is, should, want,
      rolePressure,  rolePressureDelta,
      energyTension, energyTensionDelta,
      identityDrift, identityDriftDelta,
      primaryType,
      peakGap,
      level: classifyTension(peakGap),
      energyTensionMessage: ENERGY_TENSION_MESSAGES[role][etDir],
    };
  }
  return result;
}

function getTopTensions(tensionData, n) {
  const all = [];
  for (const role of ROLES) {
    const t = tensionData[role];
    all.push({ role, type: 'rolePressure',  gap: t.rolePressure,  delta: t.rolePressureDelta,  level: classifyTension(t.rolePressure) });
    all.push({ role, type: 'energyTension', gap: t.energyTension, delta: t.energyTensionDelta, level: classifyTension(t.energyTension) });
    all.push({ role, type: 'identityDrift', gap: t.identityDrift, delta: t.identityDriftDelta, level: classifyTension(t.identityDrift) });
  }
  return all.sort((a, b) => b.gap - a.gap).slice(0, n);
}

function computeActionPath(tensionData) {
  const stretchRole = ROLES.reduce((a, b) => tensionData[a].rolePressure  >= tensionData[b].rolePressure  ? a : b);
  const balanceRole = ROLES.reduce((a, b) => tensionData[a].identityDrift >= tensionData[b].identityDrift ? a : b);
  const protectRole = ROLES.reduce((a, b) => tensionData[a].peakGap       <= tensionData[b].peakGap       ? a : b);
  return { stretchRole, balanceRole, protectRole };
}

function generateActionPathMessages(tensionData, actionPath) {
  const { stretchRole, balanceRole, protectRole } = actionPath;
  const st = tensionData[stretchRole];
  const bt = tensionData[balanceRole];

  return {
    stretch: {
      role:      stretchRole,
      roleName:  ROLE_NAMES[stretchRole],
      roleColor: ROLE_COLORS[stretchRole],
      description: st.rolePressureDelta > 0
        ? `Your role demands more ${ROLE_NAMES[stretchRole]} behaviour than you are currently expressing — the gap is activation, not capability.`
        : `You are expressing more ${ROLE_NAMES[stretchRole]} behaviour than your role requires — redirect this energy intentionally.`,
      action: ACTION_CUES.rolePressure[stretchRole][st.rolePressureDelta > 0 ? 'high' : 'low'],
    },
    balance: {
      role:      balanceRole,
      roleName:  ROLE_NAMES[balanceRole],
      roleColor: ROLE_COLORS[balanceRole],
      description: bt.identityDriftDelta > 0
        ? `You prefer more ${ROLE_NAMES[balanceRole]} engagement than you are currently expressing — find space to express it.`
        : `You are operating with more ${ROLE_NAMES[balanceRole]} behaviour than your natural self prefers — this gap costs energy over time.`,
      action: ACTION_CUES.identityDrift[balanceRole][bt.identityDriftDelta > 0 ? 'low' : 'high'],
    },
    protect: {
      role:      protectRole,
      roleName:  ROLE_NAMES[protectRole],
      roleColor: ROLE_COLORS[protectRole],
      description: `Your ${ROLE_NAMES[protectRole]} dimension shows the strongest alignment across IS, SHOULD, and WANT — this is your most stable foundation.`,
      action: `Don't sacrifice your ${ROLE_NAMES[protectRole]} strength under pressure or in pursuit of closing other gaps.`,
    },
  };
}

module.exports = {
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
  classifyTension, computeTensions, getTopTensions,
  computeActionPath, generateActionPathMessages,
};
