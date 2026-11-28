# TN36 · apprendre un code avant de l’exécuter

## Critères avant changement

La ligne 5 du catalogue donne TN36, N1/T1, `code_program / learned_code_program`, `ACTION6` et seize occurrences. La capture part de N1 avec les options de l’inventaire, six niveaux, plafond de 600 actions par niveau, au plus seize gestes et sans curiosité ciblée. La première vérification portera sur le mode exact de T1, les exemples ou commandes admis et la mémoire d’opérateurs au moment du ticket. [Catalogue](sic-v8-strategies-observees.md?plain=1#L31) · [Contrat de la matrice](sic-v8-composition-des-98-strategies.md?plain=1#L45)

| Étape | Critère observable |
|---|---|
| T1 avant le geste | Distinguer le plateau, le codage lu et l’exemple visible des opérateurs appris par un retour. Relever le point, le mode et les prémisses du ticket réel. |
| Acquisition | Suivre les transitions surlignées, les mots associés, le vecteur et les références. Vérifier si la démonstration préserve la position dans le monde principal. |
| Contre-épreuve au même ticket | Présenter la même image finale sans la séquence qui date les transitions. Décrire quelle preuve disparaît et ce que le prochain ticket peut faire. |
| Seconde situation | Retrouver une substitution de démonstration ou l’emploi natif d’un opérateur appris dans un autre besoin. Vérifier le vrai retour et la reprise, au-delà du nom du fournisseur. |

La frontière, le propriétaire et la prédiction doivent demeurer vérifiables quel que soit le mode du ticket. Le premier exemple sans preuve d’opérateur ne suffit pas à attribuer une exécution apprise. [Code du fournisseur](../../src/logos-engine/v6-code-program.ts) · [Contrats de référence](../../tests/v6-program-families.test.ts)

## Résultat sur le gel `d0e7527c`

Les 16 tickets et retours du départ historique `8ce7ee35` concordent avec le gel pour les commandes, les plans, les gardes, le résultat et les trames publiques. La métadonnée de palette est exclue de la comparaison entre révisions. Les 16 tickets relèvent de `code_program / learned_code_program`, soit 16/16 occurrences de l’inventaire. Un rejeu séparé avec 19 gestes ferme N2 et atteint la décision suivante en N3. [Paquets des trois rejeux](../../tests/fixtures/sic-tn36-public-returns.json.gz) · [Caractérisation du service](../../tests/sic-tn36-line-5.test.ts)

| Étape | Choix, preuve et retour |
|---|---|
| N1/T1 · exécution exploratoire | `measureCodeScene` identifie le plateau, le sujet en (4,1), la cavité en (4,6), les bits [3,0,3,0,0] et le bouton (36,55). `CodeProgram.propose` voit zéro exemple, zéro opérateur et aucune exécution consignée. Le vrai ticket `ACTION6(36,55)` exécute le code visible en mode `execute`, avec prédiction nulle. L’intitulé de famille couvre aussi cette acquisition initiale. Le garde lie l’époque, la commande, le sujet, les bits et le point de la trame d’origine. |
| Retour N1/T1 · acquisition | Sept images publiques sont remises au même propriétaire. `CodeProgram.record` relève deux transitions surlignées où le mot 3 précède le déplacement (0,+1). Le sujet se retrouve en (4,1) sur l’image finale. La mémoire ajoute un opérateur et rattache sa preuve au retour. La valeur 0 demeure inconnue. |
| N1/T2–T8 · consommation de la preuve | `physicalCodePaths` consomme la table des déplacements et trouve cinq répétitions de 3 jusqu’à la cavité. T2 choisit le premier bit à éditer en (26,42), confirme [3,2,3,0,0], puis les autres éditions sont admises pas à pas. T8 réutilise exactement `ACTION6(36,55)` avec [3,3,3,3,3]. Le retour officiel ouvre N2. |
| N2/T9–T18 · seconde situation native | `CodeProgram.start` ouvre l’époque avec une table active vide. N2/T9 choisit le premier des deux exemples mesurés, (21,55), en mode `demonstrate`. Le retour conserve la position du sujet principal et fournit le mot 33 pour (0,−1). T10 consomme cette nouvelle preuve et vise [33,33,33,33] depuis (3,5) vers (3,1). Après les éditions, T18 exécute en (46,58) et ouvre N3. |

## Épreuves à données comparables

- **Même clic N1/T1, même image finale.** En gardant cette seule image du vrai retour, le propriétaire consigne l’exécution sans aucun opérateur ni référence de mesure. T2 choisit (21,42) pour [1,0,3,0,0]. Le jeu confirme l’édition. L’essai suivant en (36,55) mesure les mots 1 pour (1,0) et 3 pour (0,1). La reprise vise ensuite [3,3,3,3,3] avec les deux effets disponibles.
- **Même arrivée N2, autre exemple admissible.** L’expérience déclare le premier exemple déjà essayé en début d’époque et garde le plateau et la table active. Le chemin natif élit alors l’exemple (8,58). Son vrai retour maintient la position du sujet et n’établit aucun opérateur. Le service tente ensuite le code affiché en (46,58). Ce second retour est également sans mesure de déplacement. L’offre suivante propose une édition pour [0,0,0,1].

Les deux variations changent le matériau de preuve reçu ou la mémoire des essais. Le moteur du gel produit les choix et acquiert les retours suivants. Les observations de jeu après ces choix sont des recaptures physiques. Le masquage des images intermédiaires et la marque d’essai de N2 sont des interventions de test.

**Attribution locale.** La ligne 5 est démontrable sur le gel. Le point réutilisé est `physicalCodePaths`, appelé par `CodeProgram.propose` avec la table d’opérateurs apprise dans l’époque. Le retour de T1 correspond à l’apprentissage, tandis que les parcours N1 et N2 contiennent chacun une exécution de code synthétisé à partir de preuves actives et un retour officiel. La branche ajoute les tests et la preuve reproductible. [Implémentation et garde](../../src/logos-engine/v6-code-program.ts) · [Ancrage dans le moteur](../../src/logos-engine/v6-native-runtime.ts)

## Reproduction

Utiliser Node 24 depuis la racine. Définir `SIC_TN36_GAME_ROOT` sur un checkout contenant les archives Python et Pyodide pour vérifier physiquement les observations attendues. `SIC_TN36_ENGINE_ROOT` permet de viser directement le checkout du gel avec le même harnais.

~~~powershell
node --test tests/sic-tn36-line-5.test.ts tests/v6-program-families.test.ts
$env:SIC_TN36_GAME_ROOT = (Get-Location).Path
node --test tests/sic-tn36-line-5.test.ts
~~~

Les trois scénarios passent avec rejeu physique, ainsi que les 62 contrats existants des familles de programme. Le 27 novembre 2026 (UTC−3), préparation à 22 h 05 min 23 s, premier rejeu du gel à 22 h 06 min 11 s, contrat `29241d51` à 22 h 06 min 27 s et verdict local à 22 h 09 min 58 s, soit 4 min 35 s.
