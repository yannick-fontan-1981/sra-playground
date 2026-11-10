# Lot 10A : question axiale acquise

## État de préparation

Le lot 10A raccorde `axial_question` au runtime commun depuis la base réellement publiée **Site 83**, moteur **0.52.0**, commit `bed48116585da864dd5c412ed11dd6990a950e8e`. Le travail est isolé dans la branche `lot10a-axial-question`. Le numéro du prochain moteur sera établi après réconciliation des publications concurrentes. Les entrées 10B à 10E ne sont pas réalisées par ce lot.

Le registre recalculé de cette branche compte **57/76 entrées raccordées**, sans entrée partielle, soit **19 entrées restantes**. Les **37 workflows compilés** ne changent pas : `v6.axial_question.choose`, déjà compilé, est maintenant installé et exécuté avec son callback `axial.select`.

Les contrats de composant passent **130/130**, et les scénarios du caller commun passent **6/6**. Les contrôles de régression, la compilation de livraison, le coût, l'intégration finale et la publication restent des étapes distinctes à établir. Aucun résultat de coût ou de partie nouvelle n'est déduit des tests de composant.

## Comportement porté

La mesure retrouve les corps à barres opposées, leurs axes, leurs marqueurs, les ancres et l'unique cible. La sélection doit avoir été acquise par un contraste public compatible. Une sélection seulement dessinée, ambiguë ou incompatible avec la scène courante n'autorise pas Axial.

Le choix suit exactement **priorité DRM, distance en quarts de tour, préférence au contrôle rappelé, commande, indice source**. Il conserve plusieurs offres et leur ordre. La garde source possède une exigence distincte : une seule offre doit correspondre à la clé et à la mesure de la proposition retenue. Des pairs partageant une clé peuvent donc conduire à un choix déterministe puis à un refus de garde, conformément à Python.

Une proposition porte une action conditionnelle **OP18**. Le runtime exécute la garde courante et le contrôle WHY/ACT, puis scelle le retour. Une projection d'orientation ne prouve ni force, ni trajectoire, ni transmission à travers un mur, ni réussite officielle.

## Connaissance et décision suivante

La boucle synthétique intégrée part d'une mémoire froide. Une action `ACTION1`, choisie par une autre famille à partir des seules observations publiques, change le marqueur central. Le passage passif Axial atteste ce contraste une fois. La décision suivante passe par `v6.axial_question.choose`, `axial.select`, OP18 et l'autorisation commune.

Un retour contrôlé observe ensuite `ACTION4 → quart de tour −1`, contrairement à son a priori. La famille conserve le reçu avec ses preuves et rappelle cette commande à la décision suivante. Une ablation séparée des seuls reçus de rotation, dans une instance native de diagnostic, donne la commande différente attendue par Python. Le diagnostic ne modifie pas la mémoire ni les autorisations du caller de production.

Deux retours sans effet consomment les deux tentatives du contexte. Axial s'abstient ensuite dans ce même contexte. Une modification géométrique pertinente peut rouvrir une question ; elle n'efface pas arbitrairement les contre-exemples.

## Portée, frontières et restauration

Les six champs source sont conservés séparément : `epoch`, `selection`, `rotations`, `portable`, `attempts`, `last`. Une frontière exporte les rotations comme méthodes révisables et remet à zéro la sélection, les rotations courantes, les tentatives et le dernier retour. La condition source de publication d'état est **selection ou rotations ou portable** ; le checkpoint natif complet est une structure distincte.

La restauration depuis le graphe conserve les connaissances, sans rétablir une autorisation périmée. Un scénario commun traverse la frontière, restaure le propriétaire, exécute une nouvelle action étrangère pour acquérir la sélection du nouveau niveau, puis rappelle la méthode transportée avec une revalidation courante.

L'adaptation native **`current_epoch_axial_packet_attribution`** est séparée de la parité Python. La scène finale du nouveau niveau ne sert jamais de preuve de l'ancien effet. Si les ancres de l'ancien et du nouveau niveau sont indistinguables, le paquet reste ambigu et n'acquiert aucun contraste physique. Les images anciennes admissibles gardent leur indice d'origine. Le delta officiel de score reste conservé séparément. Le chemin `recordSource` garde le comportement Python original pour ses comparaisons indépendantes.

## Preuves et réserves

- [Filiation source, contrats et limites](lot10a-axial-question-lineage.md).
- [Reçu des comparaisons Python](lot10a-evidence/diagnostic/axial-reference-validation.json) : 68 cas de famille, 38 de géométrie, 16 de politique/SRC et huit contrats natifs supplémentaires. Le manifeste source est vérifié avant et après l'oracle.
- [Boucle commune](../../tests/v6-axial-question-kernel.test.ts) : propriétaire unique, acquisition passive froide, action Axial, retour unique, influence, tentatives, restauration et frontières. Les journaux de diagnostic conservent aussi les essais échoués.
- [Scan public archivé](lot10a-evidence/diagnostic/initial-public-admission.json) : 95 images initiales, seul POLA admis par la mesure, aucune action exécutée. Ce scan ne constitue pas une partie.

L'oracle a détecté un écart réel sur le zéro négatif de JavaScript dans les axes opposés. La normalisation préserve le zéro entier Python ; le journal défaillant **127/128** et la reprise **130/130** restent conservés. Un premier test complémentaire avait également une attente erronée sur le statut SRC ; la correction de cette attente et son historique restent séparés du défaut de code.

POLA possède une tentative historique interrompue à **94 actions et zéro niveau**, sans reçu final ni temps récupérable. La [revue de son budget de cas](lot10a-evidence/diagnostic/pola-case-budget-review.json) conserve le périmètre recherché : les 110 commits de la base publiée et les traces historiques disponibles ne permettent pas de reconstruire un budget restant positif. Aucune nouvelle horloge de 40 minutes n'est créée, et le temps d'un autre jeu n'est pas repris. Cela ne prouve pas que les 40 minutes ont été consommées. **La contribution propre dans une nouvelle partie et une réussite officielle restent ouvertes.** Les scénarios synthétiques ne sont pas présentés comme des niveaux de jeu réussis.

La mesure des barres reste finie dans le domaine public, sans borne temporelle propre ; les 1 000 ms source concernent seulement les projections V5. Le checkpoint Axial réutilise une enveloppe immuable inchangée, mais sa validation parcourt encore l'historique mutable avant de constater cette égalité. L'aplatissement des méthodes et leur recherche suivent aussi cet historique. **Le coût de longues sessions accumulant des rotations Axial reste à caractériser** : STCK/SMLP ne doivent pas être présentés comme cette preuve si Axial n'y acquiert aucune rotation. Toute optimisation locale devra conserver la détection des changements imbriqués, les contre-exemples et la restauration, en coordination avec le lot 5. La parité complète de l'appelant V5/V6 n'est pas revendiquée.

## Prochaine étape

Terminer les contrôles du gel intégré et son coût avant de clore 10A. La réalisation autonome suivante du lot 10 est **10B, `window_question`**, puis 10C `ordered_recruitment`, 10D `temporal_selection` et 10E `invited_endpoints`.
