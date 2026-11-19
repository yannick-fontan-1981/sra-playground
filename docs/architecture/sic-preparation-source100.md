# Dériver un nouvel usage à partir d’un changement observé

## Sélection du mécanisme

Le témoin est `bacd5c7f1fcd043ad340d7aaee5f7f3fedbcf3c4`, la version SIC Fallback entraînée sur les 100 L1 lors de la précédente expérience. Le code candidat descend directement de ce témoin. Les seules données de conception sont ses 100 traces L1, chacune bornée à 60 actions. Le programme d’audit revérifie chaque image de départ et de retour en rejouant les commandes publiques. Il trouve un contraste de l’effet de B depuis une même image d’origine, selon qu’une action A a été appliquée ou non, dans 17 jeux. Dans 21 jeux une commande déplace une même composante identifiable de plusieurs façons. Sur KEYD, B déplace la pièce après A et produit une édition visuelle lorsqu’il est exécuté seul. Sur SWCH, l’objet déplacé par B change entre les deux branches.

KEYD et SWCH servent également aux essais de développement. Le plafond étendu de 240 actions laisse à l’agent le temps de revenir sur ses pas et de vérifier ses hypothèses. Les deux solveurs sont rejoués à ce plafond sur ces deux jeux. La comparaison sur l’ensemble des 100 L1 conserve le plafond historique de 60.

Pour retrouver le point de comparaison après B, le candidat apprend aussi un classement des commandes inverses sur les 100 traces. Il conserve 13 couples de commandes, chacun échantillonné dans au moins trois jeux. Il privilégie les inverses vérifiés dans la partie en cours et vérifie le retour à l’image exacte avant d’utiliser le témoin.

## Ce que prédit le candidat

1. L’agent retrouve dans les retours publics une même scène S, B exécuté depuis S et A suivi immédiatement de B depuis S. Il compare le changement causé pendant B dans chacune des deux branches. Les transitions publiques contradictoires sont écartées.
2. Il annonce une prédiction pour B seul, en vérifie le retour réel, revient à S, reproduit A et prédit l’effet de B. L’accord obtenu en rejouant les deux branches confirme la relation dans cette situation. Une réutilisation ultérieure est enregistrée séparément. L’agent peut alors essayer une suite encore inexplorée au point atteint.
3. Pour une dérivation spatiale, il choisit un autre emplacement mesuré du même objet. Il acquiert un contrôle B seul depuis cette nouvelle scène, ou reprend le reçu d’un contrôle déjà observé. Il recrée le changement par A, puis émet B avec une prédiction fixée avant le retour. Si la préparation rendait un objet mobile, la prédiction porte sur cet objet et sur le sens de son déplacement. Si elle modifiait une translation existante, elle porte sur le vecteur appris. Sans mouvement identifiable, elle porte sur l’édition visuelle mesurée. La concordance exacte de l’ensemble de l’effet est également enregistrée.
4. Une deuxième expérience concerne le transport d’une modification persistante. Une même composante visible doit avoir changé de forme ou de couleur dans une boîte mesurée sans ambiguïté. L’agent garde la provenance de A, déplace la composante modifiée et vérifie la persistance de sa signature après chaque action. Au lieu choisi, il exige un contrôle antérieur avec l’objet ordinaire à la même position et une même empreinte des pixels extérieurs à la boîte. Il prédit alors ce que B permettra de faire.
5. Pour chercher où intervenir, il emploie les translations effectivement observées pour proposer une disposition avec un élément visible. Il vérifie chaque pas, peut contourner une obstruction observée et réessaie B à l’arrivée. Une différence à ce stade produit une piste à expérimenter.

Tous les choix d’actions passent par l’autorité SIC. Les états, commandes et effets proviennent de l’interface publique du jeu. Une image identique autorise une comparaison observationnelle. Le moteur peut conserver un état caché, ce qui motive les réplications et les épreuves à un autre endroit.

## Évaluation fixée avant ouverture

Les tags sont `sic-preparation-source100-control-20261119` et `sic-preparation-source100-candidate-20261119`. Le premier désigne le témoin ci-dessus. Les moteurs communs sont figés à `f4d28aee9ebbb35533bb97a26968efd22887473d`. SS01, SS06, SS07 et SS08 sont des cibles déjà rencontrées au chantier précédent. Leur code, leurs plateaux et leurs traces restent fermés pendant le développement de ce candidat. L’hypothèse de téléportation sur SS01 a été fournie par l’utilisateur avant cette étude.

- Sur chaque cible, le candidat part du L1, puis effectue un essai indépendant directement sur le vrai L2, avec 600 actions par niveau et le budget natif à quatre workers. L’initialisation directe traduit seulement les compteurs de campagne. Les résultats témoins appariés sont les huit parties archivées de la version gelée. Un témoin supplémentaire est exécuté à neuf sur SS01 L2.
- La victoire se lit sur la progression officielle. Les verdicts du mécanisme distinguent la réplication au même endroit, la réutilisation, la prédiction vérifiée ailleurs, le transport vérifié et l’accès à un mouvement que B seul n’avait pas produit.
- Pour SS01, un long déplacement isolé est insuffisant pour établir la découverte demandée. La mesure cherche une transition prévisible d’une composante identifiable, d’amplitude au moins double de la médiane de ses déplacements mesurés, entre deux positions sans chemin dans le graphe des petits déplacements observés. L’exploitation demande un nouveau trajet correctement prédit et exécuté à partir de la relation acquise. La connectivité observée dépend des déplacements réellement échantillonnés.
- SS09 L2 reste réservé à une confirmation indépendante. Les quatre autres résultats sont consignés avec le même candidat.
- Un contrôle complémentaire, exclusivement sur KEYD et SWCH, reprend les prédictions émises lors des essais étendus. Pour chaque hypothèse et lieu distincts proposés pour le contrôle B, le banc rejoue le même préfixe public, une fois pour B seul et une fois pour A puis B. Le résultat indique si la prédiction de l’agent tenait sous ces deux interventions. Ces essais hors ligne sont comptés séparément des explorations autonomes.

## Reproduction

Depuis le checkout du candidat, avec Node 24 et les moteurs à la révision indiquée, utiliser un fichier JSONL neuf par exécution. Les suites de commandes et les images brutes restent hors du rapport.

```sh
node scripts/audit-preparation-sources.mjs <moteurs> <100-traces-temoin-jsonl...>
node scripts/learn-preparation-returns.mjs <table.json> <100-traces-temoin-jsonl...>
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> source 1 1 60
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> source:KEYD,SWCH 1 1 240
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> SS01,SS06,SS07,SS08 1 2 600
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> SS01,SS06,SS07,SS08 2 2 600
```
