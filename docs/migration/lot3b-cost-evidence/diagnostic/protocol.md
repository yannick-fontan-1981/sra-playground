# Correction 3B : protocole de diagnostic

Déclaré le 2026-11-10T00:55:31.659775+00:00.

Un rejeu public froid STCK10 instrumente le moteur 0.39.0 publié (inventaire natif 49648e72cf7d3d719addfe4a6bebd8c29842a0f618664a45ef3929a5d17132b1), avant toute modification de production. Le runner existant `scripts/profile-native-loop-costs.mjs` conserve tous les appels, commandes, compteurs, états propres et durées. Le profil CPU Node porte sur le processus entier, chargement et export compris. Les entrées sont celles de `docs/migration/lot3b-evidence/performance/cases.json`. Ce runner référence aussi son protocole historique 2C ; le présent document précise sa réutilisation en diagnostic 3B.

Après une correction motivée par ce diagnostic et la lecture des contrats, un seul rejeu STCK10 identique est prévu sur la nouvelle source gelée. Les deux résultats seront comparés avec le comparateur historique `compare-native-profile-behavior.mjs`, sans modifier ses critères. Toutes différences restent visibles. Les profils bruts et reçus seront conservés, y compris les résultats défavorables.

Ces deux exécutions instrumentées visent la localisation du travail et la conservation du comportement. Elles ne constituent ni une mesure officielle du budget, ni une preuve causale complète de la hausse antérieure, ni une nouvelle réussite de jeu. Aucun code, règle, spécification, solution ou oracle de jeu n'est lu. Les commandes sont recalculées par le moteur commun avant réception du paquet public enregistré.

La mesure officielle ultérieure est distincte : protocole préalable, source gelée, référence 0.38 fraîche, STCK10/SMLP15, deux cohortes intégralement retenues et seuil de +10 %. Aucun autre test, profil, build ou navigateur ne doit tourner pendant cette fenêtre.
