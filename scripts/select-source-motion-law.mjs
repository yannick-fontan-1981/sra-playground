// Each tested starting position has one vote. Predictions at that same position cannot select their own model.
export function motionLawSelector() {
  const byRole = new Map();
  return (role, origin, add, stop, actual) => {
    const site = origin.join(),
      history = byRole.get(role) ?? new Map();
    let support = 0;
    for (const [other, balance] of history) if (other !== site) support += Math.sign(balance);
    const useStop = !!stop && support > 0;
    const predicted = useStop ? stop : add;
    // Reveal the observation only after choosing a model.
    if (actual && stop && stop.join() !== add.join()) {
      const vote = Number(stop.join() === actual) - Number(add.join() === actual);
      if (vote) history.set(site, (history.get(site) ?? 0) + vote);
    }
    byRole.set(role, history);
    return { useStop, exact: predicted.join() === actual };
  };
}
