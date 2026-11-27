# Continuer le rôle de route acquis — ESCT, 27 novembre 2026

**ESCT reste incomplet : cinq niveaux sur six sont gagnés dans le rejeu strict.** Le témoin de la campagne `4a546a13` gagnait le premier niveau puis atteignait le plafond de 22 commandes du niveau 2. Le candidat franchit les cinq premiers niveaux ; le niveau 6 s'arrête après 25 commandes sous son plafond de 18 secondes.

## Première décision et rôle conservé

La capture publique `ee9dad5f8773fed3ed507ad3c575181deae5f754` conserve les observations, commandes et rôles acquis. Au premier geste du niveau 2, global 17, `sic_test_prepared_effects` choisit `ACTION4`. Le rôle `sic_intervene_on_observed_route` est pourtant présent, acquis par l'ouverture du cadre, le virage du corps marqué et le score officiel du niveau 1. Ses couleurs et son pas sont observés, son compteur et son époque correspondent à l'arrivée, et sa dernière preuve est l'observation courante. Le retour du geste de prévisualisation perd le repère du corps marqué.

Le correctif ajoute une entrée dans le groupe de continuation, après ses propriétaires existants. Il exige ces preuves courantes du même scope, le même compteur et la même époque, une grille unique re-mesurée, un curseur et un porteur uniques, et un repère propre non ambigu. Il appelle ensuite la proposition existante. Il ne modifie pas le chemin d'acquisition ni `routeVerified`. Un retour contradictoire retire l'admission précoce ; les rôles et leurs preuves restent conservés. Les interventions restent unitaires lorsque la décision suivante dépend du retour autonome.

## Scénarios natifs

Les huit tests ciblés passent, avec `npm run typecheck` terminé à code 0 et une revue indépendante favorable. Les deux scénarios positifs acquièrent réellement le rôle par les seize premiers retours publics du niveau 1 dans le moteur natif et utilisent les groupes d'arbitrage de production. La variante recolore l'acquisition, puis change la silhouette du porteur, les positions des cellules et la direction du premier geste au transfert. Les tickets portent les preuves acquises, le retour est vérifié et la clôture acquiert un geste. Les cas négatifs couvrent le curseur dupliqué, le repère dupliqué, une contradiction et les preuves absentes, périmées ou d'un autre scope ainsi qu'un compteur incompatible.

Le premier retour directionnel des deux scénarios est un **retour fonctionnel construit**, défini depuis les rasters publics et la commande. Il n'est pas présenté comme un retour réel mesuré sur le jeu. La fixture et son origine sont conservées dans `tests/fixtures/sic-observed-route-public.json.gz` ; `first-decision.public.json.gz` conserve le premier choix fautif, ses rasters, sa proposition, sa sélection et le rôle présent. Seuls les caches géométriques dérivés et les états des familles sans rapport sont omis de cet extrait.

## Rejeu strict

Une session SIC depuis L1, un worker, références archivées inchangées, source figée. Début à **02:43:20 UTC**, fin à **02:44:30 UTC**. Les six budgets ont été recomparés aux références et au calcul du module de budgets ; le miroir `.levels` correspond exactement aux six entrées de `levelStats`, dont la dernière est le résumé d'arrêt du watchdog.

| Niveau | Résultat | Commandes / plafond | Score / plafond de temps |
|---|---|---:|---:|
| 1 | Gagné | 16 / 21 | 5,882 s / 14 s |
| 2 | Gagné | 17 / 22 | 5,919 s / 12 s |
| 3 | Gagné | 21 / 26 | 10,244 s / 15 s |
| 4 | Gagné | 22 / 27 | 13,215 s / 16 s |
| 5 | Gagné | 17 / 22 | 10,508 s / 14 s |
| 6 | Arrêt de temps | 25 / 30 | Aucun score ; arrêt à 18,001 s / 18 s |

Les **118 commandes sont autorisées par SIC**. Les cinq niveaux gagnés totalisent **93 acquisitions confirmées**, identiques au nombre de commandes exécutées jusque-là. Le prefixHash du premier niveau est identique à celui du témoin. Le watchdog interrompt l'enfant au niveau 6 : les acquisitions des 25 dernières commandes, les compteurs de récupération, les effets détaillés et la réconciliation finale ne sont pas disponibles. Ces champs sont `null` dans le rapport, sans les remplacer par zéro. Les dernières commandes disponibles montrent des prévisualisations aux indices 111 et 113 entre les interventions ; leur première condition de refus doit encore être capturée publiquement.

Commande du rejeu, exécutée depuis le checkout figé :

```sh
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs ESCT auto RESULTATS.jsonl 1
```

`strict-results.jsonl.gz` et `strict-results.levels.jsonl.gz` sont les octets originaux compressés. `strict-run.manifest.json` conserve la commande, la source, les hashes des références et du runner ainsi que le quota CPU observé. `manifest.json` relie les fichiers archivés par SHA-256.

## État de sauvegarde et limites

### Deuxième strict : comparaison après restitution native

La capture bornée depuis L1, source locale `44d96245` / distante `cc7886c8`, reproduit les cinq empreintes gagnantes du premier strict. Le premier geste du niveau 2 est réellement `ACTION1` par le rôle route : les rasters mesurent le curseur de la cellule 65 à 53 et le porteur de 13 à 25 ; le record suivant est confirmé. Ces positions sont mesurées dans les images avec la géométrie observée, sans employer les positions anticipées comme preuve. L'extrait `roundtrip-first-loss.public.json.gz` les conserve.

Au niveau 6, le premier refus de priorité intervient au geste 8, global 101, juste après une ouverture confirmée. Rôle, compteur, dernière référence et `lastMatched=true` sont conservés. Le stockage natif a trié les clés de la grille ; la nouvelle grille contient les mêmes valeurs dans un ordre d'insertion différent. La comparaison de sérialisation échouait donc malgré une géométrie identique. Le correctif compare tous les champs et toutes les bornes, et les deux tests natifs vérifient maintenant la proposition suivant la clôture et la restitution de la mémoire.

Le deuxième strict, source locale `f9dd5336ec201aa6af258c182c85e9e296700316` / distante `3d46bb50ebdb68cc1cbb49fbee0d34c67f074a53`, conserve les cinq préfixes gagnants et les mêmes plafonds. Il reste **5/6** : **117 commandes SIC**, arrêt du niveau 6 à **24 commandes / 18,000 s**, sans score final. Les huit dernières commandes conservées sont toutes du rôle route, dont les contacts locaux aux gestes 21 et 22. Les acquisitions finales et les récupérations restent inconnues après l'arrêt dur. `roundtrip-report.json` et les nouveaux bruts gzip distinguent ce second verdict du premier.

La capture diagnostique s'arrête volontairement après le premier geste d'une autre famille au niveau cible. Son `canDispatch=false` produit un statut `error` dans BrowserV6Agent ; ce statut de coupure est conservé et explicitement étiqueté comme diagnostic, sans être compté comme un verdict de campagne.

Le coût restant étudié est borné : une fois le premier mouvement annoncé du porteur revenu, cinq déplacements du curseur visent le même mur adjacent au porteur immobile, sans repère, avant le premier contact d'ouverture. Le premier mouvement autonome doit rester unitaire. Aucun nouveau score ni gain de temps n'est attribué à cette préparation avant son propre rejeu strict.

### Premier lot sauvegardé

- Branche : `fix/sic-27-observed-route-20261127`.
- Commit du code local : `6a7a4dfee703f0c710d84c0c32f2205162370650`.
- Commit GitHub vérifié : `11634ac48179bed4ab75e7c4b741d36e87549075`.
- Arbre identique : `98bc812f2b253a54247bd281c45e153a57dfead3`. Les SHA de commit diffèrent uniquement par les métadonnées de création via API ; les quatre blobs, l'arbre et le parent ont été vérifiés.
- Base : `f38b03c52e92483c11e915a759323ba6aebc223c`.
- Intégration sur main, contrôle complet de continuité et publication : en attente ; aucune victoire du jeu livré n'est revendiquée ici.
- Suite : capturer depuis L1 la première perte de priorité du niveau 6, sans changer les plafonds ni attribuer une réussite aux données manquantes.
