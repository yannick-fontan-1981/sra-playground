# Rangée 23 · Essayer une commande inédite ici

**Le comportement composable de bout en bout est reproductible sur le gel des 107.** Le candidat ajoute le contrat statique à l’endroit où le moteur choisissait déjà. La preuve porte sur une stratégie, `observed_frontier / test_local_input / experiment`. Les trois attributions ci-dessous permettent au Banc de décider du décompte. [Critères figés avant implémentation](CRITERES.md) · [Contrat et entrée pour l’opérateur indépendant](CONTRAT.md)

| Attribution | Pièce qualifiée |
|---|---|
| Comportement de `d0e7527c` | La même offre de question sert à l’essai local et à la recherche depuis un autre plateau. Les deux classements natifs sont interchangeables en amont du même sélecteur, du même service et de la même acquisition. Le besoin et les preuves déterminent la suite effective. |
| Preuve nouvelle | Le même harnais fait jouer séparément le moteur extrait du gel et le candidat. Il contrôle les faits avant choix, les alternatives classées, la garde, le ticket matériel, le retour acquis et la reprise. Les mutations du domaine, de l’historique et du classement sont mesurées séparément. |
| Contribution du candidat | La frontière lit un `LocalTrialDomain` qui type les commandes admises et les essais par commande. Elle produit des `LocalTrialQuestion` avec contexte, commande, priorité, motif, essais locaux et hypothèses. `SearchedAccess` distingue une recherche épuisée d’un chemin trouvé. Le `null` extérieur indique une recherche omise. Les signatures participent au contrôle TypeScript de la production des questions et de leur classement. Le format de persistance du graphe reste celui du moteur. |

La compilation du seul module natif changé donne le même JavaScript ES2022 que sur le gel, commentaires retirés, avec TypeScript 5.9.3. SHA-256 `f5c8da5e1defbfa748db5e2f0806fe040e484842a5d6041e63ab40c5a2b1aabc`. L’identité de l’émission établit la parité du code exécutable. Les cas ci-dessous établissent la composition effectivement utilisée.

## Témoin de jeu

Sur G50T N1, geste 1, les moteurs historique `8ce7ee35`, gelé `d0e7527c` et candidat reçoivent la même projection publique. Les cinq commandes admises sont encore inédites. La question `Q_36ce889058ea8eda599b` est liée à l’occurrence de révision 1, plateau `f79ab0e9d856fdf8`. Le trajet reste non cherché. Le sceau avant choix est `9789b4da9ec687e34c49aa444e0b9ab41fddf3ecb329cb7b647357cc8c485f13`.

La garde `current_public_premises_match_provisional_step` accepte le pas et WHY/ACT le libère. Le service émet `frontier-qualification:native:1`, `ACTION1`, sans coordonnées, index 0. Le retour est une nouvelle occurrence de même image, `unknown_effect_observed` et `matched=null`. L’acquisition `transition:6223f07ff39b8435203b8d3d60dec0be219d809589472be788a9791eac494fc8` relie ces deux occurrences à la commande. Le besoin associé à la question passe à `observed` dans le magasin natif. Ces identifiants proviennent de rejeux bornés avec une identité de session et des horloges fixées. [Témoin publié de la campagne](../../../docs/architecture/sic-v8-strategies-observees.md#L49)

## Contre-épreuves de développement

| Condition modifiée | Décision attendue et obtenue dans le service |
|---|---|
| Aucun essai ici, domaine 1 et 2 | Question locale sur 1, ticket `ACTION1`. Permuter le domaine conserve aussi l’identifiant de question. Retirer 1 avant le choix donne un ticket `ACTION2`. |
| Retour au même plateau après 1 | La transition acquise exclut 1 du domaine inédit. La question sur 2 prend la main et obtient son propre ticket. Le second retour ferme ce besoin. Une recherche sans question accessible laisse ensuite le besoin d’accès ouvert, avec zéro ticket. |
| Même préfixe, même plateau, deux questions inédites de même priorité, un essai de 1 ailleurs dans l’époque | Le rang natif `least_tried` fournit `ACTION2` au sélecteur. Remplacer seulement ce classement par `command_order` fournit `ACTION1`. Les deux tickets vont jusqu’au retour observé de leur question respective. |
| Même historique jusqu’au troisième geste, seul le plateau retourné change | Si le retour met le service sur B, il obtient directement la question sur 3. Si le retour le met sur A, il retrouve cette même question sur B par l’arête déjà observée et engage l’accès par 4. Le contexte de la cible, l’identifiant de question et le besoin d’information coïncident. Ce dernier ticket relève de la ligne 22. |
| Ticket étranger puis ticket déjà consommé | Le service refuse les deux associations avec `stale`. La séquence, le ticket valide et la chaîne du graphe conservent la même empreinte. |

## Points d’articulation de la composition

- **P01** — `ObservedFrontier.observe` lie l’occurrence à son index public et au domaine admis. `question` identifie le couple contexte–commande.
- **P04** — `ObservedFrontier.open` sélectionne les entrées sans essai dans ce contexte et les classe par priorité, usage dans l’époque selon configuration, puis ordre canonique. Le même producteur est appelé au départ par `propose` et à destination par `access`. `selectFrontierStrategy` remet l’offre retenue à la construction effective du plan. [Producteur](../../../src/logos-engine/v6-observed-frontier.ts) · [Sélecteur](../../../src/sic/frontier-strategy.ts)
- **P05** — le premier effet inédit conserve `expected_after=null`. Le plan demande de mesurer le retour sur cette entrée. `frontierInformationNeed` lie cette mesure à l’objectif parent. L’observation d’un effet inconnu satisfait la question sans affirmer une prédiction.
- **P11** — `ObservedFrontier.guard`, la libération WHY/ACT du runtime et `V6AgentService.accept` lient l’autorisation matérielle au pas et à l’occurrence. [Service](../../../src/runtime/v6-agent-service.ts)
- **P12** — `recordTransition` et le checkpoint de besoin conservent commande, occurrences, objectif et statut. La prochaine demande de l’agenda retrouve l’essai dans le graphe et avance vers une autre question ou suspend. [Besoin persistant](../../../src/sic/need-registry.ts)

La prédiction de famille avant le premier fournisseur demeure indéterminée. Pour la ligne 23, la décision locale devient observable une fois les questions préparées. Le lot qualifie le comportement sur une seule des 98 démarches. Il fournit un candidat typé et des pièces pour une contre-épreuve indépendante. L’intégration sur main et le verdict du Banc constituent des étapes distinctes. La ligne 22 conserve sa qualification propre sur fixture et son écart REGN. [Fiche des deux rangées](../frontiere-22-23/README.md)

## Rejeu du Banc

Depuis la racine du checkout, avec les dépendances du dépôt dont TypeScript 5.9.3, Git, tar, Node 24 et le Pyodide local déjà préparé :

```powershell
$lot = 'experiments/sic-agenda-offres/essai-local-23'
& "./$lot/lancer.ps1" verifier --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu "$env:TEMP/sic23-recu.json"
```

Sans `--pyodide`, le vérificateur exerce les fixtures sur le gel et le candidat. L’option `--recu` conserve les références et les empreintes hors des entrées de l’opérateur. Le rejeu complet ajoute le premier geste du jeu sur les trois moteurs. Le contrôle du projet est `npm run typecheck`. Les trois suites natives ciblées comptent 50 tests. [Vérificateur](verifier.mjs) · [Entrée de développement](developpement.json)
