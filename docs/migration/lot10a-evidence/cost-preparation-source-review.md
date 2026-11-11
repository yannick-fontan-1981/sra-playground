# Revue indépendante de la préparation du coût 10A

## Portée et résultat

Revue de source du 10 novembre 2026, réalisée séparément de l'écriture des
helpers. **Aucun défaut bloquant de CLI, de schéma ou de chaîne de preuves n'a
été identifié dans les sources relues.** Ce constat n'est ni un résultat
d'exécution, ni une qualification structurelle, ni une acceptation de coût.

Les fichiers relus intégralement sont :

- `prepare-cost-protocol.py` ;
- `prepare-owner-cost-contract.py` ;
- `check-cost-static-inputs.py` ;
- `README-preparation.md` et la séquence corrigée de `README-commands.md`.

La revue a recoupé leurs champs et leur ordre avec les producteurs existants
`record-owner-source-inventory.mjs`, `capture-cost-owner-graphs.mjs`,
`qualify-cost-owner-graphs.mjs`, les consommateurs
`consolidate-owner-costs.mjs` et `review-owner-costs.py`, et le mode
`--check-protocol` conservé de `scripts/review-native-global-cost-window.py`.
Elle complète [la revue des outils de coût](cost-tool-source-review.md), sans
remplacer cette revue ni réexécuter les contrôles.

Aucun import, parseur, test, build, oracle, jeu, capture, décompression,
préparation effective de protocole ou chronométrage n'a été exécuté par le
relecteur. Aucun helper n'a été modifié par cette revue. Les deux durcissements
annoncés par leur auteur ont été relus dans leur version présente : inventaires
natifs complets revérifiés avant fermeture du contrat ; empreintes des lecteurs
exigées immédiatement avant leurs appels par le préflight.

## Vérifications de contrat

| Point | Constat dans les sources |
| --- | --- |
| Paramètres effectifs | Les chemins, commit publié attendu, numéro de Site et versions natives sont fournis explicitement. Les exemples CLI correspondent aux arguments des helpers. Aucun ancien digest, total de fichiers ou numéro de version ne sert de référence implicite. |
| Référence exacte | La préparation confronte le HEAD au commit attendu, exige la propreté native, extrait la version du runtime et compare l'inventaire complet au manifeste. Le contrat et le préflight retrouvent le même checkout distinct, fourni aussi en CLI. Le numéro de Site reste une donnée du responsable ; aucune vérification d'hébergement n'est prétendue. |
| Candidat exact | Le manifeste complet correspond aux octets présents. L'archive est liée au même digest et à une ascendance Git réelle. Le HEAD relevé n'est pas présenté comme le commit de modifications natives encore non commitées. Le préflight vérifie aussi les octets des membres de l'archive, sans extraction sur disque. |
| Outils historiques | Les sept outils retenus sont comparés aux empreintes de 3H. Les cas et la politique de phases conservent les octets historiques. Le préflight exige l'identité des lecteurs avant de les exécuter ; un simple contrôle déjà marqué faux ne suffit pas à autoriser un lecteur modifié. |
| Chronologie prospective | La déclaration précède l'inventaire et le début des captures. Les captures précèdent l'attribution, puis la fixture ; toutes précèdent le contrat. Le contrat précède le préflight, la readiness et la fenêtre selon les consommateurs existants. Les deux README donnent cet ordre. |
| Absence de cycle d'empreintes | La déclaration annonce le chemin du futur contrat et les empreintes des outils ; elle ne contient pas l'empreinte du contrat futur. Le contrat lie la déclaration finalisée. Les reçus de contrôle et de préflight sont produits ensuite. |
| Capture effective | Les champs attendus correspondent aux reçus réels : quatre sessions, 31 actions, zéro session de coût, zéro lecture de rapport de temps et zéro métrique de temps. Les inventaires `nativeInventoryBefore` et `nativeInventoryAfter` sont complets, distincts des empreintes de fichiers `nativeSourceBefore` et `nativeSourceAfter`. |
| Qualification fermée | La fixture et l'attribution doivent avoir le statut `qualified_functional_structure`, les digests attendus, quatre formes ordonnées, un hash canonique des formes cohérent, des contrôles tous réussis et aucune défaillance. Les reçus et rapports des deux captures sont liés et les formes des reçus doivent reproduire la fixture. |
| Chemins externes | Les chemins externes autorisés proviennent des entrées de la capture baseline et restent strictement sous son checkout réel. Les chemins à alias parent ou symlink sont refusés. L'attribution doit conserver exactement ces entrées externes ordonnées. |
| Addition de propriétaire | L'inventaire réel doit conserver tous les propriétaires/programmes existants, sans doublon, et ajouter seulement `public_axial_question` et `v6.axial_question.choose`. Les trois preuves de source attendues et les trois nœuds installés concordent avec les consommateurs. |
| Vérification sans réécriture | `--verify-only` reconstitue le contrat depuis les mêmes entrées, conserve son instant `declaredAt`, compare l'objet complet et n'écrit rien. Le contrat ne se prend pas lui-même comme entrée à empreinter. Ce mode est appelé avant la création de `static-preflight.json`, compatible avec son refus de tout préflight déjà présent. |
| Statut statique | Le reçu utilise `satisfied`, `checkedCount`, `declaration`, `ownerCostContract` et `ownerCostTools`, comme l'exigent les analyseurs. Il ne porte `static_inputs_checked` que si tous les contrôles enregistrés sont vrais ; un échec ne devient pas une readiness. |
| Sorties conservées | Les sorties finales sont ouvertes exclusivement. Les outils refusent une readiness, une fenêtre, une supersession ou des sorties de mesure préexistantes dans les emplacements surveillés. Les erreurs de structure ou de lecture peuvent interrompre avant un reçu final : l'absence de reçu ne vaut jamais succès. |

## Population et verdict inchangés

Les nouvelles politiques et leur préflight conservent A1/B1/B2/A2, deux jeux,
quatre sessions par jeu/version/cohorte et deux cohortes. Le calcul depuis les
cas donne **32 sessions mesurées, 400 actions, huit chauffes et 24 actions de
chauffe exclues**. Chaque jeu/version conserve donc ses huit sessions mesurées.

Le critère est la médiane groupée des durées complètes `session_elapsed`, avec
`médiane(B) < 1,1 × médiane(A)` pour chacun de STCK et SMLP. L'égalité à +10 %
échoue. Les deux jeux doivent passer ; aucun jeu, aucune phase ni aucune
cohorte ne compense une autre population. La politique fixe explicitement zéro
session mesurée exclue et zéro valeur extrême exclue. Aucun temps supplémentaire
du propriétaire n'est soustrait. Les phases, p95 disponibles, pauses,
inspections et mesures de mémoire restent visibles.

Le contrat prépare les chemins du refus historique futur ; il ne fabrique pas
un refus avant la fenêtre. Les deux analyseurs exigent encore, après les
mesures, la commande exacte du comparateur historique, son code réel non nul,
ses entrées inchangées, son journal contenant
`Within-cohort work metadata changed`, et l'absence de sortie historique. Un
succès strict ou un autre motif d'échec bloque ce chemin complémentaire.

## Limites et portes restantes

La revue porte sur les sources présentes au moment de la lecture. Elle ne
vérifie pas leur syntaxe par exécution, ne produit aucun exemple de déclaration
et ne prouve pas que les captures des futurs gels seront qualifiables. Une
première création différente d'un fragment commun ou un ordre différent de
delta commun doit toujours provoquer le refus strict prévu ; aucun
assouplissement 5A n'a été déduit de cette préparation.

Avant la fenêtre officielle, le responsable doit encore disposer des
prédécesseurs effectivement publiés, d'un baseline distinct exact et d'un gel
candidat intégré, puis exécuter la préparation, les captures, la qualification,
le contrat et le préflight sur ces mêmes octets. Toute modification d'un outil
déclaré exige une nouvelle déclaration et des preuves prospectives distinctes.

La readiness reste à constituer à partir des preuves fonctionnelles réellement
achevées, avec leurs limites. Aucun de ces helpers ne crée cette readiness ou
le reçu du refus historique. La coordination explicite et récente des fils,
puis le verrou exclusif de la fenêtre, restent distincts d'un préflight réussi.
La réussite du recalcul indépendant doit enfin être accompagnée du verdict
global d'acceptation pour les deux jeux.

Les quatre formes fonctionnelles préalables ne prouvent pas les feuilles
privées non enregistrées des futures sessions mesurées. Les réserves de
contribution en jeu et de durée longue restent celles des preuves de livraison ;
elles ne sont ni résolues ni effacées par cette revue de préparation.
