# Couverture de SIC Fallback aux niveaux 1 à 3

Le catalogue figé contient 100 jeux sources et 14 jeux Custom 4, chacun avec au moins trois niveaux. Le laboratoire SS15 expose également huit niveaux via sa session publique. Le registre suit les **345 couples jeu–niveau**, y compris les cases encore sans mesure. Chaque essai indique le solveur, le mode d’entrée, le budget, les commandes jouées, le crédit officiel et l’empreinte de la suite. Les colonnes de synthèse comptent chaque couple une seule fois, même s’il est gagné dans plusieurs conditions. [Registre des résultats vérifiés](couverture-sic-niveaux-1-2-3.json)

Au point de mesure du 21 novembre, **178 couples jeu–niveau** ont au moins une victoire rejouée dans le moteur. Les sources comptent 100/100 L1, 35 victoires parmi 48 L2 évalués et 18 parmi 28 L3. Sur Custom 4, 9 des 13 L1 évalués et les 14 L2 ont une victoire. Aucun des 8 L3 évalués n’en a pour le moment. Le laboratoire ajoute SS15 L1 et L2. Ces chiffres réunissent les versions et conditions d’entrée consignées. Sur CGWL, le témoin interrompait la campagne en sérialisant une condition facultative sans valeur. Le test reproduit la panne. v114 omet cette condition en l’absence d’observation et la campagne gagne les trois niveaux en 15, 33 et 36 actions. Chaque crédit est reproduit indépendamment.

## Une leçon du L1 peut changer le résultat du L3

| Source, témoin v109 | L1 en campagne | L2 à froid | L2 en campagne | L3 à froid | L3 en campagne |
|---|---:|---:|---:|---:|---:|
| CAVA | 7 | Échec à 120 | **12** | Échec à 120 | **19** |
| CATR | 32 | Échec à 120 | **4** | Échec à 120 | **5** |
| CASC | 6 | Échec à 120 | **16** | Échec à 120 | Échec à 120 |

Chaque campagne démarre avec une instance neuve et les commandes de SIC au L1. Les images et les crédits du moteur ont été rejoués indépendamment. Sur CAVA, la famille qui apprend les déplacements vers des cases surlignées choisit sept commandes au L1, onze au L2 et seize au L3. La comparaison établit l’avantage de conserver la mémoire de campagne. Elle regroupe tous les souvenirs transmis entre niveaux.

Sur **SS15**, le même binaire v109 déjà figé pour SS12–SS14 gagne directement le L2 en **48 actions**. Le moteur du laboratoire est celui du commit `a14bd33e3`. L’adaptateur délègue le chargement, la sélection et chaque action à la session publique utilisée dans le navigateur. Le L1 à froid atteint sa limite de temps actif après 190 actions, et le L3 se termine par une défaite en 48 actions. SS15 figure dans une cohorte séparée.

## Première nouvelle capacité et premier point de L3

Sur BP35, v109 gagne à froid le L1 en 18 coups et le L2 en 49. Il perd le L3 en 62 coups. Le détecteur reconnaissait une grille seulement si au moins cinq supports de même forme avaient la même couleur. Au L3, trois supports d’une couleur et deux d’une autre ont le même contour et la même phase spatiale. Le détecteur renvoyait une scène vide avant que SIC puisse proposer son expérience.

Regrouper ces objets pour déterminer la géométrie ne suffisait pas. Le premier prototype perd encore au L3 en 64 coups. Depuis le même état, le banc a comparé le déplacement horizontal après zéro, un et deux clics sur le second matériau. Le déplacement est respectivement bloqué, possible sur une case, puis de nouveau bloqué. Lors d’une autre comparaison, le même pas au-dessus d’une ouverture provoque une défaite. Réactiver le support avant ce pas garde le personnage en vie et lui permet de traverser.

Le candidat **v110** distingue les preuves physiques par apparence. Lorsqu’un bloc garde une marque après le clic, il teste l’entrée sur la case. Une traversée vérifiée lui permet de reconnaître le même passage ailleurs. Quand l’itinéraire est bloqué, il imagine le sol rétabli sous les pas projetés, rétablit l’appui nécessaire au prochain pas, observe le résultat et recalcule le trajet. La capacité se déclenche dans la famille des supports retirables. Elle hérite de son détecteur de formes et de son modèle de déplacement latéral. [Implémentation](../../../src/sic/excavate-descent.ts)

| BP35 L3, entrée directe, plafond de 120 | Résultat |
|---|---:|
| v109 | Défaite en 62 |
| Prototype qui regroupe les supports par silhouette | Défaite en 64 |
| v110, moteur SIC complet | **Victoire en 34** |
| v110, permutation de la palette publique | **Victoire en 34** |

La première commande du candidat est la direction 4, celle du témoin était la direction 3. Les 34 commandes proviennent de SIC, sans réinitialisation. La permutation de palette conserve toute la suite de commandes. Les trajectoires sont reproduites dans le moteur Python public. Le test de palette porte sur le même jeu. Le transfert de la capacité de restauration à une autre famille reste ouvert. BP35 L1 et L2 gardent leurs scores de 18 et 49 sur v110.

## Protocole et suite des mesures

Le témoin v109 est `642f6cbfa`. Le tag `sic-learn-reversible-footing-v110` pointe sur `79b4fd98c`. Les deux utilisent le pack `apprendre-la-portee-du-controle-v105.json`. Les mesures sources à froid utilisent 60 commandes pour le L1 et 120 pour les L2 et L3. Les campagnes sources ont 120 commandes par niveau. Sur Custom 4, le plafond de la nouvelle série est de 350 par niveau et la limite de temps actif peut intervenir plus tôt. Les anciennes victoires conservent dans le registre leur plafond de qualification d’origine.

Plusieurs parties tournaient simultanément lors des premières mesures, avec un parallélisme déclaré de quatre. La suite utilise **une seule partie à la fois**. Le pilote déclare un worker par défaut (`SIC_STUDY_WORKERS=1`). Cette valeur règle le temps actif autorisé par niveau dans V6, soit 360 secondes pour un worker et environ 514 secondes pour quatre. La file séquentielle limite effectivement le nombre de parties. Un fichier `<sortie.jsonl>.pause` permet au superviseur de céder la place entre deux jeux. Son retrait permet à la file de reprendre les essais manquants. Les essais interrompus au changement de cadence doivent repartir du début. Les nouvelles bandes ont un nom distinct et enregistrent `parallelWorkers: 1` pour permettre une comparaison à cadence identique. Le pilote est `scripts/compare-source100.mjs` avec `SIC_STUDY_RECORD_COMMANDS=1`. Les répertoires du solveur figé et du moteur sont fournis séparément. Le vérificateur source prend le répertoire contenant les ressources Python, le pack, un chemin de certificat et les bandes JSONL à contrôler. Il vérifie chaque commande, chaque image, les réinitialisations et la frontière officielle de chaque niveau atteint en campagne. Le vérificateur Custom 4 utilise le répartiteur natif du moteur. [Vérificateur source](../../../scripts/verify-sic-source-levels.mjs) · [Vérificateur Custom 4](../../../scripts/verify-frozen-level-scores.mjs)

Les L2 et L3 sources, les campagnes et les L3 Custom 4 continuent d’être mesurés. Sur SS13 et SS15, l’examen des L3 révèle un autre problème commun. Une partie du fond de la case peut rester visible dans les coins du personnage. Le détecteur qui exige quatre coins identiques peut alors perdre le sujet sur lequel tester le changement de contrôle. Sur SS14 L3, il repère les deux sujets mais s’abstient faute de caisse visible. Ces trois cas permettent de tester une reconnaissance des sujets indépendante de la présence de marchandises et validée par la réponse à la sélection.

## SS15 à cadence identique

Le moteur du laboratoire et le rejeu indépendant accordent à v111 (`594446c5f`) le L1 à froid en **91 actions**. SIC reconnaît les deux sujets lorsque le fond reste visible dans les coins et peut corriger leur identification en observant où passe la marque après une sélection. Le L2 à froid est gagné en **48 actions**. En campagne le même solveur gagne le L1 en 91 puis épuise les **350 actions du L2**. Les trois entrées utilisent le même moteur, le même pack, 350 actions par niveau et un worker déclaré. Toutes les commandes proviennent de SIC. Le L3 de cette campagne n’a jamais été atteint. Le registre conserve le crédit du moteur et le mode d’entrée de chaque mesure.

La première divergence arrive dès la commande 1 du L2. L’image d’entrée est identique. À froid, SIC clique sur le second sujet et le moteur confirme le transfert de la marque. En campagne, SIC joue la commande 5 pour atteindre un indicateur et le résultat contredit la prédiction. Sur les 350 décisions, 11 essais de prévisualisation sont contredits et 322 décisions cherchent à faire réapparaître un indice. Le premier défaut à examiner est donc l’arbitrage entre une vérification locale du contrôle et la recherche d’une condition héritée.

## SS14 L3 et le choix du sujet capable de préparer un passage

Dans une trace diagnostique de 210 actions, le prototype propose 73 sélections du sujet supposé capable de déplacer le mécanisme. La première arrive à l’action 19. Le planificateur vérifiait que le second sujet avait un autre effet de contact, puis cliquait sans avoir trouvé une position de lancement atteignable pour lui.

Le candidat recherche une préparation en gardant fixe la position du premier sujet. Dans un test synthétique, il trouve avec le second sujet un trajet qui pousse le mécanisme, replace le sujet et projette une arrivée dans la région visée. Le reçu donne l’opérateur, la première commande, les sites de lancement, de mécanisme et d’arrivée, ainsi que l’observation qui a établi la projection. Sur la même scène, le refus de contact mesuré pour le premier sujet laisse cette expérience disponible au second. Quand le contact est aussi réfuté pour le second, le candidat retire la proposition. Cette comparaison teste la décision locale. La victoire autonome en L3 fait l’objet d’une mesure distincte. [Test comparé](../../../tests/sic-paired-displacements.test.ts)

## Apprendre un effet quand les effets connus ne donnent aucun plan gagnant

Sur LP85 L2, les dix premières commandes et les images produites sont identiques avec v114 et v115. La dixième commande change les valeurs de 23 cases parmi 42. L’observateur mesure une seule permutation compatible avec ce changement. Le planificateur cherche à satisfaire les deux emplacements indiqués avec ce seul opérateur. Quand sa recherche échoue, v114 abandonne cette famille d’hypothèses avant de tester une autre commande.

v115 réutilise la discrimination d’hypothèses du langage SIC. Une route mesurée vers les emplacements cibles garde la priorité. En son absence, le pilote compare les résultats visibles que prédisent les modèles encore compatibles. Pour une commande inédite, il peut tester si elle reproduit une transformation déjà vue ou laisse la disposition intacte. Si elle donne un troisième résultat, il ajuste un modèle sur ce qu’il vient d’observer. À coût égal, l’essai préféré élimine le plus d’hypothèses dans le cas le moins informatif. Le pack fournit le mode et le nombre minimal de résultats distincts. SIC déduit les cibles, les transformations, la commande à essayer et les combinaisons menant au but.

| Entrée directe, plafond de 120 actions | Témoin | Candidat v115 |
|---|---:|---:|
| LP85 L2 | v114 échoue en 120 | **Victoire en 25** |
| LP85 L3 | Échec en 120 | **Victoire en 38** |
| LOGI L2 | v109 gagne en 53 | **Victoire en 53** |

À la commande 11 de LP85 L2, depuis la même image, le témoin clique sur une case qui ne change rien. Le candidat choisit une autre commande visible et 37 pixels changent. Il compose ensuite ses effets jusqu’au crédit officiel. Les 25 commandes viennent de SIC, sans réinitialisation. Sur LP85 L3, sa famille de permutation utilise trois commandes distinctes. Le rejeu indépendant confirme les deux victoires. LOGI mesure la préservation d’un jeu différent. Le nouvel effet causal est démontré sur la famille de jeux à permutation. [Choix de l’expérience](../../../src/sic/discriminating-experiment.ts) · [Réutilisation du résultat](../../../src/sic/slot-permutation.ts)

Sur la même transition publique de LP85 L2, la configuration active avec deux résultats minimaux choisit P05 et donne deux arrangements possibles dans le reçu. La configuration avec trois résultats minimaux et la configuration en observation seule s’abstiennent. Sur la transition du L1 qui donne déjà une route gagnante, les trois configurations choisissent P07 et la même route en quatre coups. En partie entière à froid, le seuil de deux donne la victoire en 25 coups. Le seuil de trois redonne les 120 commandes et toutes les images du témoin v114, puis son échec. Seul le seuil du pack change entre ces deux essais v115. Pour reproduire la comparaison, utiliser le tag `sic-experiment-before-route-v115`, le même moteur source, `SIC_STUDY_WORKERS=1` et l’entrée directe `source:LP85 2 2 120 0/1` du banc `scripts/compare-source100.mjs`. La variable `SIC_STUDY_RECOVERY_PACK` sélectionne la configuration. [Pack à deux résultats](apprendre-la-portee-du-controle-v105.json) · [Pack à trois résultats](discriminer-trois-resultats-v115.json)

Sur SS15 en campagne, v112 et v113 jouent les mêmes 91 coups au L1. Le premier coup du L2 diverge. v113 reteste une sélection observée au niveau précédent, puis remesure les commandes dans la nouvelle salle. Le L2 passe d’un échec en 350 à une **victoire en 80**. Le pack, le moteur, le temps autorisé et le plafond d’actions sont identiques. Les crédits de v112 et v113 ont été rejoués.

Sur SS14 L3, v111 et v112 produisent exactement les mêmes commandes et images pendant leurs 285 actions communes. Ils atteignent la limite de temps en 285 et 294 actions. Dans le relevé des 120 premières décisions de v112, les 119 propositions de la famille spatiale correspondent aux commandes réelles. La projection est apprise à la quatorzième action. Le modèle reconnaît un passage, mais la recherche directe ne trouve pas d’arrivée dans la zone des objectifs. Une simulation sur les positions observées trouve une arrivée dans une région intermédiaire. L’existence d’une suite gagnante reste à établir.

v116 applique le même critère de discrimination aux effets physiques. Lorsque le plan calculé reste incomplet, un déplacement témoin peut départager des explications concurrentes sur ce qui suivra le sujet. Le reçu gèle les positions prédites selon chaque loi et l’observation modifie ensuite leur classement. Le test comparé conserve une route menant au but quand elle existe. L’évaluation sur des jeux Custom 4 utilise des versions figées.

v117 peut aussi préparer un test. Quand les actions immédiates produisent les mêmes prédictions, SIC réexamine les positions qu’il a déjà explorées. Il retient une suite de préparations seulement si toutes les lois physiques encore en concurrence en prédisent chaque étape. Au point atteint, la même commande doit ensuite produire des conséquences différentes selon ces lois. Le reçu distingue la préparation et le test. Dans un cas synthétique, avancer une case donne le même résultat sous les hypothèses de marche et de poussée. La commande suivante permet de les départager au contact d’un objet. Une route calculée jusqu’aux objectifs garde la priorité.

Le contrôle de préservation a détecté une régression sur SS13 L1. v109 gagnait en 143, v112 épuise 350 actions. La première divergence est la commande 12, depuis la même image. Le témoin avance avec la préparation du placement conjoint, le candidat tente une disposition de lancement. Dans la même série v112, SS12 garde sa campagne en 64 puis 30 et SS14 en 31 puis 52. La campagne v118 décrite ci-dessous reteste cette régression.

Le reçu de la huitième commande de SS13 L1 explique cette divergence. La projection déplace une caisse et laisse les deux sujets à leur place. SIC réutilisait cette observation comme preuve du déplacement possible d’un sujet. Sur SS14, la quatorzième commande déplace effectivement un sujet. v118 distingue le rôle de l’objet dont la position a changé. Quand seule la caisse a bougé, le pilote peut tester une projection visant le sujet avant de planifier un passage pour lui. Le test du rôle utilise les positions observées avant et après l’action. [Observation du rôle affecté](../../../src/sic/paired-previews.ts) · [Utilisation de la preuve](../../../src/sic/prepare-projected-passage.ts)

Le candidat figé v118 rétablit la campagne SS13. Il gagne le L1 en **133 actions** puis le L2 en **36**, en 169 décisions autonomes et sans réinitialisation. Le moteur indépendant reproduit les deux crédits. Depuis la même observation à la commande 12, v112 tentait d’organiser un passage tandis que v118 prépare une position où les explications de l’effet physique font des prédictions différentes. Au L1, le reçu consigne deux tests de mouvement qui ont effectivement départagé les hypothèses. Le gain mesuré au L1 compare les candidats complets. L’attribution à la seule modification de v118 exige la comparaison avec v117.

### Le même critère dans un jeu à déplacement

Sur SS13 L3 en entrée directe, v116 utilise le même choix d’expérience que sur la famille des permutations. À la commande 87, quatre lois prédisent un pas ordinaire et une cinquième prédit l’échange des positions du sujet et d’une pièce. Le moteur réalise exactement l’échange. La destination observée du sujet et celle de la pièce ne correspondent qu’à cette cinquième prédiction. Dès la commande 88, le plan prévoit un échange et l’obtient.

Après le test, le pilote prévoit 41 échanges avec une pièce. Le moteur en confirme 15 et en réfute 26. Les 26 prédictions réfutées visent toutes une même case d’arrivée depuis plusieurs positions. La première survient à la commande 144. Le reçu prévoit un échange et les deux positions restent inchangées. Le constat localise une condition d’application à explorer. Le score officiel reste un **échec en 350 actions**. Ces mesures séparent le choix du test, l’identification de l’effet, sa réutilisation et la couverture réelle du niveau. [Modèles de déplacement](../../../src/sic/paired-displacements.ts) · [Choix d’une préparation](../../../src/sic/plan-paired-displacements.ts)
