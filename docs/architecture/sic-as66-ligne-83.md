# AS66 · tester la direction qui donne accès à une cavité

## Contrat de la ligne 83 avant le changement

La branche part de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. L’inventaire donne deux occurrences de `sliding_cavity / cavity_direction_question`. En repartant de L1, `8ce7ee35`, le gel et `3c2d6bcf` retrouvent les deux sondes aux tours 6 et 7 du parcours, au niveau 2. Le témoin de la ligne 83 est le premier, `ACTION1`. [Catalogue](sic-v8-strategies-observees.md?plain=1#L109) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L123)

| Situation à éprouver | Critère de qualification |
|---|---|
| Préfixe natif et changement de niveau | Reconstituer la méthode retenue à la sortie de L1, le corps et la cavité retrouvés en L2, les directions déjà connues et l’offre réellement libérée. Rattacher le retour physique et l’action suivante à la même famille. |
| Même géométrie et mêmes commandes | Une direction connue ne peut être offerte comme inconnue. Une paire direction/contexte déjà testée doit être écartée. Si une seconde question reste admissible, le service ou la famille doit pouvoir la proposer. Si le sujet ou la cavité ne peut être lié, la sonde doit être suspendue. |
| Offre à la bonne géométrie mais à une ancienne observation | Après un retour inchangé construit, représenter au service la vraie offre précédente, avec sa liaison d’origine. Une action peut redevenir utile au même endroit, mais ce ticket périmé doit être refusé. Mesurer séparément ce que vérifient le garde de famille et l’autorité de session. |
| Second contexte | Utiliser l’autre sonde AS66 et une variation de géométrie ou de preuve sur fixture publique. Vérifier le choix, l’action, la portée de la clé d’essai, les références et la raison de refus ou de reprise. |

Le lot porte sur la disponibilité d’une **sonde** après réidentification. La glissade complète et le mode SIC exclusif ont déjà leurs témoins séparés. En cas d’écart, limiter le changement à l’autorité concernée et préserver les deux occurrences historiques.

## La sonde réellement disponible

**La ligne 83 est déjà composable sur le gel.** Le point d’appel `SlidingCavity.proposeDirectionQuestion` fournit une proposition native complète. Le test remplace l’offre nominale par une autre offre fabriquée à ce même point, avec les mêmes observations, la même mémoire et les mêmes commandes disponibles. Le service vérifie ses liaisons, libère l’autre commande et utilise son vrai retour. Une offre ancienne qui arrive à ce point est refusée par l’autorité de composition. Le lot ajoute des témoins sans modifier la production. [Sélection de la famille](../../src/logos-engine/v6-sliding-cavity.ts#L32) · [Producteur](../../src/logos-engine/v6-sliding-cavity.ts#L45) · [Offre de remplacement](../../tests/sic-cavity-direction-as66.test.ts#L100)

| AS66, session neuve depuis L1 | Besoin, commande et retour |
|---|---|
| T1 à T5 | La frontière explore. À T5, un plan `sliding_cavity_access` libère `ACTION2` et termine L1. `SlidingCavity.record` conserve la méthode d’arrêt et sa référence à l’arrivée en L2. Les directions d’`ACTION2` et d’`ACTION3` existent déjà. |
| **T6, première occurrence** | Le type de corps retenu en L1 est [8,4,4]. La famille relie le nouveau carré plein de couleur 11, en (48,26), à l’unique cavité compatible et à sa surface connectée. Le reçu nomme le composant, la cavité et la surface. Aucun plan d’accès complet n’est encore disponible. La sonde propose `ACTION1` avec direction inconnue. La référence courante et celle de la méthode retenue coïncident ici (révision 6, image `fb4c841eea2f859a`). P05 publie une seule référence distincte. |
| Retour de T6 puis **T7, seconde occurrence** | Le corps arrive en (48,46). Le déplacement final dans l’ordre [ligne,colonne] est [20,0]. Les images intermédiaires permettent de retenir le sens [−1,0] d’`ACTION1`. Le retour de la sonde vaut `matched=null` et scelle le pas. La nouvelle offre lie `ACTION4` à (48,46), avec la référence courante de révision 7 et celle de la méthode de révision 6. |
| Retour de T7 puis T8 | Le corps arrive en (40,46). Le déplacement final est [0,−8] et le sens mesuré d’`ACTION4` est [0,1]. Les deux clés d’essai figurent en mémoire. La famille libère maintenant `sliding_cavity_access / ACTION1` et le premier pas d’accès obtient `matched=true`. |

Les positions du plan sont en (x,y). La mesure des vecteurs utilise l’ordre [ligne,colonne]. Sur ce plateau, déduire le sens de la seule différence entre positions finales donnerait le signe opposé pour les deux sondes. Le code compare les positions successives sur le paquet d’images, retient les pas locaux alignés et enregistre séparément le déplacement final. [Mesure sur les images publiques](../../src/logos-engine/v6-sliding-cavity.ts#L24) · [Assertions du préfixe](../../tests/sic-cavity-direction-as66.test.ts#L70)

### Portée de la preuve

| Ce qui change | Décision observée |
|---|---|
| Nouveau corps après un niveau réussi | La méthode est retenue. Dans le cas de T6, la taille et la surface du corps, la cavité unique, la phase géométrique et le sol connecté doivent concorder pour relier le nouveau corps. Le code conserve les directions déjà mesurées. Le changement de couleur seul ne déclenche pas automatiquement quatre nouvelles sondes. |
| Corps introuvable | Le test retire seulement le corps 4 × 4 du plateau de la fixture, remesure l’observation publique et appelle `SlidingCavity.propose`. La famille rend `null`. Une perte de sujet suspend l’offre. |
| Même géométrie après un retour sans mouvement | La question a été essayée même si la direction reste inconnue. La clé porte sur l’époque, la commande, les boîtes du corps et de la cavité et la géométrie intérieure des surfaces. À la révision suivante sur la même image, `ACTION1` est écartée et une offre fraîche pour `ACTION4` est admise. |
| Géométrie déplacée avec la direction toujours inconnue | Sur la fixture, la mémoire des directions est tenue fixe et la clé de la première sonde est marquée essayée. Présenter la seconde position du corps donne une nouvelle clé et rend `ACTION1` de nouveau admissible. Une direction déjà mesurée est exclue avant le calcul de clé. |
| Ancienne offre, même image, même époque | Le garde de famille admet encore la géométrie. Le test représente au service la vraie offre de T6 après un retour stationnaire construit. `CompositionTargetTree` compare la référence et l’époque de la liaison à l’observation courante. Le service s’arrête avec `composition_target_stale_proposal`, sans ticket. L’arrêt concerne l’offre ancienne délibérément représentée. La sélection normale sur les mêmes données libère `ACTION4`. |

La référence d’observation lie le **plan** à un instant. La clé géométrique empêche de répéter une **question** dans le même contexte. Enfin, la direction retenue par commande sert à établir un **trajet** après réexamen du corps, de la cavité et du sol courants. [Clé et mémoire des essais](../../src/logos-engine/v6-transition-learning.ts#L725) · [Choix des commandes inconnues](../../src/sic/missing-control-strategy.ts#L36) · [Garde géométrique](../../src/logos-engine/v6-sliding-cavity.ts#L42) · [Autorité de composition](../../src/logos-engine/v6-target-binding.ts#L76)

### Second parcours dans le jeu source

À T6, le test appelle le producteur natif ordinaire, puis un second producteur de la même classe, restauré avec le même état et donnant priorité à `ACTION4`. Seul le classement de ce second producteur est construit. Les deux offres ont la même liaison et les mêmes références de preuve. Leur commande et leur clé de question diffèrent. L’offre alternative est effectivement consommée par le service natif. Le jeu source déplace le corps de (48,26) à (28,26) après `ACTION4`. Le service dispose alors d’un trajet, libère `sliding_cavity_access / ACTION2` dès T7 et vérifie le pas. Dans l’historique, `ACTION1` en T6 laisse encore une question pour T7. Le retour de l’alternative et le ticket suivant proviennent du vrai AS66. Ce parcours construit ne compte pas comme une troisième occurrence historique. [Transfert de l’offre jusqu’au retour](../../tests/sic-cavity-direction-as66.test.ts#L100)

### Attribution et reproduction

Le pack natif par défaut reproduit les deux occurrences historiques, **2/2**, sur `8ce7ee35`, `d0e7527c` et `3c2d6bcf`. Les deux dernières révisions concordent sur les projections capturées des 16 décisions et retours. Sur le gel, `unmeasuredControls` énumère les entrées disponibles sans direction, la famille écarte les clés déjà tentées puis `bindMissingControlTrial` qualifie son offre. Le changement P05 de `3c2d6bcf` réorganise cette dernière qualification. Le comportement du fournisseur, son remplacement et le refus d’une offre périmée sont prouvés sur l’arbre de production du gel. Le lot de tests n’ajoute aucune migration de moteur. Sa qualification indépendante reste à recevoir. La reprise `follow_measured_slide` du mode SIC exclusif concerne un autre chemin. [Qualification d’une commande préparée](../../src/sic/missing-control-strategy.ts#L45) · [Autre parcours AS66](https://github.com/yannick-fontan-1981/sra-playground/blob/981b9ab9599ccb3e0f7cd12cd50fd070e2e582d7/docs/architecture/sic-transition-effet-acces-as66-g50t.md)

Les quatre suites passent 97/97 avec les jeux sources. Avec Node 24 depuis le checkout du lot, la première commande rejoue les cas publics figés. Pour les deux parcours dans le jeu source, désigner un checkout contenant `public/python` et `public/vendor/pyodide`. Le test envoie chaque ticket exécuté au vrai jeu et compare le paquet public reçu. La fixture contient le préfixe historique et les deux retours de la variante, SHA-256 `1043016c6a19a2f9d835cfc5a2ad52125f6e77cf0d310b258bd1de57bdd3c608`. [Fixture](../../tests/fixtures/sic-cavity-direction-as66-public.json.gz)

```powershell
node --test tests/sic-cavity-direction-as66.test.ts
$env:SIC_CAVITY_GAME_ROOT = (Resolve-Path ../sic-cartographie-p05).Path
node --test tests/sic-cavity-direction-as66.test.ts tests/v6-sliding-cavity.test.ts tests/sic-control-effect.test.ts tests/sic-native-resolution.test.ts
Remove-Item Env:SIC_CAVITY_GAME_ROOT
git diff --exit-code d0e7527ca8033bd805a6d7a8bb021eff62e87021 HEAD -- src
```
