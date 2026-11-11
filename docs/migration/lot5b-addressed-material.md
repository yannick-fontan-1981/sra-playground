# Lot 5B — Matériaux adressés et chemins de clics

## État de livraison

**Le transfert de développement de `observed_addressed_material` est implémenté ; sa livraison intégrée reste en préparation.** Le candidat réserve native **0.58.0**, après le lot 10A réellement publié dans Sites 90/91 et le lot 4C attendu en 0.57. Les validations finales, la fenêtre de coût et la publication 5B ne sont pas encore acquises dans cet état du rapport.

Le périmètre couvre la chaîne consommée `AddressedMaterial → AddressedField → FieldStock`, avec un propriétaire unique dans le moteur commun. Le [contrat de filiation](lot5b-addressed-material-lineage.md) décrit les conditions source, les refus et les limites du transfert. Le lot 5C, `observed_object_binding`, reste ouvert. Les autres conversations conservent les lots 4, 7 et 10.

## 1. Comportement transféré

Le moteur apprend une hypothèse d’adressage à partir des observations et des commandes effectivement revenues. Il lie chaque clic à un pixel de l’objet actuellement observé, à son époque, à son empreinte et aux preuves de l’hypothèse. Il acquiert une borne de distance acceptée et une borne rejetée ; l’absence d’un effet attendu à l’intérieur d’une portée acquise réfute le modèle.

Après calibration, une proposition peut réunir jusqu’à **16 actions**, sous la limite d’actions restante. Le moteur garde chaque étape avant de l’autoriser. Une réponse inconnue, une frontière officielle, un changement d’état ou une contre-observation ferme le préfixe. Les retours d’un préfixe sont acquis une seule fois lorsqu’il est scellé. Cette continuité est une propriété du chemin produit par la famille ; elle n’autorise pas des clics sans contrôle.

Après une frontière avec augmentation officielle du score, le champ peut conserver un prior conditionnel : action, bornes, formes, offsets et région de but. Le nouvel épisode doit revalider cette hypothèse sur ses observations courantes. Le stock typé reconstruit alors l’échelle des types, les demandes, les corps et les zones. Il peut proposer des déplacements ou des fusions et conserver les origines conjointes d’un produit sans inventer une identité physique de pixels.

Le stock maintient des quantités minimales requises par la demande actuelle. Ces obligations sont collectées avant la sélection commune et s’appliquent à toutes les familles. Une révision doit porter ses preuves de conservation ; un clic proposé par une autre famille ne reçoit pas automatiquement cette autorisation.

## 2. Travail incrémental et frontières

La même instance acquiert les retours sélectionnés et passifs. Chaque enveloppe source, y compris `field_unresolved` avec `events: []`, est enregistrée sous `addressed_material_event:<revision>`. Aucun état source supplémentaire n’est inventé pour remplacer cette acquisition.

Les snapshots immuables du propriétaire sont réutilisés tant que leur révision ne change pas. La restauration native valide le checkpoint avant de modifier le propriétaire. Les bornes de recherche et l’interruption coopérative rendent une absence de résultat explicite ; elles ne fabriquent ni action, ni réfutation. Ces contrats sont des extensions natives déclarées : les classes Python d’origine ne définissent pas d’API `state`/`restore`.

À la frontière, les observations locales, les échantillons et la calibration active sont libérés selon les règles source. Les priors, règles retenues et témoins de réussite restent conditionnels. Les confirmations héritées d’une règle de fusion repartent à zéro dans le nouvel épisode. Cette séparation évite de confondre une preuve ancienne avec une confirmation actuelle. Elle ne constitue pas une purge générale du journal ni une preuve de mémoire constante sur une longue session.

## 3. Contrats et preuves de développement

L’[oracle indépendant](lot5b-evidence/diagnostic/source-oracle-export.json) utilise le Python immuable du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Il vérifie les **1 786 fichiers originaux** avant et après son exécution et épingle les quatorze modules réellement importés. Les **14 helpers, 19 chaînes froides et 522 opérations** comparent les retours et l’état source complet. Aucune sortie native n’entre dans le calcul des attentes Python.

Les quatre fichiers de tests 5B passent leurs validations de développement : **35 tests de référence**, **13 tests du stock**, **10 tests des extensions natives** et **4 tests du noyau commun**. La suite intégrée finale est distincte de ces contrôles ciblés. Les erreurs initiales de stimulus, de sérialisation, de compilation et d’instrumentation restent dans les diagnostics.

| Preuve de développement | Résultat effectivement observé | Portée |
| --- | --- | --- |
| [Navigation positive](lot5b-evidence/development/common-positive-02/original-comparison.json) | 169/169 comparaisons originales ; 15 retours, dont cinq propres et dix passifs ; deux clics dans le même préfixe | Boucle native complète sur un tableau public synthétique, avec l’ordre original des familles et les gardes réelles |
| [Navigation sans effet](lot5b-evidence/development/common-negative-01/original-comparison.json) | 164/164 ; 14 retours, dont quatre propres et dix passifs | Le modèle est réfuté et la décision suivante change |
| [Parcours stock complet tenté](lot5b-evidence/development/common-stock-01/partial-original-comparison.json) | 384/384 comparaisons partielles ; une fusion puis un déplacement ; boucle commune **en échec** | La parité des opérations reçues ne transforme pas l’arrêt en parcours terminé |
| [Diagnostic de préservation](lot5b-evidence/development/common-stock-03/original-preservation-diagnostic.json) | Fournisseur original et deux refus originaux identiques aux captures natives | Comparaison des composants de service et de préservation, sans prétendre rejouer tout le routeur original |

### Limite conservée : poursuite du parcours stock

Après la fusion et le déplacement, un fournisseur antérieur de `window_constraints` propose un test de contrôle. La proposition ne déclare pas de révision de l’obligation de quantité minimale. L’original comme le natif rejettent ce clic. Le second choix source retrouve le même candidat, car ce fournisseur s’appuie sur la disponibilité publique de l’action malgré la liste d’inputs filtrée. La boucle s’arrête avec `frontier_preservation_conflict`.

Les trois essais stock échoués restent épinglés et échoués. Le [plan final](lot5b-evidence/coordination/common-proof-plan.json), déclaré après ce diagnostic et avant les exécutions intégrées, ajoute un contrat distinct : contribution stock réellement acquise, puis refus source respecté. Il exige une comparaison originale indépendante du fournisseur et de la préservation. **Ce contrat borné ne revendique ni une traversée complète du tableau stock ni une réussite de jeu.** La chaîne du composant source, séparément, couvre deux fusions et neuf déplacements ; ces onze actions ne sont pas attribuées à la boucle commune.

## 4. Intégration et validation finale

Le [successeur 10A effectivement publié](lot5b-evidence/coordination/published-10a-site91.json) est intégré. Ses **294 fichiers natifs** correspondent exactement à son [inventaire publié](lot5b-evidence/coordination/published-10a-source-verification.json). Les conflits de fusion ont conservé les deux propriétaires, leurs acquisitions, leurs entrées ordonnées et leurs événements. Le contrôle de compilation après cette intégration passe.

Le gel final attend le successeur 4C réellement publié. L’union ordonnée des tests publiés, les rejeux publics, les trois contrats communs, l’original indépendant, le navigateur et les contrôles de coût seront liés à ce gel. Aucun résultat de développement n’est présenté comme une validation du futur gel.

## 5. Règle et mesure du coût

La consigne utilisateur est appliquée au **temps de session complet**, séparément sur STCK et SMLP : la médiane groupée du candidat doit rester **strictement en dessous de +10 %** par rapport à la référence publiée remesurée. Un jeu ne compense pas un autre. Les durées de phases imbriquées ne sont pas additionnées.

La fenêtre prévue conserve l’ordre A1/B1/B2/A2, 32 sessions mesurées et 400 actions, avec huit sessions par jeu et version. Les chauffes sont séparées. Les dépassements de phase, les cohortes défavorables et les distributions restent visibles. La structure supplémentaire du propriétaire doit être attribuée avant mesure. **Aucune mesure officielle 5B n’est encore déclarée dans cet état du rapport.**

## 6. WEAV et rapidité perçue

Le budget cumulatif WEAV antérieur reste épuisé : aucune nouvelle exécution réelle et aucune remise à zéro ne sont autorisées par cette livraison. La compatibilité des traces déjà enregistrées peut être vérifiée sans annoncer la résolution du niveau 6.

5A a établi le transport commun des chemins de touches et mixtes ; 5B ajoute une famille capable de produire ses chemins de clics adressés. Cela ne prouve pas encore que WEAV choisit ces chemins, que ses coups forcés sont reconnus plus tôt ou que sa latence reste stable quand les niveaux progressent. Ces résultats doivent être distingués des tests synthétiques et du budget global sur les deux séquences de mesure.

## 7. Feuille de route du lot 5

| Priorité | Travail | Condition de sortie |
| --- | --- | --- |
| En cours | Livrer 5B sur le successeur 4C publié | Gel réel, union des tests, rejeux, preuves communes qualifiées, navigateur, coûts et publication effectivement vérifiés |
| Ensuite | 5C — `observed_object_binding` | Liaison de l’objet courant, conservation et retours de composition, avec restauration et frontières |
| Réserve explicite | Coordination après le préfixe stock | Un parcours commun peut continuer en respectant les obligations ; aucun contournement du refus source |
| Suivi transversal | Temps de décision, persistance, restauration et données des anciens niveaux | Mesures déclarées sur des parcours assez longs et attribution des gains, sans déduire une accélération d’une simple acceptation du seuil |
| WEAV | Niveau 6 et croissance de la latence | Budget et campagne distincts établis ; aucune réussite anticipée |

L’[index des preuves](lot5b-evidence/README.md) conserve les diagnostics et les résultats à leur portée réelle. La [feuille de route générale](v6-delivery-roadmap.md) sera actualisée après intégration du prédécesseur final.
