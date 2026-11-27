# DICO · qualification de la ligne 98

**Le candidat `e21781637371b846c60aa50de5ff080c136c9abf` conserve le classement nominal et le vrai ticket d’ouverture.** Son parent Git immédiat est le préenregistrement `798a804821603bed2cb109dc5bdab1df0dd10377`, issu du candidat 87 `c0b9f4027f1df257d7b8c96f5656f9dbb83661f0`. Le banc a rejoué la série sur la source d’inventaire `8ce7ee35`, le gel `d0e7527c`, le parent fonctionnel 87 et le candidat 98. Les deux rapports actifs, capturés indépendamment sur le parent et le candidat, sont égaux dans leur intégralité. L’archive conserve la population et l’ordre des offres. [Harnais et préenregistrement](https://github.com/yannick-fontan-1981/sra-playground/tree/e21781637371b846c60aa50de5ff080c136c9abf/experiments/sic-agenda-offres/ouverture-98)

| Départ et sélection | Ticket du vrai service | Retour |
|---|---|---|
| DICO L1, curiosité active, ordre nominal | 147 offres. Quatre atteignent le maximum de 12 relations, dans l’ordre (25,36), (32,35), (37,24), (37,36). Le garde admet le clic (25,36). | Le jeu termine L1. Le reçu de la question conserve `matched=null`. |
| Même ensemble, autre départage dans le harnais de la branche | (37,36), après renversement de l’ordre de départage. Le sceau des offres avant le choix est identique au nominal, `8f73d9b44d0d0546e818542e94876cdcd848a0d6ac0114152b3a548e7498aedf`. | Retour lié au ticket de cette question. Le jeu reste en L1. |
| Même ensemble, épreuve séparée de l’opérateur | (32,35), après permutation des deux premiers maxima à l’entrée du sélecteur. | Le jeu reste également en L1. Cette seconde intervention est publiée par l’opérateur. |
| DICO L2, après l’ouverture nominale victorieuse | 228 offres, deux maxima de 13 relations. Le service choisit (13,12). | Un niveau accompli, L2 se poursuit. |

L’absence d’option et le mode d’observation `shadow` conservent le clic initial (1,3). Le contrôle MEMO et sept décisions de fixture concordent entre les révisions. Les deux tickets alternatifs documentent des interventions distinctes sur la même égalité de classement. [Épreuve opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/71b861a935411e50471118fd1f4208c00bbc73d9/experiments/symbolic-situations/dico-ligne-98/BILAN.md) · [Index et classements](sic-dico-ligne-98/banc.json)

**Régression de la ligne 87 contrôlée sur le SHA 98.** Son vérificateur a été rejoué avec les mêmes entrées. Les décisions et retours des deux modes et le ticket de l’autre optimum sont identiques aux pièces publiées sur `c0b9f402`. La requête de portée de ligne 87 survient au T4 du départ catalogue. L’ouverture de ligne 98 survient au T1 du départ à curiosité active. Ces preuves concernent la branche 98. La référence de coexistence `1afdede0` comprend le raccord de la ligne 87. [Qualification de la ligne 87](sic-qualification-dico-c0b9f402.md)

### Reproduire

Depuis un checkout propre de `e2178163`, avec accès aux objets Git des références et à Node 24.22.3, utiliser les dépendances verrouillées du projet.

```powershell
npm ci
node scripts/prepare-python.mjs
node experiments/sic-agenda-offres/ouverture-98/verifier.mjs --pyodide ./public/vendor/pyodide --recu ./controle-98.json
node experiments/sic-agenda-offres/dico-87/verifier.mjs --pyodide ./public/vendor/pyodide --recu ./regression-87.json
```

Les deux départs nominaux, l’autre départage à (37,36) et les deux reçus de vérification sont archivés, SHA-256 `144fb42c5d45e268dbbc74914265b12afe6a01b6a5e80199adbad1b85cd299ec`. Les originaux locaux se trouvent dans `artifacts/qualification-dico-e2178163/`. [Archive](sic-dico-ligne-98/recus.zip)
