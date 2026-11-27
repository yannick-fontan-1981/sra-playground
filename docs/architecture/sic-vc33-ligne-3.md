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
