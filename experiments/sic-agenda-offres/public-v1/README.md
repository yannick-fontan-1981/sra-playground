# Consommateur Agenda de sra.public/1

Le processus reçoit une fiche JSON sur son entrée standard. Il choisit parmi les commandes publiques puis attend le retour de son geste avant de faire avancer sa mémoire. Une partie utilise un processus neuf et une branche active. Le consommateur dérive du gel Agenda `475044aa609fe2934101b6286a96ae544aa24250`. Le schéma est une copie exacte du blob public `83919759cd20a0c94ab542a09e1e43421899a9a5`. Le dialogue et les 12 entrées de développement proviennent de `62af0801b8a02c8b5e9d1ea039295b5286139cd6`.

## Démarrage et fichiers à monter

Depuis la racine du checkout, avec Node 24, sans installation de paquet :

```powershell
node experiments/sic-agenda-offres/public-v1/solveur.mjs
```

Pour un montage Git de l’opérateur, l’entrée est `experiments/sic-agenda-offres/public-v1/solveur.mjs`. Préserver les chemins ci-dessous dans le même checkout immuable.

```text
experiments/sic-agenda-offres/public-v1/admission.mjs
experiments/sic-agenda-offres/public-v1/planifier.mjs
experiments/sic-agenda-offres/public-v1/schema.json
experiments/sic-agenda-offres/agenda.mjs
src/sic/reasoning-mode.ts
```

Le solveur lit une ligne `{"fiche":…}`, puis émet `{"action":"…"}` pour une commande déclarée. Chaque nouvelle décision demande une ligne `{"retour":"…"}`. Un format invalide donne `incompatible`. Un blocage après admission donne `arret`. Le verdict terminal appartient à l’opérateur. [Entrée du dialogue](solveur.mjs)

## Ce qui justifie le geste

L’admission applique le schéma figé et vérifie les références de lignes et de commandes. Les lignes de texte sont réservées à l’audit. Le prédicat structuré, ses arguments et son statut distinguent une observation connue (y compris `false` ou `null`), une inconnue déclarée et une omission. Un relevé archivé et une mesure courante portent deux références différentes. [Admission](admission.mjs)

Chaque commande devient une offre. Son examen porte sur les conditions d’exécution, les effets conditionnels, l’invariant du but et les usages confirmés dans cette partie. Pour la commande terminale, l’agenda demande aussi que les conditions nécessaires au succès soient établies. Une lecture fait explorer chacune des valeurs de son domaine public si sa stabilité est établie. La recherche augmente le nombre de gestes admis de 1 à 10 et retient les premières commandes pour lesquelles toutes les continuations observables atteignent le but dans cette borne. Le critère est le nombre de gestes dans le pire cas. En cas d’égalité, le cœur Agenda conserve les ex æquo et départage par identifiant de branche. [Projection, coût et décision](planifier.mjs)

Sur le cadran, les effets décrivent explicitement le succès et l’échec. Sur la ressource, le scellement a l’effet terminal `unspecified`. L’adaptateur cherche d’abord une réussite décrite par les règles. À défaut, il peut atteindre une tentative terminale dont toutes les conditions nécessaires sont satisfaites. Seul le retour réel peut établir sa réussite. Les faits ordinaires persistent jusqu’à une modification annoncée. Une valeur à stabilité conditionnelle est oubliée au passage d’un geste si sa conservation n’est pas établie.

Le vocabulaire de décision provient des expressions et des effets du contrat. Le dialogue v1 expose encore les accusés matériels en texte libre. Le lecteur vérifie les cinq couples verbe/accusé rencontrés en développement. Une lecture exige une unique valeur compatible avec le retour. Une commande refusée, une lecture non interprétable ou un nouvel accusé de geste suspend la session. La recherche peut également laisser un geste dangereux ou conditionnel indéterminé. Sa borne de dix gestes fait partie du prototype.

## Vérifications de développement

```powershell
node experiments/sic-agenda-offres/public-v1/verifier.mjs ../symbolic-public-format/experiments/symbolic-situations/public-format/examples
```

Les 12 fiches sont admises. Permuter commandes, règles et observations puis masquer la prose conserve les premières décisions. Les contrôles couvrent aussi l’absence de mesure, l’archive, la case vierge, l’égalité de deux marquages, une règle citant une ligne absente, le retour hors domaine, le refus de commande et le refus d’un champ privé ajouté. [Contrôles](verifier.mjs)

| Fiches de développement | Première décision sur les fiches | Départs joués avec les deux programmes publics `play.mjs` | Verdict de jeu |
| --- | --- | --- | --- |
| 8 cadrans | 4 lectures et 4 marquages | 8 départs en 4 gestes et 4 en 3 gestes | 12 succès |
| 4 ressources | 1 purge, 1 sonde, 1 blocage et 1 retrait | 2 départs en 6 gestes, 2 en 5 et 2 en 4 | 6 succès |

Sur `dial.json`, les réponses à `lire` sont `X4c94cf` et `X6e9ba2`. Elles conduisent à des marquages différents. Sur `resource.json`, les deux débuts sont `purger`, puis `sonder`. La mesure courante `Jbbd6ad` conduit à bloquer avant de retirer. La mesure `Jbc2cd1` conduit à retirer avant de bloquer. Le solveur a reçu les JSON de développement et les seules réponses à ses propres gestes. Le numéro de monde, le chemin de la fiche et les données de réserve restent du côté de l’opérateur.
