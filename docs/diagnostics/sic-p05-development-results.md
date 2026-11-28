# P05 — bilan des 8 000 situations de développement

## Livraison et source évaluée

Le générateur reproductible, l’oracle indépendant, le comparateur et le registre candidat P05 sont publiés sur la branche `feat/sic-p05-acquisition-dev-20261128`, issue exactement de `20433007224accc36e3d7976696d9ee7a783a227`.

**SHA du code évalué : `3e33f0f6610f28484200ed915723c39f45302f7b`.**

[Campagne GitHub Actions 46153159758](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46153159758) : pilote, huit lots et agrégation terminés avec succès. Le checkout des runners est limité aux sources et aux tests nécessaires au laboratoire. Les 2 000 cas de l’opérateur indépendant et SS08–SS25 n’ont été ni consultés ni exécutés.

Le [protocole détaillé](sic-p05-development-protocol.md) définit le domaine de validité. Ce bilan mesure un laboratoire d’acquisition sur observations structurées, puis la consommation par le vrai composeur P09. Il ne qualifie pas une intégration dans le worker natif complet.

## Résultat principal

| Mesure | Résultat |
| --- | ---: |
| Pilote préalable | 80 cas, dix par famille |
| Situations de développement certifiées résolubles | **8 000 / 8 000** |
| Quota de chacune des huit familles | **1 000** |
| Signatures comportementales distinctes | **8 000** |
| Tirages examinés / doublons exclus | **8 340 / 340** |
| Situations complètement acquises par le candidat | **8 000 / 8 000** |
| Effets contextualisés correctement acquis | **31 510 / 31 510** |
| Attributions erronées / affirmations sans preuve suffisante | **0 / 0** |
| Désaccords de traces entre les deux bras et l’oracle | **0** |
| Ablations ciblées réussies, une acquisition par situation | **8 000 / 8 000** |
| Compositions P09 réellement rejouées | **8 000 / 8 000** |
| Choix discriminants F8 réellement rejoués | **1 000 / 1 000** |
| Parties natives exécutées / victoires natives | **0 / 0** |

Les 31 510 éléments sont des acquisitions **commande × contexte**, pas 31 510 compétences indépendantes. Les retours stationnaires ne sont pas ajoutés au nombre d’effets acquis. L’admission au corpus dépend de la certification et de la signature avant toute lecture du résultat candidat ; un échec du candidat ne peut pas provoquer un remplacement de cas.

Sources : [rapport intégral](sic-p05-development-evidence/report.json), [8 000 verdicts compressés](sic-p05-development-evidence/results.jsonl.gz), [rapport du pilote](sic-p05-development-evidence/pilot-report.json), [vérification des empreintes](sic-p05-development-evidence/verification.json).

## Comparaison figé / candidat à budget identique

Le figé utilise réellement `rememberMotion` et `controlledStrokes`, sans modification de leur source. Les deux bras reçoivent les mêmes commandes publiques et le même plafond de **96 gestes**, dans des mondes et mémoires séparés. Préparations, commandes, attentes et tentatives stationnaires sont toutes comptées.

Le registre figé a enregistré **29 180 déplacements bruts**, couvrant tous les mouvements attendus dans **7 000 situations sur 8 000**. La différence directement comparable porte sur les **1 000 situations de phase/délai** : les **2 330 mouvements retardés** apparaissent pendant les attentes, après le retour immédiat que ce sous-système associe à la commande.

Le candidat acquiert ces effets retardés et produit aussi leur contrat de portée et de preuve. Le sélecteur figé retient pour sa part 17 698 vecteurs après ses règles de dominance ; ce filtrage de sélection est publié séparément du stockage des 29 180 déplacements.

La frontière figée ne fournit pas d’API réunissant délai, réserve, effet distant, conditions et références de contrôle. Son champ `qualifiedAcquisitions: 0` désigne cette **absence de contrat exposé**, pas zéro capacité ni zéro résolution du moteur SIC. Les 8 000 nouveaux contrats ne doivent pas être présentés comme 8 000 victoires supplémentaires contre le moteur entier.

Le blob Git du module figé reste `35bf4e14f1d632d6e4e732846670ecfe1f940160`. Le blob du composeur P09 reste `f54a624abaaa89e4d5363f41869017f4e7f99b35`, tous deux identiques à la base.

## Bilan par famille

Chaque ligne contient exactement 1 000 situations résolubles et 1 000 réussites du candidat. Les colonnes « effets » et « mouvements figés » comptent des mesures contextualisées, les colonnes ablation et P09 comptent des situations.

| Famille | Effets acquis / attendus | Mouvements bruts figés | Tentatives stationnaires | Ablations | P09 | Gestes min / médiane / max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. Commande et déplacement inconnus | 2 358 / 2 358 | 2 358 | 0 | 1 000 | 1 000 | 15 / 15 / 20 |
| 2. Sujet sélectionné | 5 894 / 5 894 | 5 894 | 0 | 1 000 | 1 000 | 30 / 45 / 60 |
| 3. Terrain et appui | 2 340 / 2 340 | 2 340 | 4 680 | 1 000 | 1 000 | 45 / 45 / 60 |
| 4. Phase et délai | 2 330 / 2 330 | 0 | 4 660 | 1 000 | 1 000 | 45 / 45 / 60 |
| 5. Ressource et épuisement | 3 682 / 3 682 | 3 682 | 3 269 | 1 000 | 1 000 | 45 / 45 / 60 |
| 6. Effet local et distant | 4 652 / 4 652 | 4 652 | 0 | 1 000 | 1 000 | 30 / 30 / 40 |
| 7. Preuve transférée | 6 254 / 6 254 | 6 254 | 736 | 1 000 | 1 000 | 45 / 45 / 60 |
| 8. Commandes initialement équivalentes | 4 000 / 4 000 | 4 000 | 0 | 1 000 | 1 000 | 30 / 30 / 30 |
| **Total** | **31 510 / 31 510** | **29 180** | **13 345** | **8 000** | **8 000** | **15 / 45 / 60** |

Les huit familles ont chacune zéro attribution erronée et zéro preuve injustifiée. Les 13 345 tentatives sans effet donnent autant d’abstentions justifiées. Les 2 330 références de preuves anciennes restent séparées des mesures courantes. Dans la famille de transfert, les acquisitions courantes produisent **779 confirmations**, **1 630 réfutations** et **3 845 restrictions de portée**.

## Premier écart et utilisation effective par P09

Le comparateur conserve le premier préfixe public qui produit un contrat qualifié différent, ainsi que les vecteurs réellement disponibles dans le figé à ce moment. Les [premiers préfixes des huit familles](sic-p05-development-evidence/first-deviations.json.gz) conservent leurs preuves ; ils ne sont pas des descriptions reconstruites depuis un état caché.

Exemple retardé du pilote : **`p05-4-36146e809c104a8e9509`**, dont le [reçu complet est conservé](sic-p05-development-evidence/first-delayed-gain.json).

1. Le sujet `body-b` est en `[0, 0]`, en phase 0, avec appui, sans obstacle. Le contrôle par attentes le laisse immobile.
2. `ACTION1` ne produit aucun déplacement au retour `r7`. Les attentes `r8` et `r9` restent stationnaires.
3. Le retour **`r10`** place le sujet en **`[-6, 0]`**. Au même instant, le retour du contrôle **`r5`** conserve `[0, 0]`.
4. Au dixième geste, P05 acquiert donc `delta=[-6,0]`, `delay=3`, avec `r10` comme retour décisif et le contrôle temporel cité. Le figé n’a enregistré aucun mouvement immédiat de cette commande.
5. Les contre-épreuves en phases 1 et 2 restent stationnaires (`r22`–`r25` et `r37`–`r40`) et limitent l’usage du même acquis.

L’acquisition `p05:6de53197` est ensuite réellement consommée par P09 pour atteindre un appui et le maintenir pendant un transfert de charge. Le plan rejoué comporte sept gestes : commande, préparation du relais, deux attentes, activation, chargement, livraison. Le retour d’acquisition, les conditions et l’identifiant d’effet sont conservés dans le ticket P09.

Les consommateurs F8 et P09 ne reçoivent aucun verdict de l’oracle avant leur choix. Un test introduit une offre fausse prioritaire : le consommateur la choisit selon les données publiques, puis le rejeu la réfute. Cette vérification empêche une réussite obtenue par filtrage des mauvaises offres à l’aide de la vérité d’évaluation.

## Ablation du seul lien décisif

Le contrôle retire une observation : le retour qui établit le lien de l’acquisition ciblée. Ses copies du même `ref` dans les champs `before` suivants sont également masquées. Les commandes, coûts, horloges et autres observations restent identiques.

Les **8 000 ablations** retirent chacune la justification de l’effet ciblé, sans laisser de copie du nœud dans l’historique. Elles désactivent l’offre P09 originale privée de cette preuve. La couverture est **une acquisition cible par situation**, choisie de préférence parmi celles consommées par P09 ; elle ne représente pas une ablation de chacune des 31 510 acquisitions.

Dans **1 016 situations**, une autre acquisition intacte permet encore un plan P09. Ces substitutions sont comptées séparément ; elles ne sont pas des utilisations de la preuve retirée. Aucun geste de remesure supplémentaire n’est ajouté dans cette ablation contrôlée. L’exemple retardé ci-dessus perd bien son acquisition et son plan lorsque `r10` est retiré.

## Contrastes hors quota

| Série distincte | Résultat |
| --- | ---: |
| Paires indiscernables sous deux gestes | 32 / 32, soit 64 mondes |
| Préfixes publics exhaustifs et abstentions correctes | 1 530 / 1 530 |
| Différences qui apparaissent au quatrième retour, hors plafond | 32 / 32 |
| Situations entièrement stationnaires, sans acquisition indue | 32 / 32 |
| Contre-contextes conservant la commande utilisable | 32 / 32 |
| Rappels périmés sans promotion gratuite en preuve courante | 32 / 32 |
| Effet de réserve seul et effet distant seul, sans déplacement inventé | 2 / 2 |

Ces 96 contrastes et deux témoins scalaires ne contribuent pas aux 8 000 cas positifs. Le compteur de 1 530 concerne des historiques possibles, pas 1 530 nouvelles situations.

## Coûts et vérifications

L’acquisition exécute **15 à 60 gestes par situation**, médiane **45**, pour un plafond commun de 96 : **321 795 gestes par bras**, soit **643 590** au total. La première acquisition apparaît entre les gestes 10 et 50, médiane 10. Ce protocole constitue une expérience suffisante ; son coût minimal n’est pas revendiqué.

Les vérifications de choix F8 ajoutent séparément **5 000 gestes**. P09 utilise son propre plafond de seize gestes et exécute **41 009 gestes**, cinq à sept par composition.

La campagne CI prend **100,703 secondes depuis le lancement du workflow jusqu’au dernier contrôle**, dont **84,703 secondes depuis le début des contrôles du pilote**. Les exécutions des huit familles cumulent **178,670 secondes**. Le **pic observé de huit jobs simultanés** a été calculé à partir des intervalles réels GitHub Jobs, pas déduit du plafond configuré. Sources : [horodatages CI](sic-p05-development-evidence/ci-timing.json), [intervalles des jobs](sic-p05-development-evidence/ci-jobs.json), [reçu d’audit](sic-p05-development-evidence/verification.json).

Les **60 tests ciblés** passent, ainsi que le typecheck strict des deux modules. Les tests contrôlent notamment la parité des interpréteurs, les faux rappels, l’alias du retour retiré, le choix sans assistance de l’oracle et les agrégats mal étiquetés ou incomplets. Le journal CI est [conservé](sic-p05-development-evidence/tests.log).

## Graines et reproduction

Graine maîtresse : **26112805**.

| Famille | Graine | Quota | Doublons exclus |
| --- | ---: | ---: | ---: |
| 1 | 26113814 | 1 000 | 76 |
| 2 | 26114823 | 1 000 | 34 |
| 3 | 26115832 | 1 000 | 92 |
| 4 | 26116841 | 1 000 | 2 |
| 5 | 26117850 | 1 000 | 0 |
| 6 | 26118859 | 1 000 | 0 |
| 7 | 26119868 | 1 000 | 21 |
| 8 | 26120877 | 1 000 | 115 |

Depuis le SHA évalué, avec Node 24 :

```sh
node scripts/sic-p05-campaign.mjs --per-family 10 --seed 26112805 --out artifacts/sic-p05-pilot
node scripts/sic-p05-campaign.mjs --per-family 1000 --seed 26112805 --out artifacts/sic-p05-development
```

Le workflow `.github/workflows/sic-p05-development.yml` exécute le pilote puis huit fragments indépendants de mille cas. L’agrégation refuse les SHA différents, les mauvaises familles, les quotas incomplets, les budgets incohérents et les doublons globaux. Les commandes de fragmentation figurent dans le protocole.

| Empreinte | SHA-256 |
| --- | --- |
| Sources évaluées | `bb73ae7ecc1cd3282fcf89e7457a3e255c17321b9f85193a6516b738a2b80b55` |
| Rapport CI | `4b2f167f3aa06b8fbda9c44ea2f9ff6b53f461e675105fcee2aee8ae74f8bbe4` |
| Lignes des 8 000 résultats | `550d734c0ace53d7670aca970015014b07665f61782fcc6d4787639ad4d56704` |
| Ensemble des signatures | `465d30d1f70b0a16e4a70c393d12c3b7aa90bfcea94071a6fa360e62f336acd3` |

## Limites et réception indépendante

Le domaine comporte des contextes publics finis, accessibles par des préparations, des observations complètes, des effets déterministes et un délai borné. Les portées sont conservatrices : elles restent liées aux conditions mesurées. La phase du corpus est une condition de préparation, et les contrastes de réserve ne démontrent pas à eux seuls une exploration autonome jusqu’à épuisement dans une partie native.

Ce lot ne mesure pas une politique d’exploration autonome P04, un raisonnement sous bruit, une généralisation universelle des gardes, ni une victoire native. Le résultat de développement ne remplace pas la réception indépendante sur les 2 000 cas scellés.

- Branche isolée : `feat/sic-p05-acquisition-dev-20261128`.
- Code et résultats : publiés sur GitHub.
- SHA du code évalué : `3e33f0f6610f28484200ed915723c39f45302f7b`.
- Intégration sur `main` : non effectuée dans ce lot isolé.
- Version Site et SHA Site : non applicables ; aucune publication du Site effectuée.
- SS08–SS25 : aucune consultation ni exécution dans le lot.
- Transmission directe à SIC SYNC et à l’opérateur : canal non identifié ; [paquet de réception prêt](sic-p05-handoff.md), aucun envoi ni validation indépendante revendiqués.
- Prochaine étape : réception sur la réserve propre de l’opérateur, puis décision d’intégration native avec ses contrôles de continuité.
