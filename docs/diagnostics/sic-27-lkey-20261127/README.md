# LKEY — préparations de profils continues

Le candidat `165991ec` gagne **6 niveaux en 119 commandes** en une session SIC depuis le niveau 1, avec un seul worker et les plafonds stricts archivés. Le niveau 6 atteint le score en **9,612 secondes sur 18**, avec **30 commandes sur 36**. Aucun reset ni undo n’a été utilisé. Les 119 commandes sont sous autorité SIC et ont été acquises.

## Sources et portée

- Base combinée : `8e4321073e1b5445b08cd128fe7a9b2c26fb0752`.
- Correctif et tests natifs : `165991ececa2f02dfbe8950882fbb3851910a14e`.
- Contrat de continuité et matrice CI : `44fce009fee528e0e422de77db5d30ad822f017d`.
- Branche : `fix/sic-27-profile-continuity-20261127`.

Le rejeu strict et le collecteur ont exécuté le même SHA de production, propre avant et après les deux passages. Les manifests conservent les empreintes du propriétaire, du moteur, du service, des scripts et des références. Les changements suivants du gate n’ajoutent aucune logique de jeu.

La campagne stricte historique `4a546a13` s’arrêtait au niveau 6 après 27 commandes. Le diagnostic préalable sur la base combinée `8e432107` s’est arrêté après 26 commandes sous le même plafond de 18 secondes. Ce diagnostic est instrumenté ; cette archive ne prétend donc pas mesurer un pourcentage de gain de temps par rapport à lui.

## Cause et correction

Le rôle de sélection, prise, échange, ajustement et dépôt était déjà appris par `sic_verify_profile_transfer`. Au niveau 6, les 26 propositions du diagnostic étaient toutes acceptées. Après les expériences unitaires qui distinguent les outils, les préparations connues restaient séparées par une clôture et une nouvelle décision.

Le propriétaire prépare maintenant le préfixe des opérations soutenues par les preuves conservées, dans la limite de 16 commandes, du budget restant et de son compteur local. Il s’arrête avant une expérience P05 ou un effet encore ambigu. Chaque retour doit correspondre au profil, à la sélection, à la prise et aux réceptions projetés. Avant le ticket suivant, il remesure aussi les interfaces, les outils et la disponibilité de la commande. Une contradiction, une limite ou un score officiel ferme la série.

L’acquisition reprend l’état produit par le retour précédent pour chaque ticket réellement exécuté. Le diagnostic hors jeu, restauré sur les observations publiques de la décision 10, reproduit **16 commandes, leurs gardes et chaque état acquis** du témoin unitaire. Les contrôles depuis les décisions 1 et 7 confirment aussi des préfixes de 3 et 2 commandes. Le préfixe restauré depuis la décision 12 dépasse la fin de la capture ; ses derniers retours ne sont pas inventés.

## Résultats stricts et tickets

| Niveau | Commandes / plafond | Score / plafond de temps | Commandes après index 0 | Longueurs des séries |
|---|---:|---:|---:|---|
| 1 | 8 / 13 | 4.218 / 12 s | 0 | unitaires |
| 2 | 8 / 13 | 1.326 / 11 s | 5 | 6 |
| 3 | 20 / 24 | 4.449 / 14 s | 14 | 14, 2 |
| 4 | 29 / 34 | 5.140 / 19 s | 20 | 8, 14 |
| 5 | 24 / 29 | 4.824 / 18 s | 17 | 3, 2, 15 |
| 6 | 30 / 36 | 9.612 / 18 s | 22 | 3, 2, 16, 5 |

Les cinq premiers `prefixHash` du rejeu strict sont identiques à ceux du diagnostic `8e432107` : ils lient les commandes et les retours publics, y compris les frames. Le niveau 6 n’avait pas de verdict victorieux préalable sur cette base ; aucune parité complète de ce niveau ni du graphe runtime n’est affirmée.

Le collecteur indépendant retrouve les mêmes comptes de commandes et les six scores. Il lie **119 tickets à 119 retours**, répartis sur **41 décisions**, avec **78 commandes exécutées après l’index 0** et une série maximale de **16**. Chaque décision est réconciliée une fois, à sa clôture. Dans le rejeu strict, l’intervalle médian entre deux commandes d’une même série est de 47 ms ; aux frontières de décision, il est de 538 ms.

## Transfert et refus

Les deux ateliers natifs de transfert acquièrent les commandes par leurs retours publics, franchissent trois niveaux, puis exécutent leurs préparations dans le runtime natif. La seconde variante reflète et translate les stations, ajoute une dent, permute la palette et échange les contrôles d’outil et de dépôt. Les vérifications portent aussi sur les preuves conservées, l’absence d’expérience inconnue dans une série et l’acquisition unique de tous les tickets.

Les cas négatifs ferment une série au second retour contradictoire, devant deux repères compatibles ou après un changement d’apparence d’outil. Un budget insuffisant entraîne l’abstention. Les quatre tests de modèle d’ordre et d’inversion restent verts. **10 tests ciblés passent**, ainsi que le typecheck avant le gel du candidat.

## Contrat permanent

Le gate ajoute les six niveaux de LKEY sans changer les seuils des treize jeux déjà protégés. Les plafonds de commandes restent **13, 13, 24, 34, 29, 36**. Le collecteur utilise leur maximum, 36, et le contrat vérifie chaque plafond individuel ; la qualification chronométrée stricte reste celle du rejeu distinct ci-dessus.

Les références de continuité sont les comptes réellement exécutés **0, 5, 14, 20, 17, 22**, rapportés proportionnellement au nombre de commandes comme pour SIGN et GABA. L1 garde ses expériences unitaires. Sur L2–6, le contrat exige des préparations qui associent prise et déplacement sous une même décision, avec les retours du propriétaire confirmés et des changements d’image réels. Une simple série de marche ne les remplace pas. Ce contrôle utilise les retours natifs et les pixels publics ; il ne constitue pas un second simulateur indépendant des profils.

Les tests du gate refusent la perte de série, les retours dupliqués ou mal liés, la continuation après contradiction ou clôture demandée, une réconciliation incomplète, des prises sans changement d’image et un reset. **17 tests de contrat et de collecte passent**, dont sept nouveaux basés sur le témoin public. `checkRun` accepte la cohorte LKEY de six niveaux. La matrice passe à **12 cohortes, 14 jeux et 84 niveaux** ; son contrôle final conserve le nom `Executed series and final reconciliation`.

La campagne globale sur un même SHA reste à exécuter par la CI du lot intégré. Cette archive ne présente pas les anciennes preuves de 78 niveaux comme un nouveau rejeu de 84 niveaux.

## Archive reproductible

`public-evidence.tar.gz` contient le résultat historique LKEY, la capture publique complète du diagnostic, les probes, la re-proposition hors jeu, les sorties strictes et de continuité, leurs manifests et les journaux de tests. Les fichiers bruts n’ont pas été réécrits. L’ordre des entrées et les métadonnées tar/gzip sont fixes.

- Taille : 1,713,363 octets.
- SHA-256 : `d359134c4f93af690a8d54f778bcd451191bd05ea5a4df1fc05267927d829c3b`.
- `summary.json` conserve le détail par niveau et l’empreinte de chaque entrée.

Les scripts de lancement archivés indiquent les commandes exactes. Les chemins locaux y désignent l’environnement de mesure ; ils peuvent être adaptés sans changer les scripts de campagne, les références ou les plafonds. Le nouveau fixture du test de gate conserve les tickets et les effets nécessaires, avec le SHA du collecteur complet.

L’intégration sur `main`, le gate global, la publication et le rejeu par l’interface livrée sont suivis dans le lot parent. Aucun succès de publication n’est déduit de ces seuls témoins natifs.
