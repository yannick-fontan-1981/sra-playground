# HPDL : conservation prospective des résultats terminaux complets

Préparation du 11 novembre 2026, avant la prochaine campagne sur le runtime corrigé. Cette note ne représente aucune nouvelle exécution, aucun verdict de jeu et aucun débit supplémentaire.

La campagne réelle peut renvoyer un rapport terminal `failed`, avec sa trace publique complète et un code de sortie enfant 1. Les deux voies existantes de clôture couvraient le succès complet et le checkpoint incomplet, sans permettre de conserver cette troisième situation dans la revue finale. Elle doit rester distincte de ces deux résultats.

Le mode fermé `complete-parity` de `run-hpdl-clocked-diagnostic.py` appelle seulement le comparateur complet existant, sur les octets du rapport final et de la trace effectivement conservés par une exécution inscrite au registre. Les modes `writer`, `parity` et `writer-parity` gardent leurs interfaces et conditions historiques. Les commandes arbitraires et les entrées mixtes sont refusées.

La qualification `not_established` de `finalize-hpdl-case-budget-review.py` exige un rapport terminal réel `failed`, le code de sortie 1, aucune terminaison imposée par le wrapper, une capture finale complète et le digest du candidat vérifié. Elle conserve le résultat final et le texte d'échec. Elle ne transforme pas cette campagne en succès ni en checkpoint PARTIAL et ne déduit pas la cause de l'échec. Le mode `established` reste lié à un véritable résultat `passed` avec la cible de six niveaux atteinte ; le mode `partial` garde ses conditions de checkpoint incomplet.

Les sources originales, tous les appels, restaurations, acquisitions et ablations restent comparés. Une adaptation temporelle ne devient pas une égalité originale. Le plafond par défaut de 180 s, la borne configurable de 300 s, les captures, les rejets et le cumul unique de 2 400 s conservent leurs règles. Aucun reçu historique, gel, registre ou fichier natif n'est modifié par cette préparation. Le lecteur cumulatif `run-hpdl-clocked-proof.py`, déjà lié par le reçu des 451 s, reste immuable.

Revue indépendante : `window_oracle` a relu les deux extensions en texte et n'a identifié aucun défaut bloquant. Le contrôle syntaxique et toute utilisation attendent la levée explicite du calme de mesure du lot 7. Les preuves exécutées seront conservées dans de nouveaux répertoires.
