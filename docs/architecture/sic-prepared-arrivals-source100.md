# Quand une marque devient une prévision d’arrivée

SIC représente une relation entre un sujet identifiable, une marque visible et une action. La position de la marque se lit avant la commande. L’observation suivante permet de vérifier quel sujet a bougé, où il a atterri et quels autres sujets sont restés en place. Une réalisation observée peut être réutilisée dans le niveau suivant de la même campagne. Une simple ressemblance visuelle ouvre une expérience.

## Deux expériences tirées des jeux sources

Dans **VOIS L1**, trois préparations changent la destination de la même commande depuis une même origine. La famille de raisonnement peut maintenant énumérer les préparations admissibles et leurs destinations avant d’en choisir une. Elle vérifie que le sujet reste en place et que la marque arrive où prévu. Elle peut ensuite activer la commande et, si un déplacement ultérieur dispose de deux origines témoins, annoncer aussi une continuation. Une préparation démentie interrompt cette composition. [Comparaison physique des trois préparations](./sic-preview-writes-source.md)

Dans **G50T L1**, le sujet est en (12,4), la marque en (4,4), en coordonnées doublées de l’observateur. À partir du même état, ACTION5 seule laisse le sujet en (12,4). ACTION2 puis ACTION5 l’envoie en (4,4). ACTION1 puis ACTION5 le laisse en (12,4). Les deux préparations préservent le sujet et la marque à leurs positions initiales jusqu’à l’essai de la deuxième commande. Une préparation peut donc changer ce que permet l’action suivante même si ces deux positions sont identiques. Le résultat porte sur cet état physique.

## Déclenchement de l’expérience

Sur les traces de 100 jeux et de 18 niveaux supérieurs, le protocole a enregistré 113 hypothèses nouvelles dans 87 situations distinctes. Une empreinte apparaît ou se déplace indépendamment du sujet, possède des dimensions comparables et le sujet a déjà bougé en son absence. Dans les fourches physiques, 8 hypothèses sur 113 ont une commande directe qui amène le sujet sur la marque. En essayant les commandes successivement tant que le sujet et la marque restent en place, on obtient une arrivée dans 5 hypothèses. Certaines commandes peuvent aussi ramener le jeu à un état antérieur. Une arrivée isolée établit une observation conditionnelle.

Après exposition aux seuls préfixes publics de ces 87 situations, la famille de production ouvre une expérience dans 78 cas, dont 77 sur une disposition enregistrée. Elle réalise quatre arrivées dans G50T, CWSE, FITE et ZIPP. Les jeux, coordonnées, couleurs et identifiants d’action de ces exemples restent dans l’évaluation. SIC choisit ses commandes d’après les transitions déjà observées dans l’épisode. Un essai qui laisse la disposition intacte peut conduire à l’essai d’une autre commande. Un départ du sujet ou la disparition de la marque met fin à cette série.

## Mesure de transfert prévue

Le témoin d’origine demeure le commit `7f2cb3eb29a4bd7640c3c38b71107af86b521ad5`. Le candidat est l’archive du tag `sic-projected-affordances-source100-candidate-v24`. L’environnement est fixé à `f4d28aee9ebbb35533bb97a26968efd22887473d`. Les engagements de prédiction sont enregistrés avant chaque action, puis un vérificateur rejoue les commandes et mesure les positions dans le moteur. Les deux versions utilisent les mêmes positions initiales et limites de campagne. Les arrêts par temps actif se distinguent des épuisements d’actions. La réussite principale exige un franchissement officiel de SS01 L2 par SIC seul. Les autres comparaisons portent sur SS06, SS07 et SS08 L2. SS09 L2 reste réservé à la confirmation.

Les essais directs au L2 démarrent avec une mémoire vide. La campagne depuis le L1 conserve uniquement les relations effectivement apprises par l’agent avant le passage officiel au L2. L’auteur a déjà vu les diagnostics antérieurs de SS01. Le protocole mesure le transfert d’un changement conçu sur données sources vers une cible connue de l’auteur.
