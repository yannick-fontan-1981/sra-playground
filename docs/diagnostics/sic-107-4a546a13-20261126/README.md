# Campagne SIC des 107 jeux

Instantané généré le 2026-11-26T19:19:32.906288+00:00.

**État : `running` — 52/107 résultats reçus.**
Source figée : `4a546a139f9064422c078ef5f40b8c22133c39a8`. Périmètre : **107 jeux / 692 niveaux**.

**38 jeux ont tous leurs scores publics ; 38 ont aussi leur réconciliation finale attestée.**
Niveaux publiquement gagnés confirmés : **285/692** ; réconciliation attestée : **285**.
Commandes connues : **7252**, dont **7252** attribuées à SIC.

En attente : **55**. Manquants après clôture : **0**. Résultats avec incohérence : **0**.

Les scores acquis sont conservés en cas d'arrêt pendant la transition. `complete_unsettled` distingue une victoire publique complète d'une réconciliation finale non attestée.
Un jeu en attente n'est pas un échec. L'absence du reçu de fin maintient le statut en attente ; ce rapport ne sonde pas le processus.
Les erreurs du banc sont séparées des arrêts du solveur. Les résultats invalides ne contribuent pas aux totaux. Les compteurs absents restent inconnus et ne sont pas inventés.
Le contrôle de réconciliation repose sur les comptes rendus de l'enfant ; il ne remplace pas le contrôle détaillé des tickets de continuité.

Les plafonds sont comparés exactement à l'export du module de budgets inchangé : 432 niveaux avec temps mesuré, 57 avec temps estimé depuis les commandes, et 203 sans référence individuelle (repli : 80 commandes / 90 secondes). Un arrêt au repli ne suffit pas à identifier un défaut du solveur.

Compteurs de récupération connus : **0 réinitialisations**, **0 retours arrière**. Parmi les résultats valides reçus, 3 n'ont pas de compteur de réinitialisation et 3 n'ont pas de compteur de retour arrière.

## Catégories

| Catégorie | Jeux |
|---|---:|
| commands | 11 |
| complete | 38 |
| pending | 55 |
| time | 3 |

## Jeux incomplets et résultats à vérifier

Les coups et les temps de ce tableau concernent le niveau d'arrêt. Une transition interrompue conserve le score déjà acquis. L'allocation de réconciliation affichée est recalculée avec la règle du surveillant à partir des mesures arrondies ; elle est distincte du plafond jusqu'au score.
Les jeux encore en attente figurent dans le tableau exhaustif qui suit.

| Jeu | Niveau d'arrêt | Gagnés / cible | Coups du niveau / plafond du niveau | Temps observé / plafond | Motif |
|---|---|---:|---:|---|---|
| CASC | L4 | 3/6 | 25 / 25 | 17,951 / 25 s (mural) | Plafond de commandes du niveau atteint |
| CGWL | L5 | 4/6 | 71 / 74 | 45 / 45 s (mural) | Plafond de temps de résolution atteint |
| CLRS | L6 | 5/6 | 29 / 29 | 12,668 / 23 s (mural) | Plafond de commandes du niveau atteint |
| COLM | L2 | 1/6 | 34 / 34 | 13,068 / 24 s (mural) | Plafond de commandes du niveau atteint |
| CRAF | L6 | 5/6 | 33 / 33 | 18,933 / 324 s (mural) | Plafond de commandes du niveau atteint |
| CWSE | L3 | 2/6 | 80 / 80 | 44,615 / 90 s (mural) | Plafond de commandes du niveau atteint ; plafond de repli sans référence individuelle |
| DC22 | L6 | 5/6 | 271 / 271 | 299,524 / 455 s (mural) | Plafond de commandes du niveau atteint |
| ESCT | L2 | 1/6 | 22 / 22 | 8,743 / 12 s (mural) | Plafond de commandes du niveau atteint |
| ETAG | L4 | 3/6 | 80 / 80 | 71,97 / 90 s (mural) | Plafond de commandes du niveau atteint ; plafond de repli sans référence individuelle |
| FOGW | L2 | 1/6 | 19 / 19 | 5,981 / 9 s (mural) | Plafond de commandes du niveau atteint |
| GRAV | L5 | 4/6 | 28 / 28 | 13,19 / 23 s (mural) | Plafond de commandes du niveau atteint |
| GRIL | L2 | 1/6 | 10 / 10 | 3,37 / 8 s (mural) | Plafond de commandes du niveau atteint |
| LF52 | L6 | 5/10 | 97 / 110 | 76,001 / 76 s (mural) | Plafond de temps de résolution atteint |
| LKEY | L6 | 5/6 | 27 / 36 | 18,001 / 18 s (mural) | Plafond de temps de résolution atteint |

## Verdicts par jeu

| Jeu | Score public | Réconciliés | Verdict | Étape | Coups | Base du plafond | Raison brute |
|---|---:|---:|---|---|---:|---|---|
| AMZE | 6/6 | 6 | complete | — | 34 | no_level_reference | target_levels_completed |
| AR25 | 8/8 | 8 | complete | — | 255 | measured | target_levels_completed |
| AS66 | 9/9 | 9 | complete | — | 161 | measured | target_levels_completed |
| BP35 | 9/9 | 9 | complete | — | 397 | measured | target_levels_completed |
| CASC | 3/6 | 3 | commands | resolution | 69 | measured | level_action_budget |
| CATL | 6/6 | 6 | complete | — | 48 | measured | target_levels_completed |
| CATR | 6/6 | 6 | complete | — | 121 | no_level_reference | target_levels_completed |
| CAVA | 6/6 | 6 | complete | — | 83 | measured | target_levels_completed |
| CD82 | 6/6 | 6 | complete | — | 111 | no_level_reference | target_levels_completed |
| CGWL | 4/6 | 4 | time | resolution | 135 | measured | level_wall_time_budget |
| CLRS | 5/6 | 5 | commands | resolution | 89 | measured | level_action_budget |
| CN04 | 6/6 | 6 | complete | — | 240 | measured | target_levels_completed |
| COLM | 1/6 | 1 | commands | resolution | 51 | measured | level_action_budget |
| COMB | 6/6 | 6 | complete | — | 90 | measured | target_levels_completed |
| CONN | 6/6 | 6 | complete | — | 66 | no_level_reference | target_levels_completed |
| CRAF | 5/6 | 5 | commands | resolution | 125 | measured | level_action_budget |
| CWSE | 2/6 | 2 | commands | resolution | 89 | no_level_reference | level_action_budget |
| DAME | 6/6 | 6 | complete | — | 65 | measured | target_levels_completed |
| DC22 | 5/6 | 5 | commands | resolution | 643 | measured | level_action_budget |
| DICO | 6/6 | 6 | complete | — | 71 | no_level_reference | target_levels_completed |
| DNOI | 6/6 | 6 | complete | — | 59 | no_level_reference | target_levels_completed |
| ELAS | 6/6 | 6 | complete | — | 268 | measured | target_levels_completed |
| ESCT | 1/6 | 1 | commands | resolution | 38 | measured | level_action_budget |
| ETAG | 3/6 | 3 | commands | resolution | 220 | no_level_reference | level_action_budget |
| EVAS | 6/6 | 6 | complete | — | 86 | no_level_reference | target_levels_completed |
| FITE | 6/6 | 6 | complete | — | 64 | no_level_reference | target_levels_completed |
| FOGW | 1/6 | 1 | commands | resolution | 37 | measured | level_action_budget |
| FT09 | 6/6 | 6 | complete | — | 75 | measured | target_levels_completed |
| FUIT | 6/6 | 6 | complete | — | 190 | measured | target_levels_completed |
| G50T | 7/7 | 7 | complete | — | 301 | measured | target_levels_completed |
| GABA | 6/6 | 6 | complete | — | 447 | measured | target_levels_completed |
| GARE | 6/6 | 6 | complete | — | 56 | no_level_reference | target_levels_completed |
| GIGO | 6/6 | 6 | complete | — | 70 | measured | target_levels_completed |
| GLOB | 6/6 | 6 | complete | — | 79 | no_level_reference | target_levels_completed |
| GMAP | 6/6 | 6 | complete | — | 69 | measured | target_levels_completed |
| GORI | 6/6 | 6 | complete | — | 46 | measured | target_levels_completed |
| GRAV | 4/6 | 4 | commands | resolution | 85 | measured | level_action_budget |
| GRIL | 1/6 | 1 | commands | resolution | 15 | measured | level_action_budget |
| HANO | 4/4 | 4 | complete | — | 60 | no_level_reference | target_levels_completed |
| HOLE | 6/6 | 6 | complete | — | 83 | measured | target_levels_completed |
| HPDL | 6/6 | 6 | complete | — | 55 | measured | target_levels_completed |
| ISOS | 6/6 | 6 | complete | — | 49 | measured | target_levels_completed |
| KA59 | 7/7 | 7 | complete | — | 311 | measured | target_levels_completed |
| KATA | 6/6 | 6 | complete | — | 144 | measured | target_levels_completed |
| KEYD | 6/6 | 6 | complete | — | 153 | measured | target_levels_completed |
| KLOT | 6/6 | 6 | complete | — | 100 | measured | target_levels_completed |
| LF52 | 5/10 | 5 | time | resolution | 344 | measured | level_wall_time_budget |
| LIFE | 6/6 | 6 | complete | — | 139 | no_level_reference | target_levels_completed |
| LKEY | 5/6 | 5 | time | resolution | 115 | measured | level_wall_time_budget |
| LOGI | 6/6 | 6 | complete | — | 30 | no_level_reference | target_levels_completed |
| LP85 | 8/8 | 8 | complete | — | 189 | measured | target_levels_completed |
| LS19 | 8/8 | 8 | complete | — | 332 | measured | target_levels_completed |
| LS20 | —/7 | 0 | pending | — | — | — | — |
| M0R0 | —/6 | 0 | pending | — | — | — | — |
| MEMO | —/6 | 0 | pending | — | — | — | — |
| MIND | —/6 | 0 | pending | — | — | — | — |
| MOTO | —/6 | 0 | pending | — | — | — | — |
| ONDE | —/6 | 0 | pending | — | — | — | — |
| PIPE | —/6 | 0 | pending | — | — | — | — |
| POLA | —/6 | 0 | pending | — | — | — | — |
| PORT | —/6 | 0 | pending | — | — | — | — |
| PRTL | —/6 | 0 | pending | — | — | — | — |
| R11L | —/6 | 0 | pending | — | — | — | — |
| RE86 | —/8 | 0 | pending | — | — | — | — |
| RECR | —/6 | 0 | pending | — | — | — | — |
| REGN | —/6 | 0 | pending | — | — | — | — |
| REWI | —/6 | 0 | pending | — | — | — | — |
| RSWP | —/6 | 0 | pending | — | — | — | — |
| S5I5 | —/8 | 0 | pending | — | — | — | — |
| SB26 | —/8 | 0 | pending | — | — | — | — |
| SC25 | —/6 | 0 | pending | — | — | — | — |
| SELE | —/6 | 0 | pending | — | — | — | — |
| SEQN | —/6 | 0 | pending | — | — | — | — |
| SERI | —/6 | 0 | pending | — | — | — | — |
| SIGN | —/6 | 0 | pending | — | — | — | — |
| SK48 | —/8 | 0 | pending | — | — | — | — |
| SKBN | —/6 | 0 | pending | — | — | — | — |
| SMLP | —/6 | 0 | pending | — | — | — | — |
| SNAR | —/6 | 0 | pending | — | — | — | — |
| SP80 | —/6 | 0 | pending | — | — | — | — |
| SPOR | —/6 | 0 | pending | — | — | — | — |
| SS01 | —/8 | 0 | pending | — | — | — | — |
| SS02 | —/8 | 0 | pending | — | — | — | — |
| SS03 | —/8 | 0 | pending | — | — | — | — |
| SS04 | —/8 | 0 | pending | — | — | — | — |
| SS05 | —/8 | 0 | pending | — | — | — | — |
| SS06 | —/8 | 0 | pending | — | — | — | — |
| SS07 | —/8 | 0 | pending | — | — | — | — |
| STCK | —/6 | 0 | pending | — | — | — | — |
| SU15 | —/9 | 0 | pending | — | — | — | — |
| SWCH | —/6 | 0 | pending | — | — | — | — |
| SYME | —/6 | 0 | pending | — | — | — | — |
| TEQU | —/6 | 0 | pending | — | — | — | — |
| THER | —/6 | 0 | pending | — | — | — | — |
| TICT | —/6 | 0 | pending | — | — | — | — |
| TN36 | —/7 | 0 | pending | — | — | — | — |
| TR87 | —/6 | 0 | pending | — | — | — | — |
| TRCP | —/6 | 0 | pending | — | — | — | — |
| TRIA | —/6 | 0 | pending | — | — | — | — |
| TU93 | —/9 | 0 | pending | — | — | — | — |
| UPST | —/6 | 0 | pending | — | — | — | — |
| VALV | —/6 | 0 | pending | — | — | — | — |
| VC33 | —/7 | 0 | pending | — | — | — | — |
| VOIS | —/6 | 0 | pending | — | — | — | — |
| WA30 | —/9 | 0 | pending | — | — | — | — |
| WEAV | —/6 | 0 | pending | — | — | — | — |
| ZIPP | —/6 | 0 | pending | — | — | — | — |

## Mesures jusqu'au score

285 scores ont un temps disponible ; 0 scores n'en ont pas. Dépassement rapporté cumulé : **0 ms** ; maximum : **0 ms**.
Seul `scoredMs` est comparé au plafond de résolution. La durée totale et la réconciliation ne sont pas comparées à ce plafond. Les éventuels dépassements restent distincts du score public et du verdict brut ; les mesures arrondies et l'ordonnancement IPC devront être interprétés à l'audit final.

Aucun dépassement rapporté parmi les scores dont le temps est disponible.

## Contrôle et provenance

Couverture complète : **False**. Contrôles de cet instantané : **True**.
Les plafonds rapportés sont comparés, champs et sources compris, aux plafonds exportés par le module pur du SHA évalué.

Aucune incohérence détectée dans cet instantané.

Fichiers bruts : `manifest.json`, `expected-budgets.json`, `execution-start.json`, `execution-end.json` quand disponible, `results.jsonl` ou `results.jsonl.gz`.
Si le JSONL est absent, l'archive gzip est lue et décompressée en mémoire, sans créer de fichier brut. L'empreinte principale porte toujours sur les octets JSONL décompressés ; l'empreinte du conteneur compressé est conservée séparément.
Les empreintes des octets lus figurent dans `report.json`. Les fichiers bruts ne sont jamais modifiés par ce script.

Régénération légère, sans rejeu, depuis le dossier contenant ce rapport :

```bash
python summarize.py
```
