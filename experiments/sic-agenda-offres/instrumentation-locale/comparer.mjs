import { digest } from './sceau.mjs';

// Le reçu d'action ne porte pas le numéro d'invocation intra-famille.
// Exiger un appariement unique pour cette observation et ce propriétaire.
export function compareLocal(sealedPredictions, receipts) {
  if (digest(sealedPredictions.event) !== sealedPredictions.sha256) throw new Error('Prédictions altérées');
  const predictions = sealedPredictions.event;
  return receipts.map(receipt => {
    const sameKey = row => row.observationRef === receipt.observationRef && row.family === receipt.family;
    const candidates = predictions.filter(sameKey);
    const local = candidates.length === 1 && receipts.filter(sameKey).length === 1 ? candidates[0].decision : 'indéterminé';
    const native = receipt.strategy ?? 'indéterminé';
    return { observationRef: receipt.observationRef, local, native,
      verdict: [local, native].includes('indéterminé') ? 'indéterminé' : local === native ? 'accord' : 'écart' };
  });
}
