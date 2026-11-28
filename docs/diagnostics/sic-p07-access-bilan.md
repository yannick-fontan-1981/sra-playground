# P07 — bilan de développement et remise à SIC SYNC

## Résultat qualifié

**8 000 situations résolubles et structurellement distinctes : 8 000 accès vérifiés pour le candidat, contre 7 000 pour le composeur figé.** Les 1 000 gains portent sur les localisations incertaines. Les 1 000 situations de reprise réussissent dans les deux bras, avec un pire trajet plus court pour le candidat. Aucun désaccord de rejeu ni aucune régression n’est observé.

Ces résultats sont des **simulations de composants**. Le figé est le vrai `composePlan` de `20433007`, utilisé dans un adaptateur déclaratif commun ; le candidat est le planificateur conditionnel `src/sic/access-policy.ts`. Le moteur SIC natif complet, l’acquisition P05 et la perception native ne sont pas qualifiés par ce banc.

Les **10 000 hypothèses rejouées** appartiennent uniquement aux 8 000 situations de développement : F7 et F8 ont deux hypothèses par situation. **Elles ne sont pas les 2 000 situations sous scellés.** La réserve de l’opérateur et SS08–SS25 n’ont été ni utilisés ni exécutés.

## Source et exécutions

- Branche isolée : `feat/sic-p07-access-20261128`, depuis `20433007224accc36e3d7976696d9ee7a783a227`.
- **SHA qualifié : `a914ed888116248dc40d22d5b9fcf53d43028297`.**
- Arbre Git : `d43942551c7485379d9999834d0f54b3925f189c`.
- Empreinte des sources : `7d378332d9e41a033ae0b4f3bd6d6b5905eefcfaaa83490615b54f60e6392e8e`.
- [Campagne GitHub Actions 46153015715](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46153015715) : pilote, huit lots et agrégation réussis.
- [Protocole complet](sic-p07-access-protocol.md) · [Fiche de remise à l’opérateur](sic-p07-access-operator-handoff.md).

Le pilote initial compte 80 situations, 10 par famille. Il donne 70 accès pour le figé et 80 pour le candidat, 80 reprises P09, 80 invariances réussies et 102 ablations. Le pilote local et celui de GitHub ont les mêmes empreintes de corpus et de résultats. La campagne complète est exécutée sur un SHA GitHub unique, avec des sources propres.

## Quotas, graines et bilan par famille

Graine maître de développement : **`26112807`**. Chaque famille possède sa propre graine déterministe. La signature ignore noms, ordre des commandes, coordonnées, palettes et annotations de victoire ; elle conserve routes, gardes, ressources, temporalité, observations et invariants.

| Famille | Graine | Quota certifié | Accès figé | Accès candidat | Gains d’accès | Trajets plus courts | P09 complet |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| F1 — Contournement et autre entrée | `2679704222` | 1 000 | 1 000 | 1 000 | 0 | 0 | 1 000 |
| F2 — Point de vue et rattachement | `1038123093` | 1 000 | 1 000 | 1 000 | 0 | 0 | 1 000 |
| F3 — Contact puis interaction | `3676839436` | 1 000 | 1 000 | 1 000 | 0 | 0 | 1 000 |
| F4 — Appui maintenu et relais | `2035520963` | 1 000 | 1 000 | 1 000 | 0 | 0 | 1 000 |
| F5 — Ouverture temporaire et retour | `379261882` | 1 000 | 1 000 | 1 000 | 0 | 0 | 1 000 |
| F6 — Construction et ressource | `3032656241` | 1 000 | 1 000 | 1 000 | 0 | 0 | 1 000 |
| F7 — Localisations ou routes plausibles | `1376397096` | 1 000 | 0 | 1 000 | 1 000 | 0 | 1 000 |
| F8 — Reprise après changement | `4030054127` | 1 000 | 1 000 | 1 000 | 0 | 1 000 | 1 000 |

8 026 tirages ont produit les 8 000 situations retenues : 26 doublons structurels rejetés, aucun cas infaisable et aucune erreur de certification. L’agrégation a vérifié les signatures entre familles. Les certificats de base vont de 4 à 24 gestes, sous le plafond commun de **64 gestes et 24 000 états**. Le plus grand nombre d’états explorés par l’oracle de base est 993.

Variations effectivement présentes :

- F4 : 476 cas avec relais et 524 sans relais.
- F6 : 360 constructions d’appui, 306 déplacements d’obstacle et 334 passages consommables.
- F7 : 494 cas avec préfixe de mouvement commun ; 506 demandent l’observation avant le premier mouvement irréversible.
- F8 : 348 déplacements de cible, 330 retours contraires et 322 pertes d’appui.

## Mesures des exécutions

Les accès sont comptés par situation, avec réussite obligatoire dans toutes ses hypothèses. Les autres compteurs ci-dessous cumulent les mondes rejoués. Un franchissement d’arête inclut un déplacement ordinaire dans le simulateur ; ce compteur n’est pas un nombre de niveaux gagnés.

| Mesure | Figé | Candidat |
| --- | ---: | ---: |
| Accès vérifiés | 7 000 / 8 000 | 8 000 / 8 000 |
| Hypothèses avec accès vérifié | 8 000 / 10 000 | 10 000 / 10 000 |
| Franchissements d’arête réellement rejoués | 75 739 | 88 923 |
| Observations nouvelles obtenues | 2 000 | 4 000 |
| Événements de victoire du simulateur | 3 514 | 3 514 |
| Gestes exécutés, tous cas confondus | 95 732 | 102 697 |
| Victoires natives | Non évaluées : 0 partie | Non évaluées : 0 partie |

Le candidat exécute davantage de gestes au total parce qu’il résout aussi les cas F7 où le figé ne propose aucune séquence conformante. Sur F8, les deux bras résolvent les mêmes 2 000 hypothèses : **34 154 → 23 935 gestes**, soit **10 219 gestes économisés (29,92 %)**. Le pire trajet de F8 passe de 26 à 20 gestes.

**Les 1 000 gains d’accès n’ajoutent aucune victoire du simulateur : les deux bras restent à 3 514 événements de victoire. Aucun gain natif n’est revendiqué.**

## Premier écart et conservation des trajets

Les 2 000 situations qui diffèrent conservent leur premier écart de commande, de retour ou de rattachement, avec hypothèse, index et empreinte du préfixe.

- `p07-F7-uncertain-location-0` : au premier geste, le figé n’a pas de séquence unique garantissant les deux localisations ; le candidat demande une observation puis choisit la continuation compatible. Son pire trajet fait huit gestes.
- `p07-F8-recovery-0` : au sixième geste d’une hypothèse, le figé exécute une commande bloquée tandis que le candidat utilise le retour discriminant pour avancer. Le pire trajet est de 17 gestes pour le figé et de 15 pour le candidat.
- Dans les **1 000 hypothèses perturbées de F8**, le candidat traverse réellement des segments du suffixe commun après l’invalidation. La conservation du préfixe et ces franchissements figurent dans les reçus.

## Retrait ciblé des dépendances

Les 2 000 situations gagnées ou raccourcies donnent **10 639 interventions** au premier usage de chaque dépendance consommée : **9 995 preuves de route** et **644 appuis**. Il n’y a pas d’ablation d’ouverture dans cette série de gains, puisque F3 et F5 ne montrent pas de gain comparatif.

| Issue après intervention | Nombre |
| --- | ---: |
| Accès perdu | 5 870 |
| Accès conservé par autre voie ou réparation | 4 769 |
| Dont accès conservé avec gestes supplémentaires | 4 429 |
| Décision modifiée | 10 639 |
| Contrefactuels faisables manqués par le candidat | 0 |
| Désaccords de rejeu des interventions | 0 |

Le préfixe, les autres preuves et le budget déjà consommé restent inchangés. Retirer une preuve de route ne modifie pas la physique ; son impossibilité contrefactuelle signifie qu’aucune suite admissible avec les preuves restantes n’est trouvée sous le plafond. Les 5 870 pertes et les 4 769 maintiens concordent avec l’oracle contrefactuel. Les ablations établissent le rôle de la dépendance utilisée, sans attribuer à elles seules tout gain comparatif à une cause unique.

## P09 → P07 et contrôles

**8 000 demandes d’accès comme sous-but réussissent**, avec reçu rejoué et reprise du parent. Le geste final du parent est lui aussi certifié et rejoué par l’oracle indépendant. L’invariant doit tenir avant, pendant et après chaque transition. Une commande du budget est réservée au parent.

L’invariant de réserve change le trajet dans **7 358 situations**, comparées au même budget réduit. Les raccourcis qui consomment cette réserve sont ainsi écartés quand le parent doit la conserver.

- 8 000 transformations d’invariance hors quota : zéro échec, zéro changement de coût.
- Zéro désaccord simulateur/oracle ; zéro régression ; zéro situation certifiée manquée.
- 43 tests ciblés réussis, dont falsification de retour, preuve fictive, mauvais sujet, invariant transitoirement violé, hypothèses incompatibles, attente bloquée et faux reçu P09.
- Contrôle TypeScript strict du nouveau module réussi. Les anciens modules natifs ne sont pas modifiés ; la continuité native n’est pas revendiquée.

## Temps et parallélisme

La campagne va du premier démarrage au dernier contrôle d’agrégation en **10 min 37 s**. Le pic observé est de **8 lots simultanés**, chacun séquentiel. La durée cumulée des huit lots de mesure est de **1 034,296 s (17 min 14,296 s)**, génération et vérifications comprises. Le plus long lot, F5, prend 419,791 s de calcul.

Les heures techniques détaillées figurent dans [workflow.json](sic-p07-access-evidence/workflow.json). La campagne s’est déroulée le 28 novembre 2026, de 11:07:19 à 11:17:56, heure de Recife (UTC−3).

## Reproduction et archives durables

```bash
git fetch origin feat/sic-p07-access-20261128
git switch --detach a914ed888116248dc40d22d5b9fcf53d43028297
node --test tests/p07-*.test.mjs
node scripts/sic-p07-access-campaign.mjs --count 80 --seed 26112807 --expect-sha a914ed888116248dc40d22d5b9fcf53d43028297 --out artifacts/p07-pilot-reproduction
node scripts/sic-p07-access-campaign.mjs --count 8000 --seed 26112807 --expect-sha a914ed888116248dc40d22d5b9fcf53d43028297 --out artifacts/p07-development-reproduction
```

Node 24 est requis. Les quotas peuvent aussi être reproduits par famille puis agrégés avec `scripts/sic-p07-access-aggregate.mjs`. Le corpus par famille est identique à celui de la campagne monolithique ; l’emballage gzip concaténé des lots peut différer de celui d’une compression monolithique.

- [Rapport JSON complet](sic-p07-access-evidence/development/report.json).
- [Corpus des 8 000 situations](sic-p07-access-evidence/development/corpus.jsonl.gz).
- [Traces, certificats, premiers écarts et ablations](sic-p07-access-evidence/development/results.jsonl.gz).
- [Manifeste](sic-p07-access-evidence/development/manifest.json).
- [Pilote sur le SHA qualifié](sic-p07-access-evidence/pilot/report.json).
- [Couverture détaillée et exemples](sic-p07-access-evidence/derived-analysis.json).

| Archive de développement | SHA-256 |
| --- | --- |
| `corpus.jsonl.gz` | `94671bc14425dec056f364a916926eca46c468095d11382d3137af8e16dadee8` |
| `results.jsonl.gz` | `0e3cb426e13c5e56b7dcd873b38fcb8715417131874223dd8eef0b6d3acc6a83` |

Les archives complètes sont conservées avec le bilan dans GitHub ; la conservation ne dépend pas seulement des pièces jointes temporaires de GitHub Actions.

## Remise, limites et prochaine étape

Ce document constitue le bilan prêt pour **SIC SYNC**. La [fiche opérateur](sic-p07-access-operator-handoff.md) donne le SHA gelé et le contrat d’évaluation. Aucun canal SIC SYNC ni destinataire d’opérateur n’a été identifié dans les sources accessibles ; **aucun envoi externe n’est revendiqué**. La destination précise reste à fournir pour achever la transmission.

Le développement demandé est livré et qualifié à 8 000/8 000. Le travail reste sur sa branche isolée, sans intégration à `main` et sans publication Site. La prochaine étape est l’évaluation des 2 000 situations détenues par l’opérateur, puis un raccordement natif distinct avec les contrôles de transfert et de continuité prévus par `AGENTS.md`.
