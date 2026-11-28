# AS66 · verdict des lignes 84 et 97

Les douze préfixes passent sur le candidat `484f3f0d066b7c00a3e2ad68c983ad556be3a3ac`, avec `8ce7ee35` et `d0e7527c` comme références. Critères préenregistrés à `7651ad0e`. Les deux parcours nominaux conservent leurs commandes, leurs offres et leurs paquets publics sur les trois versions. [Protocole et commande de rejeu](README.md)

| Ligne | Verdict | Contrôle discriminant |
|---|---|---|
| 84 · glissade vers la cavité | Le gel reproduit les sept tickets du catalogue. Le candidat rend l’offre statique substituable via `SlidingCavity.proposeAccess`. | N1/T5 prévoit l’arrêt (24,38) par `ACTION2`. Retirer l’offre au service donne `observed_frontier / ACTION3`, puis un nouvel accès au T6. L’autre contexte N2/T8 réutilise le même raccord avant la suite d’accès. |
| 97 · accès horlogé | Le gel fournit et consomme déjà l’offre retirable de `CavityClock.propose`. Le candidat conserve ce comportement. | Avec le même état avant N3/T14, les horizons 1 à 5 suspendent l’offre horlogée et 6 permet son plan complet. Le retrait de l’offre donne `observed_frontier / ACTION2`. Un plateau contraire présenté au retour scelle le préfixe et entraîne une nouvelle offre à l’indice 0. |

Le parcours sans plafond de session explicite joue six tickets de 97. Les cinq premiers retours confirment leur projection. Au T19, le jeu valide N3 et la comparaison du plateau retourne `matched:false`. Le catalogue avec plafond 16 s’arrête à deux niveaux.

## Empreintes vérifiées

La comparaison avec les quatre captures du Banc à `47ae8531` retrouve les mêmes empreintes SHA-256 sur le préfixe commun et les tickets consignés dans le reçu. [Références du Banc](https://github.com/yannick-fontan-1981/sra-playground/blob/47ae8531/docs/diagnostics/sic-preparation-as66-84-97.md)

| Paquets publics | SHA-256 |
|---|---|
| Liste des 13 empreintes communes | `e7458489594d540140f76e4c13118f8c10da6fc458f410c843444af8cb49aa5b` |
| Retour T14 sous plafond de 16 | `344cdb3f2444b9ee1e0f6db55b3e6a4a831b9512ae16ad9ffa13a5c33b724675` |
| Retour T14 sans plafond global explicite | `1dc11a1533eda22ef7319e24f5ae7152eef7196f953aa5837e849f0e20c52704` |

TypeScript, 80 tests natifs et les cinq contrôles indépendants de 83 avaient déjà réussi. La première exécution du contrôle 83 a nécessité de rétablir sa fixture secondaire dans le lanceur. Les cinq reçus de développement sont conservés dans `artifacts/qualification-as66-84-97/developpement/`.

Le reçu agrégé a été produit le 27 novembre 2026 à 22 h 05 min 46 s (UTC−3), après 17 min 48 s depuis le début du lot et 9 min 59 s pour le rejeu agrégé. Il est disponible dans `artifacts/qualification-as66-84-97/484f3f0d.json` et reproductible avec la commande du protocole. Son SHA-256 est `cb5d8439ecb85a2cba2eb5ec3eec4789359d5c1da8208d8311ea1bbf78514346`. Le rejeu agrégé a réussi dès son premier lancement.
