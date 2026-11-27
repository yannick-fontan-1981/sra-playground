# LS19 · Ligne 92 · Essayer une commande pour reprendre l'exploration

**Au niveau 1, le geste 14 est une sonde de continuité.** La répétition du geste 13 a confirmé une deuxième immobilité. La famille de vue ne dispose alors d'aucune commande ponctuelle pour éprouver le support. Elle rend la main. La famille `view_continuity` obtient une question locale, émet `ACTION3` et acquiert son retour. Au geste 15, le moteur émet encore `ACTION3`, cette fois pour une nouvelle question ordinaire de `observed_frontier`.

## Ce que le moteur sait au moment du choix

Le rejeu démarre LS19 à zéro niveau terminé avec la configuration de l'inventaire, la session `sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10`, un plafond de 600 actions par niveau et la limite de seize gestes du témoin. Le jeu local fournit les retours. L'archive partagée de 90/91 permet de vérifier les quatorze premières observations, du départ jusqu'au retour du geste 13, et les treize premières commandes. Les derniers gestes sont joués dans LS19. Le statut terminal de ce préfixe est `session_action_budget`. [Inventaire](../../../docs/architecture/sic-v8-strategies-observees.md?plain=1#L118) · [Archive publique reprise à l'identique](../../../tests/fixtures/sic-view-edge-ls19-l1.json.gz)

Le trajet vers le bord (90), puis la répétition de `ACTION2` (91), précèdent ce choix. Le registre contient un blocage de même clé `b03ddaef…`, deux essais stationnaires, deux porteurs aux poses (40,50) et (40,48), l'origine (0,0) et cinq références publiques, révisions 10 à 14. Les révisions 12, 13 et 14 portent la même empreinte de trame `2282c4bb3152c746`. Leur ordre permet de distinguer le premier arrêt de la répétition. Aucune révélation antérieure n'est présente dans ce cas.

1. `ViewFrontier.propose` reconnaît le blocage réitéré. Ce chemin peut proposer un test sur le support si une commande ponctuelle unique le désigne. LS19 propose ici quatre directions et zéro commande ponctuelle. Le chemin du blocage retourne une offre vide avant la boucle qui projette les trajets de bord. « Aucun meilleur trajet » signifie ici qu'aucun trajet prioritaire n'a été proposé. Une comparaison exhaustive des trajets n'a pas eu lieu. [Famille de vue](../../../src/logos-engine/v6-view-frontier.ts)
2. `NativeCallerCoordinator.continuityOffer` vérifie `hasObservedViewQuestion()`, filtre les commandes sans coordonnées et transmet les références de `continuityEvidence()` au fournisseur de frontière. Cette voie admet aussi une révélation de vue enregistrée. Elle suit la famille de vue dans le parcours de ces offres. [Appelant](../../../src/logos-engine/v6-native-caller.ts) · [Répartiteur](../../../src/logos-engine/v6-native-runtime.ts)
3. `ObservedFrontier.open` retient les questions encore ouvertes dans cet état et les ordonne. Trois offres ont la priorité 3. Le critère suivant est le nombre d'essais de la commande dans le niveau, puis l'ordre canonique de la commande. `ACTION2` a déjà été essayée sur cet état. Les trois questions classées avant l'appel à l'agenda local ont pour sceau `f9a36ade6945f11412480cc1488755e725bef2e2fc1ab378fa413b76d95c32a9`. [Ordre natif](../../../src/logos-engine/v6-observed-frontier.ts) · [Sonde de qualification](sonde.mjs)

| Ordre | Question et commande | Essais dans le niveau | Sort |
|---|---|---:|---|
| 1 | `Q_779c7e6fe44602f2b143` · ACTION3 | 0 | À égalité avec ACTION4, première en ordre canonique |
| 2 | `Q_fb9d96daaaf3dddd5dd5` · ACTION4 | 0 | Également admissible et libérable |
| 3 | `Q_525c8138b847994b3335` · ACTION1 | 6 | Différée par le critère `least_tried` |

4. `selectFrontierStrategy` reçoit la première question et la sélectionne par `test_local_input`. Le trajet vers un autre état reste non cherché tant qu'une question locale existe. La garde `current_public_premises_match_provisional_step` autorise le ticket `sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10:native:14`. Le besoin est `sic-need:1d553a7a33e1fc6718c808889a1510b196c28d63977dfd7efda835f5e0f43149`, de contrat `acquire_the_selected_input_return`. [Sélection locale](../../../src/sic/frontier-strategy.ts)
5. Le retour est la révision 15, trame `8f49bd977620acf2`. Le reçu donne `unknown_effect_observed`, `matched:null` et `observed` pour la question et le besoin du ticket 14. La mesure de vue enregistre un décalage (0,0) et zéro pixel de surface supplémentaire. L'enregistrement porte encore la clé et le compteur 2. Au prochain choix, la vérification des conditions actuelles du blocage l'efface. L'appelant de continuité ne trouve plus de question de vue. La famille ordinaire obtient `Q_c84b2a436850df62152b` et son propre besoin pour le geste 15. [Rejeu du service](jouer.mjs)

## Contre-épreuves et seconde situation

| Variation | Attendu et obtenu |
|---|---|
| Au tour 14, rétablir le témoin natif conservé avant la répétition | Même plateau et mêmes quatre directions. Le compteur redevient 1. La famille `view` émet `ACTION2` pour confirmer, avant tout appel au fournisseur de continuité. Au tour suivant, la sonde `ACTION3` redevient admissible. |
| Retirer la question de vue au même tour | `continuityOffer` rend la main. La famille ordinaire libère `ACTION3` et reçoit la même trame du jeu. Son objectif est « observer l'effet de l'entrée inédite ». |
| Retirer seulement la finalité au point d'appel du fournisseur de frontière | La même famille transmet la même commande, cette fois avec le libellé ordinaire. L'attribution de 92 demande le reçu de finalité et le retour lié à la question. |
| Retirer ACTION3 du domaine public de l'observation 14 | Le vrai classement du gel retient `ACTION4`. Le service exécute le geste et rattache le retour à sa question. La restriction du domaine est une intervention d'opérateur. |
| Fournir la deuxième offre à l'arbitre dans un processus témoin | Les trois offres et leur sceau sont identiques au nominal. `selectFrontierStrategy` reçoit la question ACTION4 déjà admissible. Le service émet effectivement `ACTION4` et acquiert son retour. Ce test porte sur la consommation d'une autre offre. |
| Garder seulement les commandes ponctuelles à l'entrée de continuité | Il n'en existe aucune à ce tour de LS19. Le fournisseur renvoie `unknown_no_observed_view_access`. Le service s'arrête après 13 commandes avec `frontier_unknown_no_observed_view_access`. |
| Translation d'une autre vue, sans blocage | Quatre points colorés sur un raster 24 × 16 se déplacent de deux pixels vers la droite. Le moteur enregistre un déplacement global et 32 pixels nouveaux. La famille de vue n'offre aucun trajet. Le même fournisseur de continuité reçoit la référence de révélation, sonde `ACTION1` puis, après un retour stationnaire, `ACTION2`. |
| Refus sur cette autre vue | Avant la révélation, le fournisseur rend la main. Avec les cinq commandes ponctuelles effectivement dérivées de l'observation comme seul domaine, il refuse la sonde. Après les deux essais directionnels, la recherche d'un autre état accessible aboutit à `frontier_exhausted`, besoin ouvert, aucune commande. |

Les variantes historiques rejouent le service et le jeu. Les changements de mémoire interviennent dans un processus d'expérience au tour annoncé. La seconde situation exerce `ViewFrontier.record`, les fournisseurs de l'appelant, la garde et l'acquisition de `ObservedFrontier` sur des retours construits. [Géométrie publique](public/translation.json) · [Fixture native](seconde-vue.mjs)

## Attribution et remise

**Le gel porte la composition démontrée.** L'appelant réutilise la frontière ordinaire avec une finalité et des preuves de vue. Le changement des preuves peut donner la main à une autre famille, et le changement du domaine peut faire consommer une autre offre locale. La sélection et l'acquisition sont réutilisées sur la seconde vue. La preuve de blocage conditionne l'admission de la voie sur LS19. Les usages des commandes et l'ordre canonique départagent les gestes à l'intérieur de cette voie. La contribution de ce lot est la qualification. Le diff de production par rapport au gel est vide.

| Révision | Vérification |
|---|---|
| `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` | Reproduction du nominal de l'inventaire |
| `d0e7527ca8033bd805a6d7a8bb021eff62e87021` | Gel, sept conditions du service et seconde vue |
| `14db9cd82a345752030531e9db37fb7c0ea6df45` | Candidat 91 qualifié, rejoué à part sur le nominal, l'autre offre et le retour au premier arrêt, plus la seconde vue |
| `76647ca8d509facc9e4c36fc95569a20d4826963` | [Critères figés](ATTENDUS.md) avant qualification |

Le rejeu se lance depuis la racine du checkout avec Git, tar, Node.js 24.22.3 et le paquet Pyodide local 314.0.7 du Banc.

```powershell
$d = 'experiments/sic-agenda-offres/continuite-92'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/sic-ligne92.json"
& "$d/lancer.ps1" operateur --moteur gel --condition commande-retiree --pyodide $py --recu "$env:TEMP/sic92-operateur.json"
```

Le point d'entrée [opérateur](operateur.mjs) accepte `candidat`, `gel`, `historique` et `ligne91`. Les conditions sont `nominal`, `premier-arret`, `sans-question`, `but-ordinaire`, `commande-retiree`, `autre-offre` et `ponctuelles`. `--sans-sonde` exécute le nominal sans instrumentation. Le [vérificateur](verifier.mjs) confronte les tickets, les objectifs, les gardes et les retours de ce passage au nominal instrumenté et émet un reçu JSON réduit. Les verdicts 90 et 91 restent distincts de celui de la ligne 92.
