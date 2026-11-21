# SS06 L2 — conserver un partenaire et mesurer ce que son placement rend possible

Sur SS06, un relais de contrôle est vérifié dès le coup 3. La première décision manquante chez v86 vient **après** cette vérification. Quand aucun plan de placement ne précédait le clic, le planificateur perdait les deux rôles dont la commande venait de démontrer la relation. Il n’a proposé aucun placement pendant les 369 actions de sa partie à froid. Cette analyse utilise SS06 pour le développement. SS09 entier sert à évaluer le transfert des candidats figés.

## Ce que les jeux sources permettent d’affirmer

- Dans 103 épisodes sources, 36 relais vérifiés permettent de comparer deux clics depuis la même situation. Cliquer sur le sujet précédent et répéter le moteur connu lui rend le contrôle dans les 36 cas. Recliquer sur le sujet déjà actif déplace ce dernier dans 31 cas. Les cinq autres retours du témoin sont indéterminés. Les cinq épisodes positifs sont VOIS L1, L2 et L5, THER L1 et MOTO L2.
- Une deuxième mesure annonce un contact à partir d’un déplacement déjà observé avec la même commande. Elle vérifie ensuite si le sujet prend la place de l’objet et si celui-ci avance d’un pas avec un repère indépendant qui reste fixe. Sur 459 contacts candidats dans 103 épisodes sources, la règle reconnaît 38 poussées sur FUIT, SKBN, WA30, ESCT, GABA et CWSE L2. Dans quatre cas, l’objet poussé a plusieurs exemplaires à l’écran. Le repère de contrôle de cette mesure peut être un objet fixe. Les 38 poussées ne démontrent donc pas 38 interactions entre deux sujets pilotables.
- La simple duplication de deux silhouettes n’a pas confirmé la transmission à distance d’un déplacement. Sur 29 prédictions sur PORT et FOGW L1, aucun changement n’apparaît dans la région projetée. Les 47 régions témoins restent aussi inchangées. SIC n’utilise aucune règle de transmission fondée sur cette observation.

## Décisions prises par SIC

| Version | Première différence utile | Observation qui la contrôle |
| --- | --- | --- |
| v87 | Après le relais vérifié au coup 3, le reçu du coup 5 reprend les rôles avant de choisir un placement. Première commande différente de v86 au coup 7. | Au cours des 324 actions, 267 approches correspondent au mouvement prévu et 32 sont réfutées. Ces observations comprennent des répétitions. |
| v88 | B se heurte à un obstacle au coup 14. SIC clique sur A au coup 15, le déplace au coup 16, reprend B au coup 17 et répète la commande refusée au coup 18. | Au coup 18, le passage reste fermé. Après deux autres déplacements, B pousse un objet au coup 21 avec A resté en place. Le reçu annonçait à tort que B avait recouvert un repère. |
| v89 | Au coup 21, SIC mesure que l’objet a avancé dans le sens de B et que son autre exemplaire est resté fixe. Au coup 22, le candidat essaie une direction vers un autre repère. Avec la déclaration précédente, il sélectionnait A. | Le reçu cite le déplacement de l’objet et la position du partenaire. Le geste du coup 22 est bloqué. Au clic suivant, deux formes apparaissent près de A et SIC perd son identification. |
| v90 | Au second relais, SIC peut retrouver les deux formes observées ensemble pendant un premier relais validé par un déplacement. Le moteur suivant doit toujours vérifier laquelle bouge. | La sélection porte la référence de ce déplacement. Sans paire vérifiée, deux formes superposées laissent le sujet indéterminé. |

**Expérience contrôlée sur SS06.** Depuis chacune de 11 situations où la commande de B a réellement échoué, le banc rend le contrôle à A, essaie zéro, un ou deux gestes, redonne la main à B et répète la commande initiale. Sur 231 préparations, trois des onze blocages peuvent être levés. Le simple aller-retour des deux clics en l’absence de déplacement ne lève aucun des onze. Le déplacement préparé de B réussit dans les quatre essais où le voisinage de sa destination avait visiblement changé et dans deux des 227 autres. Cette mesure reproduit le fichier d’expériences à l’octet près. Le banc choisit les variantes pour la comparaison. Les manches autonomes n’ont accès ni aux préparations ni aux bandes enregistrées.

## Où la composition échoue encore

Dans la manche v90, le coup 23 retrouve la paire validée au coup 16. Le déplacement de A est réfuté au coup 24, B est repris au coup 25 et le blocage initial persiste au coup 26. La première commande différente de v89 est celle du coup 24. SIC réussit 99 mouvements d’approche avec le partenaire maintenu sur place. Il n’enchaîne pas de téléportation utile. Quinze lectures d’indications sont réfutées. La seizième termine la partie par `GAME_OVER` au coup 157, sans point.

Le banc a examiné 540 dispositions depuis la poussée du coup 21 avec le partenaire conservé. L’action disponible déplace B dans deux cas, l’aller et le retour d’un même passage. Une forme de cinq pixels, comprise dans une cellule de 3 × 3, désigne la destination avant chacun de ces deux gestes. Sur la partie autonome, quinze des seize lectures visaient le centre d’une région de 21 × 12 pixels dont la silhouette variait. La première lecture visait une petite forme et a aussi échoué. Ces deux arrivées justifient de comparer la précision spatiale des marques et de vérifier leur effet par l’action. Elles ne prouvent aucune règle universelle de taille.

Une recherche plus large part du même coup 21 et garde A à la position choisie par SIC. Elle recense 8 328 images publiques avant épuisement de sa file, sous un plafond de 12 000. Elle prolonge les branches où B et le partenaire maintenu restent identifiables, avec les directions et la commande d’activation. B visite 34 cases, le mécanisme local occupe 33 positions et la meilleure distance au repère choisi par SIC est de deux cases en distance de Manhattan. Aucun score officiel ni contact avec ce repère. Une téléportation est donc possible dans cette préparation, mais l’accès final reste à démontrer. Les deux hypothèses à comparer sont le besoin de changer aussi le placement de A et le choix d’un autre repère.

## Une case atteignable doit être identifiée avant l’action

La qualification de géométrie a relevé les seize sites proposés en v90. Chacun est exactement à mi-distance de deux centres selon au moins un axe de la grille mesurée. Les deux arrivées réellement observées par le banc ont un indicateur centré sur une seule case. La sélection arrondissait la position à la case la plus proche, puis la vérification exigeait un écart strictement inférieur à un demi-pas. La version v91 emploie ce même critère dès la proposition d’une nouvelle lecture. Une lecture dont le moteur a déjà vérifié l’effet conserve sa priorité. Ce changement ne nécessite aucune nouvelle primitive ni déclaration.

La taille serait un mauvais critère universel. Dans 103 épisodes sources, des sondes effectuées depuis les mêmes situations placent effectivement le sujet au centre proposé dans 80 des 480 cas avec une forme compacte et 28 des 151 cas avec une forme plus étendue que le pas appris. Ces comptes mesurent une coïncidence spatiale après la commande. Une relation de prévisualisation exige une confirmation supplémentaire. [Mesure sur les sources](../../../scripts/measure-source-arrival-extent.mjs) · [Mesure depuis la poussée et sur la manche autonome](../../../scripts/measure-parked-indications.mjs)

Sur le préfixe à froid, les quarante premières commandes de v90 et v91 coïncident. Au coup 41, la même image publique porte l’empreinte `8195a06342b2fdbb`. V90 choisit la lecture ACTION5 avec une arrivée attendue en `[15,34]`. V91 choisit ACTION1 et prévoit le mouvement du sujet vers `[12,30]`. Les coordonnées des reçus sont exprimées en demi-pixels et servent au contrôle après la partie.

La balise `sic-source100-located-arrival-receipt-v91` ajoute au reçu le motif `between_grid_cells`, le site observé, l’origine de la grille, le pas et la référence du témoin. Sur les 55 premières commandes de SS06, la bande des commandes et des images est identique à v91. Sur SS07 à froid, v91 gagne en 117 actions. L’activation réfutée au coup 56 de v90 ne changeait pas l’image. Après sa suppression, les 62 commandes restantes et leurs images de départ et d’arrivée concordent toutes avec la victoire précédente.

## Scores et limite actuelle

Sur SS06 L2 à froid, v90 et v91 émettent chacune 157 commandes au cours de ces deux manches, avec le même moteur, un plafond de 1 200 commandes et 514 286 ms de temps actif par niveau. V90 perd la partie au coup 157. V91 reste en jeu à l’expiration du temps actif. Le nombre de lectures d’une indication passe de seize à une. Les 112 déplacements conformes avec le partenaire maintenu sur place ne rapportent aucun point. Le prochain fait à établir est une préparation **choisie par SIC** qui fasse apparaître l’indication du passage effectivement empruntable. Sur SS09 gardé à part, v91 s’arrête sans point après 119 actions. En campagne, v90 épuise le temps actif au L1 de SS06 et de SS08, respectivement après 204 et 178 actions. Le L2 n’est atteint dans aucune de ces deux campagnes.

Le rejeu natif de v91 confirme SS01, SS02, SS03, SS04 et SS05 en campagne, en **32, 46, 97, 143 et 73** actions au L2. SS07 constitue la sixième victoire distincte. SS08 à froid arrive au terme du temps actif en 135 actions et SS09 en 119. La variante enrichie du reçu a émis exactement les mêmes commandes et images que v91 pendant leurs 157 actions communes sur SS06. Elle a poursuivi jusqu’à 237 actions, avec 184 approches confirmées et une seule lecture d’indication réfutée. Son rejeu officiel termine également sans point. Les nombres d’actions avant l’échéance varient avec la durée des décisions.

| Exécutable et déclaration sur SS06 L2 à froid | Actions jouées | Résultat officiel |
| --- | ---: | --- |
| v86, accès indiqué | 369 | Temps actif épuisé, 0 point |
| v87, reprise des rôles | 324 | Temps actif épuisé, 0 point |
| v88, préparation par le partenaire | 203 | Temps actif épuisé, 0 point |
| v89 avec la déclaration de v88 | 199 | Temps actif épuisé, 0 point |
| v89 avec reclassification de la destination | 207 | Temps actif épuisé, 0 point |
| v90, réutilisation des formes vérifiées | 157 | Fin de partie, 0 point |
| v91, destination sur une seule case | 157 | Temps actif épuisé, 0 point |
| v91 avec reçu détaillé | 237 | Temps actif épuisé, 0 point |

Les 100 L1 sources de v89, v90 et v91 sont rejoués indépendamment au budget de 60 gestes. Chacune de ces versions gagne les 100 et reproduit les 100 trajectoires de v86. CWSE L2 et KLOT L4 gagnent aussi à froid en 59 et 37 actions avec les mêmes trajectoires que v86. Les 508 tests SIC et de rigidité sélectionnés passent sur v91, ainsi que le contrôle TypeScript. Le changement de commande entre v90 et v91 au coup 41 de SS06 laisse l’image inchangée dans les deux cas.

## Configurer et reproduire

La préférence déclarative fixe le type d’expérience et le nombre minimal d’issues distinguables. Elle ne désigne aucun sujet, objet, geste, point à cliquer ni lieu de destination. SIC tire ces paramètres des images, des commandes disponibles et de leurs effets. Les reçus de la bande publique conservent la préparation, le résultat, le placement maintenu et, quand ils sont disponibles, les références des observations utilisées.

Avec Node 24, utiliser une sortie neuve pour chaque exécution. Les variables PowerShell `$candidat` et `$moteur` désignent respectivement le checkout figé et le moteur Custom 4 au commit `f0a1ff437`. Pour la comparaison déclarative avec le même exécutable, utiliser la balise `sic-source100-displaced-goal-v89` et changer uniquement la préférence.

```powershell
$env:SIC_STUDY_RECORD_COMMANDS = '1'
$env:SIC_STUDY_CURSOR_OFFERS = '1'
$packs = Join-Path $candidat 'docs/diagnostics/sic-plan-arbitration'
$env:SIC_STUDY_RECOVERY_PACK = Join-Path $packs 'essai-placement-partenaire-v88.json'
node scripts/compare-source100.mjs $candidat $moteur temoin.jsonl SS06 2 2 1200 0/1
$env:SIC_STUDY_RECOVERY_PACK = Join-Path $packs 'but-deplace-v89.json'
node scripts/compare-source100.mjs $candidat $moteur candidat.jsonl SS06 2 2 1200 0/1
node scripts/verify-frozen-level-scores.mjs $moteur resultat-candidat.json candidat.jsonl
```

Pour reproduire la comparaison interventionnelle, générer une bande de 45 gestes sur SS06 avec la balise `sic-source100-resume-control-v87`, la préférence `placement-apres-controle-v87.json` et le même moteur. Lancer ensuite `node scripts/compare-blocked-partner-returns.mjs $moteur court-v87.jsonl SS06 essais.json` depuis le checkout récent. Les mesures du corpus utilisent `measure-source-cursor-opportunities.mjs` avec `SIC_STUDY_RETURN_SELECTION=1`, `measure-corresponding-places.mjs` et `measure-source-displaced-destinations.mjs`. Chaque mesure de poussée rejoue les commandes publiques et vérifie leur empreinte avant de créditer l’effet.

Pour reproduire l’audit des indications, utiliser une bande v90 complète à froid. La commande `node scripts/measure-parked-indications.mjs $moteur ss06-v90.jsonl SS06 geometrie.json 540` compare les propositions faites en partie et les arrivées après la poussée. Passer le plafond à 12 000 pour étudier l’accessibilité à partenaire fixe jusqu’à épuisement de la file observée. La taille des marques n’intervient pas dans le choix de v91.

[Mesures par configuration et scores rejoués](mesures-placements-conditionnels-v91.json) · [Décision après une poussée](../../../src/sic/displaced-destination.ts) · [Expérience entre deux partenaires](../../../src/sic/test-partner-preparation.ts)
