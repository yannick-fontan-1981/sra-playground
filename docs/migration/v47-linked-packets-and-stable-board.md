# v47 · Paquets datés, supports visuels et plateau stable

## Résultat livré

**Logos Engine réussit les trois premiers niveaux de SELE en 44 actions.**
Cette campagne réelle utilise une seule session froide, continue, sans reset,
saut de niveau ni amorçage manuel. Les décisions sont produites en TypeScript
par le caller commun ; Python exécute uniquement le jeu opaque.

| Niveau terminé | Actions du niveau | Actions cumulées | Préfixes acquis cumulés |
| --- | ---: | ---: | ---: |
| 1 | 8 | 8 | 8 |
| 2 | 10 | 18 | 18 |
| 3 | 26 | 44 | 44 |

La [campagne](native-campaigns-v47/sele-three-levels.json), ses
[45 paquets publics complets](native-campaigns-v47/sele-public-trace.json.gz)
et son [reçu d'exécution](native-campaigns-v47/logs/execution-sele.json)
retiennent 229 images, 44 transitions réellement acquises par le Kernel,
53 événements propres à Linked Packet et 59 événements du propriétaire commun.
Les deux reprises naturelles de frontière conservent la même mémoire.
L'arrêt à la cible déclarée intervient à l'entrée du niveau 4, avec
`NOT_FINISHED`. La campagne n'affirme pas une victoire complète de SELE.

**ZIPP progresse aussi : cinq niveaux sont terminés après 77 actions.**
Les quatre premières frontières restent à 8, 23, 38 et 53 actions ; le cinquième
niveau ajoute 24 actions. La [tentative visant six niveaux](native-campaigns-v47/zipp-six-levels.json)
reste explicitement `failed` pour cette cible : après une action au niveau 6,
le caller s'arrête à 78 actions avec `frontier_unknown` et `NOT_FINISHED`.
Les [79 paquets publics](native-campaigns-v47/zipp-public-trace.json.gz)
contiennent 94 images. Les 78 transitions sont acquises, avec 37 préfixes et
cinq reprises de frontière. Aucun statut `WIN` n'est inventé.

## Une capacité générique de composition

Le transfert connecte `linked_packet_composition` du V6 épinglé au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Une découverte indépendante a
conservé les 100 écrans initiaux publics, sans action. SELE est le seul de ces
écrans à satisfaire à la fois la mesure des supports et l'hypothèse de marque
terminale distincte de ce composant. Ce résultat choisit un cas d'évaluation ;
le nom du jeu ne choisit aucune règle de production.

L'agent mesure des motifs de contrôle et des objets dans les pixels courants.
Une sélection est d'abord une expérience : seuls les changements effectivement
observés relient un contrôle à un objet distant. Les images successives d'un
retour animé apportent des segments et des directions de propagation. Les
effets des commandes sur les dessins de contrôle et les sorties observées
permettent ensuite de proposer des relations angulaires conditionnelles.

Le programme conserve les périodes compatibles, l'incertitude des sorties
non mesurées et les contre-exemples. Une phase déduite par inversion d'une
relation reste une prédiction ; elle ne devient pas une loi d'action réversible.
Une composition préparée doit être confrontée à un nouveau paquet réellement
renvoyé par le jeu. Un changement de niveau ne transmet aucune autorité de
clic ou calibration de contrôle sans sa vérification courante.

Le sous-calcul géométrique utilise des intersections exactes entre des rayons
conditionnels et des boîtes visibles. Les rationnels sont calculés en BigInt.
Le premier impact, la frontière du domaine et les égalités entre récepteurs
suivent le sous-kernel source. Une égalité sans ordre explicitement déclaré
est refusée. Une sortie qui dépasserait le domaine JSON des entiers exactement
représentables est refusée sans arrondi.

Cette projection ne transfère ni les disques et leurs intervalles incertains,
ni toute la machine optique V5. Une boîte de rendu n'est pas déclarée volume
physique de capture. Aucun parcours calculé n'autorise directement une action.

## Code, graphe commun et gardes

Les algorithmes de perception et de calcul sont du code TypeScript générique.
Le Kernel commun retient les observations, hypothèses, programmes, propositions,
retours, contradictions et états acquis. La migration ne prétend pas que chaque
algorithme est déjà un graphe déclaratif entièrement éditable.

Linked Packet occupe sa position DRM avant Trace Field dans la sélection.
Son état est acquis dans le même propriétaire `public_occurrence_recall`, après
Trace et avant Cell ; les paquets datés sont analysés après les enregistrements
ordinaires. Il n'existe pas un second propriétaire caché pour SELE. Les points
courants passent leurs gardes, puis l'autorisation WHY/ACT ordinaire. Une copie
publique altérée ne remplace pas la mémoire acquise. La restauration reconstruit
et vérifie le journal avant de publier les couches, de façon atomique.

La nouvelle famille ne contient ni identifiant de jeu, ni branche par niveau,
ni palette de rôles fixée, ni coordonnées de solution, ni séquence de commandes
préenregistrée. Les jeux sont sélectionnés uniquement par l'interface et les
bancs de vérification. Aucun module agent Python n'est chargé par les campagnes.

## Frontière numérique et différence de journal explicites

Le contrat canonique portable du Kernel V7 reste limité aux entiers. Le codec
existant du graphe natif représente les nombres IEEE-754 finis par des feuilles
Float64 dont les bits sont conservés exactement, y compris le zéro négatif.
Les tests traversent les vrais nœuds de famille, de préfixe et de transition.

Les fonctions trigonométriques JavaScript et Python peuvent différer dans leurs
derniers bits ; la comparaison numérique source utilise une tolérance déclarée
de `1e-12`, sans relâcher les décisions, les gardes ni les paquets publics.
Les identités flottantes natives ne sont pas présentées comme des SHA Python
identiques. Les identités de raster et de support à valeurs entières gardent
leur comparaison exacte.

La [comparaison indépendante des campagnes](native-campaigns-v47/sele-original-component-comparison.json)
retrouve les 44 références d'action et leurs paramètres effectifs, ainsi que
les 45 paquets publics et leurs 229 images strictement identiques. Quinze
commandes pointées ont le même JSON brut ; 29 commandes scalaires ajoutent
uniquement le champ de transport vide `data:{}`. Les 44 plans complets et
44 derniers événements Kernel sont comparés sur tous leurs champs : sur
54 910 nombres, l'écart maximal est de `7.105427357601002e-15`. Les empreintes
de cache sont recalculées sur leurs contenus avant le rapprochement des
références. Les angles, signes, trajets et rationnels ne sont pas ignorés.

La source Python partage certains dictionnaires `outputs` et `input_steps`
entre événements. L'acquisition d'un paquet enrichit rétroactivement neuf
émissions précédentes. Le journal natif fige chaque émission puis ajoute le
reçu du paquet. Cette extension est déclarée sous
`immutable_linked_packet_emission_receipts`.

Un traceur de retour en lecture seule capture la source à l'instant d'émission,
sans remplacer sa fonction. Les références vérifient chaque ancien contenu,
chaque enrichissement ultérieur et l'état courant après le paquet. Les 53
émissions sont couvertes par les fixtures et les tests ; le rapport réel de
campagne expose le dernier événement acquis de chacun des 44 préfixes. Les
preuves ne confondent pas ces deux projections.

## Extension de support visuel pour ZIPP

Le défaut du composant reste conforme à la source : des paires d'anneaux
concurrentes entraînent un refus. L'option native
`structural_cell_support_disambiguation_for_trace_marks` ne s'active qu'après
ce refus et demande un témoin visuel étroit : matériau du support courant,
anneau occupant les bornes de la cellule, marque intérieure concentrique
unique et au moins trois cellules pleines homologues sur les deux axes.
Le choix précède tout calcul de parcours. Une autre interprétation compatible
ou des homologues insuffisants maintiennent le refus.

L'entrée du niveau 5 apporte 18 homologues visibles. La première action reste
une expérience isolée. Son retour change le matériau du centre du marqueur :
la projection attendue est enregistrée `ordered_trace_projection_refuted`.
Ce résultat n'est pas converti en acquisition réussie d'une loi de marque.
Le retour est ensuite directement mesurable par l'observateur source, qui
termine ce niveau un coup à la fois. La
[comparaison de l'extension](native-campaigns-v47/zipp-trace-extension-comparison.json)
sépare la conservation des quatre premiers niveaux, l'interprétation native,
la contradiction et les frontières officielles effectivement obtenues.

Au niveau 6, un diagnostic hors ligne sur le paquet public d'entrée construit
déjà une trace de 25 cellules, en 48 visites de recherche. Le caller réel choisit
cependant d'abord une sonde `animated_contact`. Après cette action, le modèle
de trace ne produit plus de suffixe couvrant et le caller s'arrête. Ce diagnostic
identifie une question de coordination ; il ne constitue pas une résolution
du niveau 6 et ne prouve pas son impossibilité.

## Panneau allégé et dimensions stables

Le panneau « Solve with SRA. » conserve le titre, les commandes d'exécution,
les trois compteurs et un statut bref. Les paragraphes de migration et de
budget local, le sous-titre redondant et le nom interne du programme quittent
ce panneau. Les détails techniques restent dans l'inspection, fermée par défaut.
Les messages d'arrêt et d'erreur restent disponibles intégralement dans une
zone défilable et accessible au clavier.

La vibration provenait de l'étirement de la colonne du plateau à la hauteur
du panneau droit, combiné à son centrage vertical. `align-self:start` donne à
la colonne sa hauteur propre, déterminée par le carré de jeu et ses marges.
Le statut réserve une hauteur constante. Les mesures du navigateur sont
conservées dans la [vérification visuelle](native-campaigns-v47/sele-browser-verification.json),
avec les empreintes des fichiers UI, les rectangles en coordonnées document,
les captures et les changements de statut. Le plein écran est indisponible
dans ce navigateur de contrôle ; son refus conserve la disposition normale.
À la largeur vérifiée, le canvas reste à 384×384px, sa colonne à 442px et
le statut à 98px pendant les actions. Il ne s'agit pas d'une prétention de
mesure de tous les appareils ou de toutes les dimensions de fenêtre.

## Vérifications et avancement

Les [références Linked Packet](../../tests/v6-linked-packet-reference.test.ts)
comparent 100 vues initiales, 47 cas contrôlés, neuf paquets datés et 44 enveloppes
communes. Les [65 contrôles du sous-kernel exact](../../tests/v6-visible-box-ray-reference.test.ts)
incluent 62 cas source. Quatre tests Kernel Linked, neuf tests de l'extension
visuelle et les contrôles des couches communes complètent la suite ciblée.
Les reçus de [tests](native-campaigns-v47/validation/delta-tests-final.json),
de [typecheck, audits et build](native-campaigns-v47/validation/checks-run.json)
et la [validation finale](native-campaigns-v47/validation.json) donnent les
comptes réellement exécutés et leurs empreintes.

Les **664 contrôles distincts de la version finale passent**. Le premier passage
réussit ses 664 vérifications fonctionnelles, mais son contrôle d'immuabilité
des tests échoue correctement : une assertion de provenance a été ajoutée dans
un unique fichier pendant l'exécution. Son reçu reste intact. Les 55 tests de
ce fichier sont relancés seuls ; les 609 autres gardent leurs fichiers,
fixtures et sources inchangés. Le reçu final compose explicitement ces deux
preuves, sans annoncer une unique exécution gelée ni transformer les
719 vérifications exécutées au total en couverture supplémentaire.

Quatre régressions sur les retours publics conservés couvrent STCK, CATL, LF52
et TICT. Elles recalculent les commandes avant de fournir chaque retour
enregistré ; ce ne sont pas quatre nouvelles victoires en environnement vivant.
Les [comparaisons](native-campaigns-v47/regression-summary.json) vérifient les
paquets complets, les entrées sélectionnées et les projections acquises
déclarées. La suite historique entière n'est pas relancée sans risque concret.

L'implémentation est `logos-engine.typescript.v6.native-migration/0.17.0`.
Ses [158 fichiers natifs gelés](native-campaigns-v47/source-manifest.json)
ont pour empreinte
`2f8f5d8660716e44e81fa987d08264324f61838c81ba9e96b2e64f69c136d100`.
Ils restent inchangés pendant les campagnes et la validation.

**Avancement mesuré : 38 entrées DRM connectées sur 76, soit 50,0%, contre 48,7%
en v46.** Cet indicateur compte les entrées explicitement enregistrées dans
quatre listes source, avec le même poids pour chacune. Il ne mesure ni une
proportion de jeux gagnés, ni le volume de code, ni une parité V6 complète.
Les six critères de migration complète restent ouverts.

**Prochaine étape :** résoudre la coordination générique entre une composition
actuelle soutenue par les observations et une sonde concurrente, en partant de
la frontière publique conservée au niveau 6 de ZIPP. La règle devra exiger des
preuves acquises et les gardes courants, puis être vérifiée sur les trajectoires
déjà acquises, sans condition sur le jeu ou son numéro de niveau.
