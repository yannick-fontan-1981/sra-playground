# SS23 — feuille de route de création

## Repères de programme

La feuille de route suit **25 jeux et 200 niveaux**. Elle mesure la création et la livraison des campagnes. Elle ne mesure pas la capacité de SRA à les résoudre de façon autonome.

| Étape | Jeux créés et clos | Niveaux | Progression des jeux |
| --- | ---: | ---: | ---: |
| Repère historique avant SS23 : SS01 à SS22 | 22 / 25 | 176 / 200 | 88 % |
| Jalon visé à la clôture complète de SS23 | 23 / 25 | 184 / 200 | 92 % |
| Reste après la clôture de SS23 : SS24 et SS25 | 2 jeux | 16 niveaux | 8 % |

Les valeurs de clôture SS23 sont un jalon prévu tant que les huit cartes et la qualification finale ne sont pas terminées. Si une version ultérieure est reprise, les compteurs doivent être vérifiés sur la branche canonique courante et ne doivent jamais être ramenés à ce repère historique.

## SS23 — Les Chambres de Résonance

Composition : **Marchand, Guerrier, Magicien, Barde**. L’ordre de sélection et les touches sont M/W/Z/B, 1/2/3/4. Le niveau 1 porte les **36 découvertes** ; les sept autres salles sont des adaptations variées qui combinent les capacités sans inventer de mécanique.

| Lot | État courant | Critère de clôture |
| --- | --- | --- |
| Moteur et capacités combinées | Préparés ; 81 tests moteur/monstres réussis | Contrat MWZB conservé avec les cartes finales |
| Pédagogie | 33 tests réussis ; les 36 découvertes sont acquises sur les 221 commandes du témoin réel N1 | Conserver cette acquisition dans la campagne synchronisée |
| Cartes et références | En cours de finalisation | Huit cartes distinctes, sources documentées et témoins synchronisés |
| Interface autonome | Fixtures du HTML compilé réussies | Rejeu des huit salles, pixels/durées, aides et Undo vérifiés |
| Intégration native | Catalogue, dispatcher, aide, commandes et tests raccordés ; typecheck réussi | Les huit témoins passent par le dispatcher natif avec observations identiques |
| Build et continuité | Qualification finale en attente | Build final et contrôle `test:sic-continuity` réussis |
| GitHub et Site | Livraison SS23 en attente | Commit canonique vérifié, publication et concordance du SHA source |

Les noms de salles et les totaux de commandes ne sont pas publiés dans cette feuille de route tant que les cartes ne sont pas figées. Les preuves détaillées sont consignées dans `docs/migration/ss23-native-integration.md` et les rapports correspondants.

## Prochaine campagne

**SS24 : Marchand / Voleur / Magicien / Barde**, sans Guerrier. La composition est prévue ; la campagne n’est pas créée par ce lot. La conception doit varier les géométries et les problèmes de coopération par rapport aux campagnes précédentes, tout en conservant les contrats des rôles.

SS25 reste le dernier jalon du programme. Sa spécification et sa composition seront confirmées au moment de son ouverture.

## Reprise et traçabilité

La base `0ca0ec0235ba455af2e9600a7019044d1e9957f6` et le Site 195 sont les repères historiques de SS22 à l’ouverture de SS23. Les SHA de travail, d’intégration et de publication de SS23 seront ajoutés au compte rendu final après vérification. Une reprise examine d’abord GitHub et le Site actuels ; elle conserve les campagnes suivantes déjà intégrées.

La clôture de création, la publication et les résultats éventuels d’un agent autonome sont consignés séparément. Un témoin d’auteur menant à `WIN` ne qualifie pas le raisonnement SRA.
