# Diagnostic — répétition fonctionnelle provisoire 805b / fa23

## Résultat conservé

La préparation, l’inventaire et les deux captures se sont terminés avec le code 0. Le qualificatif a refusé la première comparaison de graphe avec le code 1. Aucun outil n’a été adapté et aucune étape n’a été relancée.

| Commande | Code | Durée constatée |
| --- | ---: | ---: |
| Préparation des entrées | 0 | 0,215 s |
| Inventaire des propriétaires | 0 | 2,275 s |
| Capture baseline | 0 | 47,746 s |
| Capture candidat | 0 | 46,672 s |
| Qualification | 1 | 2,078 s |

Durée totale du pilote : 98,995 s. Chaque commande avait une borne de 175 s, sous la limite demandée de 180 s ; la borne globale était de 480 s. Aucun timeout ni arrêt pour quiet. Les cinq gardes fraîches sont conservées, et toute l’activité s’est déroulée sous verrou partagé. Ces durées décrivent l’exécution de cette préparation ; elles ne constituent pas une mesure de performance comparée.

## Sources et captures

- Baseline provisoire déclarée par le responsable : `805b30297dc1b715dbfd9f1197a9a8ba7b361b90`. Aucun Git exécuté par ce pilote et aucune publication inférée.
- Inventaire natif baseline vérifié : 318 fichiers, `a33a5f88f3fe0034930b2056239889bed6fab662424fc84a141a5f9a28db9e57`.
- Inventaire natif candidat vérifié contre le gel : 322 fichiers, `fa23bb76ca4a01b5cfaa72ec6d1d4b4fc2e8969762e966ada8225265fc546886`.
- Propriétaires : 58 → 59, ajout de `selected_rigid` uniquement ; aucun retrait. Programmes : 27 → 27, sans ajout ni retrait.
- Cas historiques copiés octet à octet. Chaque rôle a capturé quatre sessions et 31 actions de STCK/SMLP.
- Les deux reçus confirment `nativeSourceUnchanged`, `inputsUnchanged` et `generatorUnchanged` à `true`, sans échec de capture.

## Premier refus exact

Le reçu `owner-graph-attribution.json` conserve `functional_structure_qualification_failed`. Le contrôle de provenance passe, puis `graphs:STCK:warmup:0` échoue sur le nœud commun **`reasoning:trace:1`**, au champ **`created`** de sa valeur encodée :

| Rôle | Bits float64 | Secondes Unix | UTC |
| --- | --- | ---: | --- |
| Baseline | `41dabd2b4330d4fe` | 1794419980.763 | 2026-11-11T17:59:40.763Z |
| Candidat | `41dabd2b4f0dc28f` | 1794420028.215 | 2026-11-11T18:00:28.215Z |

L’écart est de 47,452 s. Les valeurs se placent respectivement dans les intervalles réels des captures séquentielles : baseline 17:59:38.443–18:00:25.990Z, candidat 18:00:26.181–18:01:12.672Z.

Le fichier `src/logos-engine/v6-reasoning-memory.ts` est identique octet à octet entre ces deux sources. Il définit l’horloge par défaut comme `Date.now() / 1000` et écrit `created: this.clock()` dans la trace. Extraits réellement lus :

```typescript
// ligne 64
  constructor(options: { clock?: () => number } = {}) { this.clock = options.clock ?? (() => Date.now() / 1000); }
// ligne 124
    this.traces.push(freezeOwned({ id, episode, kind, body: copy(value), created: this.clock() }));
```

Sites de construction lus, sans exécution native supplémentaire :

```text

```

Le refus observé porte donc sur une valeur de temps de création issue de deux exécutions séparées. Le contrat prospectif actuel exige l’égalité exacte de toutes les valeurs communes et ne prévoit qu’une exception de métadonnée `origin.source_digest` ; il n’attribue pas ce champ temporel. Ce résultat ne démontre pas une divergence de décision SelectedRigid.

La comparaison s’est arrêtée à cette première différence : **zéro point et zéro forme qualifiés, aucune fixture `owner-structural-fixture.json` créée**. Il serait incorrect d’affirmer que le timestamp est la seule différence possible ; les différences ultérieures, notamment les identités calculées dans d’autres valeurs, restent non examinées par ce passage.

## Suite concrète

Conserver cette tentative et son refus complet. Une future adaptation prospective devra attribuer précisément la provenance des valeurs temporelles et leurs éventuelles identités dérivées pour chacun des deux rôles, avant toute fenêtre officielle. Aucune normalisation générale, modification des captures, tolérance ajoutée ni adaptation des helpers n’a été réalisée ici. La vraie publication 0.63 et la qualification finale restent à établir séparément.

Preuves locales : `execution-summary.json`, `execution.jsonl`, `provenance.json`, les cinq `coordination-before-*.json`, les cinq journaux de commande, `owner-source-inventory.json`, les deux captures `.json.gz` et leurs reçus, et `owner-graph-attribution.json`. Le journal `05-qualify-graphs.log` conserve intégralement le refus émis.

Aucun protocole final, contrat final, readiness, benchmark officiel, jeu KLOT ou navigateur exécuté. Sources, tests et helpers inchangés.
