# Composer des commandes locales et mettre à l’épreuve une disposition encore inexplorée

Cette expérience relève du chantier 11 du [programme de généralisation](chantiers-de-generalisation.md). Une commande publique a modifié un site. Une autre commande a modifié un deuxième site en conservant l’état connu du premier. SIC peut alors se demander si les deux changements sont réalisables ensemble, même si aucune image de la combinaison n’a encore été observée.

La proposition contient la commande, les observations qui la motivent, la configuration actuelle, le premier effet prédit et la configuration recherchée. Le chemin peut repasser par une configuration connue. Après chaque commande, SIC relit les sites mesurés. Un effet contraire interdit de répéter cette transition depuis la même configuration. La recherche est bornée à dix sites binaires par épisode. Elle ne représente pas encore le déplacement continu d’un site, une commande à trois positions ou l’objectif propre à chaque combinaison.

## Expérience source

La conception utilise les transitions publiques des jeux sources. Le banc restaure des préfixes authentifiés, découvre les commandes à partir de leurs effets et laisse l’exploration des combinaisons utiliser le budget restant. Sur LOGI L5 le témoin v31 échoue en 90 coups. À partir de 22 coups authentifiés, cinq commandes apprises permettent au banc de gagner avec 12 coups supplémentaires. Depuis le premier coup, le pilote intégré gagne en 84 coups. L’intérêt de ce second essai est d’inclure la découverte des commandes, le choix de l’expérience et son exécution dans la même partie.

## Épreuves de transfert enregistrées avant ouverture du candidat

- Geler le code sous le tag `sic-source100-independent-configurations-v36`. Rejouer le candidat exporté et le témoin v34 sur LOGI L5, avec 90 coups chacun, puis vérifier le score et les images dans le moteur. Les candidats v31 et v34 servent aussi de références historiques.
- Mesurer les 100 L1 dans les conditions de v31, plafond de 60. Relever les nouvelles défaites et les différences de trajectoire, y compris les quatre victoires SKBN, SWCH, KEYD et GABA. Relever séparément toute perte de KEYD L2 avec la leçon publique.
- Mesurer les neuf L2 déjà ouverts de Custom 4 à froid, avec le même moteur et le plafond de 1 200 actions. SS01 doit conserver 44 à froid et 32 avec les 19 commandes publiques du L1. SS04 doit conserver 60 à froid. Comptabiliser séparément les campagnes qui ont réellement franchi le L1.
- Une première victoire officielle au L2 d’un autre jeu constitue le progrès recherché. Une première victoire à froid sur un jeu auparavant gagné après le L1 est un autre résultat. Rejouer les commandes gagnantes indépendamment et retirer la capacité pour en tester la contribution. SS09 L2 reste réservé à la confirmation finale.
