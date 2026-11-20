import { separateMotion } from '../src/sic/conditional-placements.ts';

function* orders(word) {
  if (!word.length) {
    yield [];
    return;
  }
  for (const key of new Set(word)) {
    const tail = word.slice();
    tail.splice(tail.indexOf(key), 1);
    for (const suffix of orders(tail)) yield [key, ...suffix];
  }
}

function* substitutions(tested, vocabulary) {
  for (const training of tested) {
    const word = training.split('/');
    for (let i = 0; i < word.length; i++)
      for (const key of vocabulary) {
        if (key === word[i]) continue;
        const variant = word.slice();
        variant[i] = key;
        yield variant;
      }
  }
}

// Fit on single transpositions only. Freeze all rules before restoring the
// first unseen word and reveal its suffix outcome only after the prediction.
export async function qualifyExcursionLayouts({
  placement,
  vocabulary,
  tested,
  layouts,
  images,
  origin,
  prepare,
  outcome,
}) {
  const positive = layouts.filter((r) => r.yes && !r.no),
    negative = layouts.filter((r) => r.no && !r.yes);
  if (!positive.length || !negative.length || layouts.some((r) => r.yes && r.no)) return null;
  const point = origin.split(',').map(Number);
  const offset = (layout, i) => layout[i].split(',').map((v, j) => point[j] - Number(v));
  const rules = positive[0].layout.map((_, i) =>
    separateMotion(
      positive.map((r) => offset(r.layout, i)),
      negative.map((r) => offset(r.layout, i))
    )
  );
  if (!rules.some((r) => r.length)) return null;
  const bucket = () => ({
    eligible: 0,
    predicted: 0,
    correct: 0,
    baselineCorrect: 0,
    positive: 0,
    confirmed: 0,
    actualSuccess: 0,
  });
  async function test(words) {
    const seen = new Set(images),
      seenWords = new Set(tested),
      seenLayouts = new Set(layouts.map((r) => r.layout.join('/')));
    const all = bucket(),
      newFrames = bucket(),
      newLayouts = bucket();
    const baseline = layouts.reduce((n, r) => n + r.yes - r.no, 0) > 0;
    let ordersTested = 0;
    for (const word of words) {
      const wordKey = word.join('/');
      if (seenWords.has(wordKey)) continue;
      seenWords.add(wordKey);
      ordersTested++;
      const start = await prepare(word);
      if (!start) continue;
      const votes = rules.flatMap((rs, i) =>
        rs.map((r) => {
          const v = offset(start.layout, i)[r.axis];
          return ((r.signOnly ? Math.sign(v) : v) === r.value) === r.onMatch;
        })
      );
      const prediction = votes.every(Boolean) ? true : votes.every((v) => !v) ? false : null;
      const actual = await outcome(start.board);
      if (actual === null) continue;
      const frameNew = !seen.has(start.key),
        layoutNew = !seenLayouts.has(start.layout.join('/'));
      seen.add(start.key);
      seenLayouts.add(start.layout.join('/'));
      for (const t of [
        all,
        ...(frameNew ? [newFrames] : []),
        ...(frameNew && layoutNew ? [newLayouts] : []),
      ]) {
        t.eligible++;
        t.actualSuccess += Number(actual);
        if (prediction === null) continue;
        t.predicted++;
        t.correct += Number(prediction === actual);
        t.baselineCorrect += Number(baseline === actual);
        t.positive += Number(prediction);
        t.confirmed += Number(prediction && actual);
      }
    }
    return { ordersTested, all, newFrames, newLayouts };
  }
  return { ...(await test(orders(placement))), substitutions: await test(substitutions(tested, vocabulary)) };
}
