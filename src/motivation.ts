export const screenLines = [
  'Today is a fresh chance to show up for yourself.',
  'Small promises create meaningful progress.',
  'Focus on the next honest step.',
  'Consistency grows quietly, one choice at a time.',
  'Progress is built in ordinary moments.',
];

export const completionLines = [
  'You kept a promise to yourself.',
  'That effort counts. Keep going.',
  'One goal down—your momentum is growing.',
  'You showed up, and that matters.',
  'A small win is still a real win.',
];

export function pickLine(lines: string[], seed = Date.now()) {
  return lines[Math.abs(seed) % lines.length];
}

export const reflectionLines = [
  'One difficult day does not erase your progress. Your next step still counts.',
  'Being honest with yourself is progress too. Tomorrow is another chance.',
  'You paused to reflect. Take what you learned into your next small step.',
  'Be kind to yourself. You can begin again, one promise at a time.',
];
