# SS25 — feuille de route de création

**Les 25 campagnes SS01 à SS25 sont créées : 25/25 jeux, 200/200 niveaux, soit 100 % du programme de création prévu.** Ce jalon décrit les campagnes et leurs cartes. La livraison est suivie dans la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) ; les capacités de résolution autonome de SRA font l’objet d’une évaluation distincte.

| Repère | Jeux créés | Niveaux créés | Progression de création |
| --- | ---: | ---: | ---: |
| Avant SS25 : SS01 à SS24 | 24 / 25 | 192 / 200 | 96 % |
| Avec SS25 : SS01 à SS25 | **25 / 25** | **200 / 200** | **100 %** |
| Création restant dans ce programme | **0 jeu** | **0 niveau** | **0 %** |

Les huit cartes de SS25 sont finalisées, synchronisées et intégrées au moteur natif. Leurs témoins ont gagné dans le laboratoire, le HTML compilé, l’adaptateur natif et une session Chrome Manual complète de N1 à N8 sur la prévisualisation native. Consulter le reçu de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) pour la version publiée et les SHA GitHub/Site ; la [note d’intégration native](../../../docs/migration/ss25-native-integration.md) relie les preuves de qualification.

## SS25 — Les Derniers Équilibres

Le quatuor final est **Guerrier / Voleur / Magicien / Barde**, dans l’ordre `W T Z B`, avec les touches 1/2/3/4. Le niveau 1, **Le chantier des quatre gestes**, comporte **39 découvertes**. Il distingue la poussée d’une file entière, la prise unique arrière, l’échange avec la première cible et le chant mesuré depuis le poste initial du Barde. Les transports passifs ne déclenchent aucune de ces capacités.

Les salles suivantes travaillent deux réceptions sur un même quai, la transformation de deux traversées séparées en pont, les usages successifs d’une cale, la permutation d’une caisse et d’un miroir, la consommation d’une cible devenue appui, le retour d’une troisième charge et la libération coordonnée de deux accès. Le [README](../README.md) présente les huit salles et le [dossier des adaptations](source-audit.md) documente leurs références.

### Preuves acquises

| Lot | Résultat observé | Référence |
| --- | --- | --- |
| Moteur et pédagogie | **137 tests** de laboratoire réussis, dont les 39 découvertes du parcours réel N1 et leur exclusion hors tutoriel | [unit-tests.json](../validation/unit-tests.json) |
| Cartes et témoins | **8 victoires**, **1 209 entrées**, **201 sélections**, **3 296 images publiques**, zéro refus et zéro décès | [levels-report.json](../validation/levels-report.json) |
| Conception et diversité | **97 contrôles** dans quatre revues ; huit terrains distincts, aucun doublon exact parmi **88 cartes SS14–SS24**, symétries comprises | [design-report.json](../validation/design-report.json) |
| Interface autonome | **45 configurations DOM** et **8 parcours HTML**, avec contrôle des pixels, des durées et d’Undo | [ui-dom-report.json](../validation/ui-dom-report.json) |
| Intégration native | **102 tests** Custom4 / SS21 / SS22 / SS23 / SS24 / SS25 réussis ; TypeScript vérifié | [rapport natif](../../../docs/migration/ss25-evidence/native-tests-report.json) |
| Construction du Site | Build réussi ; galerie de **125 jeux / 836 aperçus** | [build.txt](../../../docs/migration/ss25-evidence/build.txt) |
| Chrome natif, mode Manual | Une seule session **N1→N8**, **1 209 entrées / 201 sélections**, **39/39 découvertes en N1**, panneau officiel **VICTORY** ; Undo final puis reprise par **ArrowDown** validés | [chrome-manual-report.json](../../../docs/migration/ss25-evidence/chrome-manual-report.json) |

Les huit témoins comptent respectivement **216, 123, 212, 159, 124, 151, 134 et 90 entrées**. Les sélections sont incluses dans ces nombres. Ils démontrent la jouabilité et ne prétendent pas être optimaux. Plusieurs variantes gagnantes sont conservées dans les revues, notamment une variante N1 qui omet la première traction : les découvertes pédagogiques ne deviennent pas un quota de victoire.

Le rejeu Chrome utilise les commandes publiques de l’interface native et conserve les transitions de campagne dans la même session. Les deux entrées du contrôle final Undo puis ArrowDown s’ajoutent aux 1 209 entrées du témoin. Cette qualification porte sur la prévisualisation native ; la correspondance du Site publié avec GitHub sera attestée par son reçu de livraison.

Les **125 jeux / 836 aperçus** décrivent la galerie complète du Site à ce checkpoint. Les **25 jeux / 200 niveaux** concernent le programme de création Sinking Star. Ces deux périmètres ne sont pas interchangeables.

### Continuité et clôture de livraison

Le contrôle `npm run test:sic-continuity` a réussi : **78 niveaux protégés, 13 jeux et 11 cohortes**, avec vérification des séries réellement exécutées, de leur clôture et des effets physiques. Le [rapport](../../../docs/migration/ss25-evidence/sic-continuity-report.json) et le [log](../../../docs/migration/ss25-evidence/sic-continuity.txt) conservent le résultat ; les 11 traces comprimées et leurs empreintes permettent sa relecture. Aucun apprentissage, planificateur ou arbitrage SIC n’est modifié par SS25.

La [validation détaillée](validation.md) rassemble les mesures et l’empreinte de l’artefact. Pour la livraison effective, consulter le reçu de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) : il conserve les SHA poussé et intégré, la version Site, son SHA source et leur concordance. Le succès d’un test de laboratoire ou d’un build ne vaut pas preuve de publication.

## Phase suivante : évaluation, équilibrage et résolution SRA

Le programme de création prévu est terminé. **Aucune campagne SS26 n’est définie par cette feuille de route.** La suite porte sur les campagnes existantes.

1. **Évaluer les parties réelles.** Recueillir les points de blocage, les lectures erronées, l’usage d’Undo et les retours sur les aides. Comparer les salles de SS25 à SS24 à partir des coordinations réellement rencontrées, sans transformer la longueur d’un témoin en score de difficulté.
2. **Équilibrer sur des constats précis.** Corriger un problème de lisibilité, une difficulté mal placée ou un raccourci qui retire le problème central lorsqu’un rejeu l’établit. Préserver les variantes légales intéressantes, régénérer les preuves des cartes modifiées et relivrer l’état qualifié suivant `AGENTS.md`.
3. **Évaluer séparément la résolution autonome de SRA.** Définir le mode, le niveau de départ, le budget et l’état source. Observer les décisions et commandes publiques réellement exécutées, les apprentissages acquis en N1 et leur transfert aux autres cartes. Les témoins d’auteur et leur rejeu réussi ne constituent pas cette preuve.
4. **Maintenir la traçabilité.** Conserver les campagnes créées, leurs sources, leurs rapports et les correspondances entre GitHub et le Site. Toute nouvelle qualification doit désigner les octets et l’état de code qu’elle a effectivement vérifiés.

Les règles de généricité, de continuité et de composition de `AGENTS.md` s’appliquent à toute modification ultérieure de SIC. L’identifiant SS25, ses coordonnées et son témoin ne doivent pas servir de raccourci dans l’apprentissage ou la planification de production.

## Reprise sans retour arrière

La base `4a546a139f9064422c078ef5f40b8c22133c39a8` et le Site 198 sont des repères historiques à l’ouverture du chantier. Les checkpoints de branche sont des sauvegardes de travail. Aucun de ces repères n’est une cible automatique de reset ou de republication.

Une reprise inspecte `main`, GitHub et le Site courants. Elle conserve les jeux et améliorations intervenus depuis ce document, vérifie si SS25 est déjà intégré et publié, puis complète uniquement ce qui manque. Elle ne diminue pas les compteurs observés pour reproduire un ancien checkpoint. Le [prompt de reprise idempotent](codex-integration-prompt.md) précise ce protocole.
