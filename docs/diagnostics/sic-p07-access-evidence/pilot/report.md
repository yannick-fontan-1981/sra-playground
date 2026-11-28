# Banc P07 — accès vérifiés

Statut : **completed**. Source : `a914ed888116248dc40d22d5b9fcf53d43028297`. Empreinte du code : `7d378332d9e41a033ae0b4f3bd6d6b5905eefcfaaa83490615b54f60e6392e8e`.

Ce bilan compare le composeur commun figé de `20433007`, exécuté dans un adaptateur déclaratif P07, à une politique d’accès contingente. Il mesure des simulations de composants. Il ne qualifie ni le moteur SIC natif complet ni une victoire de jeu natif.

Développement : **80 situations** ; **100 hypothèses rejouées**. Réserve indépendante : **2 000 situations non consultées**. SS08–SS25 restent sous scellés.

## Provenance et reproduction

- Protocole : `sic-p07-development-campaign-v1`.
- Graine de campagne : `26112807`.
- Chaque graine de famille vaut `(seed ^ Math.imul(indexGlobal + 1, 0x9e3779b9)) >>> 0`.
- Temps mural de cette exécution : **14.011 s**.
- Victoires natives exécutées : **0**.

```sh
node scripts/sic-p07-access-campaign.mjs --count 80 --seed 26112807 --family all --out artifacts/p07-reproduction --expect-sha a914ed888116248dc40d22d5b9fcf53d43028297
```

Un même SHA et une même empreinte de code sont requis pour la réutilisation. Les graines par famille et les indices locaux garantissent le même corpus en exécution monolithique ou par lots.

| Famille | Graine | Quota | Certifiés | Accès figé | Accès candidat | Gains | P09 achevé |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Contournement et entrée alternative | 2679704222 | 10 | 10 | 10 | 10 | 0 | 10 |
| Point de vue et rattachement du sujet | 1038123093 | 10 | 10 | 10 | 10 | 0 | 10 |
| Contact puis interaction | 3676839436 | 10 | 10 | 10 | 10 | 0 | 10 |
| Appui maintenu et relais | 2035520963 | 10 | 10 | 10 | 10 | 0 | 10 |
| Ouverture temporaire et retour | 379261882 | 10 | 10 | 10 | 10 | 0 | 10 |
| Construction et ressource | 3032656241 | 10 | 10 | 10 | 10 | 0 | 10 |
| Localisations et routes plausibles | 1376397096 | 10 | 10 | 0 | 10 | 10 | 10 |
| Reprise après contradiction | 4030054127 | 10 | 10 | 10 | 10 | 0 | 10 |

## Franchissements, observations et victoires simulées

Les accès sont comptés par situation : toutes les hypothèses doivent réussir. Les franchissements, observations, victoires simulées et gestes sont cumulés sur les hypothèses effectivement rejouées. Une observation de localisation ne constitue pas à elle seule l’accès à la cible demandée.

| Famille | Franchissements F / C | Observations F / C | Victoires simulées F / C | Gestes F / C |
| --- | ---: | ---: | ---: | ---: |
| F1-detour | 66 / 66 | 0 / 0 | 5 / 5 | 66 / 66 |
| F2-viewpoint | 72 / 72 | 10 / 10 | 0 / 0 | 82 / 82 |
| F3-contact-order | 81 / 81 | 0 / 0 | 7 / 7 | 101 / 101 |
| F4-held-support | 103 / 103 | 0 / 0 | 5 / 5 | 132 / 132 |
| F5-temporary-opening | 103 / 103 | 10 / 10 | 7 / 7 | 123 / 123 |
| F6-construct-route | 87 / 87 | 0 / 0 | 5 / 5 | 93 / 93 |
| F7-uncertain-location | 0 / 135 | 0 / 20 | 0 / 0 | 0 / 175 |
| F8-recovery | 219 / 219 | 0 / 0 | 4 / 4 | 322 / 227 |

## Contrôles

- Cas certifiés par oracle indépendant : **80 / 80**.
- Accès vérifiés : figé **70**, candidat **80** ; gains **10** ; régressions **0**.
- Écarts entre simulateur et rejeu indépendant : **0**.
- Situations certifiées manquées par le candidat : **0**.
- Cas avec premier écart figé/candidat conservé : **20**.
- Demandes P09 faisables : **80** ; achevées avec reprise du parent : **80**.
- Invariant parent modifiant le trajet : **70**.
- Ablations ciblées sur les gains : **102** ; accès perdu **57**, conservé **45**, conservé avec gestes supplémentaires **41**.
- Décision modifiée par l’ablation : **102** ; erreurs de rejeu des ablations : **0**.
- Invariance hors quota : **80** variantes ; **0** échecs.
- Variantes avec changement de coût : figé **0**, candidat **0** ; delta cumulé **0 / 0**.

Les ablations retirent au point d’usage seulement l’appui, l’ouverture ou la preuve de route consommée. La suppression d’une preuve ne modifie pas la physique. Le préfixe joué, les autres acquis et le budget restant sont conservés. Un accès peut rester réalisable par réparation ou par une autre voie.

Les changements de coût sous transformation sont rapportés séparément : des politiques de même coût maximal peuvent répartir les gestes différemment entre hypothèses.

## Génération et déduplication

- Tirages : **80** ; doublons rejetés : **0** ; tirages non faisables rejetés : **0**.
- Erreurs de certification : **0**.
La signature porte sur la structure des routes, conditions, ressources, observations et invariants. Les identifiants, palettes, rotations, translations, ordre des commandes et annotations de victoire ne créent pas de nouvelle situation.

Pour la famille du point de vue, le rattachement utilise une calibration géométrique à partir d’ancres publiques ordonnées et de deux sujets. L’acquisition perceptive native de ces ancres n’est pas mesurée.

## Archives

| Archive | SHA-256 | Octets |
| --- | --- | ---: |
| corpus.jsonl.gz | `582b8262bc09b57ae610d1816a56a2c20dead4b6f24a7024369efccfc6713865` | 28200 |
| results.jsonl.gz | `435499c479f9497430f9a56b434ed6bdecbcd91d52ac989ec20414e31722b63e` | 121644 |

Les traces complètes, retours, certificats, premiers écarts et interventions se trouvent dans `results.jsonl.gz`. `corpus.jsonl.gz` contient les scénarios acceptés et leurs signatures.
