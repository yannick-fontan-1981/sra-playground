# Préparer le placement d’un sujet avant de passer au suivant

Sur SS07 L2 à froid, SIC rejoint par ses propres décisions une situation depuis laquelle le moteur accorde une victoire vérifiée. À partir de v79, le premier sujet atteint un repère au coup 16. Au coup 17, SIC choisit le second sujet. L’image publique obtenue est identique à celle que le banc de recherche atteint au coup 3 de sa partie gagnante. La même suite de 66 actions gagne depuis les deux préparations. Le score autonome de v79 reste à zéro.

## Origine de l’hypothèse

Sur les traces des 100 jeux sources, un test rétrospectif sélectionne la dernière décision de chaque partie. Il cherche si un déplacement déjà observé permet de rejoindre l’un de deux repères fixes. Il calcule les prédictions avant de présenter l’image suivante. Dans deux cas, DC22 L1 au coup 24 et LS19 L1 au coup 5, la direction prédite est la seule des quatre qui gagne depuis cet état. Les deux cas soutiennent la décision d’approcher un repère. Aucun des deux ne montre un deuxième sujet déjà immobilisé sur l’autre repère. La composition avec le changement de contrôle constitue une hypothèse supplémentaire. [Expérience sur les sources](../../../scripts/measure-paired-arrivals.mjs)

SS07 a servi au diagnostic. Le banc restaure l’état initial, essaie chacune des 16 préparations de deux mouvements, puis joue le même clic et la même suite. Les 16 clics modifient l’image. Une seule préparation place le premier sujet sur un repère stable et elle seule gagne avec cette suite. Les 15 autres échouent avec cette suite. Cette expérience ne détermine pas si une autre suite peut les faire gagner. [Intervention et vérification des deux préparations](../../../scripts/compare-prepared-landmark-contacts.mjs)

## Autorité de la déclaration

L’auteur choisit la priorité d’expérience. Le témoin garde `motion_contrast` en mode actif, qui permet déjà à SIC de découvrir un changement de contrôle. Le candidat déclare `paired_arrival`, qui maintient cette capacité et demande de tester l’intérêt d’un placement avant le clic. Les deux déclarations conservent le même seuil de deux retours distinguables, 88 pas de profondeur, 1 000 états et le même budget de partie. [Déclaration témoin](controle-v63-active.json) · [Déclaration candidate](placements-v77.json)

SIC doit déduire le sujet, le deuxième corps à tester, les repères et leur persistance, le pas compatible avec leurs positions, le mouvement de préparation et le moment du clic. Le reçu contient la position visée pour chaque corps, la position à conserver, la prochaine position prévue et l’origine observée ou hypothétique du mouvement. Une contradiction locale écarte cette action depuis cette position. Le score vient du moteur. [Décision de placement](../../../src/sic/paired-landmark-placement.ts) · [Tests avec des dispositions synthétiques](../../../tests/sic-paired-landmark-placement.test.ts)

## Comparaison à froid sur SS07 L2

| Révision | Première divergence des actions face au témoin | Résultat autonome |
| --- | --- | --- |
| Témoin actif v76 | Clic de changement de contrôle au coup 8, confirmé par le mouvement au coup 9. Le sujet initial ne couvre le repère sur aucune des 51 images de décision. | Échec en 51 actions |
| v77 | Au coup 6, commence un déplacement avant un clic encore incertain. L’échelle de déplacement admise est incompatible avec l’espacement des repères. | Échec en 13 |
| v78 | Même commande et même image au retour sur les 51 décisions du témoin. Le cadre de sélection au coup 8 entoure le corps sans coïncider exactement avec lui. | Échec en 51 |
| v79 | Au coup 8, remplace le clic immédiat par un déplacement. Recouvre le repère au coup 16, clique au coup 17 et confirme le contrôle au coup 18. | Échec en 48 |
| v80 | Conserve l’objectif pendant le test moteur. Le rectangle protégé ne suffit pas à retrouver l’ancien sujet redessiné. Trajectoire identique à v79. | Échec en 48 |
| v81 | Identifie les deux corps redessinés à leurs emplacements puis vérifie le déplacement du corps sélectionné. À partir du coup 19, choisit 144 actions visant le second repère. | Échec en 253, fin officielle de partie |

Le rejeu indépendant de v79 retrouve le premier sujet sur le repère pendant les 32 dernières images de décision. Sur ces images, le second sujet effectue 14 déplacements mesurables pendant que le premier garde sa place. Sur v81, ces chiffres passent à 237 images et 134 déplacements. Le premier contact est maintenu jusqu’à la perte. La suite du banc n’est jamais transmise au pilote.

## Quelle disposition ouvre une capacité nouvelle ?

Depuis le relais effectué par SIC, le banc épuise 198 images atteignables par les quatre directions en conservant le premier placement. Aucune direction n’obtient de score depuis ces états. Pour chaque état, le banc rejoue exactement la préparation puis essaie l’activation. Elle ne change rien dans 165 cas, perd dans 22 cas et échange deux positions en conservant le premier placement dans 11 cas. Le premier échange demande huit déplacements après le relais.

Les 11 échanges désignent rétrospectivement un même rôle visuel. Dans les 165 états sans effet, son indication est absente. Elle est visible dans les 33 autres. Dans les 11 échanges, elle indique un lieu que le second sujet peut atteindre par les directions ordinaires. Dans les 22 pertes, le lieu indiqué se trouve hors de cet ensemble. Cette classification utilise toute l’exploration du banc. Un agent en ligne devra reconstruire cet ensemble avec ses seules observations et décider quelle indication mérite ce test. [Banc de comparaison depuis le relais](../../../scripts/measure-prepared-selection-access.mjs)

Les 11 premières activations atterrissent toutes sur des lieux déjà atteignables. Elles permettent pourtant 204 images supplémentaires par des continuations directionnelles. Aucune de ces continuations à une seule activation ne gagne. Dans la partie autonome de v81, 97 images distinctes après le relais ont été testées a posteriori. Aucune n’offrait l’échange. Augmenter la fréquence d’activation sur cette trajectoire aurait produit 84 commandes sans effet ou 13 pertes. La prochaine décision utile est un déplacement choisi parce qu’il fait apparaître l’indication à une destination dont l’accès a été vérifié.

Les mesures compactes distinguent les décisions de SIC, l’épreuve avec la suite du banc, les contrôles en campagne et le transfert. [Mesures par révision et par configuration](mesures-placements-v81.json)

Dans l’historique strictement antérieur à la décision 22, le second sujet a déjà occupé cinq centres visuels. Ces observations suffiraient à reconnaître la destination de quatre des onze échanges si SIC savait quelle indication viser et comment la faire apparaître. Au dernier déplacement orienté vers le second repère, ce nombre monte à sept. Le rapprochement est celui de l’évaluateur, qui connaît le rôle confirmé par le banc.

## La même priorité a-t-elle un appui sur les sources ?

Sur 108 épisodes sources, dont les 100 L1, une expérience propose une indication visible ayant déjà changé quand le sujet bougeait. Avant de tester une commande non directionnelle, elle distingue si ce sujet a personnellement occupé le lieu indiqué plus tôt dans sa partie. Plusieurs hypothèses peuvent partager une même commande depuis la même image.

| Destination lors de la prédiction | Prévisions vérifiables | Prévisions d’arrivée confirmées | Interventions distinctes avec arrivée confirmée |
| --- | ---: | ---: | ---: |
| Déjà occupée par le sujet | 110 | 10 | 7 sur 80 |
| Jamais occupée par le sujet jusqu’ici | 910 | 1 | 1 sur 251 |

Les sept confirmations de la première ligne proviennent de sept jeux, SKBN, G50T, KLOT, GABA, SNAR, WEAV et SK48. L’autre confirmation vient d’ESCT. Ce signal peut servir à classer des expériences. La majorité des hypothèses restent fausses dans les deux groupes. Sur SS07, le banc connaissait toute la zone accessible et a identifié le rôle de l’indication après l’échange. Les sources testent une situation plus exigeante dans laquelle seule l’histoire publique antérieure aide à choisir le rôle. [Sondage prospectif et contrôles d’état](../../../scripts/measure-source-indicated-sites.mjs)

## Transfert et contrôles

Les 100 L1 sources gagnent sur v81 et leurs trajectoires sont identiques à v76. Les 100 scores sont rejoués indépendamment dans le moteur. Les cinq L2 déjà gagnés en campagne sont préservés et rejoués indépendamment. SS01 gagne en 32 actions, SS02 en 46, SS03 en 97, SS04 en 143 et SS05 en 73. La suite de 496 tests passe.

Sur SS06 L2 à froid, SIC vérifie un transfert de contrôle mais ne prépare aucun repère. Sur SS08 L2 à froid, le même pack propose dix déplacements de préparation. La première commande différente du témoin vient au coup 27. Trois déplacements sont confirmés avec le partenaire immobile, aucun ne confirme le contact. À temps actif égal, SS08 s’arrête en 262 actions avec le pack candidat et 339 avec le témoin. SS06 s’arrête en 296 actions.

SS10 révèle le risque d’insister sur une préparation. Sur 580 gestes, 491 visent à placer le premier sujet. Le mouvement immédiat correspond à la prévision 454 fois, mais le contact visé et le relais ne se produisent jamais. SS11 vérifie une fois le changement de contrôle, n’engage aucun placement et s’arrête au temps après 307 gestes.

SS09 entier a été réservé avant le choix de la règle. Ses résultats historiques étaient connus. Avec v81 et le même plafond de temps actif, les 254 premières commandes et images sont identiques dans les deux configurations. Le candidat s’arrête au temps en 254 actions, le témoin en 255. SIC n’y propose aucun placement préparé et le L2 ne marque dans aucune des deux conditions. En campagne sur SS07, v81 s’arrête au L1 après 511 actions. Le L2 a été évalué à froid.

Le moteur confirme cinq jeux Custom 4 avec un L2 gagné en campagne. Les six autres L2 ont chacun été essayés à froid sur le candidat figé et n’ajoutent aucun score.
