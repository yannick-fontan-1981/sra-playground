# SS23 — feuille de route de création

## Repères de programme

La feuille de route suit **25 jeux et 200 niveaux**. Elle mesure la création et la livraison des campagnes. Elle ne mesure pas la capacité de SRA à les résoudre de façon autonome.

| Étape | Jeux créés et clos | Niveaux | Progression des jeux |
| --- | ---: | ---: | ---: |
| Repère historique avant SS23 : SS01 à SS22 | 22 / 25 | 176 / 200 | 88 % |
| Jalon de création SS23 | 23 / 25 | 184 / 200 | 92 % |
| Reste après la clôture de SS23 : SS24 et SS25 | 2 jeux | 16 niveaux | 8 % |

Les huit cartes de SS23 sont créées, synchronisées et validées par leurs commandes publiques, jusqu’à la victoire finale dans Chrome en mode Manual. Le relevé d’intégration canonique et de publication est conservé dans la [PR 127](https://github.com/yannick-fontan-1981/sra-playground/pull/127). Si une version ultérieure est reprise, les compteurs doivent être vérifiés sur la branche canonique courante et ne doivent jamais être ramenés à ce repère historique.

## SS23 — Les Chambres de Résonance

Composition : **Marchand, Guerrier, Magicien, Barde**. L’ordre de sélection et les touches sont M/W/Z/B, 1/2/3/4. Le niveau 1 porte les **36 découvertes** ; les sept autres salles sont des adaptations variées qui combinent les capacités sans inventer de mécanique.

| Lot | État courant | Critère de clôture |
| --- | --- | --- |
| Moteur et capacités combinées | **Réussi** : 81 tests moteur/monstres dans la suite de 114 tests ; preuve réutilisée après la correction de carte N5, moteur inchangé | Contrat MWZB conservé avec les cartes finales |
| Pédagogie | **Réussi** : 33 tests ; 36/36 découvertes sur les 221 commandes de N1, aucune dans les autres salles | Acquisition identique en laboratoire, HTML et natif |
| Cartes et références | **Réussi** : huit cartes définitives, 947 commandes, zéro refus ni mort ; 85 contrôles de revue | Inventaire lié aux sources et à l’artefact |
| Interface autonome | **Réussi** : 34 configurations de rôles et huit salles dans le HTML compilé | Pixels/durées, aides, liens et Undo de chaque victoire vérifiés |
| Intégration native | **Réussi** : 94 tests Custom 4 + SS21/SS22/SS23 ; typecheck passé | Observations des huit témoins identiques via le dispatcher |
| Build et continuité | **Réussi** : build du Site et `test:sic-continuity` exit 0 | Galerie 123 jeux / 820 aperçus ; 41 niveaux protégés préservés |
| Navigateur | **Réussi** : Chrome Manual N1→N8, 947 entrées, 36/36 découvertes, panneau VICTORY affiché | [Preuve native](../../../docs/migration/ss23-evidence/chrome-manual-report.json) |
| GitHub et Site | Livraison suivie dans la **PR 127** | Relevé du commit canonique, de la version publiée et du SHA source dans la PR |

Les huit témoins comptent **221, 91, 43, 132, 50, 126, 172 et 112 commandes**, soit **947**, dont 173 sélections et 2 537 images publiques. Le [README](../README.md) décrit les huit salles. Les preuves détaillées sont consignées dans `docs/migration/ss23-native-integration.md` à la racine du dépôt et dans les rapports correspondants.

## Prochaine campagne

**SS24 : Marchand / Voleur / Magicien / Barde**, sans Guerrier. La composition est prévue ; la campagne n’est pas créée par ce lot. La conception doit varier les géométries et les problèmes de coopération par rapport aux campagnes précédentes, tout en conservant les contrats des rôles.

**SS25 : Guerrier / Voleur / Magicien / Barde**, sans Marchand, reste le dernier quatuor prévu. Sa conception détaillée sera établie au moment de son ouverture.

## Reprise et traçabilité

La branche `feat/sinking-star-ss23-20261126` a une première sauvegarde distante vérifiée au SHA `ee6880f27f2e9f36c7606dae011820e6322d781b`. Ce point intermédiaire précède les derniers rapports et ne représente pas une publication. La [validation](validation.md) décrit la version qualifiée ; la PR 127 conserve les SHA finaux et le relevé de publication, sans imposer une référence circulaire à un document appartenant au commit lui-même.

La base `0ca0ec0235ba455af2e9600a7019044d1e9957f6` et le Site 195 sont les repères historiques de SS22 à l’ouverture de SS23. Une reprise examine d’abord GitHub et le Site actuels ; elle conserve les campagnes suivantes déjà intégrées.

La clôture de création, la publication et les résultats éventuels d’un agent autonome sont consignés séparément. Un témoin d’auteur menant à `WIN` ne qualifie pas le raisonnement SRA.
