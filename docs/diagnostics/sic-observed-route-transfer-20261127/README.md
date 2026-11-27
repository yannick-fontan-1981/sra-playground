# Continuer le rôle de route acquis — ESCT, 27 novembre 2026

**ESCT gagne ses six niveaux dans le rejeu strict : 118 commandes SIC, 118 acquisitions et aucun reset ni undo.** Le score du niveau 6 arrive à **17,139 secondes sous son plafond inchangé de 18 secondes**. Un second passage, avec le collecteur standard passif, reproduit les 118 commandes et la même empreinte finale de trajectoire ; il conserve les tickets, les retours et les clôtures nécessaires au contrat de continuité.

Ces preuves qualifient les sources ci-dessous. L'intégration commune, la CI complète et le viewer publié restent des étapes distinctes ; aucune victoire sur une version livrée n'est revendiquée dans cette archive.

## Première décision fautive et rôle conservé

Le témoin de la campagne `4a546a13` gagne le premier niveau puis atteint le plafond de 22 commandes du niveau 2. La capture publique `ee9dad5f8773fed3ed507ad3c575181deae5f754` conserve le premier geste fautif : au global 17, premier geste du niveau 2, `sic_test_prepared_effects` choisit `ACTION4`. Le rôle `sic_intervene_on_observed_route` est pourtant présent. L'ouverture du cadre, le virage du corps marqué et le score officiel du niveau 1 ont établi ses rôles. Sa dernière référence est l'observation courante ; son époque et son score correspondent à l'arrivée. Le geste de prévisualisation perd le repère du corps marqué.

La première correction ajoute une entrée dans le groupe de continuation, après les propriétaires existants. Elle exige les références courantes du même scope, le même score et la même époque, une grille unique re-mesurée, un curseur et un porteur uniques, et un repère propre non ambigu. Elle appelle ensuite la proposition existante. Le chemin d'acquisition reste disponible et aucune vérification de route n'est inventée. Une contradiction retire l'admission précoce et conserve les rôles et leurs preuves.

`first-decision.public.json.gz` conserve le choix fautif, les rasters, la proposition, la sélection et le rôle présent. Les caches géométriques dérivés et les états des familles sans rapport sont omis. La capture ultérieure depuis L1 confirme réellement le premier retour corrigé du niveau 2 : `ACTION1`, curseur 65→53, porteur 13→25, puis acquisition confirmée. Ces positions sont mesurées dans les images avec la géométrie observée ; `roundtrip-first-loss.public.json.gz` les conserve.

## Restitution de la grille et préparation de l'ouverture

Au niveau 6, la même capture localise un second refus au geste 8, global 101, après une ouverture confirmée. Le rôle, le score, la dernière référence et `lastMatched=true` sont présents. Le stockage natif a trié les clés de la grille ; la nouvelle mesure a les mêmes valeurs dans un ordre d'insertion différent. La comparaison par sérialisation échouait malgré cette identité. La seconde correction compare toutes les bornes et tous les champs de la grille, indépendamment de l'ordre des clés. Les deux scénarios natifs vérifient aussi la reprise après clôture et restitution de la mémoire.

Après cette correction, toutes les dernières décisions restent au rôle route, mais le niveau 6 s'arrête encore au budget de temps. Le prochain point est borné par les retours publics : après le premier déplacement autonome du porteur, cinq déplacements déjà calculés du curseur visent le même mur adjacent au porteur immobile, puis le premier contact d'ouverture. La troisième correction conserve ces préparations dans une série. Le premier mouvement autonome reste unitaire et la série s'arrête au premier contact. À chaque retour, les gardes re-mesurent le curseur, le porteur, le repère absent, le mur et les rivaux libres susceptibles d'entrer dans l'ouverture ou son voisinage. Le record final acquiert les gestes réels dans leur ordre, sous une seule clôture.

## Scénarios natifs et contre-exemples

Les **18 tests de rôle et de continuité** passent, ainsi que le contrôle TypeScript. Deux transferts acquièrent le rôle nativement depuis les retours publics des premiers niveaux, utilisent l'ordre réel des groupes et poursuivent après restitution. La variante change la palette, la silhouette du porteur, les positions des cellules et les directions utilisées. Les retours des successeurs construits sont explicitement étiquetés comme scénarios fonctionnels ; ils ne constituent pas une mesure de temps du jeu. Les fixtures conservent les observations publiques qui servent à les construire.

Les refus couvrent les rôles absents, les preuves périmées ou étrangères, les acteurs et repères ambigus, le déplacement inattendu du porteur, l'apparition d'un repère, le mur disparu, une commande manquante et une menace rivale. Les tests passifs et contractuels ajoutent la preuve future, le mauvais frame, le découpage en décisions unitaires, l'occlusion inconnue du mur, l'absence d'acquisition et la double clôture. **63 tests passifs et contractuels partagés** passent dans la validation finale de ce lot ; cela ne remplace pas la campagne complète de continuité.

## Rejeu strict final

Une seule session SIC depuis L1, un worker, références archivées et plafonds inchangés, source propre et figée. Début **03:26:31 UTC**, fin **03:27:41 UTC**. Les six lignes du miroir `.levels` correspondent aux six entrées de `levelStats`.

| Niveau | Résultat | Commandes / plafond | Score / plafond de temps | Acquisitions cumulées |
|---|---|---:|---:|---:|
| 1 | Gagné | 16 / 21 | 5,927 s / 14 s | 16 |
| 2 | Gagné | 17 / 22 | 6,018 s / 12 s | 33 |
| 3 | Gagné | 21 / 26 | 9,322 s / 15 s | 54 |
| 4 | Gagné | 22 / 27 | 13,163 s / 16 s | 76 |
| 5 | Gagné | 17 / 22 | 10,302 s / 14 s | 93 |
| 6 | Gagné | 25 / 30 | 17,139 s / 18 s | 118 |

Les 118 commandes sont autorisées par SIC et ont leurs 118 effets archivés. Le dernier niveau est aussi entièrement réconcilié : son temps total est de 17,932 secondes, dont le score à 17,139 secondes. Les compteurs de récupération sont explicitement `reset=0`, `undo=0`. Les cinq premières empreintes gagnantes sont identiques aux deux stricts intermédiaires. L'empreinte finale est `59f699cae3803de03a511ccd66d05bc71ae5df61e2dcdcfb7e869ab0b8f06ef8`.

```sh
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs ESCT auto RESULTATS.jsonl 1
```

Les octets stricts originaux sont conservés dans `opening-strict-results.jsonl.gz` et `opening-strict-results.levels.jsonl.gz`, avec le manifeste de source et la fin d'exécution.

## Tickets et physique effectivement exécutés

Le collecteur standard, source `31856be8`, part également de L1 en SIC avec un worker. Il gagne les six niveaux en **16, 17, 21, 22, 17 et 25 commandes**, sans reset, et produit la même empreinte complète que le strict. Les 118 tickets portent exactement un retour natif, **109 décisions sont clôturées une fois**, et les sommes de leurs préfixes acquis couvrent les 118 commandes. Les séries ont les longueurs 2, 4 et 6 ; la série de longueur 2 du premier niveau appartient au rôle de cadre déjà existant.

| Niveau | Série du rôle route | Mesures publiques | Acquisition finale |
|---|---|---|---|
| 3 | 3 déplacements puis 1 contact | Le curseur se déplace vers le même mur ; le même porteur reste immobile ; le mur disparaît au contact | 4 retours, ouverture confirmée, preuves antérieures conservées |
| 6 | 5 déplacements puis 1 contact | Les cinq poses du curseur et le même porteur sont re-mesurés ; le mur est présent avant le contact puis absent | 6 retours, ouverture confirmée, preuves antérieures conservées |

Le collecteur copie les rôles avant le dispatch, mesure les deux vraies grilles et lit l'état acquis seulement après la clôture native. Les positions anticipées ne sont pas utilisées comme preuve physique. Un acteur absent ou ambigu, une frontière de niveau et un mur masqué par un occupant inconnu restent inconnus. La preuve d'ouverture accepte seulement le fond entièrement visible, ou le motif acquis du repère du porteur avec le reste libre. Les références sont reliées au plan, à l'index, au scope, à l'époque, aux révisions et aux hashes des frames exécutés.

Le contrat exige ces préparations aux niveaux 3 et 6, contrôle les plafonds individuels inchangés et autorise les décisions unitaires des autres niveaux. Les compteurs sont calibrés uniquement sur les tickets exécutés. Le collecteur emploie le maximum de commandes 30, puis le contrat contrôle chaque plafond individuel ; **ce passage passif n'est pas une qualification chronométrique**. Les temps qualifiés proviennent du strict séparé.

## Historique des deux stricts incomplets

Les premiers rapports restent archivés sans effacer leurs valeurs inconnues.

| Source GitHub | Résultat | Dernier arrêt | Données après l'arrêt dur |
|---|---|---|---|
| `11634ac4` | 5/6, 118 commandes SIC | L6 : 25 commandes, 18,001 s, aucun score | Acquisitions des 25 dernières commandes, récupérations et réconciliation finale inconnues |
| `3d46bb50` | 5/6, 117 commandes SIC | L6 : 24 commandes, 18,000 s, aucun score | Acquisitions finales et récupérations inconnues |

Dans les deux cas, les cinq niveaux gagnés totalisent 93 acquisitions confirmées. Les fichiers `report.json`, `roundtrip-report.json` et leurs bruts distinguent ces verdicts du résultat final. La capture diagnostique s'arrête volontairement après le premier geste d'une autre famille au niveau cible : son `canDispatch=false` donne un statut `error` dans BrowserV6Agent. Il s'agit d'une coupure diagnostique explicitement étiquetée, sans être comptée comme un verdict de campagne.

## Sources et sauvegarde

| Objet | Commit local | Commit GitHub vérifié | Arbre identique |
|---|---|---|---|
| Production ESCT du strict final | `e571f2a97c7a5db23d27f40c929ec3765f928498` | `6617b4b3835062bb44d551143fc248aff8f232bd` | `eb0e7c60164e9dd96abfaa20afdad1f98b4d0b08` |
| Collecteur passif avec main livré | `a4b9450efc60b9ff9745b505a9c9e2cfa3ea6748` | `31856be8435d9ad6cdff7c19c19fd9e8d8766efb` | `24d7d62771829e6021efb3e68554434d8160214a` |
| Contrat calibré et raccord PORT | `49aa4778bcad56b1d794725f69cedd2ea03951b3` | `cadd7e4e9341d6146cec0fb963cc818c77856dd6` | `606818870e30721f2c971580971713695814e4da` |

Le collecteur ajoute les contrats livrés de main `0dc7f2ee` et les mesures passives ; le fichier de production ESCT est identique à celui du strict. Les arbres du strict et du collecteur sont donc distincts et leurs provenances sont conservées séparément. Les SHA locaux et GitHub peuvent différer par les métadonnées de création via API ; chaque arbre, chaque blob ajouté et chaque parent/ref distant ont été vérifiés. Branche : `fix/sic-27-observed-route-20261127`.

`opening-report.json` donne le bilan final, les budgets et les mesures de continuité. `manifest.json` associe chaque fichier archivé à son SHA-256 et, pour les gzip, au SHA-256 du contenu décodé. Les limites de publication et de CI doivent être mises à jour uniquement après leurs propres validations.
