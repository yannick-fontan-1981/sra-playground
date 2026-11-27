# DICO · Rangée 87 · Choisir le sous-ensemble à tester

**Le témoin de la rangée 87 est le quatrième geste du niveau 1 dans le catalogue initial.** La famille `subset_diagnosis` libère le plan `subset_scope_query`. Parmi six questions admissibles, deux partagent les quatre candidats en deux groupes de deux. Le départage natif retient le test de `{0,4}` au point `(6,3)`. Les neuf images retournées établissent un résultat LOCAL. La famille conserve `{1,5}`.

Le gel possédait déjà ce comportement et le calcul partagé du pire cas. Le candidat rend la sélection d’offres distincte de la famille qui prépare les commandes. Une intervention au nouveau point de sélection va jusqu’à une autre commande autorisée et à son propre retour. [Attendus préenregistrés à 5446e42e](ATTENDUS.md) · [Pré-événement, reçus et contre-épreuves](temoin.json)

## Deux départs à distinguer

Les sessions redémarrent au niveau 1, zéro niveau terminé, depuis le jeu local DICO. Le harnais reprend le pack du catalogue, le réglage actif du répartiteur de familles du worker et le budget normal de 600 actions par niveau. Chaque préfixe réel s’arrête au quatrième geste. Les horloges du service sont fixes pour comparer les tickets. Le paquet du jeu reste côté opérateur. Seule sa projection publique entre dans le service.

| Geste | Catalogue, curiosité d’ouverture omise | Contrôle avec `openingCuriosity: active` |
|---|---|---|
| 1 | N1, `observed_frontier`, clic (1,3), le niveau continue | N1, curiosité d’ouverture, clic (25,36), un niveau terminé |
| 2 | N1, navigation de portée, clic (6,3) | N2, essai de frontière, clic (13,12) |
| 3 | N1, navigation de portée, clic (16,3) | N2, essai de frontière, clic (1,3) |
| 4 | **N1, question de la rangée 87**, clic (6,3) | N2, navigation de portée, clic (6,3) |

L’inventaire initial est publié sur le code `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`. La campagne ciblée avec curiosité documente la ligne 98 à son premier geste. Le lot vérifie ces préfixes sur le code historique, le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le candidat. Le total historique de 58 actions pour les six niveaux appartient à la campagne ciblée d’origine. [Inventaire, témoins 86 et 87](../../../docs/architecture/sic-v8-strategies-observees.md#L112) · [Campagne ciblée et ligne 98](../../../docs/architecture/sic-v8-strategies-observees.md#L123)

## Avant le choix de la question

La coupe est située dans `SubsetDiagnosis.propose`, après la construction des offres et avant leur comparaison. Elle enregistre les offres **effectivement arrivées au choix local**. La famille a déjà écarté les commandes sans contrôle appris, les tests de portée sans recouvrement ou sans discrimination utile selon ses gardes et les questions de portée déjà essayées dans ce domaine. Le répartiteur global doit d’abord amener cette famille à proposer. Une navigation peut être produite à une autre coupe.

Occurrence `subset-qualification:epoch:1:revision:4:frame:44924ad65c1ab548`. La portée visible contient `{0,1,4,5,6,7}`, mais le domaine compatible avant le geste vaut `{0,1,4,5}`. Les preuves utilisées remontent aux observations des révisions 2 et 3. Le sceau SHA-256 de l’ensemble des offres est `c338cb858626bd0c69d0cf33c377ab83eb4023a27a746d3a0fa39b71f0a57d5d`.

| Offre et commande | Testés | Restants si GLOBAL | Restants si LOCAL | Pire cas |
|---|---|---:|---:|---:|
| Portée (6,3) | 0, 4 | 2 | 2 | **2** |
| Portée (27,3) | 1, 5 | 2 | 2 | **2** |
| Singleton (13,26) | 0 | 1 | 3 | 3 |
| Singleton (25,26) | 1 | 1 | 3 | 3 |
| Singleton (13,38) | 4 | 1 | 3 | 3 |
| Singleton (25,38) | 5 | 1 | 3 | 3 |

Sous l’hypothèse conditionnelle d’un seul membre fixe, GLOBAL conserve l’intersection avec les membres testés, LOCAL le complément. Le pire cas est le plus grand de ces deux effectifs. Sur les anciennes versions, la sonde lit le coût conservé dans chaque offre. Elle reconstruit les deux effectifs à partir du domaine et des membres de cette offre, tous présents à la coupe. Sur le candidat, elle les lit dans l’offre typée. Le même calcul indépendant vérifie chaque ligne.

À pire cas égal, l’ordre natif préfère une commande de portée à un singleton, puis la liste de membres lexicographiquement la plus petite. Des offres encore identiques sur ces critères gardent leur ordre de présentation. Ici les deux meilleures ont le même type. La liste `[0,4]` précède `[1,5]`. La garde `current_subset_control_and_exact_declared_question` accepte la question `74cd95c9b651b30d5b8401743745eb744e36efdd240849d4d7751f2c3437dd79`. Le service délivre `subset-qualification:native:4`, `ACTION6(6,3)`.

## Retour, contrôles et attribution

| Essai | Résultat obtenu |
|---|---|
| Retour réel | Les neuf images établissent LOCAL sur `{0,4}`. L’événement `public_subset_feedback` lie les occurrences 4 et 5 et le domaine passe de quatre à deux candidats, `{1,5}`. Le contrôle du plan reste `matched=null` comme dans l’inventaire. La prédiction conditionnelle et l’acquisition du retour sont deux objets distincts. |
| Même ticket, seulement le dernier raster réel | La dernière occurrence a le même identifiant que dans le jeu. Le retour transitoire est indéterminé, aucun événement d’élimination, les quatre candidats sont conservés. |
| Même ticket, retour stationnaire construit | Le harnais rend une seule image identique à l’image antérieure. Même préfixe, mêmes offres et ticket complet identique. Le domaine reste `{0,1,4,5}`. Les coordonnées seules ne justifient aucune élimination. |
| Domaine permuté | Deux restaurations de la même famille sur le même plateau diffèrent uniquement par l’ordre d’insertion des candidats. Même sceau des six offres, même question, même commande. |
| Retour pris en compte sur la vue initiale | Dans une fixture ultérieure, réexposer la géométrie de départ avec le seul domaine réduit `{1,5}`. Les deux contrôles de portée perdent leur justification. Deux singletons à pire cas 1 restent en concurrence. La famille propose le test de 1 en (25,26). |
| Autre offre optimale imposée au raccord, candidat seulement | Dans un processus témoin, substituer la seconde offre de même coût et de même type **après mesure des mêmes six offres**. Les trois premiers tickets sont identiques. La famille prépare la question sur `{1,5}`, le service admet et joue (27,3). Les images réelles donnent GLOBAL et conservent `{1,5}`. Le domaine final coïncide avec le nominal malgré une commande et une preuve différentes. |

Le gel reliait `measureSubsetScene`, les prédictions conditionnelles, `assessHypothesisPartition`, le tri privé de la famille et `SubsetDiagnosis.record`. Il jouait déjà le bon geste et acquérait le bon retour. Le candidat remplace les tuples privés par des offres typées qui portent commande, membres, origine et mesure. `selectSubsetQuery` choisit l’offre. La famille consomme ses champs pour construire la question et le plan. Le contrôle sur l’autre optimum démontre que ce retour de sélecteur commande effectivement le geste. Dans les sessions nominales, le service garde son autorité et la sonde se limite à observer. [Sélecteur](../../../src/sic/subset-query.ts) · [Famille native](../../../src/logos-engine/v6-subset-diagnosis.ts) · [Opérateur de partition partagé](../../../src/sic/discriminating-experiment.ts)

Dans la composition de la matrice, **P01** ancre la portée et le domaine avec `measureSubsetScene` et `resetDomain`. **P03** fournit la relation conditionnelle entre appartenance et issue. Avant le choix, seuls les groupes nécessaires à la mesure de **P04** interviennent. La prédiction détaillée de `measureConditionalSubset` est gelée dans le plan après sélection de la question. **P11** vérifie le contexte et la clé de question avant le ticket. **P12** utilise `subsetFeedback` sur les images publiques, puis conserve les membres compatibles avec le reçu. La mesure du pire cas ne dépend donc d’aucune image du retour.

La branche est issue de `02032a3d` pour réutiliser son chargeur de jeux. Son moteur de départ est celui du gel. Le module de partition partagé avec les objectifs d’information reste à sa version du gel. Le lot porte sur une seule ligne parmi 98. Le choix des familles, la navigation 86 et l’ouverture 98 conservent leur attribution propre. La qualification sur branche et l’éventuelle intégration sur main restent deux décisions séparées.

## Rejouer pour le Banc

Depuis la racine du checkout candidat, avec Git, tar, Node 24 et le paquet Pyodide de SRA-Playground préparé localement :

```powershell
.\experiments\sic-agenda-offres\dico-87\verifier.ps1 --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu "$env:TEMP/sic87-recu.json"
```

Le vérificateur extrait les deux révisions de référence, contrôle les attentes préenregistrées, la pièce témoin et la parité du candidat avec le gel. `--recu` est facultatif. Les raster et animations restent en mémoire dans le processus local. Les assertions testent les offres avant choix, la libération, les retours liés aux tickets et le domaine réellement retenu. [Vérificateur](verifier.mjs) · [Tests de sélection](../../../tests/sic-subset-query.test.ts)
