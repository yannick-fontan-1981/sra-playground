# Lot 10C : qualification fonctionnelle de la composition

## Résultat au 11 novembre 2026

La composition native **329 fichiers / `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316`** passe sa suite formelle, ses cinq contrôles de projet, ses dix rejeux principaux et le complément KATA. La vérification d'intégrité complète passe avec les vérificateurs inchangés. Les sources natives et les tests sont identiques au précédent checkpoint `3df0fc780f479e51f51aaceb2a32ec287b67671d` ; cette reprise qualifie la composition et adapte les outils de travail courant.

Le [bilan structuré](functional-summary.json) lie les reçus et leurs empreintes. L'audit du candidat conserve **68/76 entrées raccordées, soit 89,5 %**. La version **0.66 demeure proposée** ; la [dernière publication observée](publication-observation-final.json) reste **Site 103 / native 0.62**, accès existant et révision 3 conservés.

| Vérification réellement terminée | Résultat | Preuve |
| --- | --- | --- |
| Suite formelle, 56 modules | **1 767/1 767**, aucun échec, annulation, test ignoré ou `todo` | [Revue formelle](composed-functional02/validation/formal-review.json) |
| TypeScript, audit des entrées, audit de migration, différences et build Sites | **5/5** ; une nouvelle compilation réellement exécutée | [Reçu de compilation](composed-functional01/validation/checks-run.json) |
| Dix rejeux principaux | **10/10 cas et 170/170 contrôles** | [Revue des rejeux](composed-functional02/regression-review.json) |
| KATA, déclaration et exécution distinctes | **1/1 cas et 17/17 contrôles**, 33 actions archivées | [Revue KATA](kata-supplement/review.json) |
| Couverture des deux exécutions | **11 jeux distincts et 187 contrôles réussis** | [Liaison explicite](composed-functional02/kata-supplement-link.json) |
| Intégrité de livraison fonctionnelle | **PASS** : 329 natifs, 816 fichiers archivés, 753 entrées sources/tests, 394 entrées de compilation et 1 786 originaux inchangés | [Intégrité](composed-functional02/delivery-integrity.json) |

Les dix rejeux principaux retiennent 357 commandes, 367 paquets publics complets, 1 676 images d'animation, 275 préfixes, 632 requêtes et 30 frontières naturelles. Le comparateur conserve ses 17 contrôles par cas. Le champ historique KATA `fresh_current_native_self_consistency` désigne sa provenance 6A/native 0.60 ; aucune nouvelle auto-comparaison de référence sur 0.66 n'est inventée.

La première tentative formelle a atteint sa borne de **600 secondes**, sortie **124**, sans résumé TAP complet. Ses sorties restent conservées et ne sont pas acceptées. L'exécution suivante a effectivement terminé les 56 modules en **616,718965502 secondes** avec tous les comptes complets. Les quatre anciens groupes de développement ne s'ajoutent pas aux 1 767 tests de cette nouvelle exécution.

Les actifs Pyodide locaux ont été matérialisés depuis leurs octets épinglés, **18 339 702 octets**, pour remplacer le lien symbolique que le vérificateur inchangé refusait. Le build a été réellement refait. Le même reçu frais a ensuite été réutilisé à l'identique pour le second répertoire après contrôle des inventaires et du worker ; aucune seconde compilation n'est revendiquée.

## Travail courant et conservation

La [politique ordinaire](../../lot10-ordinary-work-policy.md) et son [complément pour les cas](../../lot10-ordinary-case-work-policy.md) suppriment l'admission globale pour développement, tests fonctionnels, builds, revues, commits et pushs de branche. Les nouvelles entrées conservent la supervision, les traces, les délais et les contrats ; **19 contrôles courts simulés** passent. Ils sont distincts de la suite native.

Les anciens helpers exécutés restent inchangés pour conserver leurs preuves. Le dernier rejeu lancé sous l'ancien protocole s'est terminé normalement et a fermé son propre verrou. Aucun fichier de verrou détenu n'a été supprimé ni remplacé. Les registres cumulés gardent uniquement leur protection propre au cas. Les mesures officielles et la publication effective conservent leurs fenêtres exclusives courtes.

La [revue du stockage](storage-review.json) établit la reconstruction à l'identique de **91 834 393 octets en 107 fragments** pour les dix rapports et de **9 774 240 octets en 11 fragments** pour KATA. Les deux archives de sources conservent chacune leurs six fragments. Les originaux restent présents ; seules les copies exactement reconstructibles sont exclues du transport redondant.

Les [six commits de preuves poussés et vérifiés](transport/review.json) conservent **239 fichiers et 113 240 191 octets bruts**, jusqu'au checkpoint `4622babc20ae32d9421d3cdeeaebaa84a48befac`. Les deux commits de politique l'ont précédé. La clôture documentaire conserve les résumés, les reçus de push et la feuille de route. Tous ces envois portent sur la branche de sources `lot10c-ordered-recruitment-checkpoint-20261111`, sans publication.

## Réserves et prochaine étape

Les résultats RECR, comparaison originale et navigateur restent attachés au gel historique **315 fichiers / `bb7d62…`**. Aucun nouveau résultat de ces catégories n'est attribué au candidat 329. Le registre RECR est inchangé : **642,824027506 secondes consommées, 1 757,175972494 restantes sur 2 400**. HPDL reste partiel, LKEY fermé, et ses quatre modules exclus sont absents des 56 modules exécutés. La parité complète de l'appelant n'est pas établie.

La qualification de publication 10C doit encore réconcilier les prédécesseurs effectivement publiés et qualifier le coût **0.65 → 0.66**, avec le seul ajout OrderedRecruitment prévu par le contrat. La médiane de session complète doit rester **strictement sous +10 % séparément pour STCK et SMLP**. Une phase au-dessus de +10 % reste acceptable si le global du même jeu passe. Aucun coût officiel 10C n'a été acquis ici.

La prochaine étape ordinaire est déjà [préparée pour 10D / TemporalSelection](../../lot10d-temporal-selection-next-step.md) : créer le générateur de référence indépendante et son corpus de mesures/politique. Le port devra fournir les descriptions de cellules périodiques consommées par la source et préserver la représentation ainsi que l'ordre des pixels des composantes. Cette étape peut avancer sur la branche du lot 10 sans attendre les publications voisines.
