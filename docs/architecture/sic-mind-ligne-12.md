# MIND · choisir la suite d’une séquence à partir du retour

## Critères avant intervention

La ligne 12 donne MIND N1/T1, `feedback_sequences / public_feedback_sequence`, `ACTION6`. La capture du catalogue part de N1, six niveaux cibles, 600 gestes par niveau, une limite globale de 16 et sans curiosité ciblée. Le rejeu prolongé vérifie la réponse à une autre séquence après changement de niveau. [Catalogue](sic-v8-strategies-observees.md?plain=1#L38) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L52)

| Étape | Critère |
|---|---|
| Première présélection | Relever le symbole, son point et la preuve visuelle ou acquise qui l’admet. Vérifier le retour avant de créditer une loi d’ajout. |
| Réponse et nouvelle question | Suivre la proposition complète jusqu’au contrôle de soumission et au retour ordonné. Identifier le premier choix qui consomme l’historique et le compte des hypothèses alors admissibles. |
| Contre-épreuve | Au même préfixe public, omettre uniquement l’historique de retours du calcul de proposition. Observer la différence de séquence entière, même si son premier clic coïncide. Rejouer les actes effectivement admis et leur retour. |
| Réemploi | Vérifier une autre séquence ou un autre niveau. Distinguer le transfert d’une méthode de saisie des contraintes de retour propres à une époque. |

L’origine des hypothèses et le type de reçu doivent demeurer visibles à chaque transition, avec leurs références et le garde du point. [Fournisseur](../../src/logos-engine/v6-feedback-sequences.ts) · [Sélection finie](../../src/logos-engine/v6-feedback-sequences-finite.ts)

## Le parcours au gel

Les 16 tickets et retours de l’inventaire concordent entre `8ce7ee35` et `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Cela retrouve les **16/16** occurrences, toutes chez `feedback_sequences`. Les 17 observations de ce préfixe correspondent à l’archive 0.51 pour les trames et les séquences d’images. Le rejeu prolongé vérifie la première reprise en N3. [Archive publique MIND](../migration/lot4a-evidence/integrated-051/mind-live-01/mind-public-trace.json.gz) · [Tests via le service](../../tests/sic-mind-line-12.test.ts)

| Étape | Preuve consommée et décision |
|---|---|
| **N1/T1 · présélection** | `FeedbackSequences.propose` utilise l’étape `acquire_append` de son programme de choix. La palette présente un contour distinctif unique pour 8. `ACTION6(4,54)` essaie cet ajout. La disposition de la rangée est mesurée et la loi d’ajout reste à vérifier. Le retour donne un seul appendice ordonné de valeur 8, indique la rangée active et mesure que la palette se compacte en retirant la valeur choisie. |
| **T2–T4 · premier essai et retour** | Le même point (4,54) porte désormais 14. L’opérateur `chooseFeedbackTrialCooperative` propose [8,14,9] avec 27 candidats et une loi possible. Les deux ajouts suivants complètent cette séquence. `ACTION5` teste le contrôle sur rangée pleine. Le retour contient une unique rangée compatible de trois marques et le journal inscrit `observed_submission_feedback` pour [8,14,9] avec les références avant et après. |
| **T5–T8 · consommation du retour** | Le même opérateur calcule les séquences compatibles avec le préfixe, les rangs révélés et cet historique. Il retient [8,9,14] avec 2 candidats et 4 lois. Le premier clic (4,54) est identique à celui de l’essai précédent. Le deuxième passe en (10,54) pour la valeur 9. Les gardes contrôlent préfixe, palette, point et observation courante. La soumission T8 ouvre N2. |
| **N2/T9–T16 · second contexte** | Le fournisseur rappelle la méthode de saisie de N1 et porte ses références d’ajout et de soumission. T9 réessaie 8. Son retour confirme la rangée active. La preuve de retour de N1 conserve son époque. Le nouveau retour T12 date [8,14,6]. T13 calcule [14,6,8], avec 4 candidats et 12 lois. T16 soumet et ouvre N3. À T17 la méthode de N2 est présentée comme hypothèse à rééprouver. |

Les cadres distinctifs, les rangées, les symboles et leur position proviennent de l’observation. Les hypothèses du calcul fini sont des couples de séquence et de loi de retour. Un point identique peut donc engager un autre symbole après compaction ou une autre suite dans le même lot. [Producteur, garde et acquisition](../../src/logos-engine/v6-feedback-sequences.ts) · [Calcul des hypothèses](../../src/logos-engine/v6-feedback-sequences-finite.ts)

## Contre-épreuve à T5

À même observation après T4, le fournisseur calcule son offre depuis une copie de la mémoire où seul l’historique a été retiré. Les rangs visibles, la méthode d’ajout et les autres champs sont conservés. Le résultat retrouve [8,14,9], avec 9 candidats et une loi. Le vrai service exécute le même premier clic qu’au nominal, puis choisit 14 par (4,54) au deuxième, là où le nominal choisissait 9 par (10,54). Au retour physique de T8, deux rangées correspondent à l’essai soumis. Le reçu `feedback_ambiguous` ne fournit aucune nouvelle contrainte. Le journal acquis conserve la preuve initiale. T9 revient à [8,9,14], T12 ouvre N2 et T13 réessaie la méthode de saisie.

Les commandes et retours de cette variante sont physiques. L’intervention porte sur la copie présentée à l’étape de choix. [Retours alternatifs](../../tests/fixtures/sic-mind-alternate-returns.json.gz)

**Attribution.** Le moteur du gel consomme déjà cette articulation du calcul fini à la reprise. L’historique change une décision et le retour réellement acquis, tandis qu’une méthode d’interface peut traverser le changement d’époque sous réserve d’un nouveau contrôle. La branche apporte la caractérisation de ces deux usages.

## Reproduire

Utiliser Node 24 depuis la racine. Définir `SIC_MIND_GAME_ROOT` sur un checkout contenant les archives Python et Pyodide pour vérifier physiquement les retours. Définir `SIC_MIND_ENGINE_ROOT` pour charger explicitement le moteur du gel.

~~~powershell
node --test tests/sic-mind-line-12.test.ts
$env:SIC_MIND_GAME_ROOT = (Get-Location).Path
node --test tests/sic-mind-line-12.test.ts
node --test tests/v6-feedback-sequences-reference.test.ts tests/v6-feedback-sequences-integration.test.ts
~~~

Critères figés au commit `f86843ec`.

Les deux scénarios physiques et les 45 contrats de séquence passent. Le 27 novembre 2026 (UTC−3), préparation à 22 h 42 min 07 s, premier rejeu à 22 h 43 min 05 s, contrat à 22 h 43 min 39 s et verdict local à 22 h 46 min 41 s, soit 4 min 34 s.
