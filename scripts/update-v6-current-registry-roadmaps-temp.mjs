import { readFile, writeFile } from 'node:fs/promises';

const runId = process.env.GITHUB_RUN_ID ?? 'unknown';
const marker = '## Registre courant V6 reconstruit — 13 novembre 2026';
const sections = new Map([
  ['docs/migration/v6-delivery-roadmap.md', `${marker}

L'absence du registre courant est fermée par
\`docs/migration/v6-entry-point-progress.json\` et son vérificateur fail-closed.

- capacités courantes qualifiées : **50** ;
- frontières avec preuve de performance : **6** ;
- portes de preuve non comptées : **6** ;
- lacunes ouvertes : **9** ;
- correspondances prouvées avec les slots historiques : **0** ;
- dénominateur courant : **aucun**.

Ce résultat ne signifie pas \`50/76\`. La revendication historique Site 109 / native
0.68 reste séparée, et le SHA
\`d90ce5b64fffa53cca201e2a6a49450fd123f299\` reste non résolu.

Le registre inclut le noyau de continuité de session, son checkpoint atomique et
le codec exact FieldStock. Le raccord du checkpoint au host et au contrôleur
navigateur reste la prochaine dette fonctionnelle.

Qualification d'intégration : run GitHub Actions \`${runId}\`.
`],
  ['docs/recovery/site109-reconstruction-status.md', `${marker}

La reconstruction canonique possède désormais un registre machine vérifiable de
**50 frontières de capacité courantes**. Le compteur est calculé depuis les
entrées et leurs preuves, sans appliquer le dénominateur historique 76.

Le registre couvre aussi le noyau de continuité intégré : campagne et
participants checkpointés atomiquement, \`needId\` en attente, déduplication des
retours et état exact FieldStock. Son activation dans le cycle de vie du host et
du contrôleur navigateur reste ouverte.

Preuves :

- \`docs/migration/v6-entry-point-progress.json\` ;
- \`docs/recovery/v6-current-reconstruction-registry-20261113.md\` ;
- \`scripts/verify-v6-current-reconstruction-registry.mjs\` ;
- run d'intégration \`${runId}\`.

Aucune identité binaire avec Site 109 et aucune parité \`50/76\` ne sont
revendiquées. Aucune publication Site n'appartient à cette étape.
`],
  ['docs/recovery/op01-op31-official-readiness-status.md', `${marker}

Le garde séparé qui signalait l'absence totale de
\`docs/migration/v6-entry-point-progress.json\` est désormais fermé pour l'état
**courant reconstruit**.

Le registre compte OP01–OP31 comme une seule frontière agrégée et conserve leurs
dispositions détaillées dans le suivi OP. Il ne transforme donc pas les 31
opérations en 31 anciens points d'entrée V6.

La qualification C7 Region reste inchangée. Le mapping individuel vers les 76
slots historiques et l'identité exacte de Site 109 restent non résolus et
continuent de bloquer toute revendication de parité historique.

Qualification d'intégration : run GitHub Actions \`${runId}\`.
`],
  ['docs/migration/op01-op31-progress.md', `${marker}

Le registre courant de la reconstruction est maintenant durable :

- **50** capacités fonctionnellement qualifiées ;
- **6** capacités avec preuve de performance ;
- **0** correspondance historique revendiquée ;
- OP01–OP31 représentées par une seule entrée agrégée afin d'éviter tout
  gonflement artificiel du compteur.

Le noyau de continuité ajoute trois frontières courantes : coordinateur de
checkpoint atomique, codec exact FieldStock/rétention, et participant du runtime
adressé. Leur raccord au host et au contrôleur reste ouvert.

Run d'intégration : \`${runId}\`. Aucune publication Site.
`],
]);

for (const [path, section] of sections) {
  let text = await readFile(path, 'utf8');
  if (text.includes(marker)) continue;
  if (!text.endsWith('\n')) text += '\n';
  await writeFile(path, `${text}\n${section.trim()}\n`);
}

console.log(JSON.stringify({
  status: 'v6-current-registry-roadmaps-updated',
  runId,
  marker,
  files: [...sections.keys()],
}, null, 2));
