export const frontierInputOrders = {
  least_tried: 'Try the least-used command first',
  command_order: 'Use a stable command order',
} as const;

export type FrontierInputOrder = keyof typeof frontierInputOrders;

export function isFrontierInputOrder(value: unknown): value is FrontierInputOrder {
  return typeof value === 'string' && Object.hasOwn(frontierInputOrders, value);
}

export interface FrontierConfiguration {
  readonly inputOrder: FrontierInputOrder;
  readonly localRule?: FrontierLocalRule;
}

export interface FrontierLocalRule {
  readonly title: string;
  readonly mode: 'shadow' | 'active';
  readonly commands: 'any' | 'directions' | 'clicks';
  readonly minimumUsageGap: number;
  readonly prefer: FrontierInputOrder;
}

export function compileFrontierLocalRule(value: unknown): FrontierLocalRule {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'commands,minimumUsageGap,mode,prefer,title') {
    throw new TypeError('The exploration rule requires a title, mode, command domain, usage gap and priority.');
  }
  const { title, mode, commands, minimumUsageGap, prefer } = value as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 80
    || (mode !== 'shadow' && mode !== 'active') || (commands !== 'any' && commands !== 'directions' && commands !== 'clicks')
    || typeof minimumUsageGap !== 'number' || !Number.isSafeInteger(minimumUsageGap) || minimumUsageGap < 1 || minimumUsageGap > 600
    || !isFrontierInputOrder(prefer)) {
    throw new TypeError('Use a title up to 80 characters, a registered command domain and priority, and a usage gap from 1 to 600.');
  }
  return Object.freeze({ title: title.trim(), mode, commands, minimumUsageGap, prefer });
}

export interface FrontierChoiceEvidence {
  readonly candidateRefs: Readonly<Record<FrontierInputOrder, string>>;
  readonly usageGap: number;
}

export function evaluateFrontierLocalRule(rule: FrontierLocalRule, { candidateRefs, usageGap }: FrontierChoiceEvidence) {
  const matchesDomain = (command: string) => rule.commands === 'any'
    || (rule.commands === 'directions' && /^ACTION[1-4]$/.test(command))
    || (rule.commands === 'clicks' && command === 'ACTION6');
  if (!matchesDomain(candidateRefs.least_tried) || !matchesDomain(candidateRefs.command_order)) {
    return { matched: false, reason: 'The competing commands are outside the rule’s domain.' };
  }
  if (usageGap < rule.minimumUsageGap) return { matched: false, reason: 'The usage gap is below the rule’s threshold.' };
  return { matched: true, reason: `The competing commands differ by ${usageGap} prior ${usageGap === 1 ? 'use' : 'uses'}.` };
}

export const defaultFrontierConfiguration: FrontierConfiguration = Object.freeze({ inputOrder: 'least_tried' });

export function compileFrontierConfiguration(value: unknown): FrontierConfiguration {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).some(key => key !== 'inputOrder' && key !== 'localRule')
    || !('inputOrder' in value) || !isFrontierInputOrder(value.inputOrder)) {
    throw new TypeError('Exploration configuration requires a registered input order.');
  }
  return Object.freeze({ inputOrder: value.inputOrder,
    ...('localRule' in value ? { localRule: compileFrontierLocalRule(value.localRule) } : {}) });
}
