# Revue indépendante des onze outils de coût 6B

Cette revue porte sur les onze brouillons de `lot6b-evidence` dérivés des outils
6A publiés. Elle autorise seulement leur lecture, leurs corrections bornées, le
parsing AST Python et `node --check`. Aucun de ces outils n'est exécuté ; aucune
capture fonctionnelle, mesure, import natif, partie, campagne, construction ou
suite de tests n'est lancée. Le reçu `review.json` donne le résultat effectif des
contrôles de syntaxe et les empreintes finales. Il ne constitue pas une
qualification fonctionnelle du futur protocole.

## Provenance conservée

Les fichiers initiaux sont conservés dans `before/`, leurs prédécesseurs exacts
dans `original-6a/`, les différences initiales dans `derivation-diffs/`, les
corrections de cette revue dans `review-diffs/`, et la dérivation complète finale
dans `final-derivation-diffs/`. `inputs-before.json` conserve les empreintes des
onze originaux du checkout 6A immuable et établit leur égalité avec les copies 6A
du nouveau checkout. Les copies et les originaux ne sont pas modifiés.

Le pin original demeure `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.
Les références directes de provenance héritées à 5B ont été corrigées vers 6A.
Les sept outils centraux et les sources arithmétiques historiques restent
distincts de cette provenance d'adaptation.

## Changements de cette revue

| Point examiné | Correction ou conclusion |
| --- | --- |
| Identité de comparaison | La capture, l'inventaire, la préparation, le contrat, le préflight, les lecteurs et la finalisation exigent maintenant 0.63 pour A et 0.64 pour B. Le numéro du Site et la publication effective restent des preuves à fournir par le responsable dans la readiness. Aucun numéro futur n'est inventé. |
| Propriétaire observé | La capture compare réellement `rawNativeSelectedRigid(wrapper)` à `runtime.acquisitionFamilies.selectedRigid`, exige exactement une famille enregistrée côté candidat et aucune côté baseline, et conserve ce lien dans chaque point capturé. |
| État sur parcours étrangers | Chaque point fonctionnel doit conserver exactement `{format: 'selected_rigid_events.v1', events: []}` côté candidat et aucun propriétaire côté baseline. Les propositions négatives, checkpoints et compteurs `record` restent contrôlés. Aucun cache Preview n'est admissible. |
| Valeurs communes | Le contrat prospectif 6B exige l'égalité exacte de chaque valeur commune, à chaque point et dans chaque delta commun. L'exception explicite de métadonnée reste `origin.source_digest`, vérifiée contre chaque rôle. Une couverture ordonnée relie les comparaisons aux vrais compteurs de chaque point. |
| Fragments et racines | Chaque delta de fragment doit porter l'identifiant de son contenu ; chaque racine de graphe natif modifiée est hydratée. Les nouveaux fragments doivent toujours être reliés à un checkpoint réel de `selected_rigid`. |
| Un seul ajout | L'inventaire réel doit ajouter uniquement `selected_rigid`, supprimer aucun propriétaire et conserver l'ordre des autres familles. Les programmes installés et leurs appels d'installation restent identiques. Aucun effectif de propriétaires n'est présupposé à partir de l'ancienne baseline 6A. |
| Préparation du contrat | `--owner-cost-qualification` devient obligatoire pour 6B. Le contrat et les deux lecteurs exigent la couverture complète des valeurs communes ; aucune omission n'autorise une exception. |
| Seuil et population | Les calculs, les signatures de travail, le critère global strictement inférieur à +10 % pour chaque jeu, les 32 sessions et 400 actions sont conservés. Les 8 chauffes et 24 actions exclues sont identifiées prospectivement ; aucun échantillon mesuré n'est supprimé. |
| Contrôle strict historique | Le comparateur historique est réellement exécuté après la fenêtre par le finaliseur, son code retour et son journal sont retenus. La branche complémentaire exige un véritable refus de métadonnées, sans sortie historique produite. Un succès inattendu est conservé séparément et bloque cette branche. |
| Rendu et transport | Le rendu lit le verdict calculé, y compris un refus global, et conserve diagnostics, p95 disponibles, pauses, mémoire et toutes les sessions. Le transport des quatre journaux de mesure conserve leurs octets exacts. |

## Portée plus stricte de 6B

La qualification 6A déclarait explicitement qu'elle ne prouvait pas l'égalité
des valeurs privées communes. La nouvelle exigence 6B n'invalide pas cette
portée historique et ne transforme aucune preuve 6A en preuve de parité privée.

Le `factorySourceDigest`, le digest d'exécution et les chaînes Kernel peuvent
changer légitimement quand un propriétaire est ajouté. Ils peuvent apparaître
dans des valeurs, au-delà de `origin.source_digest`. Aucune normalisation de
chaînes, aucun retrait de sous-arbre ni aucune tolérance générique n'a été
introduit pour ces valeurs. Les premières captures sur les sources finales
pourront donc être refusées. Toute différence réellement observée devra être
reliée à un calcul précis vérifié indépendamment pour chaque rôle, dans une
adaptation déclarée avant la fenêtre officielle. Une fixture future n'est pas
présumée conforme.

## Vérifications statiques et limites

Le reçu de revue vérifie le parsing des sept fichiers Python et la syntaxe des
quatre modules JavaScript sans suivre leurs imports. Il compare aussi les AST
des fonctions Python de calcul, de populations, de signatures et de refus
historique, ainsi que les corps exacts des fonctions JavaScript correspondantes,
à leurs prédécesseurs 6A. Les sept outils centraux sont comparés aux empreintes
historiques de la déclaration 3H.

Les API lues sont celles du composant `v6-selected-rigid.ts`, du wrapper et de
l'acquisition commune dans `v6-native-runtime.ts`, et du stockage Kernel. Le
getter `sourceState()` est pur ; `nativeState()` expose le checkpoint immuable.
L'observation de ces getters par l'outil fonctionnel ne constitue pas une mesure
de coût. Aucun appel supplémentaire à l'horloge du composant n'est ajouté.

La publication 0.63 n'est pas disponible au moment de cette préparation. Les
sources 0.64 devront encore intégrer le prédécesseur effectif. Il faut ensuite
refaire les inventaires, les quatre formes fonctionnelles A/B, l'attribution,
le contrat, le préflight et la readiness sur les gels finaux. Les formes portent
STCK et SMLP, chacune en chauffe puis session complète, soit quatre sessions et
31 actions par rôle hors de toute mesure officielle. Les trois inspections
terminales sont présentes uniquement dans chaque forme complète.

Le finaliseur reçoit explicitement le répertoire du gel candidat et le manifeste
baseline. Son défaut de chemin `integrated-final-02` est hérité de 6A ; il faut
passer le chemin réellement lié par la future déclaration si le gel 6B a un
autre nom. Les assertions de fingerprint empêchent de substituer un autre gel.

Le transport des quatre journaux A/B n'inclut pas `aggregation-failure.log`.
Ce journal strict reste conservé séparément avec son empreinte réelle ; toute
compression future pour publication devra démontrer son égalité byte à byte
et ne pas lui substituer le reçu d'un journal de mesure.

Le coût des deux parcours étrangers ne qualifie pas le coût propre de la
recherche SelectedRigid, la source originale complète, l'isolation machine,
une campagne réelle, ni le succès ou la publication futurs. Le responsable
doit conserver ces limites et les éventuelles tentatives refusées.
