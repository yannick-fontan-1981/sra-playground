# VC33 · transférer des bandes en conservant leur alignement

## Contrat avant changement

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, catalogue `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`. La ligne 3 est l’unique ligne du catalogue portée par `band_transfer`. Son mode est `conserved_band_transfer / aligned_band_transfers`. Partir du niveau 1, pack natif par défaut, borne de 16 gestes et 600 par niveau. [Inventaire](sic-v8-strategies-observees.md?plain=1#L29)

| Condition | Ticket et retour attendus |
|---|---|
| N1/T1, deux bandes (32,12), axe horizontal, cible de la seconde bande à 24, unité 4, sens inconnu | Relâcher le premier essai pointable en (61,25), sans prédiction signée. Le retour (36,8) établit `into_clicked`. T2 doit libérer (61,33) pour le trajet d’alignement, en s’appuyant sur le retour de T1. |
| Même présentation au T2, référence fixe de couleur 11 devenue méconnaissable | Le modèle garde le sens appris mais son sujet n’est plus visible comme prévu. La famille doit refuser. |
| Même état initial et autre essai admissible | Choisir l’autre actionneur, observer dans le jeu les deux longueurs, déterminer le sens puis reprendre. Le retrait de toutes les offres de sonde doit laisser un autre ticket ou une abstention constatable. |
| Autre géométrie native | N2 a trois bandes. N3 a un axe vertical, cinq bandes, trois contraintes d’alignement et une unité de 2. Vérifier leurs propres mesures et références et le maintien de la priorité au trajet quand il est disponible. |

Le gel possède déjà `findBandPath` et `bandEffect`, également appelés par `createSicVerifyBandTransfer`. L’entrée historique est `originalEventFamily(new BandTransfer())`. Au T1, en l’absence de sens connu, elle ne consulte aucun sélecteur d’offre de sonde. `BandTransfer.propose` construit les indices encore inédits au vecteur courant et prend le premier. Figer les 16 libérations et retours sur le gel. Pour créditer une articulation nouvelle sur branche, exiger une substitution et un retrait au T1 dans le service, tout en conservant chez la famille l’admissibilité, le pointage, le garde, la mesure et le trajet. [Entrée native](../../src/logos-engine/v6-native-runtime.ts) · [Producteur, recherche et reçu](../../src/logos-engine/v6-band-transfer.ts) · [Autre famille utilisant la recherche](../../src/sic/band-alignment.ts)

## Décision suivie depuis N1

`measureBandGeometry` admet un modèle unique. Il repère des repères fixes et mobiles de même couleur, des paires d’actionneurs pointables, un axe, une unité et les rangées où mesurer le remplissage. `bandQuantities` exige que les sondes d’une bande donnent une longueur cohérente. La différence de position des deux repères fixe la longueur recherchée. Au T1 le repère fixe 11 occupe (38,28)–(39,31), le mobile (50,44)–(51,49). Ils contraignent la seconde bande à 24. À chaque nouvelle proposition la famille vérifie le repère fixe et la position attendue du mobile à partir du changement de longueur. Un alignement déjà satisfait clôt cette question. [Géométrie, acquisition et gardes](../../src/logos-engine/v6-band-transfer.ts)

| Entrée du service | Offre ou garde | Retour rattaché et reprise |
|---|---|---|
| T1, quantités [32,12], pas 4, direction inconnue | Les deux indices 0 et 1 sont inédits pour ce vecteur. Le premier fournit `ACTION6(61,25)`. La garde `bind_current_band_lengths_and_local_actuator` vérifie quantités, époque, score, observation et empreinte locale. | Le reçu `compare_measured_band_vector` porte `matched=null` car le geste n’avait pas de prédiction. `BandTransfer.record` mesure [36,8]. Une seule des deux lois de `bandEffect` convient, `into_clicked`. Le plan de T2 référence l’observation de retour. |
| T2, quantités [36,8], sens connu et deux repères présents | `findBandPath` donne l’actionneur 1 en (61,33) et prédit [32,12]. Un actionneur sans mesure propre borne le préfixe à ce premier geste. T3 peut engager trois gestes après confirmation. | T2 confirme les longueurs. T5 passe officiellement en N2 et transmet le sens comme hypothèse préalable. Les gestes d’un préfixe sont observés à chaque retour, puis acquis au moment de sa clôture. |
| T6, trois bandes, et T13, cinq bandes | T6 vise une longueur de 28 pour la bande 2. T13 change d’axe et d’unité. Les cibles des bandes 0, 3 et 4 valent respectivement 16, 18 et 10. Le ticket se lie à la géométrie mesurée du niveau. | Les retours T6 et T13 confirment respectivement [52,8,12] et [6,0,4,6,28]. La frontière T12 est officielle. Les 16 occurrences sont couvertes, dont deux frontières et la sonde initiale sans prédiction. |

### Ce qui fait changer la décision

- **Autre sonde, mêmes preuves.** Sur le candidat, choisir l’indice 1 parmi [0,1] donne (61,33) au T1. Le jeu renvoie [28,16]. Ce retour établit le sens, puis le service reprend **le même clic**, cette fois avec la prédiction [24,20]. Le jeu la confirme et le service autorise le geste suivant du préfixe. Le sélecteur de sonde n’est appelé qu’au T1 de ce départ.
- **Retrait de l’offre.** Au T1, l’abstention du sélecteur ou l’offre de l’indice 2, extérieur aux indices mesurés, libère `observed_frontier / experiment` en (21,36). Le producteur et le point changent.
- **Même commande, preuve différente.** Sur un retour T1 construit où les longueurs restent [32,12], `record` date l’essai comme bloqué. T2 choisit encore (61,33), mais le sens et la prédiction restent inconnus. Sur le vrai retour T1, ce même point est le premier pas d’un trajet prédit.
- **Mauvais alignement.** Sur le paquet T1 construit avec le repère fixe effacé, la mesure de longueur établit toujours `into_clicked`. La proposition suivante de la famille est nulle. Le service libère `observed_frontier / experiment` en (61,25). Les deux paquets construits servent à éprouver la décision en service. Les retours de la sonde de substitution proviennent du jeu réellement exécuté.

### Attribution et limite

Le gel fournit la mesure, les lois opposées, la recherche de trajet, la garde et l’acquisition. Il conserve aussi le départage historique du premier essai. La recherche de trajet est déjà appelée par deux familles. Au T1 de la ligne 3, aucun sens n’a encore été mesuré pour la consulter. Le candidat extrait uniquement `BandTransfer.selectProbe(eligible)`. La famille construit les indices inédits au vecteur courant, vérifie que le résultat en fait partie, prépare le point et autorise la suite via la garde existante. Un trajet mesuré garde la priorité. Le sélecteur peut s’abstenir ou prendre un autre indice à entrées constantes. Le catalogue de cette ligne comprend 16 gestes de VC33 sur ce départ. La substitution physique a été vérifiée à l’ouverture de N1. Les autres niveaux attestent la relecture du contexte et la continuation. [Tests de la ligne](../../tests/sic-vc33-line3.test.ts) · [Paquets nominaux et deux retours du geste alternatif](../../tests/fixtures/sic-vc33-line3.json.gz)

## Entrée pour le Banc et l’opérateur

Node 24, depuis la racine du candidat. Le parent de code est le gel `d0e7527c`, le contrat préenregistré `f3361eeb`. Sans variable d’environnement, les tests rejouent les paquets publics du catalogue dans le service. Pour reproduire physiquement le parcours nominal et la substitution, indiquer un checkout avec les ressources locales Pyodide et les jeux. Pour rejouer les assertions rétroactives, conserver le lanceur du candidat et lui fournir le répertoire source de la révision à examiner.

```powershell
$env:SIC_VC33_GAME_ROOT = 'D:/dev/ARC-AGI/SRA-Playground/sic-cartographie-p05'
node --test tests/sic-vc33-line3.test.ts
node --test tests/v6-program-families.test.ts tests/sic-band-passage.test.ts tests/v6-branch-routing-kernel.test.ts tests/v6-radial-port-integration.test.ts tests/v6-v45-kernel-integration.test.ts
node node_modules/typescript/bin/tsc --noEmit

$gelVC33 = Join-Path ([IO.Path]::GetTempPath()) ('vc33-gel-' + [guid]::NewGuid())
git clone --shared --no-checkout . $gelVC33
git -C $gelVC33 sparse-checkout set src reference
git -C $gelVC33 checkout --detach d0e7527ca8033bd805a6d7a8bb021eff62e87021
$env:SIC_VC33_ENGINE_ROOT = $gelVC33
node --test --test-name-pattern='VC33 releases the 16|stationary return|fixed marker disappears' tests/sic-vc33-line3.test.ts
Remove-Item Env:SIC_VC33_ENGINE_ROOT
```

Le rejeu indépendant des arbres historique et gel retrouve exactement les 16 décisions et leurs retours. Les images publiques et les animations des 17 observations concordent. Le gel ajoute la palette optionnelle. Le parcours nominal du candidat reproduit les 16 libérations et retours et les 17 observations publiques complètes du gel. Le banc peut partir du plan T1 suffixé `epoch:1:revision:1:frame:fdde551e3fd269f6` et suivre au T2 `epoch:1:revision:2:frame:24cea280160201f2`. Le cas discriminant consiste à choisir l’autre indice, à conditions de départ et déclarations identiques, puis à comparer la référence de retour et la prédiction suivante.

**Temps locaux du lot.** Départ de branche à 20 h 54 min 45 s (UTC−3), contrat figé à 20 h 56 min 37 s, soit 1 min 52 s de préparation. Le premier rejeu complet du gel a pris 42,39 s. Le verdict des six cas de la ligne a été obtenu à 21 h 03 min 51 s, soit 7 min 14 s après le contrat et 9 min 06 s depuis le départ. La dernière commande de caractérisation a pris 68,48 s, incluant les deux exécutions physiques. Trois assertions de parcours et de refus passent également sur les sources du gel. Ces durées sur l’hôte partagé excluent les files indépendantes du Banc et de l’opérateur. Avec 22 numéros déjà qualifiés, CONN/63, CONN/66 et VC33/3 représentent les trois verdicts individuels encore nécessaires pour atteindre 25 si chaque ligne passe ses deux contre-épreuves.
