# LP85, ligne 24 — permutation mesurée des emplacements

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Ligne 24,
LP85 N1/T1 ACTION6, `orbit_constraints / measured_slot_permutation`.
Reprendre depuis N1 avec les paramètres de l'inventaire SIC.

- Relier les emplacements et leur cible aux témoins de coin, puis
  identifier le contrôle qui ouvre le premier essai. Vérifier le
  retour réel et la réduction éventuelle des permutations candidates.
- Suivre une répétition discriminante ou un trajet qui utilise les
  permutations acquises. Retrouver la garde, le retour et la reprise
  dans une seconde configuration observée.
- Retirer ou contredire la preuve du même contrôle à présentation
  comparable. Vérifier le premier changement de question, de
  prédiction ou d'admission et la portée de cette différence.
- Décrire ce qui est déjà composé sur le gel. Borner la couverture
  aux gestes effectivement rejoués et séparer le gain officiel.

## Enchaînement observé

`measureOrbitField` mesure les carrés de même taille et lit les
cibles quand quatre marques de coin ont la même couleur. Les commandes
candidates pointent des pixels réellement occupés par une classe de
silhouettes non rectangulaires répétées sous différentes orientations.
`orbitCycles` produit des contours candidats. `fitOrbit` compare
les arrangements avant/après et conserve les permutations compatibles
avec les déplacements et les couleurs visibles.

| Geste | Besoin et preuve | Retour et reprise |
|---|---|---|
| N1/T1 ACTION6 (5,32) | 20 emplacements de côté 4, deux contrôles adressables, cible de couleur 11 à l'indice 0. Le premier contrôle n'a aucune permutation mesurée. | Le jeu donne un nouvel arrangement. Le reçu ajuste une permutation unique à ce contrôle. Le ticket portait une prédiction nulle. |
| T2 ACTION6 (58,32) | Le second contrôle reste à mesurer. | Son retour ramène les valeurs des emplacements à l'arrangement initial. Une seconde permutation unique est acquise. |
| T3–T7 ACTION6 (5,32) | Le moteur lie à nouveau le même point et les mêmes valeurs d'emplacements qu'à T1. Avec deux opérateurs mesurés, `orbitRoute` construit un préfixe de cinq gestes vers la cible. Chaque pas prédit les nouvelles valeurs et retrouve le contrôle courant. | Les quatre premiers retours confirment le vecteur de valeurs. T7 marque le niveau et le préfixe se ferme sur la frontière officielle. |
| N2/T8–T13 | Le champ comporte 42 emplacements de côté 2, six contrôles et deux cibles 11, aux indices 29 et 32. Les opérateurs de N1 sortent de portée. Le moteur mesure les contrôles de cette disposition. | Les candidats compatibles restent séparés lorsque deux permutations donnent les mêmes valeurs colorées. |
| N2/T14–T17 | Le besoin devient un contraste sur un autre arrangement. T15 puis T16 emploient le même ACTION6 (14,26), à des valeurs d'emplacements différentes. | T15 conserve plusieurs ajustements. T16 laisse une seule permutation compatible. T17 dispose d'un troisième opérateur unique. Ce prolongement ne marque aucun niveau supplémentaire. |

`OrbitConstraints.propose` choisit entre un contrôle encore inconnu,
un chemin composé et une répétition qui peut départager les
permutations restantes. L'époque, le champ, ses cibles et les
contrôles bornent les modèles acquis. Le plan conserve une référence
par opérateur utilisé. La garde vérifie les valeurs des emplacements
et l'empreinte du contrôle avant chaque geste. Le gain officiel reste
une mesure du jeu distincte d'une prédiction de valeurs.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L64)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L50)
· [Mesure des emplacements](../../src/logos-engine/v6-orbit-constraints.ts?plain=1#L103)
· [Sélection](../../src/logos-engine/v6-orbit-constraints.ts?plain=1#L221)
· [Garde et acquisition](../../src/logos-engine/v6-orbit-constraints.ts?plain=1#L273)

## Même commande, preuves différentes

- **Retrait de preuve à T3.** Le replay conserve le vrai raster et
  les retours T1–T2. Avant la sélection, la variante retire uniquement
  la permutation du premier contrôle et sa référence locale. Le
  service garde le clic (5,32), mais libère un seul essai sans
  prédiction à la place de la série de cinq. Le vrai jeu produit
  le même nouvel arrangement. Le reçu booléen n'est plus affirmé.
  La mesure réelle réacquiert l'opérateur, que la décision suivante
  cite à la place du premier reçu.
- **Garde d'un préfixe engagé.** Au deuxième pas du préfixe nominal,
  modifier un seul emplacement dans une copie du raster conserve le
  point et l'empreinte du contrôle. La garde isolée refuse néanmoins
  le même geste, car la succession des valeurs attendues a changé.
  Le vrai geste du scénario nominal reste autorisé.

La caractérisation utilise la composition des opérateurs déjà présente
sur le gel. Aucun nouveau sélecteur ou modèle de déplacement n'est
requis pour établir ces deux parcours.

## Reproduction et portée

Le gel et `8ce7ee35` concordent sur 16 tickets et leurs 16 retours.
La métadonnée `palette` diffère. Les **16/16 occurrences** de la
ligne 24 sont retrouvées, plus une décision prolongée à T17 qui
expose l'opérateur acquis au T16. Le premier niveau est marqué à T7.
La qualification indépendante reste ouverte.

Avec Node 24 et Pyodide préparé sous `public/` :

```powershell
node --test tests/sic-lp85-line-24.test.ts
node --test tests/v6-orbit-containment.test.ts
```

`SIC_LP85_GAME_ROOT` peut désigner un checkout séparé des actifs.
`SIC_LP85_ENGINE_ROOT` permet de charger les modules depuis le gel.
Les essais nominaux et le retrait de preuve de T3 emploient le jeu
officiel. Le raster modifié est utilisé uniquement par la garde isolée.

La caractérisation passe **2/2** et la suite orbit/containment **49/49**.
Branche ouverte à 23:40:56, critères figés à 23:41:25, premier rejeu
du gel à 23:41:51 et verdict local à 23:44:33 (UTC−3).
