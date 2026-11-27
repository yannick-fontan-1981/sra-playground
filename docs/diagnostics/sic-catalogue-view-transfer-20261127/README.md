# GRIL — réemploi des commandes de vue acquises

## Qualification native du complément

Le complément gagne **6 niveaux sur 6 en 74 commandes** dans une session SIC
depuis le niveau 1, avec les six budgets archivés inchangés. Les 74 commandes
sont autorisées par SIC et acquises ; aucun reset, undo ou dépassement de
plafond n'est relevé. La session se réconcilie normalement avec
`target_levels_completed`. Les six objets `.levels` sont identiques au résultat
principal. Le premier niveau conserve son préfixe public de référence.

| Niveau | Commandes / plafond | Score observé / plafond |
| --- | ---: | ---: |
| 1 | 5 / 10 | 2,523 s / 10 s |
| 2 | 5 / 10 | 1,369 s / 8 s |
| 3 | 8 / 13 | 2,244 s / 10 s |
| 4 | 8 / 13 | 2,561 s / 11 s |
| 5 | 13 / 18 | 4,698 s / 15 s |
| 6 | 35 / 39 | 17,830 s / 28 s |

Source effectivement mesurée : local
`8bddf9db717602ecfaf87543ceba476b8eb6bce7`, distant
`c6f8dd387a0f0b6504dc7522461cb8da6f90b17f`, arbre
`d1b4f43ad4e9db058c3e3beb210bca74176d7bb7`. Ce commit ajoute seulement la
première archive au complément testé fonctionnellement. Les décisions restent
unitaires ; ce lot ne revendique aucune nouvelle série de plusieurs commandes.

## Première mesure conservée

Le premier candidat est **incomplet : 2 niveaux sur 6**. Une session SIC depuis
le niveau 1 gagne les deux premiers niveaux en **5 puis 5 commandes**. Le niveau
3 s'arrête après **13 commandes**, sous la limite de commandes habituelle. Le
total est **23 commandes, 23 autorisations SIC et 23 acquisitions**, sans reset
ni undo. Les scores arrivent à 2 639 ms et 1 271 ms, sous les plafonds respectifs
de 10 000 ms et 8 000 ms. Le premier niveau conserve exactement le préfixe de la
campagne de référence `4a546a13`.

Cette mesure concerne le commit local `167a18ad77cc9798aec356e598b9bc5420dfb378`,
équivalent au commit distant `e46062c80592cf60c24c007221dfc9b34fd8dd86`, arbre
`7fab3848478ec5302af03094ccfe3bdf5561122d`. Les trois objets du fichier `.levels`
sont identiques aux statistiques de niveaux du résultat principal.

## Première décision perdue et correction suivante

La capture bornée à onze commandes reproduit exactement le préfixe de ce
rejeu. Au niveau 3, les deux sélecteurs déjà observés ont conservé leur forme
et leur couleur, mais ont changé de position ; un troisième sélecteur s'est
ajouté. La comparaison exacte de l'ensemble de l'interface refuse donc les
commandes de vue pourtant conservées. Le premier geste devient une sélection
par `witnessedPreview` ; les douze vues suivantes restent ambiguës.

Le complément conserve la priorité d'une interface exacte. Sinon, il exige
qu'un seul ensemble de sélecteurs acquis soit inclus dans l'interface courante,
avec le même scope, le bon compteur de niveaux gagnés et une époque compatible.
Il conserve seulement les associations couleur/commande déjà observées. Le
sélecteur ajouté ne reçoit aucune commande apprise par simple ressemblance.
Le premier retour positif de la nouvelle interface réunit ses preuves avec
celles des deux rôles antérieurs. Les fonds, candidats et réponses restent à
acquérir dans le niveau courant.

Le complément est sauvegardé au commit local
`ecaf0caaae70cf5c552c0dfa8bcbb8a39cddedbd`, distant
`81c26a8d20c84d81aec1b5ee8ab5054756392878`, arbre
`160aa44ebb6683be5e275b5635931cdfafb5fce4`.

## Validation et limites

Les **16 tests ciblés passent**, ainsi que `npm run typecheck`. Les tests natifs
emploient l'ordre réel des groupes, une acquisition depuis le niveau 1, une
réflexion, une permutation de palette, une autre commande et une interface
agrandie dont les contrôles changent de position. Ils vérifient le premier
ticket réutilisé, son retour positif, ses références et sa clôture. Les refus
couvrent la commande absente, les sélecteurs dupliqués, deux interfaces
antérieures également compatibles, un retour ambigu et un retour contradictoire.
Une acquisition par une autre famille est également vérifiée.

Le complément a le rejeu strict complet décrit plus haut. La continuité
complète et la vérification du viewer livré restent des étapes
d'intégration. Aucun nouveau bilan complet des 107 jeux n'est annoncé.

Le rôle reste conservateur lorsqu'un niveau entier se termine sans retour de
vue positif : son époque peut devenir trop ancienne pour un transfert ultérieur.
Cette limite n'a pas été élargie sans observation correspondante.

## Sources

`report.json` donne les compteurs et les deux états du code. `manifest.json`
donne les empreintes des fichiers stockés et décompressés. Les bruts du premier
strict, son miroir `.levels` et le résultat GRIL de la campagne de référence
sont archivés, ainsi que le strict complet du complément et son manifeste
de source. `first-decision.public.json.gz` conserve toutes les grilles et
animations, commandes, propositions, retours natifs et états du rôle de la
capture. Seules les entités géométriques recalculables, les autres mémoires de
familles et les traces globales dupliquées sont omises ; l'empreinte du fichier
original est conservée.

Commande de qualification :

```bash
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs GRIL auto result.jsonl 1
```

Les références et plafonds n'ont pas été modifiés.
