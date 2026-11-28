# FT09/94, qualification locale du gel

Le parcours catalogue `8ce7ee35` et le gel `d0e7527c` ont livré le même reçu sur les 16 gestes. Le préenregistrement est `ae88904c` et le harnais vérifié est `d0348ec1f1646259b9c95f0fa4a44dd0bb966025`. Six préfixes natifs et les quatre tests de parité de champ ont passé. Du début du lot à l'écriture du reçu, 7 min 50 s. Les contrôles en développement ont précédé cette passe agrégée, qui a réussi au premier lancement.

| Parcours | Décision et résultat |
| --- | --- |
| N1/T1 | `window_constraints / multiscale_constraints / public_window_constraint`, `OP18`, `ACTION6(38,38)`. Quatre fenêtres ajustent une règle 3 × 3, 28/32 en validation par retrait contre 20/32 pour la constante. Sur les 32 contraintes, quatre violations. La cellule (36,36), de taille 6 × 6, vaut 9 et doit égaler la référence 8 de (44,44). Le retour montre 9 → 8, sans prédiction, et scelle la question. Une référence d'observation périmée est refusée. |
| N1/T2–T4 | T2 observe la même réécriture en (36,44). T3 avant exécution prédit 8 sur un troisième site, confirmée. T4 franchit la limite officielle au dernier geste du paquet, avec `matched:null`. |
| Une seule fenêtre fournie à l'ajustement | Même observation et mêmes commandes. La règle devient indéterminée, aucune offre de la famille. Le parcours se replie sur un clic de frontière en (12,10) et la famille reprend ensuite. |
| Premier point retiré | Même règle et mêmes quatre violations, sélection et garde du prochain point (38,46). La réécriture arrive sur ce site. |
| Retour stationnaire construit | Le paquet construit ne permet aucune réécriture locale unique. (36,36) est écarté et (38,46) devient la prochaine question. |
| Un seul effet acquis fourni au T3 | Commande, règle et vrai paquet restent identiques. Avec une seule réécriture distincte en entrée, la valeur prédite reste inconnue. L'exécution devient une question locale scellée. |

Le gel consomme déjà une contrainte réutilisable et une garde liée au point courant, puis le retour fait passer la question à une prévision exploitable. Le harnais ajoute la preuve causale. Aucune modification de production.

**HPDL/75 et FT09/94.** Le reçu HPDL vérifié et les tickets FT09 montrent le même contrat natif `OP18`, but officiel, point lié à l'observation courante et premier retour scellé avec `matched:null`. HPDL réutilise une méthode signée, une géométrie courante et une couverture conditionnelle du mot. FT09 ajuste une règle empirique sur plusieurs fenêtres, teste une violation et apprend une valeur d'effet à partir de deux sites distincts. Dans ce couple le besoin local et les calculs diffèrent. Les producteurs de mesures restent propres à chaque famille.

Rejeu et variantes dans [README.md](README.md). Reçu local `artifacts/qualification-ft09-94/d0348ec1.json`, SHA-256 `0f18c1a0608b4c4292c875d04c4553bd5d917154126f1f990cd5bc3c06cd3f80`.
