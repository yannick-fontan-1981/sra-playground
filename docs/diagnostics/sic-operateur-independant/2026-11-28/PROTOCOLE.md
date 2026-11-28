# SIC — protocole de l’opérateur indépendant P05 / P07 / P14

Identifiant de préparation : **SIC-OP-20261128-01**. Référence du moteur : **`20433007224accc36e3d7976696d9ee7a783a227`**, arbre `src` **`401f4046ff47087b627ec5022d291db343cfc26d`**. Aucun SHA candidat n’est accepté pour une évaluation avant publication du reçu de scellement correspondant.

## Périmètre et unités

| Lot, par primitive | Par famille | Total pour huit familles |
| --- | ---: | ---: |
| Situations positives actives | 250 | 2 000 |
| Remplacements positifs distincts | 50 | 400 |
| Contrôles négatifs | 25 | 200 |
| Paires indiscernables | 25 paires | 200 paires / 400 mondes |

Une situation est un problème avec deux mondes cachés initialement indiscernables. Son certificat est une politique conditionnée aux retours publics qui réussit dans chacun de ces mondes. Les deux exécutions ne font pas deux positifs. Le résultat d’un bras est robuste seulement si les deux exécutions satisfont le critère. Les 6 000 positifs actifs, 1 200 remplaçants, 600 négatifs et 600 paires sont comptés séparément.

Les noms des scènes, les graines, les structures réservées, les solutions, les certificats, les traces détaillées et les identités des familles natives restent chez l’opérateur. Les fichiers publics contiennent les effectifs, critères, limites, SHA et engagements cryptographiques. Les réalisations simulées ne sont jamais comptées comme victoires natives.

## Résolubilité et vérification

Le générateur construit les mondes et les observations. Un oracle séparé recherche une politique forte dans l’espace des croyances : une même histoire publique impose la même décision ; toutes les branches observables de l’action retenue doivent pouvoir réussir. Aucune solution privée ni liste d’effets supposés n’est donnée au candidat. Les retours publics peuvent comprendre la géométrie visible, les receveurs, les contrôles, les affichages et le temps effectivement écoulé.

Chaque certificat positif est rejoué dans tous ses mondes par un vérificateur séparé du solveur. Il vérifie l’action autorisée, la vraie transition, le retour, le temps de jeu, l’objectif visible, les plafonds, l’empreinte de la politique et son coût annoncé. Le départ n’est jamais déjà gagnant. Les tableaux de transition et les preuves ne franchissent pas la frontière de l’évaluateur.

Les contrôles négatifs doivent être impossibles dans chaque monde, sous les limites fixées. Une paire indiscernable exige à la fois une solution individuelle dans chaque monde, l’absence de politique commune gagnante, et l’égalité des retours publics et des durées sur tous les préfixes communs non terminaux. Une devinette favorable dans un membre ne valide aucune primitive.

La certification concerne la classe finie de mondes définie par chaque situation. Elle ne prétend pas identifier une loi parmi toutes les lois cachées imaginables. Le corpus est un banc simulé ; son adaptation à l’entrée du véritable SIC a une qualification séparée.

## Séparation structurelle

La déduplication neutralise noms, ordre de présentation, palette, translation, indices de sommets et graine. Elle porte sur les dépendances exécutoires entre effets, leur composition, l’observabilité et les contraintes qui changent réellement les transitions. Les dépendances transitives redondantes ne créent pas une nouvelle topologie. Les permutations de graphes et changements de présentation ont des contrôles d’invariance.

Les empreintes individuelles restent privées ; leurs engagements sont publiés. Avant qualification d’un candidat, l’opérateur compare ces signatures au registre complet des structures et combinaisons du développement, avec un normaliseur compatible et audité. Une différence de graine ne vaut pas une réserve structurelle. **Tant que ce registre n’est pas reçu et contrôlé, l’absence de recouvrement avec le développement reste non vérifiée.** Le scellement d’un fichier ne démontre pas, à lui seul, cette absence.

Les familles natives réservées doivent aussi être absentes du développement du candidat considéré. Leur présence dans les jeux historiques du moteur de référence n’est pas présentée comme une absence historique d’entraînement. Un chevauchement bloque la qualification de transfert ; une réserve de remplacement est scellée avant un candidat ultérieur.

## Ce qui constitue une réussite

| Primitive | Critère exigé |
| --- | --- |
| P05 | Effet d’une commande réellement jouée sur le bon receveur, citation du retour qui le confirme, conditions testées de validité et réemploi compatible. Une victoire simulée sans cette preuve n’établit pas l’acquisition justifiée. |
| P07 | Franchissement effectivement joué, sujet ou zone effectivement atteint, ou observation effectivement obtenue selon l’objectif du cas. L’identité doit rester correcte après un changement de vue. L’ouverture annoncée, la sélection ou le plan seuls ne suffisent pas. |
| P14 | Choix d’agir, attendre ou réobserver justifié par une évolution mesurée ; prédiction annoncée avant le geste, vrai retour, et révision ciblée si la prédiction est contredite. Le temps du jeu et le temps mural restent deux mesures. |

Les comptes rendus séparent : **résolubilité certifiée**, **succès autonome sur simulateur**, **preuve de primitive vérifiée**, **victoire officielle native**. Un reçu de preuve produit par le candidat seul n’est pas un audit indépendant.

## Bras, budgets et chronométrage

Chaque SHA complet est figé, avec son arbre, sa configuration, son adaptateur et ses dépendances. Le moteur de référence conserve le pack strict `solver: sic` de la révision ci-dessus. Le même adaptateur d’observations et de commandes est appliqué à tous les bras. Aucun modèle hypothétique privé, état vrai, solution ou moteur du jeu n’entre dans le processus SIC.

Pour chaque situation simulée et chaque monde, chaque bras reçoit **64 gestes au maximum, 12 000 états explorés au maximum et 10 000 ms murales au maximum**. Les observations payantes, attentes, sélections, essais, déplacements préparatoires et commandes d’un préfixe sont comptés. Chaque décision continue engage au plus 16 commandes ; les retours sont vérifiés entre gestes et la série s’arrête immédiatement sur contradiction, fin ou limite.

Le processus de raisonnement reçoit une enveloppe identique : un worker, un cœur logique, 1 Gio de mémoire, aucun réseau, sources de production autorisées en lecture seule, espace temporaire propre. Le chargement à froid a un plafond séparé et identique de 30 s ; sa durée est enregistrée. Le temps d’épisode part du premier paquet public remis au moteur et se termine au dernier contrôle en ligne du retour. Le rejeu indépendant après arrêt a sa propre durée de vérification ; la durée totale jusqu’au dernier contrôle est aussi conservée. Le calcul de l’oracle reste hors du temps du candidat. L’ordre référence/actif est contrebalancé et scellé ; les sources d’aléa autorisées sont fixées identiquement entre les bras et les deux mondes d’une paire.

Le compteur d’exploration doit être imposé par une instrumentation de l’opérateur : débit avant expansion, revisites et recherches imbriquées comptées, quota commun, aucun remboursement après reprise ou annulation. Une taille de graphe ou un total autodéclaré par le candidat ne suffit pas. Le code, la couverture des sites de recherche et les reçus du compteur doivent être audités et empreintés. **Sans ce compteur et sans confinement effectif, aucune exécution n’est qualifiante.**

Pour les natifs, le manifeste privé fixe **six familles mécaniques, six jeux et 36 niveaux**, avec un seul parcours chronologique L1→L6 par jeu et par bras. Les plafonds d’origine du jeu sont conservés. Les limites extérieures reprennent la règle chronologique de la référence : 25 niveaux utilisent un témoin historique uniquement pour fixer leur budget ; 11 utilisent le défaut de 80 gestes / 90 s. Ces témoins ne sont pas imputés au moteur de référence actuel. Le plafond d’exploration est de 12 000 par niveau. Le chargement du jeu côté hôte a un plafond séparé de 120 s ; le processus de raisonnement conserve son plafond froid de 30 s. Les limites exactes et les sources sont empreintées avant les parties.

Une campagne native complète se déroule sur des runners GitHub Actions indépendants, répartis en lots selon les durées historiques ; les jeux d’un lot restent en série. Les reçus conservent le temps mural jusqu’au dernier contrôle, le pic de lots simultanés et la durée cumulée. Les vérifications locales de préparation ont leur propre bilan.

## Gains, pertes et ablation

Référence et candidat actif sont comparés sur tout le lot fixé. Sur chaque gain vérifié, le candidat est rejoué depuis le même état avec le retrait de la seule preuve ou capacité invoquée. L’intervention possède un diff ou un masque précis, une empreinte et une autorisation méthodologique de l’opérateur. Le reste du moteur, la mémoire initiale, l’objectif, les observations et les limites restent identiques.

Le journal privé conserve, pour chaque gain ou perte, le premier écart de commande ou de preuve, l’histoire publique disponible, la commande effectivement jouée, son vrai retour, sa conséquence sur l’objectif et le budget, et le résultat du rejeu. Un gain qui subsiste après ablation reste un gain observé sans attribution causale à la capacité retirée. Une ablation absente, trop large, interrompue par le plafond mural ou un incident technique, ou non vérifiable ne produit pas d’attribution. Un échec vérifié au plafond de gestes ou d’états reste un échec sous la même enveloppe.

Les agrégats publics sont produits par primitive et famille opaque. Ils donnent les effectifs de succès, échecs, gains, pertes, attributions, gestes, expansions, temps et statuts de vérifiabilité, sans trace révélatrice.

## Arrêts et résultats non vérifiables

Les statuts sont distincts : succès vérifié, échec vérifié, plafond de gestes, plafond d’états, arrêt mural, commande illégale et résultat non vérifiable. Un superviseur extérieur utilise une horloge monotone et impose une terminaison ferme. Le préfixe déjà joué est conservé et vérifié. Aucune commande illégale n’est remplacée silencieusement.

Un arrêt mural reste dans le dénominateur complet et dans sa catégorie propre ; sa phase est précisée : démarrage ou épisode. Il n’est pas transformé en succès par le certificat de l’oracle et n’est pas utilisé comme échec vérifié pour une attribution causale. Les taux sur tous les cas et sur les seuls résultats vérifiables sont publiés séparément. Une reprise technique ne remplace pas le premier reçu ; elle n’est permise que pour une défaillance d’infrastructure identifiée avant toute décision, selon une règle préenregistrée.

Le retour terminal est aussi remis au moteur. Sa réconciliation est acquittée dans le temps mural restant, avec une référence au ticket et à l’empreinte du retour, sans geste ni crédit temporel supplémentaire. Le contrôle de l’adaptateur doit établir que cet acquittement suit la vraie clôture SIC. Un objectif constaté par l’hôte sans cette acquisition est enregistré séparément et ne suffit pas à qualifier une preuve d’apprentissage ou la continuité native.

## Barrière de transfert et confidentialité

**SS08–SS25 restent sous scellés.** Leur ouverture exige qu’un même SHA gagne des niveaux natifs supplémentaires dans **au moins deux familles mécaniques réservées distinctes**, à budget égal, sans perdre une victoire de référence et sans commande illégale. Toutes les comparaisons nécessaires à ce constat doivent être vérifiables. Deux présentations d’une même mécanique ne font qu’une famille ; des gains répartis sur plusieurs SHA ne se cumulent pas pour ce seuil.

Un cas dévoilé est inscrit irréversiblement au développement. Il est retiré de la réserve active et remplacé par un cas frais, structurellement contrôlé ; un nouvel engagement est publié avant le prochain candidat. Les anciens reçus restent immuables. Les cas déjà divulgués ne servent jamais de nouveau témoignage indépendant.

Le paquet SIC SYNC contient uniquement les agrégats par primitive et famille, les SHA complets, les empreintes, les statuts de contrôle et le verdict. Une publication dans le dépôt ne vaut pas un accusé de réception d’une conversation externe : le canal réel et son reçu sont consignés séparément.
