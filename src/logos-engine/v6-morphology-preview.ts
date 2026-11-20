/** A visible indicator can encode a future layout conditional on a public action.
 * Observations own the indicator; the forecast and the subsequent measurement own the subjects.
 * A physical object can serve as an indicator in one experiment and as a participant in another.
 */
type Point = [number, number];
type Positions = Readonly<Record<string, Point>>;
export type PreviewSample = {
  ref: number;
  before: Positions;
  after: Positions;
  beforeForms?: Readonly<Record<string, string>>;
  afterForms?: Readonly<Record<string, string>>;
};
export type MorphologicalPreview = {
  kind: 'action_conditioned_layout_preview';
  action: string;
  indicator: { role: string; at: Point; form: string | null };
  layout: { subject: string; at: Point; form: string | null }[];
  evidence: {
    status: 'hypothesis' | 'witnessed' | 'replicated_with_control';
    witnesses: number[];
    controls: number[];
    counterexamples: number[];
    distinctIndicatedSites: number;
  };
};
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const difference = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const translate = (a: Point, d: Point): Point => [a[0] + d[0], a[1] + d[1]];

export function projectMorphologicalPreview(
  positions: Positions,
  forms: Readonly<Record<string, string>>,
  subject: string,
  indicator: string,
  action: string,
  examples: PreviewSample[],
  controls: number[],
  counterexamples: number[] = []
): MorphologicalPreview | null {
  const at = positions[indicator],
    here = positions[subject];
  if (subject === indicator || !at || !here || same(here, at)) return null;
  const histories = examples.filter(
    (e) =>
      e.before[indicator] &&
      e.before[subject] &&
      e.after[subject] &&
      !same(e.before[subject]!, e.before[indicator]!) &&
      same(e.after[subject]!, e.before[indicator]!)
  );
  const sites = new Set(histories.map((h) => h.before[indicator]!.join()));
  function futureForm(role: string) {
    // A mark's current pose can predict a participant's future pose only after replication.
    // Require a differing previously observed outcome for another indicator form.
    const now = forms[indicator];
    if (!now) return null;
    const matching = histories.filter((h) => h.beforeForms?.[indicator] === now && h.afterForms?.[role]);
    const outputs = new Set(matching.map((h) => h.afterForms![role]!));
    if (outputs.size !== 1 || new Set(matching.map((h) => h.before[indicator]!.join())).size < 2) return null;
    const expected = matching[0]!.afterForms![role]!;
    return histories.some(
      (h) =>
        h.beforeForms?.[indicator] &&
        h.beforeForms[indicator] !== now &&
        h.afterForms?.[role] &&
        h.afterForms[role] !== expected
    )
      ? expected
      : null;
  }
  const layout: MorphologicalPreview['layout'] = [{ subject, at, form: futureForm(subject) }];
  if (sites.size >= 2) {
    for (const role of Object.keys(positions).sort()) {
      if (role === subject || role === indicator) continue;
      // An additional participant must have moved in every witness and kept the same
      // nontrivial relationship to the indicated site. A missing observation breaks support.
      let offset: Point | null = null,
        agrees = true;
      for (const h of histories) {
        const start = h.before[role],
          end = h.after[role];
        if (!start || !end || same(start, end)) {
          agrees = false;
          break;
        }
        const d = difference(end, h.before[indicator]!);
        if (offset && !same(offset, d)) {
          agrees = false;
          break;
        }
        offset = d;
      }
      if (agrees && offset) layout.push({ subject: role, at: translate(at, offset), form: futureForm(role) });
    }
  }
  const status =
    sites.size >= 2 && controls.length > 0 && counterexamples.length === 0
      ? 'replicated_with_control'
      : histories.length
        ? 'witnessed'
        : 'hypothesis';
  return {
    kind: 'action_conditioned_layout_preview',
    action,
    indicator: { role: indicator, at, form: forms[indicator] ?? null },
    layout,
    evidence: {
      status,
      witnesses: histories.map((h) => h.ref),
      controls,
      counterexamples,
      distinctIndicatedSites: sites.size,
    },
  };
}

export function measureMorphologicalPreview(
  preview: MorphologicalPreview,
  action: string,
  positions: Positions,
  forms: Readonly<Record<string, string>>,
  sameEpisode: boolean
) {
  const applicable = sameEpisode && action === preview.action;
  const subjects = preview.layout.map((e) => {
    const at = positions[e.subject] ?? null,
      form = forms[e.subject] ?? null;
    const outcome = !applicable
      ? 'inapplicable'
      : !at || (same(at,e.at) && e.form !== null && form === null)
        ? 'unobserved'
        : same(at, e.at) && (e.form === null || form === e.form)
          ? 'realized'
          : 'contradicted';
    return { subject: e.subject, at, form, outcome };
  });
  const status = !applicable
    ? 'inapplicable'
    : subjects.some((s) => s.outcome === 'contradicted')
      ? 'contradicted'
      : subjects.some((s) => s.outcome === 'unobserved')
        ? 'unobserved'
        : 'realized';
  return { status, subjects };
}
