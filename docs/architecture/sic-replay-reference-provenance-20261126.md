# Références archivées pour la reprise SIC du 26 novembre 2026

Le fichier [sic-replay-reference-levels-20261126.json](sic-replay-reference-levels-20261126.json) contient des **références de victoires**, que `scripts/sic-replay-budgets.mjs` transforme en plafonds. Il ne contient ni commandes témoins ni observations destinées au solveur. Aucun code du runner, aucune formule de marge et aucun budget de production ne sont modifiés par cet archivage.

## Provenance et périmètre

Les données ont été retrouvées dans les sources réunissant `main` après SS23 (`7ba57180`) et la branche SIC `19a82e7afb4bcac034de9a7f16b643153b1c00ac`. Ce fichier reconstitue des références disponibles dans le dépôt. Il **ne prétend pas reproduire à l'identique le fichier temporaire de la campagne Windows des 107 jeux**, qui n'a pas été retrouvé. Les 12 verdicts, 7 jeux gagnés et 69 niveaux cités dans le journal de cette campagne ne constituent pas des résultats de la nouvelle reprise.

La collection décrite ici comprend les 100 jeux source et SS01–SS07, soit 107 jeux et 692 emplacements de niveau. Le choix de cette cohorte est explicite ; la continuation ne doit pas inclure automatiquement les autres jeux Custom 4.

| Lot de références | Entrées | Source et traitement |
|---|---:|---|
| Victoires archivées au commit `7bb9f152` | 326 | `sic-v8-level6-campaign-7bb9f152.json`, uniquement `cases` et `control`, uniquement les lignes `won: true`. Actions et temps en millisecondes recopiés sans ajustement. Cela préserve exactement les références que le runner charge par défaut. |
| Niveaux 6–10 qualifiés ensuite | 104 | Paragraphes de victoire de `sic-v8-validation.md` antérieurs au jalon `sic-v8-636-levels`. Le champ `source` donne le titre exact. Les durées en secondes sont converties en millisecondes. DC22 L6 conserve la mesure de campagne déjà archivée (336 324 ms), et non le rejeu distinct à 241,62 s. |
| CRAF L6 | 1 | Paragraphe « CRAF gagne les six niveaux en 106 clics » : 27 clics et 239,98 s pour L6. |
| AS66 L6 | 1 | La section « AS66 niveau 7 » atteste 565 commandes pour L1–L6. Elle atteste aussi 532 commandes dont 453 au L6 lors du passage interrompu : le préfixe L1–L5 vaut donc 79, et le L6 gagné 565 − 79 = 486. Aucun temps propre à ce niveau n'est inventé. |
| MOTO L6 | 1 | Section « MOTO niveau 6, réutiliser les trajectoires élémentaires » : 19 commandes dans un rejeu chronologique gagnant. La durée seulement approximative (« environ 19 secondes ») est omise. |
| SS01–SS05, hors SS02 L7–L8 | 38 | Tableau de continuité réussie dans `docs/migration/ss22-evidence/sic-continuity.txt`. Comptes réellement exécutés ; aucune durée n'y est disponible. |
| SS02 L7–L8 | 2 | Section « Indexer les postures de poussée » : 54 et 84 commandes. L8 dispose d'une mesure de 46,4 s, réconciliation comprise, obtenue dans le diagnostic déclaré à 81 s. |
| SS06–SS07 | 16 | Parcours d'auteur validés dans `experiments/sinking-star-ss0{6,7}/validation/levels-report.json`, avec `solved: true`. Le compte correspond à la longueur du témoin associé dans `tests/witnesses.json`. Chaque référence est marquée `author_oracle`, porte le hash du témoin et ne fournit aucun temps SIC. |

**Bilan de l'archive : 489 références, dont 432 avec un temps mesuré et 57 avec le nombre de commandes seul.** Les 433 références source comprennent 108 des 137 emplacements L6–L10. Les 56 niveaux SS01–SS07 possèdent un compte attesté, dont 16 comptes d'oracles d'auteur.

## Absences conservées

203 emplacements source restent `null` : 174 parmi L1–L5 et 29 au L6. `null` conserve le repli du runner sur son archive, puis son défaut de 80 commandes / 90 secondes si aucune référence n'existe. Une absence de nombre ne signifie pas que le niveau n'a jamais été gagné ; elle signifie qu'aucun compte admissible n'a été retrouvé dans les sources retenues ici.

Jeux sans référence individuelle L1–L5 dans cette reconstruction :

AMZE, AS66, CATR, CD82, CONN, CRAF, CWSE, DICO, DNOI, ETAG, EVAS, FITE, GARE, GLOB, HANO, HPDL, LIFE, LOGI, MOTO, ONDE, PIPE, RECR, REGN, REWI, SB26, SELE, SEQN, SERI, SKBN, SYME, TEQU, THER, TICT, TRCP, ZIPP.

Niveaux 6 sans référence individuelle reconstruite :

AMZE, CATR, CD82, CONN, CWSE, DICO, DNOI, ETAG, EVAS, FITE, GARE, GLOB, LIFE, LOGI, ONDE, PIPE, RECR, REGN, REWI, SB26, SELE, SEQN, SERI, SKBN, SYME, TEQU, THER, TICT, ZIPP.

Tous les emplacements L7–L10 du catalogue source disposent ici d'une référence documentée. HANO compte quatre niveaux ; aucun faux L6 n'est créé.

## Utilisation

Depuis la racine du dépôt :

```bash
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs GABA 6 /chemin/absolu/gaba-bounded.jsonl 1 sic
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs SIGN 6 /chemin/absolu/sign-bounded.jsonl 1 sic
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs WA30 9 /chemin/absolu/wa30-bounded.jsonl 1 sic
```

Le nombre `1` fixe le nombre de workers budgétaires ; ces commandes s'exécutent séparément. La cible `auto` permet une campagne complète avec les codes explicitement choisis. Un nouveau fichier de sortie évite de mélanger des résultats de commits différents ; le runner ajoute les résultats au fichier existant.

### Plafonds reproduits pour les reprises prioritaires

Les plafonds suivants sont calculés par la formule existante : marge d'actions de 20 % bornée entre 5 et 30, marge temporelle de 35 % avec au moins cinq secondes, arrondi temporel à la seconde supérieure.

| Jeu | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 |
|---|---|---|---|---|---|---|---|---|---|
| GABA : commandes / secondes | 57 / 20 | 45 / 16 | 81 / 23 | 106 / 36 | 128 / 50 | 120 / 37 | — | — | — |
| SIGN : commandes / secondes | 20 / 19 | 58 / 59 | 68 / 82 | 27 / 32 | 64 / 75 | 98 / 88 | — | — | — |
| WA30 : commandes / secondes | 32 / 18 | 64 / 46 | 92 / 41 | 58 / 30 | 136 / 61 | 58 / 21 | 51 / 22 | 166 / 103 | 80 / 51 |

Ces lignes reproduisent les plafonds GABA L2/L5/L6, SIGN L3/L6 et WA30 L5 explicitement mentionnés dans les journaux précédents. Elles ne suffisent pas à établir la parité des 107 anciens plafonds, puisque le fichier de références de cette ancienne campagne reste absent.

### Chronométrage et preuve des commandes

`check-sic-chronological.mjs` applique un surveillant externe et conserve les scores publics, les temps jusqu'au score et de réconciliation, les empreintes des commandes/retours, les effets et les séries. Il ne fournit pas les tickets détaillés de continuité. Pour les tickets acquittés par le moteur et leurs clôtures, le contrôle séparé est :

```bash
SIC_STUDY_SOLVER=sic SIC_STUDY_WORKERS=1 SIC_STUDY_CONTINUITY=1 SIC_STUDY_RECORD_COMMANDS=1 node scripts/compare-source100.mjs . . /chemin/absolu/gaba-tickets.jsonl source:GABA 1 6 128
npm run test:sic-continuity
```

Ce second banc utilise son propre budget. Son succès valide la continuité et les effets physiques ; il ne prouve pas le respect des plafonds chronométriques ci-dessus. L'enregistrement observe les tickets après `advance` et les commandes publiques réellement appliquées ; il ne remplace aucune décision de SIC.

La continuité complète de la branche récupérée couvre 71 niveaux : SS01–SS07 L1–L8, SIGN et GABA L1–L6, AR25/HANO/DC22 L1. Ses campagnes sont séquentielles. Aucune durée complète récente n'a été retrouvée dans le dépôt.

## Empreintes des sources lues

Ces empreintes identifient les octets utilisés pour la reconstruction. Elles ne sont pas des résultats de nouveaux rejeux.

| Source | SHA-256 |
|---|---|
| `docs/architecture/sic-v8-level6-campaign-7bb9f152.json` | `18cafd4d8b6a9a29c18f5e07ab1d1e63b74e53b1c0fc605f6dbbd390aae7efcc` |
| `docs/architecture/sic-v8-validation.md` | `e84f1ce56ca3433f17bc7f8b64b20cbcdb29f9a85461b3b773408eedc564b9cc` |
| `docs/architecture/sic-v8-reference-levels.md` | `723dcae48e22f2b1738ba85035201d8c74695db5136ac2947201086bc488a9c8` |
| `docs/migration/ss22-evidence/sic-continuity.txt` | `07a5cee1369fd05c0eaa9f5e8967ea06dffe9fb7f0996c2fd145dcdc82683764` |
| `experiments/sinking-star-ss06/validation/levels-report.json` | `1cfe20da4ef4f7dda5cac90fd7f087f0e778bcecea70b1e5d194a02a345176dd` |
| `experiments/sinking-star-ss06/tests/witnesses.json` | `3291f3273b161b91f5d55d40c905d934ed284647df8e19d118874ab97e25f79e` |
| `experiments/sinking-star-ss07/validation/levels-report.json` | `ce778d62cf1083094d10dca6b3430a4c36217f993f557a6eb00ca70a9f143541` |
| `experiments/sinking-star-ss07/tests/witnesses.json` | `8c663c72fe90e93fcea75102cd53e9c78f6c964e9fcdabc450b1ed745195c72e` |
