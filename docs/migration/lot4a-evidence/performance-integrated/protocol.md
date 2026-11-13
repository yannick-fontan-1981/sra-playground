# Lot 4A : protocole de coût global

Déclaré le 2026-11-10T19:10:19.797070+00:00, avant toute mesure. A : Site 79, native 0.50.0, commit `6d03c2adda9f60b1c97304f5491a428cfbec7a6c`, digest `e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87`. B : native 0.51.0, digest `c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7`. Les inventaires gelés contiennent 270 et 273 fichiers natifs.

A s'exécute dans `/workspace/sites/sra-lot4a-base79`; B dans `/workspace/sites/sra-lot4a-20261110/.sites-checkout`. Les anciennes durées ne fournissent aucun échantillon. Les cas, retours publics, outil de mesure et comparateurs sont conservés octet pour octet depuis le protocole précédent.

## Mesure et règle fixées avant exécution

Ordre A1/B1/B2/A2; STCK puis SMLP dans chaque série. Quatre sessions froides par jeu et série, soit huit par jeu et version, **32 sessions / 400 actions mesurées**. Huit chauffes séparées de trois actions, soit 24 actions, sont exclues conformément au protocole existant. Aucune session mesurée ni valeur extrême n'est exclue. Les deux cohortes seront terminées quel que soit le premier verdict. Tout incident restera conservé.

Le moteur calcule la commande avant de recevoir son retour public enregistré. Il n'est préinitialisé avec aucun trajet ni état appris. Les cas mesurent la boucle commune; ils ne démontrent pas la résolution live de ces jeux ni une contribution propre de Feedback.

Pour chaque jeu, réunir les huit sessions A et les huit sessions B, puis calculer `médiane(B)/médiane(A)-1`. L'augmentation doit être **strictement inférieure à 10 % pour chaque jeu**. Aucune compensation entre jeux ou somme de phases imbriquées. Les hausses par phase restent des diagnostics visibles lorsque ce critère global passe.

Mesures conservées : nouvelle décision, service/requête/garde de continuation, acquisition et persistance, persistance seule, restauration, Pause et mémoire. Le p95 empirique utilise `ceil(0.95*n)` uniquement avec au moins vingt échantillons; aucun p95 de session n'est annoncé sur huit sessions. Les mesures imbriquées ne s'additionnent pas et les observations d'une session sont corrélées.

## Intégrité et fenêtre exclusive

Les tests, builds, campagnes et contrôles navigateur doivent être terminés et le preview arrêté avant la fenêtre. Les agents du lot4A passent en lecture seule. Le verrou partagé `/workspace/shared/sra-coordination/performance.lock` est tenu pour les quatre séries; l'acquittement des autres fils et toute limite d'isolation sont consignés dans `readiness.json`. Le verrou coopératif seul ne prouve pas cet acquittement.

Les sources, outils, cas et politiques sont immuables pendant les mesures. Le wrapper contrôle leurs empreintes avant chaque série et après la dernière. Toute nouvelle correction exige un nouveau gel et une nouvelle fenêtre; les résultats antérieurs restent conservés.

Politique globale SHA-256 : `540d08e3c68cf2fa51705cab3cecfd2d6d3c14455602e43b8cb33a0afcfd5a83`.
Vérificateur global SHA-256 : `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940`.
Calculateur global conservé SHA-256 : `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341`.

Cette fenêtre exclut le rendu navigateur, le moteur du jeu et le réseau. Les tests et campagnes établissent leurs portées séparément. Elle ne prouve pas une stabilité sur plusieurs heures.
