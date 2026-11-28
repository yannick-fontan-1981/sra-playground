# TRIA, ligne 79 — choisir d'après une relation entre sujets

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Catalogue
`8ce7ee35`, TRIA N1/T1 ACTION6, `relative_arrangements /
relative_arrangement / public_relative_arrangement`. Depuis N1,
graine 0 et plafond de 16 commandes.

- Retrouver le premier clic et distinguer la sélection, l'essai
  sur l'actionneur, le déplacement mesuré et la progression
  officielle. Suivre le sujet, la relation recopiée et les références.
- Sur le deuxième plateau, varier la relation entre participants
  en conservant leurs couleurs, formes et apparence locale.
  Mesurer la première différence d'offre ou d'intervention.
  Garder le reste de la scène et ses commandes disponibles.
- Distinguer ce que change le nouvel arrangement visible de ce
  que le modèle de contrôle a réellement appris. Jouer l'intervention
  quand sa physique reste vérifiable, mesurer son retour puis le
  choix suivant.
- Séparer le rejeu officiel et les observations construites.
  Vérifier si le gel suffit avant toute extraction. Attribuer
  une divergence causale à sa première preuve modifiée.

Le premier retour est vérifié dans le mode du catalogue même
si la commande de sélection a la même forme qu'un essai ultérieur.

## Le déplacement relatif et son essai

Le catalogue et le gel libèrent les mêmes 16 clics de
`relative_arrangements` avec leurs 16 verdicts de retour.
Ils donnent deux passages officiels, aux T2 et T13. Les
premières sélections et les mesures de déplacement sont
distinctes de ces deux gains.

| Moment | Relation et offre | Retour et suite |
| --- | --- | --- |
| N1/T1 | Deux sujets de valeur 9 à [8,6] et [10,6]. La légende demande deux cases voisines. Le plan préserve [10,6] et sélectionne le sujet en [8,6], ACTION6(28,20). | La sélection est observée. T2 ACTION6(11,53) essaie le contrôle et donne le premier passage officiel. |
| N2/T3 | Trois sujets de valeur 9. La légende décrit deux sujets alignés et un troisième en diagonale. Le plan nominal sélectionne [0,9] au clic (4,29), avec [12,9] comme destination. | Les essais T4–T7 déplacent ce sujet jusqu'à ce que la relation avec [12,11] soit établie. |
| N2/T8–T9 | Une fois les deux sujets alignés, T8 sélectionne [14,2] au clic (46,8). T9 ACTION6(3,57) essaie un actionneur pour rejoindre [13,10]. | Seul le sujet sélectionné passe de [14,2] à [13,3], avec un changement rattaché à un actionneur. Le reçu conserve la sélection, les deux autres sujets et les observations. |
| N2/T12–T13 | Le plan consomme des références de déplacements et cible encore la relation qui manque. | Le T13 donne le deuxième passage officiel. Les témoins gardent `matched:null` pour la prédiction. |

`relativeArrangementProject` mesure la grille, les sujets et
la légende. `translatedRelativeArrangementTargets` propose
les relations de la légende translatées près des sujets.
`relativeArrangementOptions` classe la préservation des sujets
et l'intervention encore nécessaire. `RelativeArrangements.before`
lie le clic au support et à son observation. `relativeArrangementEffect`
acquiert un déplacement contrôlé quand une seule identité
sélectionnée bouge et qu'un seul actionneur correspondant change.

## Disposition construite à apparence constante

Dans la vue N2 au T3, le test échange la case 3×3 du sujet [0,9]
avec une case de terrain de même phase en [12,9]. Le masque
uniforme de valeur 9, les deux autres sujets, la légende et
les actionneurs demeurent identiques. L'offre vise maintenant
[14,2] vers [13,10] et sélectionne (46,8). Ce clic est déjà
attesté plus tard au vrai T8, quand les passages précédents
ont réellement mis le sujet en [12,9].

Le service joue la sélection alternative (46,8) et l'essai
(3,57) sur le plateau officiel sous cette projection
construite. Les deux sujets d'appui à la relation restent
observés aux positions projetées. L'acteur réellement
sélectionné passe de [14,2] à [13,3]. L'effet physique
confirme ce pas local dans la variante, qui ne reproduit pas
un gain officiel de ce plateau.

Le calcul et le choix sont exercés directement dans le gel.
Le résultat porte sur les seize actions retrouvées, les deux
dispositions officielles et cette variation de relation.

## Reproduction

Node 24. `SIC_TRIA_GAME_ROOT` désigne les actifs et Pyodide.
`SIC_TRIA_ENGINE_ROOT` sert à répéter les assertions sur un autre SHA.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-tria-line-79.test.ts tests/v6-relative-arrangements-reference.test.ts tests/v6-relative-arrangements-integration.test.ts
```

[Test du service](../../tests/sic-tria-line-79.test.ts) ·
[Producteur et garde](../../src/logos-engine/v6-relative-arrangements.ts) ·
[Mesure du plateau et des déplacements](../../src/logos-engine/v6-relative-arrangements-geometry.ts) ·
[Catalogue](sic-v8-strategies-observees.md#L105)
