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

const ROLE_TINTS = {
  P: 'rgba(200,16,46,0.07)',
  A: 'rgba(29,53,87,0.07)',
  E: 'rgba(232,119,34,0.07)',
  I: 'rgba(42,157,143,0.07)',
};

const GAP_TYPE_META = {
  execution: {
    label:      'Execution Gap',
    formula:    'Role Expectations VS Current State',
    lensA:      'should',
    lensALabel: 'Role Expectations',
    lensB:      'is',
    lensBLabel: 'Current State',
  },
  engagement: {
    label:      'Engagement Gap',
    formula:    'Role Expectations VS Intrinsic Preference',
    lensA:      'should',
    lensALabel: 'Role Expectations',
    lensB:      'want',
    lensBLabel: 'Intrinsic Preference',
  },
  authenticity: {
    label:      'Authenticity Gap',
    formula:    'Current State VS Intrinsic Preference',
    lensA:      'is',
    lensALabel: 'Current State',
    lensB:      'want',
    lensBLabel: 'Intrinsic Preference',
  },
};

// Action cues per gap type, role, and direction
// direction: "high" = signed >= 0 (first lens > second); "low" = signed < 0
const ACTION_CUES = {
  execution: {
    P: {
      high: 'Take direct ownership of a critical deliverable this cycle — close the loop yourself.',
      low:  'Identify one area where you can reduce execution overhead to free up strategic headspace.',
    },
    A: {
      high: 'Invest an hour this week building or refining a process your team will use repeatedly.',
      low:  'Identify one area where structural overhead can be reduced to free up speed.',
    },
    E: {
      high: 'Propose one forward-looking idea or experiment this cycle — don\'t wait for permission.',
      low:  'Channel your entrepreneurial energy into a specific innovation project with a clear outcome.',
    },
    I: {
      high: 'Schedule one-to-ones with two stakeholders you have under-invested in this month.',
      low:  'Balance relationship investment with task accountability — results need attention too.',
    },
  },
  engagement: {
    P: {
      high: 'Look for tasks with longer time horizons that better match your natural energy.',
      low:  'Direct your extra results-drive into areas where direct ownership adds the most value.',
    },
    A: {
      high: 'Use checklists and templates to carry the structural load — reduce the manual effort.',
      low:  'Deliberately allow one area to run with less oversight this month.',
    },
    E: {
      high: 'Block 30 minutes per week for exploratory thinking — protect it from operational demands.',
      low:  'Channel your creative energy into a specific project with a defined outcome.',
    },
    I: {
      high: 'Prioritise two key relationships this month — depth over breadth.',
      low:  'Apply your people instincts in a cross-functional or collaborative context.',
    },
  },
  authenticity: {
    P: {
      high: 'Look for ways to redirect effort toward longer-horizon work that energises you.',
      low:  'Find one project where direct execution is the right tool — own it fully and visibly.',
    },
    A: {
      high: 'Build systems and templates that carry the structural load without constant manual effort.',
      low:  'Bring your structural instincts to an area that currently operates without enough clarity.',
    },
    E: {
      high: 'Block 30 minutes per week for exploratory thinking — protect it from operational demands.',
      low:  'Choose one initiative where you can operate at your natural strategic and creative level.',
    },
    I: {
      high: 'Invest in one meaningful team relationship that has been crowded out by delivery pressure.',
      low:  'Seek a project where team cohesion is the critical success factor — your instincts are needed.',
    },
  },
};

/**
 * Select top N gaps by absolute magnitude from the backend-computed gaps array.
 *
 * @param {Array} gaps - backend gaps: [{role, execution_gap, execution_gap_signed,
 *                        execution_severity, ...same for engagement, authenticity, ...}]
 * @param {number} n
 * @returns {Array} top N items: [{role, gap_type, gap_abs, gap_signed, severity, meta}]
 */
function getTopGaps(gaps, n) {
  const all = [];
  for (const g of gaps) {
    for (const gapType of ['execution', 'engagement', 'authenticity']) {
      all.push({
        role:      g.role,
        gap_type:  gapType,
        gap_abs:   g[`${gapType}_gap`],
        gap_signed: g[`${gapType}_gap_signed`],
        severity:  g[`${gapType}_severity`],
        narrative: g[`${gapType}_narrative`],
        meta:      GAP_TYPE_META[gapType],
      });
    }
  }
  return all.sort((a, b) => b.gap_abs - a.gap_abs).slice(0, n);
}

/**
 * Determine Stretch / Balance / Protect / Complement roles from the gaps array.
 */
function computeActionPath(gaps) {
  const gapsByRole = {};
  for (const g of gaps) gapsByRole[g.role] = g;

  const stretchRole = ROLES.reduce((a, b) =>
    gapsByRole[a].execution_gap >= gapsByRole[b].execution_gap ? a : b);
  const balanceRole = ROLES.reduce((a, b) =>
    gapsByRole[a].authenticity_gap >= gapsByRole[b].authenticity_gap ? a : b);
  const protectPeakGap = (role) =>
    Math.max(gapsByRole[role].execution_gap, gapsByRole[role].engagement_gap, gapsByRole[role].authenticity_gap);
  const protectRole = ROLES.reduce((a, b) => protectPeakGap(a) <= protectPeakGap(b) ? a : b);

  // Complement: role with the largest engagement gap (want << should) → natural deficit
  const complementRole = ROLES.reduce((a, b) =>
    gapsByRole[a].engagement_gap >= gapsByRole[b].engagement_gap ? a : b);

  return { stretchRole, balanceRole, protectRole, complementRole };
}

/**
 * Generate full action path messages for Page 5.
 */
function generateActionPathMessages(gaps, actionPath, scaledScores) {
  const gapsByRole = {};
  for (const g of gaps) gapsByRole[g.role] = g;

  const { stretchRole, balanceRole, protectRole, complementRole } = actionPath;
  const sg = gapsByRole[stretchRole];
  const bg = gapsByRole[balanceRole];

  return {
    stretch: {
      role:      stretchRole,
      roleName:  ROLE_NAMES[stretchRole],
      roleColor: ROLE_COLORS[stretchRole],
      description: sg.execution_gap_signed > 0
        ? `Your role demands more ${ROLE_NAMES[stretchRole]} behaviour than you are currently expressing — the gap is activation, not capability.`
        : `You are expressing more ${ROLE_NAMES[stretchRole]} behaviour than your role requires — redirect this energy intentionally.`,
      action: ACTION_CUES.execution[stretchRole][sg.execution_gap_signed >= 0 ? 'high' : 'low'],
    },
    balance: {
      role:      balanceRole,
      roleName:  ROLE_NAMES[balanceRole],
      roleColor: ROLE_COLORS[balanceRole],
      description: bg.authenticity_gap_signed > 0
        ? `You are operating with more ${ROLE_NAMES[balanceRole]} behaviour than your natural self prefers — this gap costs energy over time.`
        : `You prefer more ${ROLE_NAMES[balanceRole]} engagement than you are currently expressing — find space to express it.`,
      action: ACTION_CUES.authenticity[balanceRole][bg.authenticity_gap_signed >= 0 ? 'high' : 'low'],
    },
    protect: {
      role:      protectRole,
      roleName:  ROLE_NAMES[protectRole],
      roleColor: ROLE_COLORS[protectRole],
      description: `Your ${ROLE_NAMES[protectRole]} dimension shows the strongest alignment across Current State, Role Expectations, and Intrinsic Preference — this is your most stable foundation.`,
      action: `Don't sacrifice your ${ROLE_NAMES[protectRole]} strength under pressure or in pursuit of closing other gaps.`,
    },
    complement: {
      role:      complementRole,
      roleName:  ROLE_NAMES[complementRole],
      roleColor: ROLE_COLORS[complementRole],
      description: `Your ${ROLE_NAMES[complementRole]} dimension shows the largest gap between what your role demands and what you naturally prefer — actively seek colleagues who lead with this energy.`,
      action: `Build relationships with strong ${ROLE_NAMES[complementRole]}s on your team. Their instincts cover your natural gap.`,
    },
  };
}

module.exports = {
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, GAP_TYPE_META, ACTION_CUES,
  getTopGaps, computeActionPath, generateActionPathMessages,
};
