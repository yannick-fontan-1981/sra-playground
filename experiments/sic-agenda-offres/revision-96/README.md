# SK48 · Ligne 96 · Réviser la projection de contact après un retour contraire

**Sur le gel, la révision est déjà composable jusqu'au retour.** À la douzième commande de SK48, deux pièces se déplacent plus loin que prévu. La preuve de déplacement conjoint permet deux accès. Avec la priorité historique, le moteur rétracte la tige au geste 13 et termine le niveau au geste 19. En donnant priorité au repositionnement, il déplace d'abord le support et termine au geste 21. Les deux premières projections révisées sont différentes et le jeu confirme chacune.

## Témoin et connaissances antérieures

Le catalogue initial attribue le calibrage de SK48 N1/1 à la ligne 64. Le témoin ciblé de 96 est `public_occurrence_recall / revise_rooted_contact / observed_composition_services / rooted_line`, **N1, geste 13, ACTION3**. La table publiée à `2a17e14b` compte sept commandes de récupération, gestes 13 à 19. Le rejeu emploie le code précédant sa publication `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`, puis le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. L'archive publique du préfixe contient le départ et les douze premiers retours. Les commandes et les treize empreintes de trame ont été comparées une à une avec le jeu. Les gestes 13 et suivants sont exécutés à nouveau dans SK48. [Inventaire](../../../docs/architecture/sic-v8-strategies-observees.md?plain=1#L129) · [Archive publique](../../../docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz)

Départ au niveau 1 non joué, réglage de récupération actif, ordre natif du pack, profondeur maximale 88 et 1 000 états au plus, plafond de 600 actions par niveau, agenda de familles du worker. Les quatre premiers gestes mesurent, dans l'ordre, la montée du support (`ACTION1`, −6), l'extension de la pointe (`ACTION4`, +6), sa rétraction (`ACTION3`, −6) et la descente du support (`ACTION2`, +6). Les références avant/après de ces quatre mesures figurent dans le reçu. Le bandeau donne l'ordre 8, 14, 9. Les gestes 5 à 11 confirment sept projections du premier plan.

Au geste 12, huitième commande de ce plan, `ACTION2` translate le support de six pixels, de `[11,18,16,23]` à `[11,24,16,29]`. La pointe reste en x=46. Les trois pièces occupent la bande x=42…45. Le tableau donne leurs ordonnées publiques.

| Pièce | Avant | Prédit par le premier plan | Observé au retour 12 |
|---|---:|---:|---:|
| 8 | 19…22 | 25…28 | 25…28 |
| 9 | 25…28 | 29…32 | 31…34 |
| 14 | 31…34 | 33…36 | 37…40 |

Ce retour réfute la projection qui réduisait l'espacement de la chaîne. Il conserve les quatre contrôles mesurés. `witnessedCellPush` vérifie la scène, le support, la pointe, le pas d'une cellule, l'alignement et la contiguïté des pièces emportées. Le témoin lie la révision 12 (`c6facbac7af1facf`) à la révision 13 (`f8828ab792ad8a19`), dans la même session, à la même époque et pour la disposition `f0c92eea…`. Le premier plan est scellé avec `matched:false`. [Mesure et hypothèse de contact](../../../src/logos-engine/v6-rooted-line-revision.ts) · [Acquisition et garde](../../../src/logos-engine/v6-rooted-line-access.ts)

## Choix natif et contrefactuels

La sonde copie la mémoire acquise immédiatement **avant** `resolveRootedRecovery`. Au premier choix de reprise, le sceau SHA-256 est `b0a9599754be2bc601e27de4c22572a6a9c182d767740a2912dcea6a1069b518`. Il est identique avec les deux ordres du pack. Une deuxième capture scelle la projection du plan **avant** l'appel au jeu. Le retour est lu séparément. Les gestes 6 à 12 suivent le préfixe proposé au geste 5, d'où l'absence de nouvel appel au sélecteur pour le geste 12. [Sonde](sonde.mjs) · [Service et jeu](parcours.mjs)

| Situation testée | Décision ou premier écart obtenu | Vérification |
|---|---|---|
| Priorité historique | Geste 13, `revise_rooted_contact`, ACTION3. Longueur prévue 7, 64 états visités. | Support immobile, pointe 46 → 40, pièce 8 de x=42 à 36. Toute la projection concorde. Six retours assignent le même besoin. Au 19, le niveau change et le besoin est satisfait, `matched:null`. |
| Repositionnement prioritaire | Même preuve antérieure. Geste 13, `reposition_root_before_contact`, ACTION1. Longueur 9, 78 états visités. | Support de y=24 à 18, pointe en x=46, pièce 8 de y=25 à 19. Le jeu confirme. Au 14, la révision ordinaire reprend depuis cette autre position. Huit retours concordent, le niveau change au 21. |
| Couleurs publiques 8 et 14 permutées pendant toute la partie | Ordre visible 14, 8, 9. La disposition, les références d'observation et l'identité du besoin changent. | Nouveau témoin admis au 12, nouvelle projection confirmée au 13, niveau terminé au 19. Ce contrôle réemploie la géométrie de SK48. |
| Pixel d'écran sans rapport au retour 11, fixture | L'empreinte publique change. Le support, la pointe et les pièces mesurées restent identiques. | Ancienne projection confirmée, aucune réfutation et aucun besoin de révision. |
| Identités 8 et 9 échangées dans le terrain au retour 12 | Même commande, support et pointe corrects. L'hypothèse initiale est réfutée, la preuve de transport conjoint manque. | Le fournisseur renvoie `conditional_contact_model_refuted`. Dans le service complet, les douze commandes sont exécutées puis arrêt global `frontier_unknown`. |
| Témoin d'une autre session, à géométrie constante | Les références ne satisfont plus la portée de la scène. | Refus local, aucune action de reprise. |
| Accès borné à un geste | Besoin ouvert, les deux stratégies ont cherché, cinq états visités en tout. | Deux `no_plan`, arrêt natif `rooted_cell_access_unresolved` après 12 commandes. |
| Shadow à preuves identiques | Les deux stratégies sont qualifiées en observation, zéro état recherché. | Arrêt natif `sic_recovery_shadow` après 12 commandes. |
| Repositionnement prioritaire, profondeur 7 | Le premier fournisseur de plan échoue dans sa borne, le second trouve l'accès de sept gestes. | `no_plan` puis `selected`, ACTION3. |
| Projection révisée elle-même contredite, fixture | Au geste 13, renvoyer le même plateau malgré la rétraction prévue. | Le besoin assigné passe à `refuted`, les deux réfutations sont conservées et la branche cesse d'émettre. |

La permutation durable de couleurs est un changement de représentation, et la retouche ponctuelle du retour 12 est une observation synthétique. L'autre itinéraire de 21 gestes se déroule dans le jeu historique sans retouche. Le compteur « états visités » est celui des expansions pendant la recherche de la proposition courante. Les deux méthodes partagent le budget disponible.

## Attribution

`RootedLineMemory.record` et `rootedLineAfter` comparent le retour et la prédiction. `admitContactRecoveryNeed` et `selectRootedRecovery` exigent une paire consécutive du même domaine de références, la disposition correspondante et le témoin de cellule entière. `contactSituation` transforme ces preuves en faits, dont la translation disponible et l'affectation préalable du besoin. `resolveStrategyGraph` essaie les méthodes dans l'ordre déclaré du pack. La seconde méthode impose une translation initiale mesurée. `planCellPush` effectue la recherche, et `rootedLineBefore` garde un seul geste révisé à la fois. OP03, OP12 et OP08 qualifient le retour, OP26 cherche l'accès et OP18 engage la proposition sous garde. Cette décision est locale à la famille déjà appelée par l'agenda global. [Contrat et faits](../../../src/sic/active-recovery.ts) · [Agenda](../../../src/sic/strategy-agenda.ts) · [Opérations](../../../src/logos-engine/v6-rooted-line-recovery-operations.ts)

Ces articulations existent sur le gel. La contribution de la branche est le rejeu comparatif, les contrefactuels et l'entrée opérateur. Le diff de `src` par rapport au gel est vide. Le candidat réutilise deux fichiers d'évaluation du lot DICO/98 à l'identique. Les lignes 64 et 98 gardent leurs propres preuves. Les [attendus](ATTENDUS.md) ont été figés au commit `d9760e9c13fbae68b8425ee8fab5266ed4b42afd`.

## Rejeu et qualification opérateur

Depuis la racine du checkout, utiliser Git, tar, Node.js 24.22.3 et le paquet local Pyodide 314.0.7 du Banc (incluant NumPy et Pydantic).

```powershell
$d = 'experiments/sic-agenda-offres/revision-96'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/sic-ligne96.json"
& "$d/lancer.ps1" operateur --moteur gel --fiche "$d/public/reposition.json" --pyodide $py --recu "$env:TEMP/sic-contact-operateur.json"
```

L'opérateur peut remplacer `gel` par `historique` ou `candidat` et fournir sa propre [fiche publique](public). Le vérificateur compare le parcours nominal avec le moteur historique, puis l'ensemble des cas entre le gel et le candidat. Il applique les contre-épreuves de fournisseur sur les deux derniers moteurs. Le reçu contient les références antérieures, les projections, les empreintes comparées, les motifs de suspension et le SHA du checkout.

Le contrat `sic.contact/1` prend `gestes` (1 à 24), `couleurs` (liste vide ou deux indices de palette distincts), et `pack` (options validées par le moteur). Une retouche facultative `retourModifie` prend le numéro de geste, un rectangle inclusif `zone:[gauche,haut,droite,bas]` et les deux couleurs à échanger sur ce retour. Elle s'applique aux images publiques du retour et à son image finale. Le jeu sous-jacent continue à exécuter ses propres règles. Le point d'entrée [operateur.mjs](operateur.mjs) ne lit aucun attendu. Le JSON standard résume l'essai, et `--recu` conserve les mesures détaillées localement.
