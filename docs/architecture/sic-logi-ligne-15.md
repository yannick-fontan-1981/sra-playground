# LOGI · mesurer quels affichages répondent ensemble

## Référence et préenregistrement de la ligne 15

La branche `refactor/sic-logi-ligne-15` part du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Deux sessions neuves de LOGI, sur `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` (inventaire historique) puis sur le gel, retrouvent le tuple `information_goal / coupled_displays / experiment` dès le premier tour. Le moteur choisit lui-même `ACTION6(49,50)` et le jeu rend un changement local et distant. Les réglages sont ceux du lanceur d’inventaire, graine 0, niveau 1, pack natif par défaut, plafond de session 16 et 600 actions par niveau. [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L55) · [Témoin](sic-v8-strategies-observees.md?plain=1#L41) · [Campagne](../../tests/helpers/sic-qualification.ts#L175)

La fixture conserve les observations publiques initiales et les deux premiers retours sur LOGI et REWI, produits par le moteur historique. Chaque partie a été initialisée séparément avec le même identifiant déterministe de capture. Le test peut attribuer une autre session au rejeu pour vérifier la portée d’un nouveau besoin. Le moteur ne reçoit que l’observation publique courante. SHA-256 de la fixture compressée `9f2a049421405a35829214a44950ceb9a30e08c126ae052e32e53de459949158`. [Fixture](../../tests/fixtures/sic-information-displays-public.json.gz)

| Référence ou variation fixée avant extraction | Choix ou retour attendu |
|---|---|
| LOGI réel, tour 1. Contrôles [3, 3, 3], récepteurs [11, 11, 3]. | Un seul plan d’information admissible. Le clic sur le contrôle 2, (49, 50), donne [3, 3, 14] et [3, 11, 11]. La mesure valide `coupled_switch` et contredit `inert_decoration` et `local_switch`. Le contrôle de pas natif demeure sans prédiction vérifiée. |
| Variation construite sur la même observation initiale. Déplacer uniquement la valeur minoritaire des lampes de droite à gauche, de [11, 11, 3] à [3, 11, 11]. Conserver la géométrie, les commandes disponibles, le budget et les trois contrôles. | À froid, le producteur doit préférer le contrôle 0, `ACTION6(5,50)`. La source de l’offre, le besoin d’information et les trois prédictions restent du même type. |
| Même commande autorisée du premier tour. Conserver le changement local du contrôle 2, remettre seulement les lampes à leurs valeurs initiales dans le retour. | Le résultat devient `local_only`. La prédiction `local_switch` devient la seule compatible pour cet essai. |
| LOGI réel, tour 2. Un parent est engagé après le premier retour mesuré. | Le reçu contient deux offres admissibles. Le clic retenu (5, 50) sert le parent engagé. Le passage au niveau suivant laisse les trois hypothèses de cet essai inconnues. |
| REWI réel, nouveau contexte de mesure. Six contrôles et cinq récepteurs. | Le premier clic (34, 61) laisse les valeurs stables. La mesure `unchanged` valide la prédiction inerte, écarte ce contrôle et le prochain clic est (28, 61). |

La qualification demande de distinguer les commandes examinées au sein du producteur, les offres réellement présentées à l’élection et celles que le planificateur essaie. Il faut contrôler les observations citées par le besoin et le retour, la commande libérée et l’effet de chaque intervention à l’entrée native. La concurrence constatée au deuxième tour doit être attribuée à ses vrais producteurs. La ligne 16 garde son critère et son verdict propres.

## Verdict sur le code du gel

**La ligne 15 est fonctionnellement composable de bout en bout sur `d0e7527c`.** Le préenregistrement est `e03b78df`. Les tests ajoutés à `7bf3c85a` s’exécutent avec le même arbre `src` que le gel. La preuve est nouvelle. Le comportement était déjà présent. Le typage du candidat a un statut d’intégration séparé. [Tests sans changement du moteur](https://github.com/yannick-fontan-1981/sra-playground/blob/7bf3c85a4183baf0dd535ca7c97d055bb6a0b958/tests/sic-information-displays.test.ts)

| Critère | Preuve sur le gel | Ce que mesure le test |
|---|---|---|
| **a · articulation réutilisée** | Dans les deux jeux, la même classe `CoupledDisplays` fournit une expérience adressée à `NativeCallerCoordinator.informationOffer`. `electInformationGoals` évalue les prédictions, les relations, la préservation et le budget. `selectInformationStrategy` appelle le planificateur des offres ordonnées jusqu’au premier plan admissible. Le service source de REWI initialise une nouvelle instance de besoin et rappelle cette même chaîne avec six contrôles et cinq récepteurs. | Les observations des producteurs sur LOGI utilisent des espions en lecture qui appellent les méthodes d’origine. La session REWI a une portée distincte, élit le contrôle 5, mesure le retour, exclut ce contrôle inerte et élit le 4 à géométrie identique. [Appelant](../../src/logos-engine/v6-native-caller.ts#L439) · [Sélection paresseuse](../../src/sic/information-strategy.ts#L35) · [Test du nouveau besoin](../../tests/sic-information-displays.test.ts#L132) |
| **b · changement causé par une preuve** | Sur le plateau initial de LOGI, la rareté des valeurs des récepteurs départage les commandes encore éligibles. Déplacer seulement la valeur minoritaire de la troisième lampe à la première déplace le ticket de (49, 50) à (5, 50), en conservant la géométrie, le besoin et les prédictions. Au tour 2, l’historique d’un contrôle modifié engage le parent. | Dans la contre-épreuve d’élection, les deux offres réelles du tour 2 restent disponibles avec une même préférence pour le contraste de point. Enlever uniquement le fait `engaged_parent` donne la priorité au point. Ce dernier choix est exercé au niveau de l’électeur. Le changement de clic dû aux lampes est, lui, vérifié sur le ticket du service. [Filtre du parent](../../src/logos-engine/v6-information-goals.ts#L42) · [Deux interventions](../../tests/sic-information-displays.test.ts) |
| **c · plan libéré, retour et reprise** | Au tour 1, l’autorité `information` libère `ACTION6(49,50)` après le garde `current_public_premises_match_provisional_step`. L’objectif est `C_information_a99bf5cf9b23843f9e9c`, parent `G_protocol_completion`. `CoupledDisplays.observe` lit les zones liées avant et après le clic. `reconcileInformationGoal` vérifie séparément chaque prédiction. Le reçu cite la révision 2, empreinte `34dc642370301773`, et le même objectif. | Le journal d’acquisition contient l’effet `coupled` pour le contrôle 2. Le ticket du tour 2 conserve le besoin et adresse le contrôle 0. Un retour où seule la valeur du contrôle change conserve la même commande initiale et valide `local_switch`. Un récepteur illisible laisse les trois contrôles d’hypothèses inconnus et l’historique de mesure vide. [Acquisition](../../src/logos-engine/v6-native-caller.ts#L557) · [Vérification des prédictions](../../src/logos-engine/v6-information-goals.ts#L79) · [Publication du retour](../../src/logos-engine/v6-native-runtime.ts#L1842) |

### Offres réellement disponibles sur LOGI

- **Tour 1.** Les trois contrôles de la rangée fournissent des positions de clic possibles. Le producteur classe les contrôles selon les états déjà visités, les effets déjà mesurés, la distance aux récepteurs minoritaires puis la position. Il soumet un seul clic, sur le contrôle 2. Le producteur de contraste de point et le producteur de contraste de mouvement rendent chacun une liste vide. L’appelant ne reçoit aucune offre additionnelle. Le reçu contient `admissible_offers = 1`, `distinct_outcomes = 3` et `rejected = {}`. [Producteur](../../src/logos-engine/v6-coupled-displays.ts#L92) · [Test des offres](../../tests/sic-information-displays.test.ts)
- **Tour 2.** Le point propose (49, 50), les affichages proposent (5, 50) et le mouvement ne propose rien. Les deux offres sont admissibles. La politique préserve le parent engagé par la mesure du premier clic. Elle ordonne l’offre des affichages en tête et le premier plan aboutit. Le reçu de sélection contient une seule entrée `selected`. Aucun garde n’a rejeté l’offre du point. Le passage en niveau 2 après ce clic conserve le schéma acquis et rend les trois prédictions de cet essai inconnues. [Élection et plan](../../src/logos-engine/v6-native-caller.ts#L478) · [Règles d’ordre](../../src/logos-engine/v6-information-goals.ts#L24)

### Frontière et décompte

Le plus petit contrat se trouve déjà entre le producteur de l’offre et son consommateur au retour. Le candidat donne un type à la commande, aux deux rangées de zones, à l’index adressé, aux valeurs initiales, à l’époque, au score de départ et aux trois prédictions. `observe` expose les résultats `unchanged`, `local_only`, `coupled`, `other`, la frontière `boundary` et la mesure absente `null`. La reconnaissance des rangées encadrées, le choix d’une adresse dans un contrôle et l’histoire des valeurs restent spécifiques aux affichages. L’élection de l’expérience, la garde, la vérification de chaque hypothèse et la portée du besoin restent dans les articulations existantes. [Contrat de mesure](../../src/logos-engine/v6-coupled-displays.ts) · [Partition des hypothèses](../../src/sic/discriminating-experiment.ts)

Le seul fichier de production modifié est `v6-coupled-displays.ts`. Avec TypeScript 5.9.3, cible et module ESNext, sans commentaires, sa compilation sur le gel et le candidat donne le même JavaScript, SHA-256 `8178d156fa9d96a27f2d03384ad8585cb0cc01fef3758a69778d5200d445be48`. Cette égalité vérifie la préservation du comportement par le typage. Les trois preuves du tableau justifient le crédit fonctionnel sur le gel. Pour les 98 démarches, compter la ligne 15 une fois. Les types et tests de branche attendent leur intégration. La présence d’une offre concurrente de point ne qualifie pas la ligne 16.

Les témoins portent sur les deux premiers tickets de LOGI et REWI et sur des interventions construites. Ils établissent la reprise d’une expérience sur une nouvelle instance du besoin d’information. La mémoire de la famille conserve les essais par contrôle et état. Les trois verdicts d’hypothèse concernent le retour de l’essai courant. La reprise avec une géométrie hors du détecteur de rangées ou avec une quatrième sorte de prédiction demanderait un témoin distinct.

## Reproduire

Pour vérifier la qualification rétroactive, utiliser le commit de tests `7bf3c85a4183baf0dd535ca7c97d055bb6a0b958` dans un checkout dédié. La première commande doit sortir avec le code 0 et un diff vide. La seconde rejoue les quatre cas avec le service natif.

```powershell
git diff --exit-code d0e7527ca8033bd805a6d7a8bb021eff62e87021 7bf3c85a -- src
node --test tests/sic-information-displays.test.ts
```

Sur le candidat, la suite de caractérisation et les contrôles de référence passent **118/118** avec Node 24.22.3. TypeScript passe également. Pour comparer les jeux source et les fixtures, préparer les actifs dans le checkout, puis activer le backend. Les jeux exécutent la commande libérée et chaque observation publique retournée est comparée à sa référence historique.

```powershell
node scripts/prepare-python.mjs
$env:SIC_INFORMATION_GAME_ROOT = (Resolve-Path .).Path
node --test tests/sic-information-displays.test.ts tests/v6-point-display.test.ts tests/v6-goal-attention.test.ts tests/v6-control-attention-reference.test.ts
Remove-Item Env:SIC_INFORMATION_GAME_ROOT
npm run typecheck
```
