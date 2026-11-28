import { familyNames } from './generator.mjs';

export function emptyInvariance() {
  return { tested: 0, failed: 0, signatureFailures: 0, frozenAccessFailures: 0,
    candidateAccessFailures: 0, replayMismatches: 0, frozenCostChanges: 0,
    candidateCostChanges: 0, frozenCommandDelta: 0, candidateCommandDelta: 0,
    maxAbsoluteFrozenCommandDelta: 0, maxAbsoluteCandidateCommandDelta: 0 };
}

export function invarianceFailures(result) {
  const issues = [];
  if (!result.signatureStable) issues.push('invariance-signature');
  if (!result.frozenAccessStable) issues.push('invariance-frozen-access');
  if (!result.candidateAccessStable) issues.push('invariance-candidate-access');
  if (result.mismatches) issues.push('invariance-replay');
  // Equivalent minimax policies can distribute costs differently across worlds.
  // Command deltas remain visible but do not turn a preserved access into failure.
  return issues;
}

export function addInvariance(total, value) {
  total.tested++;
  total.failed += Number(invarianceFailures(value).length > 0);
  total.signatureFailures += Number(!value.signatureStable);
  total.frozenAccessFailures += Number(!value.frozenAccessStable);
  total.candidateAccessFailures += Number(!value.candidateAccessStable);
  total.replayMismatches += value.mismatches;
  total.frozenCostChanges += Number(value.frozenCommandDelta !== 0);
  total.candidateCostChanges += Number(value.candidateCommandDelta !== 0);
  total.frozenCommandDelta += value.frozenCommandDelta;
  total.candidateCommandDelta += value.candidateCommandDelta;
  total.maxAbsoluteFrozenCommandDelta = Math.max(total.maxAbsoluteFrozenCommandDelta, Math.abs(value.frozenCommandDelta));
  total.maxAbsoluteCandidateCommandDelta = Math.max(total.maxAbsoluteCandidateCommandDelta, Math.abs(value.candidateCommandDelta));
  return total;
}

export function resultFailures(row) {
  const failures = [];
  if (row.frozen.mismatches || row.candidate.mismatches) failures.push('independent-replay-mismatch');
  if (row.regression) failures.push('access-regression');
  if (!row.candidate.verified) failures.push('candidate-miss');
  if (!row.parent?.oracleFeasible) failures.push('parent-oracle-certification');
  if (!row.parent?.completed) failures.push('parent-not-completed');
  if (row.ablations.some(item => !item.audit.valid)) failures.push('ablation-replay-mismatch');
  if (row.ablations.some(item => item.counterfactualOracle.solvable && !item.accessRetained)) failures.push('ablation-planner-miss');
  if (row.family === 'F8-recovery' && row.retainedSegments.some(item => item.invalidated.length > 0
    && (!item.reusedAfterChange.length || !item.finalAccess))) failures.push('retained-route-not-replayed');
  if (row.invariance) failures.push(...invarianceFailures(row.invariance));
  return failures;
}

const n = value => String(value ?? 0);
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

/** The same renderer can be used by the local campaign and the CI shard aggregator. */
export function reportMarkdown(report) {
  const c = report.configuration, t = report.totals;
  const lines = [
    '# Banc P07 — accès vérifiés', '',
    `Statut : **${report.status}**. Source : \`${c.sourceSha}\`. Empreinte du code : \`${c.fingerprint}\`.`, '',
    ...(c.sourceDirty ? ['**Pilote local avec sources non commitées.** Le SHA indique la base du checkout ; l’empreinte identifie le code exécuté. Une campagne publiée doit être rejouée après commit avec `--expect-sha`.', ''] : []),
    'Ce bilan compare le composeur commun figé de `20433007`, exécuté dans un adaptateur déclaratif P07, à une politique d’accès contingente. Il mesure des simulations de composants. Il ne qualifie ni le moteur SIC natif complet ni une victoire de jeu natif.', '',
    `Développement : **${t.cases} situations** ; **${t.worlds} hypothèses rejouées**. Réserve indépendante : **2 000 situations non consultées**. SS08–SS25 restent sous scellés.`, '',
    '## Provenance et reproduction', '',
    `- Protocole : \`${c.protocol}\`.`,
    `- Graine de campagne : \`${c.seed}\`.`,
    `- Chaque graine de famille vaut \`(seed ^ Math.imul(indexGlobal + 1, 0x9e3779b9)) >>> 0\`.`,
    `- Temps mural de cette exécution : **${Number(report.seconds).toFixed(3)} s**.`,
    `- Victoires natives exécutées : **${t.nativeVictories}**.`, '',
    '```sh',
    `node scripts/sic-p07-access-campaign.mjs --count ${c.count} --seed ${c.seed} --family ${c.families.length === 8 ? 'all' : c.families.join(',')} --out artifacts/p07-reproduction --expect-sha ${c.sourceSha}`,
    '```', '',
    'Un même SHA et une même empreinte de code sont requis pour la réutilisation. Les graines par famille et les indices locaux garantissent le même corpus en exécution monolithique ou par lots.', '',
    '| Famille | Graine | Quota | Certifiés | Accès figé | Accès candidat | Gains | P09 achevé |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const family of c.families) {
    const f = report.byFamily[family];
    lines.push(`| ${escape(familyNames[family] ?? family)} | ${c.familySeeds[family]} | ${c.quotas[family]} | ${f.certified} | ${f.frozen.accesses} | ${f.candidate.accesses} | ${f.accessGains} | ${f.parentCompleted} |`);
  }
  lines.push('', '## Franchissements, observations et victoires simulées', '',
    'Les accès sont comptés par situation : toutes les hypothèses doivent réussir. Les franchissements, observations, victoires simulées et gestes sont cumulés sur les hypothèses effectivement rejouées. Une observation de localisation ne constitue pas à elle seule l’accès à la cible demandée.', '',
    '| Famille | Franchissements F / C | Observations F / C | Victoires simulées F / C | Gestes F / C |',
    '| --- | ---: | ---: | ---: | ---: |');
  for (const family of c.families) {
    const f = report.byFamily[family];
    lines.push(`| ${escape(family)} | ${f.frozen.crossings} / ${f.candidate.crossings} | ${f.frozen.newObservations} / ${f.candidate.newObservations} | ${f.frozen.simulatedWins} / ${f.candidate.simulatedWins} | ${f.frozen.commands} / ${f.candidate.commands} |`);
  }
  lines.push('', '## Contrôles', '',
    `- Cas certifiés par oracle indépendant : **${t.certified} / ${t.cases}**.`,
    `- Accès vérifiés : figé **${t.frozen.accesses}**, candidat **${t.candidate.accesses}** ; gains **${t.accessGains}** ; régressions **${t.regressions}**.`,
    `- Écarts entre simulateur et rejeu indépendant : **${t.replayMismatches}**.`,
    `- Situations certifiées manquées par le candidat : **${t.candidateMisses}**.`,
    `- Cas avec premier écart figé/candidat conservé : **${t.firstDifferences}**.`,
    `- Demandes P09 faisables : **${t.parentFeasible}** ; achevées avec reprise du parent : **${t.parentCompleted}**.`,
    `- Invariant parent modifiant le trajet : **${t.parentInvariantChangesDecision}**.`,
    `- Ablations ciblées sur les gains : **${t.ablations}** ; accès perdu **${t.ablatedAccessLost}**, conservé **${t.ablatedAccessRetained}**, conservé avec gestes supplémentaires **${t.ablatedMoreCommands}**.`,
    `- Décision modifiée par l’ablation : **${t.ablationDecisionsChanged}** ; erreurs de rejeu des ablations : **${t.ablationAuditErrors}**.`,
    `- Invariance hors quota : **${report.invariance.tested}** variantes ; **${report.invariance.failed}** échecs.`,
    `- Variantes avec changement de coût : figé **${report.invariance.frozenCostChanges}**, candidat **${report.invariance.candidateCostChanges}** ; delta cumulé **${report.invariance.frozenCommandDelta} / ${report.invariance.candidateCommandDelta}**.`, '',
    'Les ablations retirent au point d’usage seulement l’appui, l’ouverture ou la preuve de route consommée. La suppression d’une preuve ne modifie pas la physique. Le préfixe joué, les autres acquis et le budget restant sont conservés. Un accès peut rester réalisable par réparation ou par une autre voie.', '',
    'Les changements de coût sous transformation sont rapportés séparément : des politiques de même coût maximal peuvent répartir les gestes différemment entre hypothèses.', '',
    '## Génération et déduplication', '',
    `- Tirages : **${report.generation.attempted}** ; doublons rejetés : **${report.generation.duplicates}** ; tirages non faisables rejetés : **${report.generation.infeasible}**.`,
    `- Erreurs de certification : **${report.generation.certificationErrors}**.`,
    'La signature porte sur la structure des routes, conditions, ressources, observations et invariants. Les identifiants, palettes, rotations, translations, ordre des commandes et annotations de victoire ne créent pas de nouvelle situation.', '',
    'Pour la famille du point de vue, le rattachement utilise une calibration géométrique à partir d’ancres publiques ordonnées et de deux sujets. L’acquisition perceptive native de ces ancres n’est pas mesurée.', '',
    '## Archives', '',
    '| Archive | SHA-256 | Octets |', '| --- | --- | ---: |');
  for (const key of ['corpus', 'results']) {
    const a = report.artifacts[key];
    if (a) lines.push(`| ${escape(a.file ?? a.path ?? key)} | \`${a.sha256}\` | ${n(a.bytes)} |`);
  }
  if (report.firstMismatch) lines.push('', `Premier contre-exemple : \`${report.firstMismatch}\`.`);
  if (report.failures?.length) lines.push('', 'Échecs de campagne : ' + report.failures.map(value => `\`${value}\``).join(', ') + '.');
  lines.push('', 'Les traces complètes, retours, certificats, premiers écarts et interventions se trouvent dans `results.jsonl.gz`. `corpus.jsonl.gz` contient les scénarios acceptés et leurs signatures.', '');
  return lines.join('\n');
}
