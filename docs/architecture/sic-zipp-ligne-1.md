# ZIPP · identifier la commande qui agit sur la cible

## Contrat de la ligne 1 avant le changement

La branche part du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. L’entrée de catalogue est `acquire_control_for_target / experiment`, ZIPP L2, commande 15, `ACTION2`. Elle totalise huit commandes dans l’inventaire. La recapture du niveau 1 jusqu’au plafond historique de 16 commandes, avec reprise de la même session après le passage de niveau, donne `replicate_translation` pour ce ticket sur `8ce7ee35`, `d0e7527c` et `3c2d6bcf`. La voie `sample_unused_control` de la même famille est celle qui appelle `bindMissingControlTrial`. Le reçu de T15 ne porte aucun `missingControl`. [Catalogue](sic-v8-strategies-observees.md?plain=1#L27) · [Choix de l’expérience](../../src/logos-engine/v6-native-caller.ts#L375)

| Situation à vérifier | Invariant préenregistré |
|---|---|
| ZIPP L2 T15 | Un seul essai antérieur de la commande dans l’époque, deux recalages possibles, une signature suivie et une origine différente justifient de proposer une répétition. Préserver `ACTION2`, la paire morphologique, la signature, le vecteur attendu (0,12), les trois références dans leur ordre, le garde, le résultat du pas et la décision T16. |
| Mêmes commandes, plateau et objectif, historique modifié | Un essai antérieur hors époque ne justifie plus cette répétition. Si la signature de la cible manque dans la preuve ou si le sujet est revenu à l’origine de l’essai, aucun déplacement de ce sujet ne justifie l’offre. Une autre décision reste possible suivant les offres ouvertes. |
| Autre contexte | Sur le protocole public indépendant à carré mobile, la première commande sans mesure ouvre un essai P05. Le déplacement depuis une origine différente ouvre ensuite la répétition, avec son propre vecteur. Comparer le sujet et les reçus jusqu’au retour. |
| Périmètre du candidat | Isoler uniquement la construction de l’offre de répétition à partir de l’essai mesuré, en réutilisant le recalage et le déplacement du moteur. La famille garde l’ordre des expériences et des commandes, la paire retenue et le passage par la frontière. Le moteur garde l’autorisation d’exécuter. |

Le crédit sur le gel et l’apport du candidat seront établis séparément. La ligne 18 possède son propre témoin et son propre dénominateur.

## Ce que le moteur a effectivement choisi

Le pack natif par défaut joue huit clics en L1. Le retour de T8 transporte la même session en L2. De T9 à T13, la famille `containment` libère successivement les commandes 1 à 5. T14 répète la commande 5 par `public_outline_service`. À T15, la morphologie retient une composition dont le contrôle reste à établir (`retained / control_not_currently_attested`). Elle rattache le besoin à la paire `f375e1c1…7336c`. La mesure suit séparément le rôle de signature `3da02019…0fe2`. Les identifiants complets sont fixés dans le test. [Préfixe natif](../../tests/sic-target-control-zipp.test.ts#L64) · [Mémoire des rôles observés](../../src/logos-engine/v6-composition-memory.ts#L98)

| Étape | Preuve et décision vérifiées |
|---|---|
| Essai disponible | La seule transition antérieure d’`ACTION2` dans l’époque 2 est T10. Son rôle passe de la boîte (11,31,17,37) à (11,43,17,49). Le recalage des repères fixes permet de comparer les scènes. À T15 le rôle est encore en (11,43,17,49), à distance de son origine de T10. |
| Offre au parent | La famille prépare `replicate_translation` pour `ACTION2` et le vecteur (0,12). L’ordre des références dans l’offre est révision 15, puis 10, puis 11. Les révisions 11 et 15 ont la même empreinte de grille et deux références distinctes. La famille lie la commande et la paire morphologique à la question. `ObservedFrontier.propose` vérifie qu’elle peut proposer cette commande ici. |
| Autorisation | Le garde `current_public_premises_match_provisional_step` admet un pas. Le reçu porte `acquire_control_for_target`, l’autorité `native`, l’objectif `G_protocol_completion` et l’observation de T15. Le champ de sous-objectif est nul. Le reçu ne porte aucun témoin `test_missing_control`. |
| Retour et reprise | Après T15, la boîte reste (11,43,17,49). Le déplacement réalisé est (0,0). L’historique public contient la seconde transition `ACTION2`. Le reçu d’issue porte `matched=null` et sa référence d’observation. Le moteur n’inscrit donc aucun verdict booléen sur la prédiction (0,12). La même paire reste retenue à T16. L’appelant ne propose plus de répétition et la frontière libère `ACTION6(14,10)` pour `Q_b129c7fff4b4adc609a5`. |

Le test contrôle la commande effectivement soumise, la famille qui a libéré le plan, l’épisode avant/après et la première décision qui suit. Le rattachement disponible s’arrête à la paire, à la référence de la question et à la transition exécutée. Il n’existe pas ici de reçu de satisfaction d’un sous-objectif. [Préparation de la question](../../src/logos-engine/v6-observed-frontier.ts#L382) · [Acquisition de la transition](../../src/logos-engine/v6-native-caller.ts#L536) · [Issue publiée](../../src/logos-engine/v6-native-runtime.ts#L1721)

### Ce qui fait changer l’offre

- **Contre-exemple construit sur le service ZIPP.** On rejoue les quatorze tickets historiques, puis on place la seule transition antérieure d’`ACTION2` dans l’époque précédente, avec ses références cohérentes. À présentation, paire, budget et commande identiques, le service propose `sample_unused_control`. La prévision de déplacement disparaît. Le témoin `test_missing_control` contient la seule référence courante. Cette branche passe effectivement par `bindMissingControlTrial → evaluateMissingControl`. Sur le gel, le témoin existe déjà. Le candidat P05 `3c2d6bcf` isole sa qualification interne. [Contre-épreuve](../../tests/sic-target-control-zipp.test.ts#L99) · [Liaison P05](../../src/sic/missing-control-strategy.ts#L45)
- **Second contexte, protocole public construit.** Un carré mobile fait d’abord l’objet d’un essai sans mesure. Son déplacement de deux pixels vers la droite ouvre, au tour suivant, une répétition pour la même paire. Le second retour reproduit effectivement le vecteur (2,0). Les trois références désignent l’origine actuelle et la première transition. Ce parcours passe par la morphologie, la frontière, le garde et le service. Il éprouve une autre géométrie et un autre effet, sans accroître le nombre d’occurrences historiques recapturées. [Deux tickets et deux retours](../../tests/v6-control-attention-kernel.test.ts#L45)
- **Contre-épreuves du producteur.** Une autre fixture publique de translation donne (1,0). Marquer le seul sujet mobile comme ambigu suffit à fermer l’offre, même lorsque les repères fixes permettent toujours le recalage. Les essais couvrent aussi le retour à l’origine initiale, un historique vide ou double, un changement d’époque et un recalage impossible. [Test de l’offre](../../tests/v6-contextual-translation.test.ts#L55)

### Apport du candidat

Sur le gel, la famille groupe les essais par commande publique et par époque. Les mesures `registered` et `relativeMotion` existent déjà. La décision de répéter depuis une autre origine est écrite dans la boucle qui choisit l’expérience. Les tests au SHA `273b95a7` établissent rétroactivement le ticket, la variation de portée et la reprise. Les deux tests ZIPP passent également sur le code de `3c2d6bcf`, avec les mêmes observations et la même intervention de portée. À cette révision, la qualification P05 intervient sur la voie de l’essai inédit. Elle ne décide pas du ticket historique T15.

Le nouveau producteur `offerTranslationReplication(trials, current)` reçoit les transitions pour **une commande** et l’observation actuelle. Il exige un essai dans la même époque et deux recalages. Il renvoie soit les trois références et les vecteurs des rôles admissibles, soit `null`. Les signatures doivent être présentes aux trois instants, le déplacement antérieur non nul, et l’origine actuelle différente de l’origine initiale. Le contrat permet plusieurs rôles. La famille garde la paire, l’ordre d’examen, les autres types d’essai et la décision de soumettre le plan à la frontière. Une absence d’offre lui rend la main. Cette extraction ne modifie aucun critère de déplacement ni le rattachement du retour. [Producteur](../../src/logos-engine/v6-contextual-translation.ts#L14) · [Consommateur](../../src/logos-engine/v6-native-caller.ts#L387)

### Reproduction et portée

Les 16 commandes ZIPP, les 17 observations dans le schéma public historique et les projections enregistrées des décisions et retours concordent sur `8ce7ee35`, `d0e7527c`, `3c2d6bcf` et le candidat. Les trois dernières révisions concordent aussi sur la palette. La portée historique directe est **1/8 occurrence** du triplet. Le lot couvre un second contexte construit et un contre-exemple au service. Une qualification indépendante de la ligne 1 sur branche reste à recevoir. La ligne 18 conserve son propre statut.

Utiliser Node 24 avec les dépendances du dépôt. Le test de provenance de `v6-contextual-translation` vérifie les octets du générateur Python. Sous Windows, un checkout créé avec `git -c core.autocrlf=false clone --config core.autocrlf=false --branch refactor/sic-zipp-ligne-1 <URL> <répertoire>` conserve les fins de ligne Git. Le premier test peut fonctionner sur la fixture compressée (SHA-256 `a0a7abca1db77e434c2c56d0afbf27465b2ec4858b85b103db999abfcc7e8d06`). Avec `SIC_TARGET_GAME_ROOT`, les seize commandes sont envoyées au vrai jeu et chaque paquet retourné est vérifié. [Fixture publique](../../tests/fixtures/sic-control-zipp-public.json.gz)

```powershell
node --test tests/sic-target-control-zipp.test.ts tests/v6-control-attention-kernel.test.ts
$env:SIC_TARGET_GAME_ROOT = (Resolve-Path ../sic-cartographie-p05).Path
node --test tests/sic-target-control-zipp.test.ts tests/v6-control-attention-kernel.test.ts tests/v6-control-attention-reference.test.ts tests/v6-contextual-translation.test.ts tests/sic-control-effect.test.ts tests/sic-reasoning-mode.test.ts
node node_modules/typescript/bin/tsc --noEmit
Remove-Item Env:SIC_TARGET_GAME_ROOT
```

Les six suites passent 111/111 sur le candidat, avec le jeu source. Le contrôle TypeScript passe. Pour le Banc, comparer le candidat à `273b95a740a26bde3688e37a45338a624fb5450c`, dont l’arbre de production est strictement celui du gel. Le préfixe démarre en L1, pack natif par défaut, graine 0, plafond de session 16 et de niveau 600. Les points de comparaison sont le besoin, la paire et l’offre de T15, son ticket, la boîte réellement retrouvée et le ticket T16.
