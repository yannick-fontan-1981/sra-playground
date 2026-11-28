# Bilan P14 — 8 000 situations temporelles de développement

**Le candidat résout 7 844 situations sur 8 000 (98,05 %), contre 767 (9,59 %) pour la primitive figée.** La comparaison conserve **7 083 gains et six régressions**. Les huit quotas sont remplis, les 8 000 signatures normalisées diffèrent et chaque cas possède un certificat oracle de politique publique sur ses deux mondes déclarés.

Ce résultat mesure une **primitive SIC isolée avec un adaptateur commun et une composition P09 simulée**. Il ne mesure pas le taux de victoire du moteur SIC complet. **Aucun jeu natif exécuté, aucune victoire native qualifiée.**

## Références et exécution

- Base demandée : `20433007224accc36e3d7976696d9ee7a783a227`.
- SHA du code effectivement évalué : **`05b9e74ad2a293ac91420d6f727b873f82c99686`**.
- Branche : `feat/sic-p14-temporal-dev-20261128`.
- Graine de développement : **26112814**, également utilisée pour les 80 cas du pilote.
- [Campagne GitHub Actions réussie](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46152308332).
- Huit lots indépendants de 1 000 cas ; épisodes en série dans chaque lot.
- [Rapport complet](development-report.json), [reçus des 8 000 situations](development-receipts.jsonl.gz), [provenance GitHub](github-run.json), [validation](validation.json).

Le code a été publié par la connexion GitHub après absence d’authentification Git locale. L’arbre publié `00fd5aa96884ae3d1b93ed0bd49e09acc7f6ff98` est identique à l’arbre testé localement. Le commit local initial `ea2642d349bfbe7ea15e8b2f8966d8c1b690ac05` ne sert pas de référence distante. Les comptes rendus sont ajoutés ensuite sans changement du code mesuré.

## Résultats par famille

Une situation ne passe que si **ses deux mondes** sont franchis avec preuves accessibles, gardes temporelles complètes et révisions justifiées. Les 16 000 épisodes par variante ne sont pas comptés comme 16 000 situations.

| Famille | Quota | Figé | Candidat | Gains | Régressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Transitoire puis période | 1 000 | 64 | 949 | 886 | 1 |
| Périodes ou déphasages ambigus | 1 000 | 94 | 971 | 880 | 3 |
| Effet retardé de commande | 1 000 | 0 | 999 | 999 | 0 |
| Fenêtre expirante | 1 000 | 491 | 1 000 | 509 | 0 |
| Intervention sur le cycle | 1 000 | 7 | 986 | 979 | 0 |
| Horloges distinctes | 1 000 | 109 | 968 | 861 | 2 |
| Trames intermédiaires ordonnées | 1 000 | 0 | 1 000 | 1 000 | 0 |
| Observation partielle | 1 000 | 2 | 971 | 969 | 0 |
| **Total** | **8 000** | **767** | **7 844** | **7 083** | **6** |

Il reste **156 situations non réussies par le candidat**. Les échecs ne sont pas exclus du corpus après mesure. Sur les épisodes individuels, le candidat franchit **15 745 / 16 000 mondes**, contre **1 787 / 16 000** pour le figé.

## Ce qui est appris et ce qui est réellement exécuté

Le figé appelle `inferWitnessedSuffixCycle` du commit de base sans modification ; cette fonction ne retient que des suffixes débutant entre les indices 3 et 6 et impose ses témoins de confirmation. Le candidat maintient des hypothèses datées pour les périodes 2 à 24, avec trois observations fiables par phase, puis exige leur accord pour prédire. Il apprend également les réponses retardées depuis un retour complet 0 → 1 → 0 consécutif à une commande.

Les deux variantes ont la même interface, les mêmes trajets et commandes publics, le même adaptateur, le même composeur P09 et les mêmes plafonds : **180 gestes, 360 ticks de jeu, 20 000 états de recherche par appel**. Les trajectoires, durées et effets des commandes de maintien sont des prémisses déjà mesurées ; leur acquisition P05 et leur perception depuis les pixels ne sont pas évaluées ici.

Pour engager un déplacement, le composeur doit disposer d’une prévision pour **chaque canal requis à chaque tick du mouvement**. Le simulateur exécute ensuite réellement la transition ; l’oracle réimplémente séparément ses effets et vérifie les observations. Un plan annoncé ne suffit pas. Les preuves sont enregistrées avant le résultat. La phase antérieure d’un mécanisme perturbé est révisée ; les autres mécanismes conservent leurs acquis.

### Mesures globales

| Mesure sur les 16 000 épisodes par variante | Figé | Candidat |
| --- | ---: | ---: |
| Prédictions émises | 125 146 | 266 907 |
| Prédictions confirmées par un retour fiable | 124 998 | 255 910 |
| Prédictions contredites | 46 | 1 435 |
| Prédictions non évaluables : masque ou bruit | 102 | 9 562 |
| Actions temporisées au bon instant | 2 185 | 19 717 |
| Actions temporisées mal placées | 12 | 221 |
| Révisions justifiées | 427 | 3 137 |
| Gestes exécutés | 2 266 938 | 521 109 |
| Ticks de jeu consommés | 3 220 748 | 703 506 |

Le candidat effectue 401 055 inspections, 77 356 commandes d’attente, 8 809 déclenchements, 982 maintiens et 32 907 mouvements. **12 237 décisions sont explicitement des abstentions de franchissement**, réalisées comme une attente sûre ; il ne s’agit pas d’une victoire par abstention terminale. Les modes exclusifs des décisions figurent dans `validation.json`.

**Zéro preuve invalide, zéro déplacement conditionnel sans garde complète, zéro révision sans support**, dans les deux bras et dans les ablations. Une preuve valide peut néanmoins soutenir une induction erronée : cette distinction explique les six régressions ci-dessous.

### Mesures du candidat par famille

| Famille | Prévisions confirmées | Contredites | Bons instants | Mauvais instants | Révisions | Gestes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Transitoire puis période | 11 456 | 421 | 1 921 | 79 | 326 | 73 570 |
| Périodes ou déphasages ambigus | 7 548 | 273 | 1 943 | 57 | 198 | 62 110 |
| Effet retardé de commande | 61 106 | 129 | 3 999 | 1 | 128 | 69 608 |
| Fenêtre expirante | 27 017 | 0 | 2 000 | 0 | 0 | 35 138 |
| Intervention sur le cycle | 19 576 | 182 | 3 944 | 28 | 2 150 | 132 157 |
| Horloges distinctes | 78 731 | 354 | 1 951 | 37 | 259 | 82 775 |
| Trames intermédiaires ordonnées | 41 234 | 0 | 2 000 | 0 | 0 | 14 664 |
| Observation partielle | 9 242 | 76 | 1 959 | 19 | 76 | 51 087 |

## Oracle, quotas et déduplication

L’oracle ne dépend ni du candidat, ni du figé, ni du simulateur. Il construit une politique sur les classes d’historiques publics : une même classe reçoit une seule action, puis toutes les observations issues des mondes encore compatibles doivent conduire à une solution sous les plafonds. Le test d’indiscernabilité refuse un cas où chaque monde possède une solution omnisciente mais où aucun choix public commun n’est possible. Les solutions et horloges restent dans l’évaluateur.

**8 057 propositions** ont été nécessaires : 13 doublons structurels écartés et 44 cas sans certificat retenu. Parmi ces derniers, 40 sont des rejets après recherche et quatre atteignent la borne de recherche de l’oracle. Ces quatre cas ne sont pas annoncés impossibles. Le candidat n’intervient pas dans ces décisions de sélection.

La normalisation retire noms, ordre de présentation, origine absolue, répétitions de périodes primitives et prolongements redondants du suffixe. Elle conserve les dépendances, durées, fenêtres, commandes, choix et conditions d’observation. La signature porte sur les programmes causaux ; elle ne revendique pas une équivalence exhaustive par bisimulation. Les **32 contrôles de translation d’origine** passent et restent hors des 8 000 cas.

**3 395 302 contrôles d’observations et de transitions concordent** entre les deux implémentations : 2 820 047 pour les deux bras principaux, puis 575 255 dans les ablations. Ce compteur comprend **3 349 332 transitions jouées et 45 970 observations initiales**. Les 80 reçus du pilote sont identiques aux cas correspondants de la campagne après exclusion des mesures murales. Les 24 rejeux ciblés des six régressions reproduisent leurs métriques.

## Ablations des témoins effectivement consommés

Il y a **13 970 gains d’épisode** où le candidat réussit et le figé échoue. Chaque gain reçoit une ablation d’une trame citée dans les gardes du passage ; 3 874 de ces témoins sont intermédiaires. Les références, ticks, commandes, coûts et horloges restent identiques. Seules les valeurs et la fiabilité du témoin sont supprimées.

- **19 ablations suppriment le franchissement physique.**
- **6 947 modifient la suite des actions**, dont ces 19 pertes.
- **6 889 entraînent au moins une inspection supplémentaire.**
- **7 023 conservent la même suite d’actions et la réussite.**

Ces catégories se recouvrent comme indiqué. L’ablation d’un témoin redondant ne prouve pas sa nécessité. Pour la famille des trames intermédiaires, les 2 000 ablations modifient les actions et imposent une nouvelle observation, mais aucune ne supprime la réussite. Les trames sont consommées ; le sujet peut les réacquérir dans ces cas.

## Six régressions conservées et premier écart

[Diagnostic complet des six régressions](regressions.json). Elles touchent 11 des 12 mondes de ces six cas. Toutes proviennent de périodes 2 ou 3 extrapolées trop tôt, suivies d’un mouvement dont la garde est contredite. Elles surviennent entre 5 et 7 gestes et entre 7 et 11 ticks ; aucun plafond n’est atteint.

| Famille / index de génération | Mondes perdus | Premier écart de commande | Première garde contredite |
| --- | --- | --- | --- |
| Transitoire / 83 | 0 | Tick 7 | Tick 8 |
| Ambiguïtés / 143 | 0 et 1 | Tick 5 | Tick 7 |
| Horloges distinctes / 189 | 0 et 1 | Tick 5 | Tick 7 |
| Ambiguïtés / 191 | 0 et 1 | Tick 8 | Tick 10 |
| Horloges distinctes / 440 | 0 et 1 | Tick 5 | Tick 7 |
| Ambiguïtés / 732 | 0 et 1 | Tick 8 | Tick intermédiaire 10 |

Dans le dernier cas, le déplacement exige une ouverture aux ticks 10 et 11. Le retour vaut **0 au tick intermédiaire 10, puis 1 au tick final 11**. Le passage échoue malgré une finale conforme. Un contrôle limité à l’image finale manquerait cette violation. Dans les deux régressions de la famille à deux horloges, le candidat emprunte un détour dépendant d’un seul signal : c’est sa prévision de ce signal qui échoue, et non le calcul de synchronisation.

Le premier écart global du corpus se situe au tick 46 du cas transitoire index 0 : à préfixe public identique, le figé continue l’inspection tandis que le candidat attend une ouverture apprise puis franchit. Les reçus conservent l’écart de commande et la première erreur de prévision séparément. [Premières erreurs du pilote](pilot-first-errors.json).

## Limites de la preuve et prochaine qualification

Le certificat est existentiel sur **les deux mondes déclarés du cas**, sans fournir ces mondes au sujet. Il ne prouve pas qu’un agent ignorant toute loi temporelle peut acquérir une garantie avant chaque occasion unique. Le pilote contient un cas à deux horloges où le candidat apprend correctement après avoir manqué l’ouverture commune initiale ; prolonger son attente ne recrée pas cette occasion. Le rapport garde cet échec et distingue l’existence d’une politique de la possibilité d’apprendre à temps.

Le bruit de cette version est signalé par un indicateur public de fiabilité et une commande d’inspection fiable est disponible. Les hypothèses non encore soutenues ne sont pas toutes représentées par l’inférence candidate. Ces choix bornent l’interprétation des résultats de développement.

La prochaine correction à qualifier concerne la confirmation sûre de la **phase ouverte effectivement requise par le mouvement**, avant un engagement irréversible, avec les six régressions maintenues et les plafonds inchangés. Le candidat n’est pas qualifié pour une intégration native par ce seul banc. L’intégration nécessitera le protocole de transfert natif et `npm run test:sic-continuity`, selon `AGENTS.md`, sans ouvrir les jeux réservés dans ce lot.

## Temps du jeu et temps mural

- Les ticks sont exclusivement ceux du simulateur ; aucun temps mural n’entre dans la décision.
- Comparaisons des huit lots : **77,981 secondes** entre le premier début et la dernière fin ; pic mesuré de **six comparaisons actives**.
- Les huit jobs de famille ont été simultanément alloués ; leur démarrage de comparaison dépend de la préparation.
- Durée cumulée des huit lots : **295,966 secondes**.
- Durée cumulée des rejeux, deux bras et ablations : **271,710 secondes**.
- Workflow complet jusqu’au dernier contrôle et à la remise des artefacts : **226 secondes (3 min 46 s)**, le 28 novembre 2026 de **10:59:13 à 11:02:59, heure de Recife**.

Le temps cumulé des épisodes principaux est de 208,185 s pour le figé et 32,821 s pour le candidat. Ces durées décrivent ce banc sur ses runners, pas le coût global du SIC natif.

## Reproduction et empreintes

```bash
git switch --detach 05b9e74ad2a293ac91420d6f727b873f82c99686
node --test tests/sic-p14-*.test.mjs
node scripts/sic-p14-campaign.mjs --count 80 --seed 26112814 --state artifacts/sic-p14/pilot-80
node scripts/sic-p14-campaign.mjs --count 8000 --seed 26112814 --state artifacts/sic-p14/development-8000
```

Node **24.22.3** utilisé. Le rapport précise les empreintes des dix fichiers exécutables du banc. Les reçus contiennent les indices de génération acceptés ; un cas se reconstruit avec `generateCase(family, sourceIndex, 26112814)`.

- Empreinte des sources : `a0daee679f53af0d70a4b583cb4d7e9cfec2af516d3adb76817dabed0c8f3895`.
- Empreinte déterministe des reçus : `defe844d64e8ffbe9cd2656a054d324bc96bba9df3141ea025c1f7b3376a85e4`.
- Reçus compressés : `61e9cf22bfea275953bffda41e875bfee63894b77ddd3145d21612684819c603`.
- Rapport JSON : `83bbae55004be3dcc4a9445e9124c516466bf253ad36e1d4020f1d2b00344311`.
- Tests : **18 tests P14 et 8 tests des composants temporels existants**, tous réussis.

## État de livraison

Code et résultats sont publiés sur la branche isolée. Aucun commit de ce lot n’est intégré à `main` et aucune version Site n’est publiée. Le Site n’est pas une référence de cette évaluation. Les **2 000 situations de l’opérateur indépendant** ne sont ni générées ni consultées ; **SS08–SS25 restent sous scellés**.

[Remise préparée pour SIC SYNC](HANDOFF-SIC-SYNC.md) · [Remise préparée pour l’opérateur indépendant](OPERATOR-HANDOFF.md). La transmission directe à ces destinataires nécessite leur canal exact ; elle n’est pas présumée effectuée par la seule publication GitHub.
