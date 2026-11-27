# Preuve commune avant validation

Le candidat figé est `bd61ff40b0a9fbc243787ea269b4e89225206dd8`, sur `experiment/sic-agenda-preuve-commune`. La cible a été enregistrée au commit `d717e51a`, avant le changement de code. Le point de départ est `383c9e0581304f17e6321222cb0e02a41a0e2551`, qui conserve le contre-exemple du consommateur `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. [Attendu](ATTENDU.md) · [Variation publique](../caracterisation-public-v1/contre-exemple.json)

| Situation | Gel précédent au premier tour | Candidat au premier tour | Vérification |
| --- | --- | --- | --- |
| Sortie cachée, même tampon demandé par les deux sorties | Lire, horizon 4 | Marquer X022d46 avec X03a3e1, horizon 3. Marquer Xfc26f3 en premier est ex æquo. | Deux succès en trois gestes, sans lecture. Les deux sorties donnent la même séquence. |
| Sortie cachée, tampons opposés | Lire, horizon 4 | Lire, horizon 4 | Deux succès en quatre gestes. Le premier marquage dépend du retour public. |
| Le domaine comporte une troisième sortie sans règle terminale applicable | — | Aucune commande garantie | La projection s’abstient et la recherche ne trouve aucun plan garanti. |
| Douze anciennes fiches, dix-huit départs de développement | 18 succès, 74 commandes, 12 lectures | Mêmes résultats | Les reçus des 18 départs sont identiques, jusqu’aux commandes, aux retours et aux statuts d’exécution. |

La **première divergence** est le premier geste du cas à tampon commun. Le banc local instancie séparément les deux sorties décrites dans la fiche modifiée et vérifie les marques au moment de la validation. Le solveur reçoit uniquement la fiche et les accusés de ses gestes. Sur les anciennes fiches, les deux gels ont été montés et joués séparément par l’opérateur `8f99972d79c92699631684fc805cde0bd8033947`, partition `developpement`. [Essai ciblé](verifier.mjs) · [Comparaison des reçus](comparer-developpement.ps1)

## Ce que la projection peut prouver

La garde terminale du cadran comporte une alternative par sortie. Avec deux marques correctes mais un cadran inconnu, le calcul à trois valeurs laisse les deux tests de sortie indéterminés. Le candidat intervient lorsque la commande du but rencontre un effet conditionnel dont l’application reste inconnue. Il cherche une seule référence inconnue dans les gardes indécises et exige un domaine public stable dans l’état courant.

Pour chaque valeur déclarée, il crée une copie temporaire des faits et exécute la projection entière de la commande terminale. La boucle s’arrête à la première issue défavorable, indéterminée ou `unspecified`. Elle peut conclure une réussite commune uniquement après un `end: success` explicite pour **toutes** les valeurs. Le reçu interne porte la référence de la variable, les valeurs couvertes et la ligne source du domaine. La référence du cadran demeure absente de la mémoire des valeurs connues. Le test compare la mémoire et les compteurs d’usage avant et après cette évaluation. [Projection et budget](../public-v1/planifier.mjs)

La recherche en horizon croissant peut désormais établir une continuation de trois gestes pour chacun des deux bons premiers marquages. Le cœur Agenda applique son départage habituel par identifiant de branche. Avec des exigences opposées, la nouvelle vérification rencontre une issue incompatible. La recherche conserve alors le geste qui permet de lire la valeur réelle.

| Coût de la nouvelle vérification au premier choix | Tampon commun | Tampons opposés |
| --- | ---: | ---: |
| Projections sous hypothèse exécutées | 2 | 3 |
| États où une réussite commune a été établie | 1 | 0 |
| États examinés sans certificat de réussite | 0 | 2 |
| Réutilisations du résultat en cache | 0 | 2 |

Une preuve couvre au plus **8 valeurs** d’une seule inconnue. Une décision peut exécuter au plus **64 projections sous hypothèse**, tous horizons et toutes offres confondus. Le cache est local à la décision. Avant de commencer un domaine, le calcul vérifie que le budget permet d’en parcourir toutes les valeurs. Une réfutation peut être obtenue plus tôt. À la borne, une branche sans certificat reste indéterminée. Dans le test de saturation, 32 préparations sur 33 reçoivent un certificat de deux valeurs, et la dernière reste sans certificat. Ces limites concernent la nouvelle inférence ; le compteur de gestes du jeu est indépendant.

Les contrôles couvrent également un domaine absent, une stabilité indéterminée, deux inconnues, un résultat simplement `unspecified`, une troisième valeur défavorable, les seuils de huit et neuf valeurs et la permutation des commandes. Pour les 12 fiches historiques, les seuls changements observés sont internes : les quatre cadrans masqués examinent chacun trois hypothèses au premier choix. Les cadrans visibles et les quatre ressources n’en examinent aucune à ce tour.

## Démarrer et vérifier

Entrée à monter depuis le SHA **bd61ff40b0a9fbc243787ea269b4e89225206dd8**, avec Node 24 :

```powershell
node experiments/sic-agenda-offres/public-v1/solveur.mjs
```

Les cinq dépendances relatives du montage sont les suivantes. Parmi ces fichiers, seul le planificateur diffère du consommateur précédent.

```text
experiments/sic-agenda-offres/public-v1/admission.mjs
experiments/sic-agenda-offres/public-v1/planifier.mjs
experiments/sic-agenda-offres/public-v1/schema.json
experiments/sic-agenda-offres/agenda.mjs
src/sic/reasoning-mode.ts
```

Depuis la racine du checkout candidat, avec le checkout de l’opérateur en dossier voisin :

```powershell
$exemples = '../symbolic-public-format/experiments/symbolic-situations/public-format/examples'
node experiments/sic-agenda-offres/preuve-commune/verifier.mjs $exemples
.\experiments\sic-agenda-offres\preuve-commune\comparer-developpement.ps1
```

Le second rejeu monte les deux SHA immuables, compare l’intégralité de chaque reçu de développement et indique le dossier local des mesures. La troisième mécanique dispose de son évaluation indépendante sur le gel `f296ac1c`.
