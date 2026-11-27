# LS19 · confirmer une obstruction par une seule répétition

## Contrat figé avant le changement

La **ligne 91** commence quand une trajectoire auparavant franchissable échoue au contact d’un support identifiable. Son essai consiste à répéter une fois la commande liée à cet arrêt, puis à mesurer si les mêmes porteurs sont encore immobiles dans la même vue. Une seconde immobilité ferme la possibilité de répéter cette commande au titre de la confirmation. La cause exclusive du blocage reste ouverte. La ligne 90 fournit le préfixe d’accès. Les preuves propres à la ligne 91 sont l’admission de la répétition, son retour et la prochaine décision. [Matrice, ligne 91](sic-v8-composition-des-98-strategies.md?plain=1#L131) · [Témoin LS19](sic-v8-strategies-observees.md?plain=1#L117)

La branche `refactor/sic-ls19-ligne-91` part du candidat 90 figé `975d9d809ba1cb41dd8c63414586cb95498018b1`. Elle réutilise ses 14 observations publiques et son hôte de rejeu. Le moteur de l’inventaire `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` et le parent de cette branche reproduisent séparément les tickets 12 à 14 et le compteur 1 → 2 sur la même clé. La preuve du premier arrêt existe donc avant l’extraction de la ligne 90. Sa validation indépendante n’est pas un préalable technique. [Fixture partagée et conditions de capture](sic-ls19-ligne-90.md)

| Moment | Qui décide, avec quelles preuves et quel retour |
|---|---|
| Construire la question, après le tour 12 | Dans `ViewFrontier.record`, la vue reste enregistrée sans décalage, les porteurs attendus sont encore à leurs anciennes poses, et l’entrée projetée est dans l’écran. Pour ce mouvement et cette empreinte, un passage réussi a laissé une texture de référence. La nouvelle texture diffère et un seul support observé couvre les cellules discordantes en contact. La clé lie époque, segment, origine, commande, signature et position du support, ainsi que les poses des porteurs. Une clé déjà testée ne rouvre pas la question. |
| Présenter l’offre du tour 13 | Le support doit toujours être visible à la position enregistrée. Chaque porteur doit rester identifiable de manière unique à la pose attendue, dans la même origine de vue. La clé doit rester disponible. Une réouverture déjà liée aurait priorité. La commande mémorisée fournit un essai d’un seul pas, avec `stationary_trials = 1`, les références des passages et de l’arrêt, et `expected_after = null`. Un changement de portée révoque la question. Le garde peut encore refuser une commande retirée ou une observation périmée. |
| Libérer puis observer | `selectViewStrategy` retient `confirm_access_obstruction` pour le besoin `observe_view_access`. Le garde `bound_view_step` autorise `ACTION2 {}`. La pose finale n’a pas de prédiction positive. Le contrôle de pas rend `matched = null`, `probe_outcome_observed`. L’acquisition relit le déplacement global de la vue et les positions des porteurs. LS19 rend [0, 0] et les deux poses d’origine (40, 50) et (40, 48). La même clé passe d’un arrêt à deux et reçoit la référence de la révision 14. Le retour `no_new_area` vaut zéro pixel et cite l’objectif de l’essai `C_view_e965aabfee26bec4`. |
| Arrêter la répétition ou reprendre | Après le deuxième arrêt, le graphe peut tester un changement du support si une seule commande ponctuelle l’adresse. Sans offre unique, la voie de vue s’abstient. Sur LS19, le service libère au tour 14 `ACTION3` via `view_continuity / test_local_input`. Ce nouveau besoin a son propre identifiant, reprend la référence du retour de l’essai et poursuit `G_protocol_completion`. En cas de porteur déplacé dès la répétition, la question de blocage est levée. Une perte d’enregistrement de la vue efface aussi le blocage. |
| Démontrer l’absence de boucle | À image et commande identiques, retirer le passage antérieurement appris empêche même la création du premier témoin, y compris après deux retours immobiles. À commande autorisée et couverture identiques, faire avancer le porteur après la répétition lève le blocage. Le nombre de pixels nouveaux, la répétition de la commande et l’égalité des images prises isolément sont insuffisants pour conclure. |

L’essai historique distingue trois révisions avec la même empreinte d’image `2282c4bb3152c746`. Les retours aux révisions 13 et 14 désignent deux observations successives. Les références et le compteur de la clé `b03ddaef9975ff61cfea0e67f15909467db18a1e05c723b624b7378185e52619` permettent de vérifier que l’essai a consommé exactement une répétition. Le préfixe du jeu s’arrête au retour du tour 13 dans la fixture. Le service choisit le ticket 14 sur cette dernière observation et le test vérifie sa commande avant exécution. [Test du service natif](../../tests/sic-view-edge-ls19.test.ts) · [Appelant de continuité](../../src/logos-engine/v6-native-caller.ts#L311)

**Second scénario.** La fixture native de référence `known_entry_and_obstruction_cycle` utilise `ACTION1` et un mur en (8, 5). Après le deuxième arrêt, un clic unique `ACTION6(8,5)` devient admissible. Le changement de pixels sur le support permet ensuite une nouvelle `ACTION1` sous `test_reopened_access` avec le témoin du changement. Les contre-épreuves construites retirent l’historique du passage, perturbent la liaison du porteur, du support ou de l’origine, et changent le retour de la même commande. Ce second scénario et ces interventions sont distincts d’une seconde partie réelle LS19. [Fixture de référence](../../tests/fixtures/v6-view-reference.json) · [Assertions de transfert et de refus](../../tests/sic-view-obstruction.test.ts)

**Critère de remise.** Retrouver le ticket historique, son garde, son objectif et le reçu de mesure, conserver la clé et ses références, passer le second scénario et les deux contre-épreuves, puis exposer au choix SIC les preuves typées de l’admissibilité et de la clôture de la répétition. La qualification réservée et l’intégration sur `main` se constatent séparément.

## Ce qui est extrait

Le contrat préalable est publié à `68efddd2d009ace4f4b898cc82c4bb7941e815ae`. Le candidat ajoute deux opérations sur le même témoin typé. `bindViewObstruction` rattache la clé à l’origine, au support encore présent et aux poses uniques, puis fournit au graphe les références et le fait « déjà répété ». La production utilise ce même fait pour préparer l’offre et pour évaluer sa garde dans l’agenda. `observedRepeatedStop` applique la mesure du retour aux mêmes poses, une fois la vue enregistrée. La famille conserve le compteur et ajoute la référence du retour en cas de nouvel arrêt. [Contrat typé](../../src/sic/view-obstruction-trial.ts) · [Consommation avant l’essai](../../src/logos-engine/v6-view-frontier.ts#L179) · [Mesure après l’essai](../../src/logos-engine/v6-view-frontier.ts#L298)

L’identification du support et des textures, la construction de la clé, la disponibilité du clic, la mémoire d’intervention et l’attribution du résultat à l’objectif restent dans leurs appelants. Le graphe existant porte déjà les branches confirmation, changement de support et réouverture. Le garde de libération conserve son rôle sur un essai à un seul pas. L’empreinte historique du ticket 13 couvre le plan, l’agenda, les références, l’admission et le retour immédiat. Elle complète l’assertion explicite sur le passage de 1 à 2 et la reprise au tour 14. [Graphe](../../src/sic/view-strategy.ts#L25) · [Construction du premier témoin](../../src/logos-engine/v6-view-frontier.ts#L315) · [Conservation du reçu](../../src/logos-engine/v6-native-caller.ts#L548)

## Effort comparé

| Périmètre | Ligne 90 · accès au bord | Ligne 91 · confirmation |
|---|---|---|
| Préparation historique | Capture de deux sessions et création d’une fixture de 14 observations, 2 222 octets compressés | Réutilisation du même fichier. L’inventaire et le parent donnent le même résultat aux tours 12 à 14. |
| Travail de production | Projection du coût et du gain, typage des trajectoires et classement des accès. Deux fichiers, 89 lignes ajoutées et 20 retirées. | Liaison du témoin à l’observation et mesure du deuxième arrêt. Deux fichiers, 54 lignes ajoutées et 8 retirées. |
| Preuve propre à la ligne | Sélection du trajet, garde du premier pas et retour de fin de préfixe | Un sous-test supplémentaire dans le rejeu du service et quatre tests ciblés sur la seconde situation. Le compteur, la clôture et la reprise se vérifient séparément de l’accès. |

Les volumes de production se vérifient par `git diff --numstat` dans `src` depuis le parent respectif. Ils mesurent l’étendue du changement. Le transfert indépendant de la ligne 90 a son propre reçu au SHA `331f4076`. Le transfert de la ligne 91 reste à qualifier par SIC 3. [Reçu indépendant de la ligne 90](https://github.com/yannick-fontan-1981/sra-playground/commit/331f4076240b192674e01ab10ea6c9fd4ae96ec0)

## Rejeu pour SIC 3 et le Banc

Depuis la racine, avec Node 24.22.3, exécuter les quatre suites ci-dessous. Le test LS19 rejoue le service avec les observations historiques. Les deux autres points d’entrée pour des situations indépendantes sont `ViewFrontier.propose / before / record` au niveau famille et `V6AgentService.handle` au niveau ticket. Le comparateur doit vérifier la provenance du premier arrêt, le nombre d’essais sur la même clé, le résultat et la commande suivante.

```powershell
node --test tests/sic-view-edge-ls19.test.ts tests/sic-view-obstruction.test.ts tests/v6-view-frontier.test.ts tests/v6-caller-integration.test.ts
npm run typecheck
```

Pour vérifier les 13 commandes exécutées sur le vrai jeu puis la libération du ticket 14, activer le backend de jeu public de la même révision. Le contrôleur choisit toutes les commandes. La fixture sert à les vérifier et à comparer les observations reçues.

```powershell
node scripts/prepare-python.mjs
$env:SIC_LS19_GAME_ROOT = (Resolve-Path .).Path
node --test tests/sic-view-edge-ls19.test.ts
Remove-Item Env:SIC_LS19_GAME_ROOT
```

La vérification locale couvre 37/37 tests sur les quatre suites avec le backend de jeu actif, ainsi que le contrôle TypeScript. Pour isoler le changement, comparer le candidat au parent de production `975d9d80`, ou directement au contrat `68efddd2` qui ajoute seulement la caractérisation. L’intégration reste à décider.
