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
  const offset = (layout, i, anchor = point) => layout[i].split(',').map((v, j) => anchor[j] - Number(v));
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
  const knownLayouts = new Set(layouts.map((r) => r.layout.join('/')));
  const baseline = layouts.reduce((n, r) => n + r.yes - r.no, 0) > 0;
  function predict(layout, reference) {
    const votes = rules.flatMap((rs, i) =>
      rs.map((r) => {
        const v = offset(layout, i, reference)[r.axis];
        return ((r.signOnly ? Math.sign(v) : v) === r.value) === r.onMatch;
      })
    );
    return votes.every(Boolean) ? true : votes.every((v) => !v) ? false : null;
  }
  function record(t, prediction, actual) {
    t.eligible++;
    t.actualSuccess += Number(actual);
    if (prediction === null) return;
    t.predicted++;
    t.correct += Number(prediction === actual);
    t.baselineCorrect += Number(baseline === actual);
    t.positive += Number(prediction);
    t.confirmed += Number(prediction && actual);
  }
  async function test(words) {
    const seen = new Set(images),
      seenWords = new Set(tested),
      seenLayouts = new Set(knownLayouts);
    const seenJoint = new Set(),
      seenShiftedFrames = new Set(images);
    const all = bucket(),
      newFrames = bucket(),
      newLayouts = bucket();
    const shifted = {
      all: bucket(),
      newFrames: bucket(),
      newJoint: bucket(),
      newPeerLocations: bucket(),
      absoluteOnSameJoints: bucket(),
      firstConfirmed: null,
      firstRefuted: null,
    };
    let ordersTested = 0;
    for (const word of words) {
      const wordKey = word.join('/');
      if (seenWords.has(wordKey)) continue;
      seenWords.add(wordKey);
      ordersTested++;
      const start = await prepare(word);
      if (!start) continue;
      const moved = start.origin !== origin,
        key = start.layout.join('/');
      const reference = start.origin.split(',').map(Number);
      const prediction = predict(start.layout, reference),
        absolute = predict(start.layout, point);
      const actual = await outcome(start.board, reference, point);
      if (actual === null) continue;
      if (moved) {
        record(shifted.all, prediction, actual);
        if (!seenShiftedFrames.has(start.key)) record(shifted.newFrames, prediction, actual);
        seenShiftedFrames.add(start.key);
        const joint = start.origin + '/' + key;
        if (seenJoint.has(joint)) continue;
        seenJoint.add(joint);
        record(shifted.newJoint, prediction, actual);
        record(shifted.absoluteOnSameJoints, absolute, actual);
        if (!knownLayouts.has(key)) record(shifted.newPeerLocations, prediction, actual);
        if (prediction === true) {
          const id = actual ? 'firstConfirmed' : 'firstRefuted';
          shifted[id] ??= { word, origin: start.origin, layout: start.layout, absolute };
        }
      } else {
        record(all, prediction, actual);
        if (!seen.has(start.key)) record(newFrames, prediction, actual);
        if (!seen.has(start.key) && !seenLayouts.has(key)) record(newLayouts, prediction, actual);
        seen.add(start.key);
        seenLayouts.add(key);
      }
    }
    return { ordersTested, all, newFrames, newLayouts, shifted };
  }
  return { ...(await test(orders(placement))), substitutions: await test(substitutions(tested, vocabulary)) };
}
