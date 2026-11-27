# Reprise Codex des corrections SIC

## Lot LF52, SK48 et ETAG

La PR142 a fusionné après 27 contrôles verts. Le merge synthétique `12e1403500b9bd6193dd7be015acbe37aaa48828` et le commit intégré `4313d7ce41505cece5f397dc8125b430697176ed` ont le même arbre `ed2a800a9727f4c6c4b8b46409f759f42126c47e`. Le strict combiné couvre les huit jeux du dernier lot et la continuité protège 162 niveaux de 25 jeux. Les deux workflows déclenchés sur main ont aussi réussi.

Le Site privé 210 est prêt et porte exactement `4313d7ce41505cece5f397dc8125b430697176ed`. Le build de production local au port 4173 et le Site ont chargé le même bundle `/assets/index-5nnSgotL.js`. Les reçus bruts des deux workflows, leurs empreintes et le reçu de publication sont conservés sur la branche [audit/sic-pr142-receipts-20261127](https://github.com/yannick-fontan-1981/sra-playground/tree/723b7781c374315aa6450a1739debbef876202cb/docs/diagnostics/sic-10-integration-20261127).

Les reprises du viewer depuis L1 dans une session SIC unique ont confirmé les victoires de SPOR (6/6, 121), DC22 (6/6, 630), WEAV (6/6, 199), LS20 (7/7, 393), LF52 (10/10, 713), SK48 (8/8, 348) et ETAG (6/6, 274). SPOR a été rejoué sur le Site 209. SK48 et ETAG ont été rejoués sur le Site 210. Les quatre autres jeux ont été rejoués sur le build local du Site 210. Les reçus détaillés sont sur [fix/sic-viewer-receipts](https://github.com/yannick-fontan-1981/sra-playground/tree/427bf97a6ba48472205a6ba121db0dee09da1503/docs/diagnostics/sic-first-lot-viewer-20261127).

## SNAR et WA30

SNAR a gagné strictement 6/6 sur `9756ab4e79612c8be8615f6629edc5c14b4687cf` dans le [run 46027386793](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46027386793). Les commandes par niveau sont 16, 24, 23, 36, 35 et 29. Le niveau 6 compte 13 719 ms actifs sur son plafond de 17 000 ms. Le candidat conserve un premier pas expérimental et n'autorise son suffixe que si le retour public confirme la position et les prémisses de la sortie. La qualification combinée et le contrôle physique restent à confirmer à ce checkpoint.

WA30 a gagné 8/9 sur `90fb06f44016a1a60ecacf888086de1a69873783` dans le [run 46024175969](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46024175969). Le niveau 9 s'arrête après 41 commandes au plafond de 51 secondes. Le [diagnostic public 46025848752](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46025848752) localise la première perte de la lecture de caisse à la révision 550. Un porteur déjà observé se lie à une caisse fixe, dont la bordure de contact n'entre plus dans le décompte des caisses au repos.
