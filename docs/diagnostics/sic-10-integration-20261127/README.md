# Intégration des dix jeux restants — 27 novembre 2026

## Point de reprise

Huit des dix jeux ont un rejeu strict complet depuis L1, avec un worker, sans reset ni undo, sous les plafonds originaux. Cela ne constitue pas encore une nouvelle campagne complète des 107 jeux ni une livraison des huit corrections.

| Jeu | Niveaux | Commandes | Point de reprise local |
|---|---:|---:|---|
| CGWL | 6/6 | 167 | 50dcefe1 |
| DC22 | 6/6 | 630 | 9f38612e |
| GRAV | 6/6 | 80 | 9f38612e |
| SPOR | 6/6 | 121 | f95e3d66 |
| WEAV | 6/6 | 199 | f95e3d66 |
| LF52 | 10/10 | 713 | 6cd93391 |
| SK48 | 8/8 | 348 | dd683bd3 |
| ETAG | 6/6 | 274 | e531143b |
| SNAR | 5/6 | 134 avant L6 | d5ff51c4 ; candidat 81084152 en cours |
| WA30 | 7/9 | 412 avant L8 | 3872019d ; arrêt L8 à 134 commandes / 103 s |

Les sources individuelles exactes, commandes par niveau et empreintes sont dans leurs archives spécialisées. Les cinq premières lignes ont également passé un strict sur l'arbre combiné du premier lot, `a15057faf6964fd0095e7feb4b140368957a418e`, avec les mêmes comptes.

## Premier lot — PR141

Les reçus sous `pr141-8cd13f73/` proviennent des workflows GitHub 46010805058 (strict) et 46010805381 (continuité). Les 24 jobs ont réussi. Les 21 cohortes protègent 138 niveaux ; SPOR reste unitaire et est protégé par le strict complet et ses contrats natifs, sans série physique inventée.

La source effectivement testée est le merge synthétique `8cd13f7394706c0087c0afa60e802c024701a443` (tête `d55a773c318155641bf2ad56e750b4622edbf142`, base `5b14136d237af3e5715436c555688802b581fad4`). `receipt-index.json` lie chaque fichier brut à son SHA-256 ; les archives gzip préservent exactement les octets téléchargés.

GitHub a refusé la fusion avec « Required status check: Executed series and final reconciliation is expected » alors que les 24 checks étaient verts et la branche indiquée derrière main. La branche a été actualisée normalement sur main : local `b7b5a8953129986d747b9ca60a44f731bad6bd72`, GitHub `c0d730c7f8f13611960bed16b3a89083e9f9a0c9`, même arbre `a15057fa`. Les workflows 46013961863 et 46013962237 revalident cette tête. Aucune règle de protection n'a été modifiée ou contournée. Le premier lot n'est pas encore fusionné à ce checkpoint.

## Deuxième lot — branche d'intégration

La branche `fix/sic-10-qualified-batch2-20261127` réunit les corrections de LF52, SK48 et ETAG sur le premier lot et main. Les collecteurs sont additionnés : aucun des collecteurs précédents n'est remplacé. La déduplication des contextes de passage ETAG inclut maintenant leur scope ; le strict e531 reste identifié comme antérieur à cette correction et la CI combinée devra rejouer la nouvelle source.

Les 64 tests ciblés de ces trois rôles et TypeScript passent ensemble. Le contrat LF52 et le gate intégral vérifient ses dix niveaux et portent le périmètre à 148 niveaux. Le contrôle déterministe accepte les 138 niveaux des reçus CI du premier lot et les dix niveaux du strict passif LF52. Pour ce dernier, seules les clés de premier niveau sont adaptées (`mode`→`solver`, `actions`→`issued`, `authority`→`sic`, `levelStats`→`levels`) ; les tickets, positions, acquisitions, hashes et observations sont conservés. Aucun effet ou hash manquant n'est reconstruit. La prochaine CI collecte le schéma normal sur la nouvelle source combinée.

SK48 et ETAG ont leurs preuves strictes et leurs scénarios natifs variés ; leurs collectes physiques complètes et seuils par niveau sont en attente. SNAR et WA30 restent à compléter. Aucun des budgets chronologiques n'est relevé.

## Publication

Au checkpoint, main et le Site208 portent `5b14136d237af3e5715436c555688802b581fad4`. Les modifications indépendantes de citation et carrousel sont conservées. Les prochains lots doivent être fusionnés, publiés avec leur SHA exact, puis reproduits depuis L1 dans le viewer avant d'être marqués livrés. LS20, déjà fusionné/publié, attend aussi son reçu viewer.

## Mise à jour après fusion du premier lot

PR141 a finalement fusionné normalement, après les **24 checks verts** de la tête actualisée `c0d730c7`, au commit main **`052d82dec4e92f4eef5fa90ab0c2a7fd3a5125da`**. La version Site **209** est publiée, statut `succeeded/ready`, avec exactement ce SHA. Le fichier `site209-delivery.json` conserve les identités des contrôles et de publication. La vérification viewer de ces cinq jeux et LS20 est en cours ; elle n'est pas encore comptée comme livrée.

La branche d'intégration suivante a incorporé ce main. Ses **162 niveaux** de contrats passent sur les reçus physiques conservés : 138 du premier lot, LF52 (10), SK48 (8), ETAG (6). Les 38 tests de contrat de ces trois ajouts passent ensemble. La prochaine CI rejouera leurs parties sur la source combinée ; les archives actuelles restent liées à leurs sources individuelles. SK48 reproduit348 commandes et ETAG274 avec leurs observations passives ; ETAG conserve aussi exactement la trace complète du strict après sa correction de scope.

Le workflow strict inclut maintenant les huit jeux qualifiés. Son délai global passe à45 minutes pour la cohorte séquentielle élargie ; les limites de commandes et de temps de chaque niveau restent les limites originales. SNAR demeure5/6 et WA30 est en cours de nouveau rejeu ; leurs niveaux finaux ne sont pas ajoutés avant qualification.
