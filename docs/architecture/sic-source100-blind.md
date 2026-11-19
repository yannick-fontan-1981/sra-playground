# Transfert de compositions des 100 niveaux sources vers Custom 4

## Question et protocole fixé avant l’ouverture des jeux

Un changement de SIC Fallback choisi sur les 100 premiers niveaux permet-il de gagner un L2 Custom 4 qui résiste au témoin ? SS06, SS07 et SS08 forment le lot principal. SS01 est évalué séparément avec les mêmes réglages. Le comportement de son curseur avait été décrit par l’utilisateur avant le gel. SS09 L2 est réservé à une confirmation indépendante.

Le témoin A est le commit `76142bf41c7f5c8dffb39f24f8ecaa11bd2332fb` du 16 novembre 2026, qui introduit SIC Fallback avant l’intégration du premier jeu Custom 4 le 17 novembre. Le candidat B part du même commit. L’amélioration SS03 est intégrée dans `main` à `f4d28aee9ebbb35533bb97a26968efd22887473d`. Cette révision fournit les moteurs de jeu communs. Les archives Python des sources et les déclarations du moteur utilisées par le banc sont identiques aux deux révisions. Le changement SS03 et le prototype sur les clics sont absents des deux solveurs.

## Acquisition sur les sources

Chaque version rejoue les 100 L1 d’origine, en session neuve avec un plafond de 60 actions. Le témoin gagne 66 L1 sur 100. Parmi ses 34 échecs, 15 jeux contiennent au total 196 retours à une image antérieure après une action qui change l’image. Dans huit de ces échecs, le témoin répète au moins une transition déjà observée avec le même état initial, la même commande et la même image de retour. On en compte 43, contre deux dans un seul des 66 succès. SWCH essaie quatre paires ordonnées parmi les seize formées par ses quatre commandes utilisées. KEYD en essaie cinq sur vingt-cinq. Ces nombres décrivent les traces. Certaines combinaisons peuvent être inutiles ou inaccessibles.

La nouvelle stratégie conserve les retours publics de toutes les familles SIC du niveau en cours. Elle peut intervenir après trois répétitions de transitions ayant effectivement changé l’image, avec au moins une répétition dans les huit dernières actions. Des chemins différents peuvent également ramener SIC aux mêmes images. Un deuxième déclencheur exige six retours de ce type au cours du niveau, dont deux sur les huit dernières actions. Ce signal est présent dans neuf échecs et dans aucun des 66 succès des traces sources du témoin. La stratégie intervient aussi lorsque les stratégies existantes ne proposent plus de suite. Le même budget global couvre tous ses essais.

- Pour les actions, elle énumère les commandes publiques disponibles et les positions mesurées admises par SIC. Elle essaie les continuations sous-explorées après le préfixe courant. La longueur de contexte augmente avec l’expérience. Elle distingue répéter, reprendre une action après une autre, changer de commande, changer de modalité et changer de cible.
- Pour les objets, elle associe une commande déjà observée à la translation d’une composante visuelle identifiable, puis à une autre composante actuellement visible. Elle teste un rapprochement, mesure la distance au retour, et réévalue la suite. Si la forme devient ambiguë, le résultat du rapprochement reste indéterminé.
- Lorsque plusieurs expériences ont la même couverture, une table classe leurs chances de produire une image nouvelle. Elle est reconstruite à partir des 100 traces du témoin, donne une voix par jeu et exige trois jeux pour retenir une classe. Le solveur reçoit uniquement la table agrégée. Aucun numéro de jeu, de couleur ou de position issu des cibles ne sert à choisir l’action.

Une nouvelle image ou une relation vérifiée est un résultat d’exploration. Seule la progression officielle du moteur établit une victoire. Les combinaisons accessibles dépendent du domaine d’actions, de l’identification des composantes et du budget.

## Mesure sur Custom 4

Les révisions sont publiées sous les tags `sic-source100-blind-a-20261119` et `sic-source100-blind-b-20261119` avant toute ouverture des quatre jeux. Les cibles sont exécutées sur les archives des deux tags. L’évaluation utilise le même moteur, 600 commandes par niveau et le budget de temps natif du profil à quatre workers pour chaque version. Chaque commande doit être autorisée par SIC. Aucune mémoire de partie ne passe d’un jeu à l’autre.

1. Le critère principal est la victoire au L2 en partant du L1, dans la même session. Une partie qui s’arrête au L1 donne un L2 non atteint.
2. Un essai indépendant commence sur le vrai plateau L2. V6 exige que sa première observation soit numérotée 1 avec zéro niveau terminé. Le banc vérifie le niveau fourni par le moteur puis traduit les compteurs pour cette session vierge. Toutes les images, actions et victoires proviennent du L2 réel.
3. Les empreintes initiales doivent concorder entre A et B pour chacun des départs. On compte comme déblocage une victoire de B face à un échec de A dans le même mode. Le banc conserve aussi les nombres d’actions, de paires de commandes, de retours à une image, de réexécutions de transitions et d’actions où une composante de forme unique revient à une position déjà visitée. Ce dernier compteur peut concerner plusieurs objets.
4. Les résultats des quatre jeux restent en dehors de la sélection du candidat. Une erreur de banc est isolée et toute répétition technique est documentée. SS09 reste fermé.

## Reproduction

Le banc s’exécute avec Node 24 depuis le checkout du candidat. Le premier chemin désigne un solveur archivé et le second le checkout des moteurs à `f4d28aee`. Chaque campagne écrit dans un JSONL neuf. Le dernier argument facultatif `i/n` répartit le catalogue entre n processus, avec i commençant à zéro.

```sh
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> source 1 1 60
node scripts/learn-source100-compositions.mjs <table.json> <fichiers-temoin.jsonl...>
node scripts/summarize-source100.mjs <resume.json> <fichiers-temoin.jsonl...> -- <fichiers-candidat.jsonl...>
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> SS01,SS06,SS07,SS08 1 2 600
node scripts/compare-source100.mjs <solveur> <moteurs> <sortie> SS01,SS06,SS07,SS08 2 2 600
```
