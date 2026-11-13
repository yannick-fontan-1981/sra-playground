# Correction du coût 3A : diagnostic préalable

Déclaré le 9 novembre 2026, avant la modification native et avant la mesure.

Base : publication 65, commit `24c15cc5c147a8e2d639a6e0e3fe25bc632537f0`, moteur `0.37.0`, inventaire natif `f3f795a3c813b72803e3f26bd207eed032853ae03d60582a33392f52a1bf8e7d`.

Un unique replay froid SMLP15 instrumenté par le script existant `scripts/profile-native-loop-costs.mjs` et le profileur CPU Node localise les appels et allocations. Le moteur recalcule chaque commande avant de recevoir le retour public enregistré correspondant. Aucun checkpoint appris, scénario de solution ou code de jeu n'est fourni à l'agent. Le script de diagnostic conserve sa référence historique à `lot2c-cost-evidence/diagnostic/README.md` ; le présent protocole déclare spécifiquement cette nouvelle exécution SMLP.

Les durées de cette exécution incluent l'instrumentation et ne valident aucun budget. Les phases sont imbriquées. Aucun benchmark, test, build ou serveur de prévisualisation ne doit s'exécuter en parallèle. Les autres analyses de code sont en lecture seule ; les sources natives restent gelées pendant ce replay. Le profil CPU est un échantillonnage, pas une attribution exacte de chaque allocation ni une preuve de fuite mémoire.

Objectif : choisir une correction générique qui supprime un travail réellement répété ou des allocations inutiles, en conservant les sorties, acquisitions, gardes et refus. Les résultats historiques 0.37 restent intacts. La validation officielle utilisera séparément les 16 médianes STCK10/SMLP15 et le seuil +10 %, avec une référence 0.36 fraîche et un protocole déclaré avant les exécutions.

## Comparaison après correction

Après le gel 0.38, un second profil unique SMLP15 emploie le même script, le même manifest et les mêmes entrées. Il vérifie le nouveau digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`. Les deux profils et leurs limites restent disponibles ; cette comparaison diagnostique n'est pas ajoutée aux cohortes officielles et ne modifie pas leur règle de décision.

`summarize-native-cpu-profiles.mjs` conserve chaque profil intégral sous gzip et calcule les temps propres échantillonnés. Les deux profils contiennent quelques intervalles bruts négatifs de −1 ou −2 microsecondes : deux avant, quatre après. Ils restent dans les sommes signées et sont listés, sans exclusion ni correction des données. Leur cause n'est pas attribuée.

`compare-native-profile-behavior.mjs` compare exactement les commandes, les quatre états de propriétaires conservés et une projection explicitement listée des requêtes, ainsi que les effectifs d'appels. Les autres valeurs, identités de graphe et horloges restent intactes dans les rapports. L'égalité stricte du résultat complet reste fausse et n'est pas transformée en parité générale.
