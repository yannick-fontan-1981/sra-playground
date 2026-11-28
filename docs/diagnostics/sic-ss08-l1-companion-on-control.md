# SS08 L1 · reconnaître le compagnon sur une commande occupée

La dernière [campagne du groupe SS08–SS25](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46141922351) a donné 0/144. À la demande de Yannick, SS08 L1 devient un cas de développement avec une comparaison ciblée. SS09–SS25 demeurent en réserve. Un nouveau taux de groupe exige un rejeu de groupe.

## Première cause mesurée

Sur `552e1c62`, le service SIC depuis L1 joue 80 commandes autorisées sous le plafond de 80 gestes et 90 secondes actives, avec un worker. Il propose 13 réflexions et n’émet aucune sélection. L’analyse locale du vrai retour montre que le second personnage ne quitte jamais sa plaque. À la première prise en charge par la famille de composition des acteurs, le registre lit l’aperçu de réflexion comme un acteur. Lorsque l’aperçu disparaît, le registre devient un registre à un seul acteur. La forme du vrai compagnon est visible, mais la plaque occupée laisse quatre pigments de coin qui rendent son arrière-plan hétérogène.

Le raccord expérimental P05 → P14 → P07 avec P09 possède ses propres témoins V6. À ce SHA, ses appelants sont des tests et le pack strict de cette partie n’appelle pas le raccord. Le premier verrou physique de SS08 est l’identité et la sélection du second sujet, en amont de l’ordonnancement des effets. Prolonger l’exploration du seul acteur reconnu laisse cette condition manquante.

## Comportement corrigé

La perception garde le motif du corps distinct de sa surface. Elle ne lie la couche de coin à une commande que si sa combinaison cadre et accent correspond à une porte observée sur la même grille. Elle maintient l’unicité du candidat et récupère les deux corps dès le départ. La règle exploite des motifs et des pigments relatifs. Les coordonnées, identifiants de jeu et commandes d’une solution n’entrent pas dans sa décision.

Sur le moteur `8b66fe19`, le rejeu local strict gagne officiellement L1 en 32 commandes autorisées, au même plafond. Le premier changement de famille est visible dès le geste 1. La commande 1 reste identique et le fournisseur devient la composition des acteurs. Au geste 21, le moteur sélectionne le compagnon. Le geste 22 obtient un échange. Depuis les mêmes positions au geste 20, jouer directement cette commande directionnelle sans sélectionner pendant le contrôle donne une marche du marchand. Le second changement de contrôle est joué au geste 28. Le rejeu physique indépendant des 32 commandes retrouve trois réflexions, deux échanges et les deux destinations occupées au retour officiel.

Les deux bras GitHub reproduisent sous Linux les commandes, les effets ordonnés et les empreintes de préfixe obtenus sous Windows. Le figé `552e1c62aca9ec620365ac73449ededc33ae582b` reste à 0/1 en 80 gestes et le candidat `8b66fe19898e37855e5e7488381d6d29a52f9a82` passe à 1/1 en 32 gestes. Le préfixe gagnant est `c559f787c367fb88624c494d76c555d9e71f5bdb9728420ba8364b0cc28a71ab`.

## Besoins et campagne d’amélioration

| Besoin | Contrôle exécuté dans ce lot | Extension à mesurer |
| --- | --- | --- |
| P01 · Attribuer un corps sur un contrôle occupé | Trois permutations de palette conservent les deux corps. Retirer seulement l’accent correspondant de la porte retire l’attribution du compagnon. | Faire varier le motif du corps, la position des couches et la présence de plusieurs décorations candidates. Vérifier l’abstention en cas de liaison ambiguë. |
| P05 · Attribuer le contrôle au receveur sélectionné | À positions égales, la même commande produit une marche ou un échange suivant la sélection réellement confirmée. | Varier l’alphabet, le receveur, la portée du trajet coudé et les échanges qui échouent après confirmation de la sélection. |
| P07 · Franchir à la suite de l’échange ou de la réflexion | Le vrai retour enregistre deux échanges et trois réflexions avant l’occupation conjointe des destinations. | Tester le maintien de l’ouverture, les reflets sur l’autre aile et la révocation de la route après un changement de surface. |
| P09 · Conserver la première destination pendant la préparation de la seconde | Le retour terminal rejoint les deux destinations dans le vrai moteur. | Rejouer la composition sur des familles nouvelles avec plusieurs ordres possibles et comparer le coût de sélection et de reprise. |

La campagne ciblée repart du L1 sur les deux SHA et vérifie la couverture des commandes par SIC, le plafond commun et le score observé. Les contrôles sources de continuité sont séparés. [Comparatif SS08 L1](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46157307879) · [Continuité des sources](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46157308304)

```powershell
node scripts/check-sic-chronological.mjs SS08 1 "$env:TEMP/sic-ss08-l1.jsonl" 1 sic
node --test --test-name-pattern "covered control" tests/sic-observed-actor-composition.test.ts
```
