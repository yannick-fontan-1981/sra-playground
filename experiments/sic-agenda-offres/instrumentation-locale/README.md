# Observer la qualification d’une approche et d’un contact

Sur les deux gestes de la fixture native, l’agenda prédit **P07 puis P05** à partir des faits présents à l’entrée du workflow local. Les deux reçus natifs confirment ces choix. Avant le premier fournisseur, les deux sélections de famille restent indéterminées.

| Parcours et instant de prédiction | Mode | Route soutenue | Sonde éligible | Interaction connue | Agenda | Reçu natif ouvert ensuite | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture L1, geste 1, approche | assimilation | vrai | faux | faux | P07 | P07 · ACTION4 | accord local |
| Fixture L1, geste 2, contact | résolution (`solving`) | faux | vrai | faux | P05 | P05 · ACTION4 | accord local |
| Trace A G50T L4, tour 11, avant le premier fournisseur | résolution | inconnue | inconnue | inconnue | indéterminé | sic_verify_remote_replay · P07 | besoin, offres et refus indisponibles |
| Trace A G50T L4, tour 12, avant le premier fournisseur | résolution | inconnue | inconnue | inconnue | indéterminé | sic_verify_remote_replay · P05 | même cause |

La fixture reproduit le changement de qualification avec le vrai moteur, un état initial construit et deux retours publics. G50T conserve les deux verdicts du lot `958c6dbc752008ca5494ce7574021ce85a96de63`, SHA de départ vérifié de la branche `experiment/sic-observation-locale`. Les réserves historiques passent de 28 à 27. Le gel natif des 107 jeux est `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. [Contrat temporel G50T](../observation-native/CONTRAT.md) · [Résultat du banc A](../observation-native/README.md)

## Rejouer la mesure

Depuis la racine du checkout, avec Node ≥ 22.18 accessible sous PowerShell, cette commande exécute les deux bras natifs, compare leur comportement et contrôle les fuites.

```powershell
.\experiments\sic-agenda-offres\rejouer.ps1 sonde-locale
```

Pour prédire dans un processus qui ouvre uniquement le fichier d’entrée, puis confronter la prédiction au reçu dans un autre processus, utiliser les témoins livrés. Ces deux commandes fonctionnent aussi avec un dossier produit par `sonde-locale --capturer nouveau-dossier`. Chacune vérifie l’empreinte des données scellées qu’elle consomme.

```powershell
$rejeu = '.\experiments\sic-agenda-offres\rejouer.ps1'
$temoin = '.\experiments\sic-agenda-offres\instrumentation-locale\temoin'
$prediction = Join-Path $env:TEMP ((New-Guid).Guid + '.json')
& $rejeu sonde-locale --predire "$temoin/avant.json" $prediction
& $rejeu sonde-locale --comparer $prediction "$temoin/recus.json"
```

Le prédicteur reçoit des faits et des références. Le comparateur reçoit des prédictions déjà scellées et des reçus. L’appariement exige une unique invocation et un seul reçu portant la même référence d’observation et le même propriétaire. Une ambiguïté donne `indéterminé`. Les SHA-256 portent sur les objets JSON sérialisés par le producteur. Ils permettent de vérifier l’intégrité et de reproduire le résultat. [Pré-événements](temoin/avant.json) · [Prédictions](temoin/predictions.json) · [Reçus](temoin/recus.json)

## Où les données deviennent disponibles

| Coupe | Producteur et faits disponibles | Conclusion permise |
| --- | --- | --- |
| Avant le premier `offer` de `NativeV6Runtime.selectFamily` | Le moteur connaît l’observation courante, les actions publiques, les entrées filtrées, les activations, les groupes et leurs points d’entrée. Sur la voie adaptative, il a calculé le mode, la réserve, l’ordre et les mesures déjà matérialisées. Certains lecteurs sont encore des fonctions. | Documenter le contexte. Le besoin du prototype, les offres qualifiées, les refus éventuels et la comparaison des contributions sont inconnus. La famille est indéterminée. |
| Dernière instruction avant `decide.run` dans `proposeRecording` | `chooseRecording` a produit un choix local et la famille a vérifié l’acteur et la disponibilité de sa commande. `knownInteraction` provient de l’intention `commit`. `eligibleProbe` provient d’une impulsion à mesurer ou d’une mesure de déplacement. `routeSupported` vaut vrai quand les deux autres conditions sont fausses. `mode` provient de l’exécution, avec le repli natif `exploration`. | Prédire quelle garde du workflow local s’applique à cette invocation. Le nom de la famille désigne le fournisseur en train de travailler. |
| Références à la même coupe | La famille dispose de `observation_ref`, des références des chemins retenus et de celles de l’enregistrement courant. Le collecteur les copie et les déduplique. Dans la fixture, chaque observation possède sa propre référence et les deux citent `fixture:directions-acquises`. | Lier les faits au contexte d’enregistrement. La famille ne calcule pas de justificatif indépendant pour chaque booléen. |
| Après le workflow, la proposition et la délivrance | Le reçu de l’opérateur joint la stratégie de `sic_native_plan` à l’observation du ticket. La fixture vérifie sa cohérence avec la décision locale de la proposition et le passage de la porte native WHY/ACT. | Comparer au choix déjà prédit. Les commandes identiques des deux tickets ne permettent pas de distinguer P07 de P05. |

Le raccord optionnel `createNativeV6Runtime(..., { recordingDecisions })` transmet une boîte locale aux deux variantes du fournisseur d’enregistrement. Juste avant `decide.run`, la boîte reçoit une copie figée des trois booléens, du mode et des références. Aucun rappel applicatif ne s’exécute dans la sonde. La boîte conserve au plus 32 événements entre deux lectures et compte les omissions. Une invocation qui quitte la famille avant ce point ne produit aucun événement. Une omission ou un événement absent laisse le choix local inconnu. [Sélection des familles](../../../src/logos-engine/v6-native-runtime.ts#L808) · [Producteur des faits](../../../src/sic/replay-access.ts#L97) · [Boîte de collecte](../../../src/sic/recording-decision-observation.ts)

`predictLocal` pose une question bornée à l’agenda existant. Les trois descriptions d’offres reproduisent l’ordre déclaré par `landingModule` — route P07, sonde P05, interaction P02. Une offre ultérieure exige la réfutation explicite des gardes précédentes. La sortie est indéterminée si une garde nécessaire manque et vaut abstention si les trois sont fausses. Le mode est passé à l’agenda, les offres locales n’ont aucune préférence de mode dans ce workflow. [Déclaration native](../../../src/sic/highlighted-route-card.ts#L8) · [Adaptation au prototype](predire.mjs)

## Vérifications et portée

- La fixture fournit une scène de niveau 1, des directions déjà acquises et la position du contact. Le service `V6AgentService` délivre les tickets du moteur. Les deux déplacements font passer l’acteur de x=1 à 4, puis à 7. Le retour animé au contact inscrit une impulsion au pas 2. Les retours sont associés au ticket effectivement délivré. [Fixture](fixture.mjs)
- Sonde inactive puis active, le moteur visite dans chaque bras un fournisseur muet suivi de `sic_verify_remote_replay` à chacun des deux gestes. Le groupe suivant reste inexploré. Le vrai workflow s’exécute deux fois et le service délivre deux tickets. Le contrôle compare les tickets complets, l’ordre des visites, les sélections, les empreintes des propositions et de l’état final, la chaîne du graphe et le contenu ordonné de chaque lot d’écritures aux quatre frontières. Les horloges et durées du test sont fixées de manière identique.
- Les écritures cumulées sont **40 → 71 → 81 → 109**. L’empreinte finale des deltas est `e80e5d1f7b1e2ad872debf4dd78ef4a912dc90dfa592993b4042af41a93cc0d4` dans les deux bras. À l’entrée réelle du workflow, le contrôle vérifie que le pré-événement est déjà figé et que les faits copiés correspondent aux arguments reçus.
- Remplacer la stratégie et les autres champs de résultat dans les reçus produit deux écarts et conserve les prédictions. Modifier l’empreinte ou introduire une stratégie, une proposition, un ticket, une commande ou une observation suivante dans l’entrée fait échouer la prédiction. Effacer la garde de route au second geste donne `indéterminé`. La rétablir à `false` redonne P05. [Contrôles de fuite](anti-fuite.mjs)

La capture historique de G50T n’a pas de pré-événement local. Une mesure locale sur ce jeu demanderait de recueillir la même projection lors d’un futur passage. Pour aller jusqu’au **choix de famille avant les fournisseurs**, il manque des descriptions d’offres et de prérequis disponibles à cette coupe, ainsi que le besoin courant. Les essais natifs réellement visités peuvent ensuite être joints en tant que reçus.

Le prototype réservé au Transfert reste `475044aa609fe2934101b6286a96ae544aa24250`. Le verdict indépendant `d775a89b` porte sur l’admission des six nouveaux départs, tous arrêtés avant la première commande. Les deux mondes du cadran passent. Le contrat public `sra.public/1` est figé en `4f3658ea`. L’essai futur du consommateur distinguera l’admission des fiches et la qualité des décisions après admission.
