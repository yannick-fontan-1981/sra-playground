# Ce que SIC apprend en jouant le premier niveau

v104 a été intégré à `main` au commit `7b6859dd2`. Les expériences suivantes sont sur `codex/sic-autonomous-lessons`. Le candidat v109 est figé au commit `642f6cbfa`, tag `sic-autonomous-room-lessons-v109`.

Le périmètre mesuré couvre SS01 à SS14. Pendant la qualification, le laboratoire SS15 a rejoint `main` au commit `a14bd33e3`, descendant du merge de v104.

## Scores officiels

| Jeu | v104 au L1 | v104 au L2 à froid | v109 au L1 | v109 au L2 après L1 | v109 au L2 à froid |
|---|---:|---:|---:|---:|---:|
| SS12 | Échec après 335 | Échec après 272 | Gagné en 64 | Gagné en 30 | Gagné en 40 |
| SS13 | Échec après 245 | Échec après 117 | Gagné en 143 | Gagné en 36 | Gagné en 61 |
| SS14 | Échec après 30 | Échec après 350 | Gagné en 31 | Gagné en 52 | Gagné en 97 |

V104 perdait les trois L1 et les trois entrées directes au L2. Avec v109, les trois campagnes franchissent les deux niveaux. Les huit victoires historiques à froid et les trois nouvelles portent à onze le nombre de L2 gagnés en entrée directe sur les quatorze jeux.

Chaque campagne commence au L1 avec une mémoire neuve. SIC choisit tous les gestes du L1 et garde sa mémoire jusqu’au L2. L’entrée directe recommence avec une autre instance qui a uniquement l’image initiale du L2. Le plafond est de 350 commandes par niveau, avec quatre travailleurs et le même moteur natif. Chaque score a ensuite été reproduit par un second programme qui vérifie l’image avant et après chaque commande et le compteur de niveaux du moteur. [Certificat des cohortes](certificat-lecons-autonomes-v109.json)

## Quelles expériences changent la partie ?

| Jeu | Première commande différente de v104 au L1 | Expérience et exploitation |
|---|---|---|
| SS12 | Coup 3, SIC essaie la direction 2 après la sélection du second sujet. v104 rejouait la direction 1. | Après avoir relié les deux rives avec des appuis, SIC commence au coup 16 à chercher un placement du mécanisme et une position de départ qui projettent le sujet dans la région des sorties. Au coup 40 il teste une arrivée visible sur sol praticable. Au 43 il passe la main. Au 55 il teste si dégager un objet plus proche libère la projection du second sujet. |
| SS13 | Coup 8, SIC active le mécanisme devant une silhouette de destination. v104 jouait la direction 2. | Le changement d’image permet d’associer un objet et sa destination de part et d’autre d’un pivot. SIC confronte cette géométrie à des distances différentes. Les formes qui se déplacent indépendamment deviennent un coût d’approche pour le planificateur. |
| SS14 | Coup 14, SIC teste la direction 2 au lieu de répéter la direction 4. | Le pilote mesure la portée du contrôle et suit les objets déplacés de concert. Au L2, dès le coup 2, il essaie de déplacer ensemble des pièces dont la disposition correspond à plusieurs plaques qui commandent une porte. Il peut ensuite laisser en place le sujet qui prépare le passage et conduire l’autre vers le but. |

La première version qui savait résoudre SS13 L1 en 143 coups perdait ensuite le L2 en 99. Elle n’y essayait aucun clic alors qu’un L2 démarré à froid faisait apparaître une expérience de sélection. Dans la première image du L2, deux formes pouvaient être interprétées comme le partenaire. Les observations du L1 permettaient de les départager. V109 recherche les corps déjà identifiés et une indication compatible, essaie le changement de contrôle, puis réemploie les effets mesurés. La commande suivante dépend de l’image obtenue. [Proposition et vérification de l’expérience](../../../src/sic/probe-paired-displacements.ts)

## Qu’apprend réellement le L1 ?

| Jeu | L2 avec transmission | L2 avec réapprentissage | Première commande différente au L2 |
|---|---:|---:|---|
| SS12 | Gagné en 30 | Échec après 350 | Coup 1, direction 1 avec réapprentissage et clic (9, 27) avec transmission. |
| SS13 | Gagné en 36 | Échec après 99 | Coup 1, direction 2 avec réapprentissage et clic (21, 30) avec transmission. |
| SS14 | Gagné en 52 | Gagné en 99 | Coup 1, direction 2 avec réapprentissage et clic (9, 27) avec transmission. |

Sur SS12 et SS13, réactiver la transmission transforme un échec en victoire en campagne. Sur SS14, les deux configurations gagnent et la transmission économise 47 commandes au L2. Une entrée directe au L2 réinitialise toutes les autres mémoires et constitue une troisième condition.

Les deux packs s’exécutent avec le même binaire et les mêmes budgets. Seul le choix déclaratif de transmettre la leçon de contrôle change. Les deux campagnes produisent exactement les mêmes commandes et images sur tout le L1 de chacun des trois jeux. Le L2 repart de la même image, les autres mémoires de SIC fonctionnent dans les deux configurations. Dès la première décision du L2, le reçu de v109 cite la transition qui a validé le niveau précédent. Au deuxième coup, il cite aussi trois observations précises du L1 dans chaque jeu. Les numéros de révision sont dans le certificat.

Le pack d’expérience choisit la stratégie `learn_the_scope_of_a_control`. L’auteur déclare la préférence d’expérimentation, la profondeur de 88 et le budget de 1 000 nœuds. La bibliothèque native fournit les hypothèses de marche, poussée, traction, déplacement de groupe, échange et projection perpendiculaire à distance égale. SIC doit identifier dans les images les participants, la commande, l’étendue du déplacement, la direction de projection et la position où l’action ouvre un accès. Une prévision vers la nouvelle rive se teste quand le pilote voit une marque sur une case praticable. [Pack du candidat](apprendre-la-portee-du-controle-v105.json) · [Pack de réapprentissage](reapprendre-par-salle-v107.json) · [Recherche d’un placement ouvrant une région](../../../src/sic/prepare-projected-passage.ts)

La mémoire transmise contient des observations référencées, les signatures visuelles des deux sujets, les directions mesurées, les effets concurrents et, lorsqu’elles ont été observées, des relations de projection ou de mobilité des appuis. Le pilote reconstruit les positions et les itinéraires depuis la nouvelle scène. Sur les trois jeux, les décisions sont prises à partir des commandes publiques et des images. Le banc hors ligne sert à comparer des suites depuis le même état et à localiser une erreur. Les scores ci-dessus proviennent du moteur SIC complet.

## Conservation et portée du résultat

Les onze L2 de SS01 à SS11 ont été rejoués par le candidat dans la condition gagnante de v104. 11 sur 11 reproduisent exactement les commandes et l’image finale du témoin. SS01 gagne toujours le L2 en 32 commandes après le L1. Les deux succès à froid supplémentaires de v104 ont également été vérifiés, SS01 en 44 coups et SS04 en 60. Les 100 L1 sources sont gagnés par le candidat au plafond historique de 60 commandes. 100 trajectoires sources sur 100 sont identiques à celles de v104. Deux contrôles sources supplémentaires reproduisent leur trajectoire de référence, CWSE L2 en 59 commandes et KLOT L4 en 37. La compilation TypeScript et les 529 tests de qualification ont réussi.

SS12, SS13 et SS14 ont servi au diagnostic puis à la mesure. Ces essais établissent une réutilisation d’effets observés entre les niveaux et permettent d’en mesurer l’apport à budget égal. Le système dispose déjà d’une famille d’hypothèses spatiales et d’un détecteur de scènes à deux sujets. Par exemple, la recherche de déplacement d’un pivot après la jonction de deux rives exige actuellement une forme non classée unique. La généralisation à des graphismes ou à une géométrie de projection différents reste à mesurer.

## Reproduire la comparaison

Figer le solveur sur le tag indiqué et employer le moteur du commit d’intégration. Dans `scripts/compare-source100.mjs`, les arguments sont le répertoire du solveur figé, celui du moteur, un nouveau fichier JSONL, le code du jeu, le niveau de départ, le niveau final, le plafond par niveau et la tranche. Pour chacun des trois jeux, utiliser `1 2 350 0/1` et `2 2 350 0/1`. Choisir le pack avec `SIC_STUDY_RECOVERY_PACK`, enregistrer les commandes avec `SIC_STUDY_RECORD_COMMANDS=1` et fixer `SIC_STUDY_WORKERS=4`. Pour la comparaison causale, reprendre uniquement la campagne avec le pack de réapprentissage. Sur les sources, lancer le lot `source 1 1 60` avec les ressources publiques Python du moteur et les quatre tranches `0/4` à `3/4`. Chaque comparaison utilise un nouveau fichier de sortie. [Pilote autonome](../../../scripts/compare-source100.mjs) · [Vérificateur de scores Custom 4](../../../scripts/verify-frozen-level-scores.mjs)
