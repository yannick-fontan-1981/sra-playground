# DICO · Ligne 98 · Tester d'abord la composition observable la plus riche

Au départ ciblé de DICO, le moteur compare **147 questions de même priorité**. Quatre ont douze relations observables distinctes. La première, le clic **(25,36)**, obtient le ticket et termine le niveau 1. Remplacer le départage à preuves constantes libère le clic **(37,36)**. Sa question reçoit le retour et le niveau 1 continue. La richesse mesurée justifie le choix d'une expérience. La progression du jeu s'apprend après exécution.

## Point de départ et articulation native

Le témoin historique est le premier geste du niveau 1 de DICO, zéro niveau terminé, pack du catalogue avec `openingCuriosity: 'active'`, agenda de familles du worker et plafond de 600 actions par niveau. Le harnais relance le jeu local au départ et injecte dans le service sa seule observation publique. Une horloge fixe permet de comparer les tickets. La campagne ciblée est identifiée dans [l'inventaire historique](../../../docs/architecture/sic-v8-strategies-observees.md?plain=1#L131). La requête de sous-ensemble du catalogue initial dispose de sa [qualification propre, ligne 87](../dico-87/README.md).

| Référence | Usage |
|---|---|
| `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` | Code du témoin de la campagne ciblée |
| `d0e7527ca8033bd805a6d7a8bb021eff62e87021` | Gel de comportement, 107 jeux validés antérieurement |
| `c0b9f4027f1df257d7b8c96f5656f9dbb83661f0` | Parent de branche, réemploi du chargeur du jeu et de l'évaluateur de DICO |
| `798a804821603bed2cb109dc5bdab1df0dd10377` | [Attendus figés](ATTENDUS.md) avant le raccordement 98 |
| `ba04161fbce03f9660e9e73c14ed2c14ef2538d7` | Contrat de types 23, vérifié dans une extraction isolée |

1. `NativeV6Runtime.selectFamily` appelle les fournisseurs selon l'agenda global. Lorsque `observed_frontier` est appelée, `NativeCallerCoordinator.frontierOffer` transmet le réglage d'ouverture si la mémoire ne contient encore aucun épisode du niveau courant. Le début du niveau 2 est donc un autre point d'essai. [Répartiteur](../../../src/logos-engine/v6-native-runtime.ts) · [Appel du fournisseur](../../../src/logos-engine/v6-native-caller.ts)
2. Dans `ObservedFrontier.propose`, il faut que l'agenda local soit applicable, qu'aucune expérience imposée n'ait été retenue et que la question ordinaire soit un clic. La famille retient cette question et les autres clics de même priorité. `openingClickTargets` rattache chaque clic à une seule entité mesurée et cherche les voisins. Sur l'axe orthogonal, les boîtes doivent se chevaucher. Sur l'axe de la relation, la distance vaut entre 1 et le maximum de 8 et de la dimension correspondante du sujet. Une clé distincte associe côté, signature de forme et couleur du voisin. Le reçu expose le total et jusqu'à quatre références de voisins. Un clic sans sujet unique ou sans relation reçoit `null`. [Famille](../../../src/logos-engine/v6-observed-frontier.ts) · [Mesure](../../../src/sic/opening-curiosity.ts)
3. **Le gel** mesure déjà les cibles séparément, varie son choix avec le voisinage, conserve le premier maximum et fait consommer la question par `selectFrontierStrategy`. Son maximum se calculait dans une boucle privée de la famille. **Le candidat** relie chaque preuve positive à sa question dans `OpeningOffer` et délègue ce seul arbitrage à `selectOpeningOffer`. En actif, l'agenda reçoit la question choisie. En shadow, il reçoit la question ordinaire et le reçu conserve la recommandation. [Arbitrage](../../../src/sic/opening-curiosity.ts) · [Agenda local](../../../src/sic/frontier-strategy.ts)
4. La garde, le ticket et le retour passent par le service natif. L'identifiant générique du reçu est `observed_frontier / test_local_input / experiment`. L'attribution historique à `opening_curiosity` se lit dans le mode, la recommandation effectivement retenue, sa preuve et l'objectif `Investigate the richest observable composition`. À la fin du geste, `actual_outcome` rattache le retour à l'identifiant de cette question et à son besoin. [Évaluateur du service](../evaluateur-jeu.mjs) · [Préfixe jouable](jeu.mjs)

## Offres, décision et retour

La sonde scelle le rang, la question ordinaire, toutes les commandes admissibles avec leurs preuves et les références positives juste avant le classement. La colonne de droite du tableau est relevée ensuite par le service. Sur le premier pré-événement, la question ordinaire `(1,3)` a deux relations, `(25,24)` en a onze, et les quatre meilleures en ont douze. Le sujet retenu est `component:e18abcdecea12551:5` de boîte `[22,36,28,40]`. Le reçu permet notamment de contrôler des voisins au-dessus (`[22,24,28,28]`) et à gauche (`[10,36,16,40]`). Le justificatif antérieur au ticket ne contient ni commande délivrée ni résultat. [Sonde](sonde.mjs)

| Situation et attendu | Offres et décision obtenue | Retour |
|---|---|---|
| DICO N1 actif, première des plus riches | 147 offertes. Maxima (25,36), (32,35), (37,24), (37,36), dans cet ordre. Ticket 1 pour (25,36), question `Q_25c1916be61561533bb6`. | Garde admise, `unknown_effect_observed`, `matched:null`, un niveau terminé |
| DICO N2 actif, premier maximum à la nouvelle ouverture | 228 offertes. (13,12) et (25,12) ont treize relations. Ticket 2 pour (13,12), question `Q_0f7ae3b372ec456042ed`. | Garde admise, même statut, niveau 2 en cours |
| DICO N1 shadow, puis option omise | Shadow mesure la même liste et recommande (25,36). Les deux réglages délivrent (1,3) pour observer l'effet de l'entrée ordinaire. | Niveau 1 en cours |
| DICO N1, départage substitué sur candidat | Même liste scellée, même mesure. Le dernier maximum (37,36) obtient le ticket 1, question `Q_5f9afa3b4248510a359c`. | Garde admise, retour lié à cette question, niveau 1 en cours |
| MEMO N1, curiosité active, autre famille propriétaire | `public_occurrence_recall` reçoit la main et clique (31,30). Aucun pré-événement d'ouverture. | Niveau 1 en cours |

Les sceaux des ouvertures nominales sont `8f73d9b44d0d0546e818542e94876cdcd848a0d6ac0114152b3a548e7498aedf` (N1) et `18f5361c51f014302623085f7bc6c7d9dc84b1887dca67fa891146549e665a5d` (N2). Le pré-événement N2 se rattache à l'observation effectivement livrée après le premier geste. L'essai du départage substitue l'ordre de lecture du sélecteur dans un processus dédié, puis laisse le moteur délivrer et jouer son ticket. Aucun résultat du jeu n'entre dans le classement.

## Contre-épreuves publiques

La fixture appelle le fournisseur natif sur un plateau reconstruit et vérifie sa garde. Les coordonnées A=(10,10) et B=(40,40) restent les mêmes. Les questions sont triées par le moteur.

| Changement | Attendu | Obtenu sur gel et candidat |
|---|---|---|
| A et B ont chacune un voisin au-dessus | Égalité, premier du rang | (1,1) relation, A |
| Ajouter un voisin à gauche de B | B plus riche | (1,2) relations, B |
| Retirer ce voisin | Revenir à l'égalité | Capture et proposition initiales retrouvées, A |
| Répéter le même rôle à gauche de B | Conserver le compte distinct | (1,2) relations, B |
| Seul clic (25,36) avec voisin, actif puis shadow | Même commande, objectifs différents | Même référence de question. En actif, examiner la composition. En shadow, observer l'effet de l'entrée |
| Même clic avec voisin, option omise | Question ordinaire | Même commande et objectif ordinaire, sans mesure d'ouverture |
| Même clic sans voisin, actif | Aucune offre de composition positive | Mesure atteinte, cible `null`, commande et objectif ordinaires |

Le départ DICO N2 et la géométrie à deux cibles fournissent deux autres situations positives. MEMO contrôle séparément le périmètre du choix global. Compter la ligne 98 relève de l'évaluation de cette seule articulation, une fois. L'effet sur un autre jeu positif ou sur une campagne entière reste à établir par le Banc.

## Rejeu et remise

Depuis la racine du checkout, avec Git, tar, Node.js 24.22.3, TypeScript 5.9.3 dans `node_modules` et le répertoire Pyodide local du Banc (paquet 314.0.7 avec NumPy et Pydantic) :

```powershell
$d = 'experiments/sic-agenda-offres/ouverture-98'
& "$d/lancer.ps1" verifier --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu "$env:TEMP/sic-ligne98.json"
```

Le vérificateur relance chaque version au même point, contrôle les listes scellées, les tickets, les gardes et les retours, exerce les fiches et le départage alternatif, puis applique le seul écart des deux modules 98 sur une extraction de `ba04161f` et compile l'ensemble avec ses types. Le reçu JSON contient le SHA du checkout, les empreintes comparées et les décisions réduites. L'opérateur dispose du [contrat et de l'exécutable indépendants des attendus](qualification-operateur/README.md) et des [cinq fiches publiques](public). Sa qualification peut être conservée sur sa propre branche avec la révision du moteur et le sceau de chaque entrée.
