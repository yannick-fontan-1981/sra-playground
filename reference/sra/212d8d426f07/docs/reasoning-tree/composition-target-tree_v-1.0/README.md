# Arbre cible de composition v1.0

> **Public-copy note:** Only internal link formatting has been adjusted in this copy. Links to project files outside the selected export are shown as source paths. Provenance is recorded in the snapshot’s root README and manifest.

[Lire l’arbre v1.0](../composition-target-tree_v-1.0.txt).

## Réconciliation courante —17octobre2026

Le snapshot public examiné est **`effe5dee8311060ecb99cd280bcd47e679e9880f`**,
manifeste exact **`f0ff0da78a68acaa1496599e1d9cc5fc346837fcadd11768509ca541ba783b20`**.
Il contient **289 clés :190 codées,97 partielles,2 planifiées**, soit134 clés de
plus que le premier état155 conservé ci-dessous. Les ajouts privés ultérieurs
ne sont pas assimilés à ce `main`.

La réconciliation examine les339 couples de preuves actifs, leurs678 extrémités,
les appels et registres Python, les workflows SRC et les déclarations DRM.
**45/190 clés codées** ont tous leurs couples reliés par les chemins statiques
explicites de cet index. Pour les145 autres, au moins un raccord complet n'est
pas établi par cette analyse ; cela ne prouve pas une absence de code. Les
ancres courantes et les sources historiques restent distinguées.

**2 clés sont observées sélectionnées sur le manifeste exact**,11 sur des
sources historiques seulement, et276 n'ont pas d'attribution native nominative
retrouvée. Une sélection n'est pas automatiquement une libération, un transfert
ou une preuve de nécessité. Les22 clés munies d'un marquage runtime ne sont pas
comptées comme utilisées du seul fait de ce marquage. Aucun nouvel essai natif
ni test unitaire n'a été lancé ; aucun fichier runtime ou clé normative modifié.

- Bilan lisible et index des289 clés — `reconciliation_main_effe5dee_20261017.md`.
- Raccords source et observations exactes — `reconciliation_main_effe5dee_20261017.json`.
- Trois revues ciblées de repères historiques — `reconciliation_reviews.json`.

Le générateur vérifie désormais les empreintes et les lignes des ancres
actuelles sur le commit Git immuable, le manifeste complet et les artefacts
d'attribution, en plus des références historiques. `validation.json` conserve
séparément ces résultats ; un simple `--write` ne vaut pas vérification source.

```text
python docs/reasoning-tree/composition-target-tree_v-1.0/generate.py --check --verify-source
```

Pour une nouvelle réconciliation, utiliser l'outil créateur
`tools/reconcile_v5_composition_tree.py --commit <SHA-main> --output <rapport.json>
--markdown-output <bilan.md> --require-committed-tools`, puis adopter le rapport
avec `generate.py --write --verify-source --adopt-reconciliation <rapport.json>`.
Les états historiques restent conservés. Une clé nouvelle ou un contrat modifié
ne reçoit pas automatiquement la preuve d'un ancien snapshot.

## Historique des états et décisions conservés

Cette version regroupe les propositions du document des 100 jeux L1 — `../COMPOSITIONS_COMPLEXES_L1_100_JEUX_TRAVAIL_20261014.md` en **18 familles génériques**. Elle rapproche la cible de composition des chemins réellement présents dans une source C figée au commit `ee53c5db35e830236f597a5a6189f7c31688993b`.

V1.5 reste l’autorité normative. La v0.1 et sa spécification complémentaire sont conservées ; aucun de leurs fichiers n’est réécrit par cette version. Le TXT n’est pas une entrée du solveur et ne crée aucun raccord runtime.

## Signification du suffixe

| Clé | Sens |
|---|---|
| `[composition.exemple]` | Code réellement présent et raccordé, avec une portée précise, un producteur et un consommateur identifiés. |
| `[composition.exemple?]` | Travail restant sur le contrat décrit : implémentation, acquisition, raccord, agrégation ou intégration. Des sous-mécanismes peuvent déjà être codés. |

Un parent marqué `?` peut contenir des enfants codés. Un enfant codé ne ferme pas le contrat générique du parent. Un calculateur consommant un modèle fourni peut donc être codé alors que la formation du modèle depuis les observations et son insertion dans la frontière commune restent à faire.

La présence source n’est pas une preuve d’usage, de victoire, de transfert ou de rapidité. Les états de ce registre de composition ne modifient aucun état du suivi historique V1.3/V1.5.

Deux limites sont explicites : la migration de l’optionalité de la conscience garde des obligations héritées de contexte dans la source C auditée ; la garde anti-resets consécutifs publiée dans A n’est pas déclarée intégrée à C sans preuve de ce raccord. Les validations indépendantes de WHY, portée et permis sont conservées.

## Fichiers

- `registry.json` contient les clés, adresses, états, portées, preuves et limites ; il relie également les 100 fiches aux familles.
- `generate.py` produit le TXT et contrôle la structure et les suffixes.
- `validation.json` conserve le résultat documentaire courant : 155 clés, 58 codées, 97 avec `?`, 18 familles et 100 jeux ; les empreintes de 95 entrées source et 148 références producteur/consommateur ont été vérifiées. Les apports A/B/D sont vérifiés à leurs révisions propres, séparément de la source C. R13 atteste la question de panneau positive, R17 celle du catalogue suivant et R22 le panneau causal jusqu'au succès GRIL L1 ; l'identification complète et le transfert restent ouverts. Après union avec main, l'adresse2.17.1 reste celle de la contribution causale B ; la question de champ D conserve sa clé stable à l'adresse2.17.4 (anciennes preuves inchangées).

La source de départ v0.1 a été photographiée pendant le travail de C ; son empreinte documentaire est distincte du commit figé utilisé pour l’audit du code. Le registre conserve cette provenance et ne prétend pas qualifier les changements ultérieurs de C.

Delta DICO après union HANO/SEQN : 158 clés, 61 codées, 97 avec `?`,
105 entrées source et 158 références vérifiées. La clé étroite2.11.4 décrit
la chaîne native R06 de six actions ; la frontière générale2.11.2 reste ouverte.
Le package R06 conserve ses limites et ne revendique pas l'appel de la façade
typée complète. Ce raccord supplémentaire R07 est désormais qualifié : cinq
contrôles source et un natif frais six actions, cinq appels FIT scellés COMPLETE,
médiane4,422s/n6. Cela ne qualifie ni les autres modes/lois ni le transfert.

Union A/B/D R09 en préparation sur main16fcc0d97 :171clés,74CODED,97?,
143entrées source et206références vérifiées. Collision d'adresses résolue en
gardant MEMO B2.11.4 et DICO D2.11.5 ; identités stables inchangées. Les totaux
R08 suivants restent historiques, pas une perte de qualification.

Union C/D R08 : 162 clés,65 CODED,97?,109 entrées source et166 références
vérifiées. Les doublons identiques de feuille ne créent pas une nouvelle clé.
Natif DICO sur manifeste45d460e0 : six actions préparées, médiane4,375s/n6 ;
aucune clé supplémentaire, ni transfert général, ni objectif2s attesté.

## Reproduction

Depuis un checkout possédant les objets Git du commit de référence :

```powershell
api/.venv/Scripts/python.exe docs/reasoning-tree/composition-target-tree_v-1.0/generate.py --check --verify-source
```

Pour une copie source C exacte déjà disponible, utiliser `--source-root <racine>`. La racine doit contenir `agents/yf_arc3_v5/`. La référence A de la garde anti-resets reste vérifiée dans les objets Git à sa révision propre. Les fichiers sont vérifiés par empreinte ; le runtime n’est pas importé.

Après une modification voulue du registre :

```powershell
api/.venv/Scripts/python.exe docs/reasoning-tree/composition-target-tree_v-1.0/generate.py --write --verify-source
```

Ces commandes sont des contrôles documentaires. Elles ne lancent aucun jeu, test unitaire, profilage, compilation SRC ni campagne de qualification comportementale.

## Faire évoluer une clé

Préciser d’abord le contrat générique et sa portée. Pour retirer un `?`, identifier l’implémentation, le producteur et le consommateur réels dans une révision source précise, conserver leurs références et empreintes, puis placer l’état du nœud à `coded` et régénérer le TXT. Une déclaration passive ou un appel typé dont l’acquisition manque ne ferme pas un contrat plus large.

Actualiser les références quand la source de référence change. Conserver séparément les dettes de qualification d’usage, de transfert et de performance ; une victoire seule ne retire pas le `?` d’un mécanisme générique.

## Principe de curiosité artificielle — décision du 14 octobre 2026

Créer une curiosité artificielle visant une stimulation intellectuelle maximale en recherchant systématiquement la composition la plus complexe accessible. La complexité désigne les relations, transformations, mécanismes et contraintes distincts mobilisés ensemble dans une même configuration réalisable ; elle ne se mesure pas au nombre de clics ni à la durée du raisonnement.

Une composition est accessible lorsque ses participants sont actuellement identifiés et ses moyens disponibles, ou qu’une expérience bornée et interprétable peut qualifier le lien encore hypothétique. Les contraintes actuelles, les effets attendus et les falsificateurs restent explicites. Préparer ce que le traitement général ferait naturellement : reconnaître les conditions, appeler les calculateurs et continuations existants, puis conserver la cible pendant sa réalisation. La curiosité ne rend pas obligatoire un étage supplémentaire de conscience opérationnelle.

Dès que le curseur, son image symétrique et un objet de même forme sont identifiés, viser la superposition de cette image et de cet objet. Composer le contrôle du curseur, la transformation symétrique et l’alignement des masques ; qualifier le déplacement encore inconnu par une action informative utile à cette cible. La clé `composition.curiosity.maximal_accessible_stimulation?` reste ouverte tant que sa reconnaissance et sa comparaison génériques ne sont pas raccordées et vérifiées.

## Retrait immédiat du ? — précision utilisateur du 14 octobre 2026

Retirer immédiatement le ? dès que le contrat écrit de la clé est réellement implémenté avec producteur et consommateur raccordés et qualifiés à une révision source précise. Suivre séparément usage, victoire, transfert et performance ; une clé plus large reste ouverte si son contrat entier ne l’est pas. Le calcul des masques et résidus utilisé pour AR25 est désormais identifié sans `?` à sa portée exacte (`composition.family.geometric_correspondence.measured_mask_residual`).

## Progression du but par la curiosité — précision du 14 octobre 2026

Toute exploration curieuse est systématiquement considérée comme une progression du but actif en tant qu’expérience à fort potentiel de retour d’information. Son WHY conserve le but poursuivi, la question testée, les observations attendues et les falsificateurs, puis le retour obtenu conditionne la continuation ; un retour négatif peut faire progresser la connaissance sans établir la configuration physique visée. Le raccord AR25 reprend le contrat de progression du but qui était présent dans la réussite historique ; la couverture de toutes les expériences reste suivie à part.


VALV Mac02 R04 : ajout2.7.8 pour la composition observée fourniture/restauration/isolation/continuation terminale.238clés,139CODED,99? à ce checkpoint. Usage natif8actions sur Source7b636388 ; parents2.7 toujours ouverts, pas de modèle quantitatif universel ni preuve de transfert ou base canonique non vide.

R08 final : continuité productive rétablie devant une question de surface apparue sur l'union DAME/HPDL ; VALV8 sur Source2c6fd413 et RECR4. HPDL5 échoue aussi avec les règles de main recompilées : contraste borné, aucune préservation de victoire HPDL revendiquée. La base canonique exportée reste vide.


## LIFE mac-03 — 16 octobre2026

La clé précise `composition.family.resource_transaction.observed_complementary_replacement_product_receptacle_questions`
(2.8.6) décrit les questions existantes de sélection/compatibilité, remplacement,
produits et correspondance visible sous le même parent. Source da030a05, révision
0bd73ff81 : LIFE L1 frais score1/L2 en14 primitives ; les14 WHY/permis exécutés
sont corrélés aux14 sélections de cette clé dans `choose_information_probe`.
Une projection passive supplémentaire de rétrospection n'est pas une action.
La question exploratoire générale cède aux correspondances actuelles déjà uniques.
Les familles larges2.8/2.14 restent ouvertes : filiation typée, noyau orienté,
mémoire d'épisode, affectation globale, transfert et rapidité non qualifiés ici.
La nouvelle réussite ne rejoue ni ne prouve la campagne des25 jeux.


## Union finale avec VALV et SIGN — 16 octobre2026

Base main `c9932a4cc6397be9f29d05067b44e5035bda9947`, candidat merge `14b4922d6c7a57d5e58cab7479514c7c521c382c`, Source `8b953b36062c3ef6be47570c9294d42a5b04fc837a7bc31603c5963b333d4a8c`.
Les2692 fichiers runtime Git/physiques/qualification/cache concordent ; source5/5,
déterminisme, catalogue statique et isolation passent. Conflits résolus sans
perdre les règles/clés VALV et SIGN : après retrait des cinq activations et des
deux gardes LIFE, le DRM combiné est structurellement identique au main publié.

LIFE L1 frais : score1/L2,14 primitives, 185.62s incluant démarrage
et export compact créateur ; médiane isolée5.8895s.
Quatorze choix de la clé2.8.6 correspondent exactement aux quatorze WHY/permis
exécutés sous le parent produit/réceptacles ; aucun acteL2. Une projection passive
de rétrospection supplémentaire est exclue. DAME préservé en11
primitives et CASC en8 sur ce même manifeste.
Paquet compact MAIN à quatre fichiers et preuves MAIN_SOURCE/MAIN_TARGETED
conservés. Huit fichiers préexistants inventoriés restent byte-identiques.

Campagne25 explicitement omise pour ce lot, aucun test unitaire/profiling.
Ni préservation globale, filiation typée complète, mémoire L2, affectation globale
ou gain de rapidité inférés. La clé précise est codée à sa portée ; les parents
larges et les TODO historiques restent ouverts. Publication vérifiée séparément
par le reçu MAC03_LIFE_MAIN_ADMISSION_20261016.json sous le verrou commun.


ESCT L1 — mac03,2026-10-16 : feuille fine2.15.4
`observed_announcement_tool_intervention`, qualifiée sur5c917df35/source00278929.
Le natif20 conserve le bénéficiaire jusqu’au score officiel1. Quatre groupes
sélectionnés portent dix occurrences agrégées ; cinq extrémités de décision
sont directement liées aux WHY/ACT exécutés. Ces dix occurrences ne sont pas
présentées comme dix preuves individuelles. La famille2.15 reste partielle ;
aucun modèle futur global, transfert L2, gain de vitesse ou préservation25 inféré.
Publication main non encore faite : fenêtre A en cours, union publique finale
et ses validations ciblées encore requises.


Raccordement du catalogue2026-10-16 : D2.15.4 décrit le transit configuré de
paquets, distinct de notre outil/annonce/intervention. La clé stable ESCT
`composition.family.autonomous_response.observed_announcement_tool_intervention`
a désormais l’adresse2.15.5. Les preuves/captures5c917df35/source00278929
conservent leur ancienne adresse2.15.4 : ne pas les renommer rétrospectivement.
Seules trois métadonnées runtime d’adresse changent ; une nouvelle qualification
et une nouvelle preuve sur l’union exacte sont requises avant main.

## D — port sur le C+FITE publié, 16 octobre2026

Main4de067c67 / Source63 contient les quatre réparations de prémisses,
qualifiées5/5 avec sept réussites ciblées. R645 vérifie7origines de permis,
8événements avant/template/gel et16occurrences de champs originaux nonvides,
pas16claims distincts. D porte quatre feuilles précises, sans ancien kernel
privé ni changement runtime : SMLP2.15.4, RECR2.14.7, DAME2.11.6 et
RSWP2.13.7. TRIA reste distinct, sans écrasement de cette dernière adresse.

249clés,150CODED,99?,18familles,439entrées source et580références vérifiées
avant l'ajout des attestations courantes, qui n'ajoute aucun lien de source.
Les qualificatifs CODED, usage local, victoire, transfert et performance sont
séparés. DAME conserve sa preuve4364, non réattribuée63 ; Source489 et les
baselines négatives restent historiques. Parents, G03/G04 et transfert ouverts.
Le reçu de publication documentaire D reste séparé de la réception C.
