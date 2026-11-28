# P14 — Identifier une évolution temporelle pour décider

Base gelée : `20433007224accc36e3d7976696d9ee7a783a227`.
Branche isolée : `feat/sic-p14-temporal-dev-20261128`.

**Campagne terminée :** [bilan des 8 000 situations](BILAN.md), [rapport et mesures](development-report.json), [six régressions conservées](regressions.json). SHA évalué : `05b9e74ad2a293ac91420d6f727b873f82c99686`.

## Périmètre de preuve

Ce banc compare **une primitive SIC temporelle isolée** et son candidat dans un simulateur. Il ne compare pas deux exécutions complètes du worker SIC natif. Le figé appelle la fonction native `inferWitnessedSuffixCycle` du commit de base, inchangée ; le candidat ajoute `temporal-evidence.ts`. Les deux passent par le même adaptateur public et le composeur P09 `composePlan`, également inchangé. Aucune nouvelle primitive n'est raccordée à l'arbitrage de production par ce lot.

Le rôle appris est une prévision de la valeur d'un mécanisme pendant un intervalle d'action. Les retours qui l'établissent sont des trames publiques datées et fiables, citées avant commande. La réutilisation exige le même contexte et des prédictions compatibles sur tous les ticks du mouvement. Une contradiction fiable ou une intervention sur le mécanisme impose une révision ciblée. Le maintien conserve la preuve de la valeur capturée ; ses échantillons ne contaminent pas la mesure du cycle libre.

L'interface et les trajets locaux, leurs durées et les commandes de maintien sont des prémisses publiques déjà mesurées. L'acquisition P05 de ces commandes et la perception depuis les pixels n'appartiennent pas à ce banc. Les horloges, transitoires, périodes, déphasages, délais et variantes de mondes restent dans les modules d'évaluation. Le sujet ne reçoit ni famille, ni graine, ni identifiant de cas, ni solution, ni index de monde.

## Génération et quotas

Graine de développement : **26112814**. Pilote : **80 cas, 10 par famille**. Campagne : **8 000 cas certifiés, 1 000 par famille**. Chaque cas comprend deux mondes initialement indiscernables. Une situation ne réussit que si ses deux mondes sont franchis avec les justifications requises. Les doublons et les cas sans certificat sont remplacés **avant tout résultat du candidat**. Les échecs du candidat ne sont jamais filtrés.

| Famille | Variation causale |
| --- | --- |
| `transient_then_period` | Transitoires de longueurs variables puis cycles d'ouverture ; durée du trajet. |
| `ambiguous_periods` | Débuts communs, prochaines récurrences différentes, observation discriminante accessible. |
| `delayed_command` | Impulsion retardée après commande, premier retour stationnaire et mécanisme automatique concurrent requis ensuite. |
| `expiring_window` | Fenêtre insuffisante pour le trajet direct ; maintien limité ou détour avec segment conditionnel plus court. |
| `cycle_intervention` | Premier passage appris puis remise à zéro, décalage ou interruption du mécanisme avant un second passage. |
| `independent_clocks` | Deux périodes distinctes, passage conditionné conjointement ou détour qui évite la synchronisation. |
| `ordered_intermediates` | Ordre de deux événements permuté, inspection sur plusieurs trames, même finale dans les deux mondes. |
| `partial_observation` | Masquage et bruit signalé, retours espacés et commande d'inspection fiable disponible. |

La signature normalise les noms de commandes et de canaux, l'ordre de présentation et des mondes, les périodes primitives et le début effectif du suffixe périodique. Elle conserve les lois, dépendances, possibilités de choix, durées, fenêtres, ressources et modes d'observation qui agissent sur les décisions. L'origine absolue cachée est exclue. Ses translations sont des contrôles d'invariance séparés, jamais des cas supplémentaires. Il s'agit d'une normalisation des programmes causaux, pas d'une preuve complète de quotient par bisimulation de tous les problèmes de décision possibles.

## Oracle indépendant

`scripts/sic-p14/oracle.mjs` n'importe que `node:crypto`. Il réimplémente les transitions et construit un certificat AND/OR : une même classe d'historiques publics reçoit une seule action, puis toutes les branches d'observations doivent rester résolubles. Le certificat donne les maxima de gestes et de ticks, le nombre de branches et son empreinte. Il est rejouable avec `replayCertifiedPolicy`.

Cette preuve porte sur les **deux mondes déclarés** du scénario. Elle ne suppose pas que la politique choisit avec l'horloge vraie et ne prouve pas l'identification de toutes les lois temporelles mathématiquement possibles. Les tests comprennent un piège où chaque monde est résoluble par un oracle omniscient mais où aucune politique publique n'existe sous le plafond. Une borne de recherche atteinte est distinguée d'un rejet après exploration complète.

Le comparateur rejoue indépendamment **chaque transition** exécutée par le figé, le candidat et les ablations. Une divergence entre simulateur et oracle arrête la campagne.

## Budgets, mesures et ablations

Budgets identiques : **180 gestes**, **360 ticks de jeu**, **20 000 états de composition/recherche par appel**. Le temps mural est mesuré séparément et n'entre jamais dans la décision. L'inférence candidate est bornée aux périodes 2 à 24, avec trois témoins fiables par phase. Une réponse retardée demande un retour complet 0 → 1 → 0 après une commande jouée. Ces hypothèses sont inductives : un transitoire peut imiter une période et produire une erreur, qui reste dans le bilan.

Les reçus distinguent franchissement brut et réussite qualifiée. Cette dernière exige aussi des preuves accessibles, les gardes de tous les ticks conditionnels et des révisions appuyées par une contradiction ou une intervention observée. Les prédictions sont enregistrées avant les retours ; seules les trames publiques fiables permettent de les compter confirmées. Les prédictions masquées ou bruitées sont censurées. Gestes, attentes, inspections, abstentions, maintiens, déclenchements, bons instants, révisions, premier écart de commande et première erreur sont conservés.

Sur chaque gain d'épisode, une trame réellement citée dans les gardes du passage est retirée, en donnant priorité aux intermédiaires. Seules ses valeurs et sa fiabilité sont effacées : référence, tick, coût, commande et dynamique restent identiques. Le rejeu mesure perte de réussite, changement de gestes et observations supplémentaires. Un succès conservé est rapporté tel quel ; il ne démontre pas que le témoin était nécessaire. Les passages annoncés par P09 sont exécutés dans le simulateur et vérifiés par position atteinte et gardes physiques, sans transformer cela en victoire native.

## Reproduction

Node 24, sans dépendance npm nécessaire pour ce banc :

```bash
node --test tests/sic-p14-*.test.mjs
node scripts/sic-p14-campaign.mjs --count 80 --seed 26112814 --state artifacts/sic-p14/pilot-80
node scripts/sic-p14-campaign.mjs --count 8000 --seed 26112814 --state artifacts/sic-p14/development-8000
```

La campagne complète GitHub Actions utilise huit runners indépendants, un par famille, et des épisodes exécutés en série dans chacun. Le workflow `sic-p14-temporal.yml` conserve les reçus compressés et les empreintes, puis vérifie la couverture, l'unicité globale, les budgets et l'identité du code avant agrégation. Le rapport contient le SHA, les empreintes des sources, la graine et les indices de génération acceptés. L'empreinte déterministe exclut uniquement les mesures murales.

## Réserve et remise

Les **2 000 situations de l'opérateur indépendant** restent externes au générateur de développement et n'ont pas été consultées ni générées. **SS08–SS25 restent sous scellés**. Aucun jeu natif n'est lancé par le workflow de ce lot et aucune victoire native n'est revendiquée.

La remise finale comprend le SHA poussé, le rapport par famille, les reçus, les limites et les commandes de reproduction. L'intégration sur `main` et la publication Site ne font pas partie de cette livraison sur branche isolée. La qualification native et le contrôle de continuité requis par `AGENTS.md` restent des étapes distinctes avant intégration.
