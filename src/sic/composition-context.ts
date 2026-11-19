export type Effect = 'unchanged' | 'return' | 'new';
export type Step = {
  source: string;
  target: string;
  key: string;
  effect: Effect;
  repeated: boolean;
  evidence: string;
};
export function actionRelation(previous: string | undefined, current: string, penultimate?: string) {
  if (!previous) return 'start';
  if (previous === current) return 'repeat';
  if (penultimate === current) return 'resume';
  const left = previous.split(':')[0],
    right = current.split(':')[0];
  if (left === right) return 'change_target';
  return left === 'ACTION6' || right === 'ACTION6' ? 'change_modality' : 'switch_control';
}
