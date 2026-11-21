# Des placements qui rendent une action possible

SS09, SS10 et SS11 ont servi au diagnostic. Les trois L2 sont désormais gagnés à froid par SIC. Le banc est un programme de diagnostic qui peut repartir du même état du moteur pour essayer plusieurs suites. La partie autonome démarre une seule fois, reçoit l’image et les commandes disponibles et laisse SIC choisir chaque geste. Les scores ci-dessous viennent de cette seconde condition. Un vérificateur recharge ensuite le niveau et contrôle chaque image, chaque commande et le crédit officiel.

## Score du candidat figé

**Onze jeux sur onze** ont un L2 gagné par le même pack v104. **8 sur onze** sont gagnés en démarrant directement au L2 dans les essais consignés. La colonne campagne donne les actions du L2 après un L1 joué par SIC dans la même session. Chaque partie indiquée a été rejouée sur le moteur indépendant, avec vérification des commandes, des images et du crédit de niveau. Le tiret indique une condition non mesurée ici. Les cinq essais complémentaires à froid sur SS01 à SS05 ont chacun un plafond de 250 commandes.

| Jeu | Entrée directe au L2 | Après L1 autonome |
| --- | --- | --- |
| SS01 | Gagné en 44 | Gagné en 32 |
| SS02 | Échec après 250 | Gagné en 46 |
| SS03 | Échec après 250 | Gagné en 97 |
| SS04 | Gagné en 60 | Gagné en 143 |
| SS05 | Échec après 250 | Gagné en 73 |
| SS06 | Gagné en 54 | — |
| SS07 | Gagné en 117 | — |
| SS08 | Gagné en 70 | — |
| SS09 | Gagné en 54 | — |
| SS10 | Gagné en 227 | — |
| SS11 | Gagné en 35 | — |

Sur SS10, le premier passage v104 s’est terminé à la limite de temps actif après 216 coups. Ses 216 premières commandes et images sont identiques à celles de la partie gagnante. Le second passage du même candidat au même plafond de 290 actions et à la même limite de temps a gagné en 227. Le résultat dépend donc aussi du temps disponible au pilote. Les parties SS09 et SS11 sont gagnées sans relance.

Les huit trajectoires gagnantes de SS01 à SS08 et celle de SS09 concordent avec v100, commandes et image finale incluses. Le rejeu des **100 L1 sources** confirme 100 victoires et 100 empreintes de trajectoire identiques à v98 au plafond de 60. CWSE L2 en 59 et KLOT L4 en 37 conservent également leurs trajectoires. La suite de qualification compte 526 tests réussis. La compilation TypeScript réussit. Le tag du candidat est `sic-source100-recover-registered-motions-v104`, commit `8452c743b`. Le moteur Custom 4 est `f0a1ff437`.

## Première décision qui change

| Niveau | Même état, même moteur, même budget | Expérience choisie par SIC | Résultat |
| --- | --- | --- | --- |
| SS09 L2 | 46 actions et images communes. Au coup 47, le réglage v99 choisit le haut. Les deux caisses occupent déjà les repères. | V100 prévoit que pousser vers la droite déplacera aussi le partenaire qui barre la route. Les deux déplacements se produisent. Le reçu suivant conserve la référence de l’observation. | Témoin en échec à 70, candidat gagnant en 54. |
| SS10 L2 | 148 actions et images communes. Au coup 149, le réglage v101 choisit une commande qui laisse l’image inchangée. Un plan de placement possède déjà une expérience à proposer. | V102 donne la priorité à ce test. Le coup 149 calibre une direction. Le coup 153 vérifie la prédiction d’entraînement. SIC distribue ensuite les placements entre les deux sujets. | Les deux caisses occupent les repères et la porte s’ouvre au coup 212. Victoire au coup 227. Le témoin échoue au plafond commun de 229. |
| SS11 L2 | 14 actions et images communes. Au coup 15, le réglage v103 remonte vers un repère. Il a auparavant joué les quatre directions, mais sa reconnaissance des sujets est postérieure à ces observations. | V104 rattache aux deux sujets les déplacements antérieurs au clic. Il choisit la droite depuis la même case. La poussée déplace une caisse. Les poussées suivantes déplacent une file et produisent un premier appui. | Témoin en échec à 80, candidat gagnant en 35 avec quatre clics et aucune remise à zéro. |

Les deux réglages de chaque ligne sont exécutés par le **même binaire** avec des packs distincts. Les trois comparaisons portent sur le premier changement de commande et d’image. Les références de preuve dans les reçus peuvent changer plus tôt. Sur SS11, dès le coup 10, le candidat cite des observations de mouvement antérieures au clic. Au coup 15, son reçu donne la disposition actuelle, les positions prévues, le terrain encore à transformer, le contact envisagé et la commande choisie.

## Ce que l’auteur déclare et ce que SIC doit trouver

L’auteur choisit le mode actif et une stratégie dans le pack. Il fixe un plafond de 88 actions pour les plans imaginés et de 1 000 états examinés par recherche. La stratégie de v104 autorise la relecture des déplacements mesurés avant l’identification des sujets. Le langage SIC v103 savait sélectionner un mode, décrire un résultat attendu, essayer une commande et comparer son retour. Il lui manquait une opération pour rattacher après coup une ancienne observation au sujet désormais identifié. [Pack v104](relire-les-mouvements-avant-selection-v104.json) · [Pack témoin v103](composer-une-traversee-continue-v103.json)

Le pilote conserve des rectangles de couleur des deux images d’un mouvement. Une fois la grille et les deux sujets identifiés, il vérifie qu’un sujet a avancé d’exactement une case pendant que l’autre est resté en place. Une commande associée à deux déplacements incompatibles reste indéterminée. Les images, les couleurs, la taille des cases, les rôles, les directions utiles et les clics sont déterminés pendant la partie. Le reçu relie la prédiction au geste observé avant le changement de contrôle. [Primitive et conditions d’abstention](../../../src/sic/motion-before-selection.ts) · [Test avec mouvements contradictoires et mouvements conjoints](../../../tests/sic-motion-before-selection.test.ts)

## Quatre étapes sur SS11

1. **Formuler la capacité recherchée.** SIC relève deux cellules de terrain entre la porte et la rive des arrivées. Au coup 9, l’occupation d’un repère modifie la porte. Il peut maintenant rechercher une disposition qui maintienne cette ouverture et permette de franchir les deux cellules.
2. **Imaginer des préparations.** La recherche simule la position des sujets, les lignes de caisses, les appuis produits et l’occupation du repère. Elle peut essayer une poussée ou un échange avant d’en connaître l’effet. Le reçu garde les effets encore hypothétiques.
3. **Tester depuis le jeu.** Le premier appui apparaît au coup 17. Après le changement de sujet, la préparation laisse une caisse sur le repère pendant que le sujet se déplace. Le second appui apparaît au coup 31. Dans deux expériences séparées, changer uniquement la poussée 17 ou 31 pour l’une des trois autres directions fait échouer la même suite en 35 coups. Ce test établit la dépendance de cette suite à sa préparation. D’autres solutions peuvent exister.
4. **Réutiliser et replanifier.** Le sujet marche sur le premier appui au coup 31 et sur le second au coup 32. Les deux arrivées sont occupées au coup 35. Dans un contrôle séparé, le vérificateur efface les 18 commandes prévues qui restent juste après le premier appui. Depuis cette observation, la recherche recalcule 18 gestes et gagne avec la même image finale. [Test de retrait du plan](../../../scripts/verify-crossing-continuation.mjs)

Le banc avait trouvé une solution en 30 actions, avec des appuis aux coups 12 et 26. Les quatre clics, les préparations et les 35 actions de la partie autonome sont choisis par SIC. Le pilote utilise le moteur par son interface publique ordinaire. Les scripts de qualification qui rejouent ou modifient une suite restent hors du pilote.

## Portée et limites

SS08 a été gardé hors de la conception de v104. Son L2 était connu des versions antérieures. Sur sa partie enregistrée, la primitive retrouve deux directions au changement de contrôle et prédit correctement les 25 déplacements unitaires ultérieurs qui permettent de les vérifier. Le même contrôle rétrospectif trouve 8 correspondances sur SS06 et 69 sur SS10. Il s’abstient sur les enregistrements de SS07 et SS09. Ces mesures qualifient la reconnaissance de mouvements sur d’autres jeux. Le gain de score attribuable à cette nouvelle opération est celui de SS11. La partie autonome de SS11 gagne malgré deux reçus initiaux défavorables au détecteur de marque des coups 8 et 9. La lecture du déplacement et de la porte fournit alors sa propre preuve. Un changement de contrôle peut ainsi devenir exploitable même quand le seul indice de silhouette est insuffisant. [Vérification sur les mouvements futurs](../../../scripts/measure-motions-after-registration.mjs)

Les traces sources étayent la distinction entre poussée et entraînement. Sur 103 épisodes couvrant 100 jeux, un nouvel essai dans une direction déjà observée confirme 20 prédictions de poussée sur 22 et 18 d’entraînement sur 20. La prédiction concurrente correspond trois fois dans chaque groupe. Les jeux Custom 4 ont ensuite orienté le choix de la priorité, de la géométrie de traversée et du rappel de mouvements à tester. La traversée recherche actuellement deux sujets, des arrivées reconnaissables et un passage sur lequel aligner des pièces. Le score mesure le catalogue évalué.

[Résultats, empreintes et interventions depuis le même état](mesures-traversees-composees-v104.json) · [SS09 et ses témoins](placements-cooperatifs-v100.md)

## Reproduire la comparaison SS11

Les deux commandes utilisent Node 24, le checkout SIC du tag `sic-source100-recover-registered-motions-v104` et le même checkout moteur `f0a1ff437` avec ses déclarations de référence. Les deux variables de chemin ci-dessous désignent ces checkouts. Le répertoire courant est celui de SIC. Le vérificateur accepte un fichier de sortie différent pour chaque condition.

```powershell
$packs = Join-Path $solverRoot 'docs/diagnostics/sic-plan-arbitration'
$env:SIC_STUDY_RECORD_COMMANDS = '1'
$env:SIC_STUDY_CURSOR_OFFERS = '1'
$env:SIC_STUDY_WORKERS = '4'
$env:SIC_STUDY_RECOVERY_PACK = Join-Path $packs 'composer-une-traversee-continue-v103.json'
node scripts/compare-source100.mjs $solverRoot $engineRoot controle.jsonl SS11 2 2 80 0/1
$env:SIC_STUDY_RECOVERY_PACK = Join-Path $packs 'relire-les-mouvements-avant-selection-v104.json'
node scripts/compare-source100.mjs $solverRoot $engineRoot candidat.jsonl SS11 2 2 80 0/1
node scripts/verify-frozen-level-scores.mjs $engineRoot score-controle.json controle.jsonl
node scripts/verify-frozen-level-scores.mjs $engineRoot score-candidat.json candidat.jsonl
node scripts/compare-maintained-preparations.mjs $engineRoot candidat.jsonl preparations.json
node scripts/verify-crossing-continuation.mjs $engineRoot $solverRoot candidat.jsonl $env:SIC_STUDY_RECOVERY_PACK continuation.json
```
