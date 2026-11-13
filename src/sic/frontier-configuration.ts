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
}

export const defaultFrontierConfiguration: FrontierConfiguration = Object.freeze({ inputOrder: 'least_tried' });

export function compileFrontierConfiguration(value: unknown): FrontierConfiguration {
  if (typeof value !== 'object' || value === null || Object.keys(value).join(',') !== 'inputOrder'
    || !('inputOrder' in value) || !isFrontierInputOrder(value.inputOrder)) {
    throw new TypeError('Exploration configuration requires a registered input order.');
  }
  return Object.freeze({ inputOrder: value.inputOrder });
}
