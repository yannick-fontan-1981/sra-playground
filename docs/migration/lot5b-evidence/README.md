# Lot 5B — preuves du matériau adressé

État courant : développement validé et intégration du Site 91 acquise. Le gel final attend le successeur 4C réellement publié. Les validations de développement ne sont pas présentées comme celles du futur gel intégré ; aucune fenêtre de coût ni publication 5B n'est encore déclarée par cet index. Le [rapport du lot](../lot5b-addressed-material.md) détaille les acquis et les réserves.

## Périmètre

Une instance `public_addressed_material` raccorde `observed_addressed_material` à sa place dans la stratégie originale. Le transfert consommé inclut `common_addressed_material.py`, `common_addressed_field.py` et `common_field_stock.py`. Le [contrat de filiation](../lot5b-addressed-material-lineage.md) décrit l'apprentissage, le stock, les refus reconnus, les obligations et les frontières. 5C `observed_object_binding` reste distinct.

Les retours sélectionnés et passifs alimentent le même propriétaire une seule fois. Chaque enveloppe originale est conservée sous `addressed_material_event:<revision>`, même quand `events` est vide. Le checkpoint natif ajoute un contrat de restauration explicite : il ne prétend pas être une méthode de checkpoint définie par le Python original.

## Preuves de développement

| Entrée | Résultat et portée |
| --- | --- |
| [Oracle canonique](diagnostic/source-oracle-export.json) et [contrat d'export](diagnostic/source-oracle-contract.md) | 14 helpers, 19 chaînes froides, 522 opérations ; 1 786 originaux vérifiés avant et après ; 35/35 tests de référence |
| [Revue du stock](development/field-stock-contract-review/README.md) | 13/13 tests du stock, contrat source et outils de coût préparés |
| [Navigation positive](development/common-positive-02/original-comparison.json) | 169/169 comparaisons de l'original sur le journal réel ; deux clics d'un même préfixe |
| [Navigation sans effet](development/common-negative-01/original-comparison.json) | 164/164 ; réfutation du modèle et changement de décision |
| [Stock partiel](development/common-stock-01/partial-original-comparison.json) | 384/384 comparaisons partielles ; parcours commun en échec, jamais requalifié en parcours terminé |
| [Cause originale du refus](development/common-stock-03/original-preservation-diagnostic.json) | Proposition du service et deux refus de préservation reproduits par le Python original |
| [Plan final des preuves communes](coordination/common-proof-plan.json) | Deux contrats de navigation et nouveau contrat borné de contribution stock suivie d'un refus ; les trois échecs historiques restent épinglés |
| [Intégration réelle de 10A](coordination/published-10a-source-verification.json) | Les 294 fichiers natifs publiés dans Site 91 correspondent à leur inventaire ; compilation du merge passée |
| [Préparation de la portée](coordination/regression-scope-preparation.json) | Union provisoire de 125 fichiers et dix cas de rejeu ; aucun résultat final anticipé |
| [Reconstruction des entrées](diagnostic/retained-input-reconstruction-01.json) | Douze fichiers reconstruits exactement depuis leurs parties ; aucun résultat recalculé |
| [Horloge WEAV conservée](coordination/weav-case-checkpoint.json) | 2 401,227841 s cumulées sur 2 400 s ; zéro temps restant, aucun nouvel essai réel 5B |

Les journaux de développement comprennent aussi les 10 tests d'extensions natives et les 4 contrats du noyau commun, les contrôles de compilation et les tentatives échouées. Le [transport des journaux](diagnostic/development-log-transport.json) conserve les sorties disponibles au moment de son enregistrement. Les preuves finales recevront leur propre inventaire.

## Plan de validation finale

Le [plan de l'oracle](oracle-plan.md) sépare les attentes calculées par le Python immuable, les tests d'extensions natives, la sélection réelle par le caller complet et les campagnes en jeu. Les tableaux publics synthétiques ne fournissent ni état appris, ni propriétaire imposé, ni action de remplacement. Les décisions et observations réellement obtenues seront rejouées à froid par l'original.

La préparation des [outils de coût](coordination/cost-tool-source-derivations.json) garde les outils officiels, les deux jeux STCK/SMLP, l'ordre A1/B1/B2/A2 et toutes les sessions mesurées. Le critère est la médiane groupée de session complète, strictement sous +10 % séparément pour chaque jeu. Les dépassements de phase restent visibles. La déclaration officielle ne sera créée qu'après identification du prédécesseur publié et gel des sources réelles.

## Coordination

Le checkout a été ouvert depuis le Site 88, native 0.55. Les Sites 89, 90 et 91 sont désormais intégrés par leur ascendance réellement publiée. Le lot 4C réserve native 0.57 ; 5B réserve 0.58 et attend son successeur réel avant le gel final. Les lots 4, 7 et 10 restent aux conversations qui en ont la charge. La fenêtre 4C sera prioritaire ; aucun test, build, export, jeu, profil ou archive 5B ne s'exécutera pendant cette fenêtre exclusive.

Le budget cumulatif WEAV déjà épuisé n'est pas remis à zéro. Les améliorations 5B ne sont pas une preuve que WEAV termine désormais son niveau 6. Une campagne synthétique n'est jamais comptée comme une réussite de jeu.
