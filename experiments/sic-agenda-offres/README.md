# Agenda SIC par besoin et par preuve

Cette expérience choisit une **description de stratégie** pour le besoin du tour. Elle peut aussi demander une preuve ou attendre la révision d’une prémisse. Le moteur du jeu reste propriétaire des planificateurs, des commandes et de leurs tickets.

Base vérifiée dans un checkout propre, `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, branche `prototype/sic-agenda-offres`. Les deux branches de l’exemple appartiennent au pack SIC strict de cette révision. Les observations, leurs références et leur mise en concurrence sont écrites à la main.

## Rejouer hors ligne

Depuis la racine du checkout, sous PowerShell :

```powershell
.\experiments\sic-agenda-offres\rejouer.ps1
```

Sous tout système avec Node ≥ 22.18, la commande équivalente est `node experiments/sic-agenda-offres/experiences.mjs`. Aucune installation npm. Ajouter `--trace` pour obtenir le JSON de chaque tour, avec les preuves de chaque garde, le motif pour chaque branche, les égalités, les retours au parent et le chemin actif. Le script vérifie les attentes indépendantes avant d’imprimer le tableau. Le lanceur PowerShell choisit un Node compatible parmi ceux du PATH.

[Tableau attendu et obtenu](RESULTATS.md) · [Cas et témoins](cas.mjs) · [Arbitrage](agenda.mjs) · [Assertions](experiences.mjs)

Le premier essai croisé réutilise ce cœur avec la fiche publique du cadran et l’opérateur du lot Transfert. Les deux mondes ont rendu `succès` en quatre actions. [Parcours, preuves, adaptation et commande de rejeu](transfert/README.md)

## Du parcours de SIC à la commande

| Étape sur le SHA figé | Fonctionnement observé |
| --- | --- |
| Groupes du solveur strict | `createNativeV6Runtime` construit la liste à partir de `standalonePlanningGroups` et `planningGroupsWithExperiments`. Ce dernier insère des groupes et des entrées selon la configuration. Les deux familles étudiées figurent dans `explore_available_inputs`, la comparaison avant le réexamen directionnel. [Construction](../../src/logos-engine/v6-native-runtime.ts#L2901) · [Liste](../../src/sic/standalone-families.ts#L120) · [Insertion](../../src/sic/experiment-selection-groups.ts#L12) |
| Parcours | Dans `NativeV6Runtime.selectFamily`, la voie active avec programme non édité appelle `selectStrategyFamily(groups, offer, order)`. Le callback `offer` parcourt les entrées activées d’un groupe, utilise le cache de l’entrée ou appelle `proposeInSubquestion`, `proposeInGroup` ou `propose`. Une proposition retenue termine le groupe. Le premier `FamilyTrial.selected` termine le parcours. Une coordination peut retenir un autre groupe et conserver `source_trigger_group`. Un essai négatif permet de continuer, un essai indisponible donne `complete: false`. [Boucle des groupes](../../src/sic/family-agenda.ts#L23) · [Boucle des entrées](../../src/logos-engine/v6-native-runtime.ts#L860) |
| Refus et portée | Après une proposition nulle, `retainProposalRefusal` vérifie observation, époque, image et absence d’autorité. Avec `block_unrelated_probe: true`, le propriétaire retient sa question à sa place dans le parcours. Le callback renvoie une offre d’arrêt de statut `unknown` à préfixe vide. `plan` traite le refus avant la libération. Un `sourceGroupStop` reconnu après un résultat nul ferme seulement le suffixe de son groupe. Un refus de témoin de service fait `continue` à cette entrée. Une garde inconnue ou contredite ne crée aucun de ces arrêts. Les exceptions de coordination existantes, par exemple `scopeStationaryContactRefusal`, restent du ressort de la source. Les cas injectent le **reçu effectif** après cette qualification. [Admission et arrêts](../../src/logos-engine/v6-native-runtime.ts#L887) · [Validation des reçus](../../src/logos-engine/v6-native-runtime.ts#L1040) · [Traitement du refus](../../src/logos-engine/v6-native-runtime.ts#L684) |
| Modes | `selectReasoningMode` choisit, par priorité, assimilation à l’entrée du niveau, exploration après contradiction, résolution (`solving`) après concordance, assimilation si de l’information a été acquise, exploration sinon. `selectFamily` place le mode dans le contexte d’exécution. `reasoningGroupOrder` réordonne seulement les places des groupes nommés par la carte, selon le mode et la réserve. Les deux familles étudiées restent dans le même groupe. Le réglage d’agenda `active/shadow/native` est une autre dimension. [Règles des modes et cartes](../../src/sic/reasoning-mode.ts#L14) · [Contexte](../../src/logos-engine/v6-native-runtime.ts#L807) |
| Autorisation | `NativeV6Runtime.plan` contrôle la proposition, la lie et fige le préfixe. `authorize` vérifie budget, commande disponible, choix fatal déjà observé, garde `family.before`, préservation et liaison du point. La première libération passe par `authority.release` si cette autorité existe. `output` émet la commande avec observation, révision et index. Côté jeu, `validateAction` vérifie le ticket, son unicité, son graphe, son image et sa commande avant exécution. [Préfixe](../../src/logos-engine/v6-native-runtime.ts#L730) · [Autorisation](../../src/logos-engine/v6-native-runtime.ts#L1523) · [Ticket côté jeu](../../src/runtime/v6-agent.ts#L309) |

Les exemples natifs de portée comprennent le refus bloquant de `NativeSelectedRigid` et la reconnaissance de `relative_arrangement` dans `window_constraints` dans la configuration étendue du moteur. Les essais de portée injectent les mêmes contrats dans une liste miniature, avec une entrée témoin dans le groupe suivant. Ils ne supposent pas que les deux familles strictes émettent elles-mêmes ces refus. [Refus bloquant](../../src/logos-engine/v6-selected-rigid.ts#L237) · [Arrêt du groupe](../../src/logos-engine/v6-native-runtime.ts#L2756)

## Deux descriptions d’offres

| Branche | Éléments réellement produits dans la famille | Traduction manuelle dans le cas |
| --- | --- | --- |
| `comparaison` · `sic_compare_available_controls / compare_alternative` | Dans `createSicCompareAvailableControls().propose`, deux directions sont disponibles. Le lecteur de mouvement rapporte un retour courant de la même époque, la lecture d’animation est disponible et une seule translation a ses deux composantes non nulles. La commande précédente appartient à la paire. La famille choisit l’autre commande admise. La proposition porte `sicLocalDecision.need`, `sicSituationCard.evidence` et `sicSrcDecision.situation.compare`. [Producteur](../../src/sic/compare-available-controls.ts#L36) | `retourDiagonalUnique` résume ce témoin contextualisé. `mouvement-7-8` confirme la diagonale. `mouvement-7-8-axial` documente une translation axiale et contredit la prémisse. Les deux autres références décrivent l’admission de l’autre commande et l’état ouvert de la comparaison. |
| `acces` · `sic_recheck_directional_controls / P07` | Dans `createSicRecheckDirectionalControls().propose`, `observedCommandFrontier` recherche un état avec entrée inexplorée. Un premier arc attesté donne `routeSupported` et la stratégie P07 si le workflow la confirme. La proposition conserve la référence de cet arc, la destination attendue et le besoin `compare_current_directional_controls` dans le cas directionnel. [Producteur](../../src/sic/recheck-directional-controls.ts#L71) · [Recherche des transitions](../../src/sic/observed-command-frontier.ts#L34) | `transition-3-4` atteste la route retenue vers l’essai, `budget-8` la place pour le réexamen et `obs-8` la paire de directions courante. |

La scène conserve une réserve de six gestes, une famille de comparaison ouverte et deux commandes admises. Les descriptions condensent les prémisses de ces deux chemins. Une offre sélectionnée annonce un résultat à rechercher, sans garantir l’effet physique. Les étiquettes de contribution, le repli acceptable du parent et les obligations liées au mode sont fournis par le cas. La comparaison encore ouverte porte sur le contraste après le dernier déplacement. Des transitions antérieures peuvent déjà documenter les commandes pour la branche d’accès.

Cette frontière rejoint la cartographie P05. `evaluateMissingControl` qualifie une commande déjà préparée et liée à l’observation. `switchContact` qualifie un contact dans le contexte de sa famille. Leurs gardes locales illustrent la différence entre lacune de preuve et refus de parcours. Les cas de ce lot ne dépendent pas de cette branche documentaire. [Cartographie au commit dd9f8212](https://github.com/yannick-fontan-1981/sra-playground/blob/dd9f8212/docs/architecture/sic-cartographie-p05.md)

## Règle de décision et arbre

1. L’opérateur fournit un instantané des preuves pour le but, la portée et les sujets courants. Une proposition booléenne connue porte au moins une référence. Un fait omis ou `unknown` est indéterminé. Une seule garde contredite suspend la branche même si une autre garde manque.
2. L’agenda applique les reçus à leurs positions dans l’ordre source effectif. Une offre antérieure reste disponible. Un arrêt caché derrière un arrêt de groupe n’étend pas son effet au groupe suivant.
3. Le besoin nomme un résultat recherché et, éventuellement, un repli acceptable. Pour chaque classe, l’agenda préfère une offre admissible puis une demande de preuve. Il traite la classe directe avant le repli. Ainsi, une preuve manquante pour la réponse directe mérite une question, alors qu’une contradiction libère le repli. Un refus de parcours atteint conserve la question de son propriétaire et écarte les nouvelles demandes de preuve.
4. À contribution et admission égales, le mode peut départager si un témoin relie l’offre à son usage. Dans le cas commun, assimilation favorise le réexamen d’un effet antérieur (`obligation-relecture-8`), exploration une comparaison encore ouverte (`registre-alternative-8`) et résolution un accès requis par le plan (`dependance-acces-8`). Cette préférence entre offres du même groupe est expérimentale. Si le mode laisse l’égalité entière, l’identifiant de branche croissant départage. La trace donne l’ensemble à égalité, les finalistes, la règle et les références.
5. Chaque instance d’`Agenda` suit un but dans une portée stable. La racine possède les branches d’offres. Une branche peut porter un enfant identifié par la branche, le fait et sa valeur attendue. Les identifiants de branche doivent donc désigner une liaison stable dans cette portée. Il y a au plus **une feuille active**. Le chemin actif contient aussi ses ancêtres. Une demande répétée reste en attente, avec zéro feuille active et une condition de reprise. À l’arrivée du témoin, `returns` rend la preuve au parent, qui réévalue ses deux branches. La sortie `tree.branches` détaille aussi les raisons des offres écartées.

## Rejeu à la main dans ChatGPT

Copier ce bloc dans une fenêtre vierge.

```text
But : progresser. Besoin : comparer les effets. Repli accepté : obtenir un retour informatif.
C compare l’autre direction. Il répond directement si le dernier retour est une diagonale unique.
A suit une route attestée vers une commande inexplorée. Il fournit le repli. La route a pour témoin R3.
Les autres gardes sont confirmées. Mode exploration. Une seule feuille active.
Une réponse directe sans témoin ouvre une question une fois. Une contradiction suspend sa branche.
Tour 1 : aucun témoin sur la diagonale. Tour 2 : mêmes données. Tour 3 : M8 atteste la diagonale.
Rejoue le tour 3 avec M8a, mouvement axial. Pour chaque tour donne branche, décision, preuve et sort de la sœur.
```

Lecture attendue : ouvrir la preuve de C, attendre sans créer de nœud, reprendre C avec M8. Dans la variante axiale, suspendre C jusqu’à un témoin diagonal courant, puis sélectionner A avec R3.

## Raccordement ultérieur en observation

Le plus petit raccord se situe **autour de l’appel existant** à `selectStrategyFamily(this.groups, offer, ranking?.order)` dans `NativeV6Runtime.selectFamily`, voie active non éditée. Juste avant l’appel, copier la référence d’observation, époque et empreinte d’image, actions publiques et entrées déjà filtrées, budget, mode, carte et ordre des groupes, identifiants de familles et points d’entrée. L’activation est lisible dans `family_activation:<id>`. Les mesures déjà matérialisées et la présence de certains lecteurs optionnels sont également visibles. Une fonction de lecture paresseuse n’est pas son résultat. [Point de raccordement](../../src/logos-engine/v6-native-runtime.ts#L983)

À cet instant, les caches d’offres du tour sont initialisés. La proposition locale, la route calculée, le booléen de comparaison, les refus courants et les besoins attachés aux propositions apparaissent pendant le parcours. Il n’existe pas de tableau complet d’offres normalisées avec leurs gardes pour toutes les familles. Après l’appel normal, joindre le reçu `selected/visited` à l’offre liée du groupe, son vrai `family.id`, sa stratégie locale et ses preuves si elles existent. Une entrée jamais interrogée reste **non observée**. L’identifiant d’invocation compte aussi : la préservation peut relancer la sélection sur la même observation avec des entrées filtrées différentes. Une comparaison ultérieure peut enregistrer cet écart de couverture sans appeler les planificateurs une seconde fois et sans intervenir dans la libération. Le `readShadow` existant illustre déjà la relecture des seuls essais observés sur l’autre chemin. [Relecture](../../src/logos-engine/v6-native-runtime.ts#L954) · [Offre liée](../../src/logos-engine/v6-native-runtime.ts#L1004)

Une fiche publique peut fournir le but, les sujets, les actions disponibles, les observations et les références des retours demandés. Une couche de traduction doit encore décrire chaque offre, ses résultats attendus, ses prérequis falsifiables, le besoin actif et son repli, le lien entre preuve et usage du mode, ainsi que l’identité durable des branches. Les refus source exigent un reçu courant de leur propriétaire. Le verdict du présent rejeu concerne les décisions sur les cas construits. La comparaison native et la campagne des 107 jeux restent à mesurer.
