# Remise P07 à l’opérateur indépendant

## Candidat gelé

- Dépôt : `yannick-fontan-1981/sra-playground`.
- Branche : `feat/sic-p07-access-20261128`.
- Base : `20433007224accc36e3d7976696d9ee7a783a227`.
- **SHA du code à évaluer : `a914ed888116248dc40d22d5b9fcf53d43028297`.**
- Arbre Git : `d43942551c7485379d9999834d0f54b3925f189c`.
- Empreinte des sources du banc :
  `7d378332d9e41a033ae0b4f3bd6d6b5905eefcfaaa83490615b54f60e6392e8e`.
- Commandes et protocole : [sic-p07-access-protocol.md](sic-p07-access-protocol.md).
- Campagne de développement :
  [GitHub Actions 46153015715](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46153015715).

Les commits ultérieurs de bilan ne changent pas ce SHA qualifié. L’évaluation de
réserve doit partir du SHA ci-dessus, indépendamment de l’évolution de `main`.

## Réserve

Les 2 000 situations sont détenues par l’opérateur. Aucun contenu, aucune graine,
aucune structure ni aucun verdict de cette réserve n’a été demandé ou consulté
pendant ce développement. SS08–SS25 restent sous scellés. Le générateur livré
ne crée pas une prétendue réserve de 2 000 situations.

## Interfaces de mesure

Le schéma sérialisable est `scripts/p07-access/schema.ts`. Le plafond courant de
développement est de 64 commandes et 24 000 états par situation, identique entre
les deux bras. Les hypothèses cachées doivent partager leurs commandes jusqu’à
ce que leurs observations les départagent. La situation ne compte comme réussie
que si toutes ses hypothèses atteignent l’accès réellement exécuté.

Les points d’entrée utilisables sur un scénario construit indépendamment sont :

```js
import { certify, compareScenario } from './scripts/p07-access/comparator.mjs';

const certificate = certify(scenario);
if (!certificate.accepted) {
  // Conserver à part ce verdict : ce n’est pas un cas résoluble certifié.
} else {
  const result = compareScenario(scenario, certificate);
  // Archiver le résultat complet : traces, premier écart, P09 et ablations.
}
```

`certify` utilise l’oracle indépendant ; le certificat est lié au scénario exact
par empreinte. `compareScenario` n’a pas besoin d’une situation issue du générateur
de développement. Le modèle fourni au figé et au candidat passe par
`publicProblem` : métadonnées, affectation réelle de cible et futurs retours de
caméra sont supprimés. Toutes les hypothèses publiques sont conservées.

La calibration F2 est limitée à des rotations d’un quart de tour et translations
avec ancres déjà détectées et ordonnées. L’oracle vérifie indépendamment les
coordonnées et le sujet réellement observé ; il ne faut pas assimiler cette
épreuve à la perception native d’une image.

## Résultats à transmettre

Conserver les quotas, les certificats de solvabilité, le coût maximal par
hypothèse, les accès vérifiés, les franchissements, les observations nouvelles,
les événements de victoire simulée, les gestes et le premier écart. Pour les
gains, conserver aussi l’intervention ciblée et le verdict du contrefactuel.

Une victoire native exige une partie native distincte et son retour officiel.
Le résultat de ce composant ne doit pas être inscrit dans cette colonne.
Les négatifs, les abstentions justifiées et les contrefactuels devenus impossibles
ont leurs propres compteurs ; ils ne complètent pas le quota des cas résolubles.

## État de transmission

Cette fiche est prête pour remise. Aucun destinataire ni canal de l’opérateur
indépendant n’a été identifié dans les sources accessibles ; aucune transmission
externe n’est revendiquée. Le SHA publié et ce document peuvent être transmis
dès que la destination précise est fournie.
