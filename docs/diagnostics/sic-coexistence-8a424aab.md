# Dix lignes SIC dans un même moteur

**Les témoins des lignes 1, 15, 16, 18, 23, 83, 87, 90, 91 et 98 passent ensemble sur `8a424aab6ca2e2f6b902cc4b9c89313ed6947b74`.** Le parent direct est l’assemblage à six lignes `1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d`. Le second assemblage conserve son moteur et y applique six fichiers supplémentaires. Sur le gel, le diff total est de 17 fichiers, tous dans `src`. L’identifiant d’arbre `src` est `72a1ae12b35e273d6817b8dfe70780638e1cc138`. [Premier assemblage](sic-coexistence-1afdede0.md) · [Diff des deux moteurs](https://github.com/yannick-fontan-1981/sra-playground/compare/1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d...8a424aab6ca2e2f6b902cc4b9c89313ed6947b74)

| Source des nouveaux apports | Fichiers moteur apportés | Recouvrement contrôlé |
|---|---|---|
| ZIPP/1 `16f3c5e8` | `v6-contextual-translation.ts`, `v6-native-caller.ts` | Le même appelant peut prendre la réplication ou l’essai P05. Les deux bras d’époque ont été rejoués. |
| G50T/18 `1a1cc965` | `v6-linked-temporal-contact.ts`, `linked-contact-step.ts` | Les mesures et l’origine du changement distant gardent leurs tests de discrimination. |
| DICO/98 `e2178163` après DICO/87 `c0b9f402` | `v6-observed-frontier.ts`, `opening-curiosity.ts` | Le diff part de 87, déjà dans le parent. La ligne 23 utilise aussi la frontière observée. Son témoin G50T produit la même empreinte après l’apport 98. |
| AS66/83 `1aaafe36` | Comportement déjà présent au gel | Le test d’offre fraîche et celui d’offre périmée tournent sur l’assemblage. |

Les quatre lignes 15, 16, 23 et 83 sont attribuées au gel. Les six autres utilisent les apports qualifiés sur branche. Les lignes 61, 92 et 96 gardent leurs preuves séparées. Les sources d’expérience, les dossiers de qualification et le correctif du récepteur FOGW sont extérieurs au diff moteur.

## Témoins exercés

TypeScript passe avec `--noEmit`. Les **256 tests des 20 suites passent**, sans test sauté. Les rapports supplémentaires conservent les offres, le ticket émis et le retour pour les deux époques de ZIPP, les départs de G50T/23 et les départages de DICO. Les tests des différentes branches qui portent le même nom de fichier sont exécutés séparément dans le harnais. [Rapports et reçus ciblés](sic-coexistence-8a424aab/temoins.zip)

| Ligne | Résultat sur le moteur à dix lignes |
|---|---|
| 1 · ZIPP | Au T15, la réplication délivre `ACTION2`. Prévision (0,12), mouvement (0,0). Si le seul essai appartient à l’époque antérieure, le service délivre encore `ACTION2` pour une sonde P05. Les captures ordonnées de 16 et 15 tickets reproduisent les deux reçus épinglés. |
| 15 · LOGI/REWI | LOGI choisit le contrôle lié aux afficheurs et qualifie son retour. REWI ouvre son propre besoin. Déplacer le récepteur discriminant modifie le clic et un retour illisible conserve l’incertitude. |
| 16 · UPST/EVAS | Le clic discriminant d’UPST est suivi d’une nouvelle question. EVAS compare les trois modèles survivants au tour suivant. L’épuisement des comparaisons rend la main à la frontière. |
| 18 · G50T | Le pas mesuré mène à l’approche, puis au contact T8 et à 23 pixels modifiés dans la région liée. Un retour modifié ailleurs ne fournit aucune preuve d’effet distant. |
| 23 · G50T | Le besoin du T1 reçoit son retour, puis le service ouvre la question du T2. Le rapport de développement complet garde l’empreinte `edd9fce36b04b761afe1df0a9459ef68c055e9bcd536e7e02de284724b96ff6b` sur le fichier de frontière partagé avec 98. |
| 83 · AS66 | Sondes T6/T7, puis accès. L’autre offre fraîche déplace le carré jusqu’en (28,26) et entraîne `ACTION2`. Une offre ancienne est refusée après le changement de révision. |
| 87 · DICO | En mode catalogue, le clic (6,3) obtient LOCAL. L’autre optimum (27,3) obtient GLOBAL. Les deux retours conservent {1,5}. Le contrôle en curiosité concorde aussi. |
| 90 et 91 · LS19 | L’approche du bord et la répétition après immobilité passent dans le même service. Les tests couvrent leurs offres et refus, la clôture du T13 et la reprise au ticket 14. |
| 98 · DICO | Les 147 offres à l’ouverture reproduisent le classement attendu. Le ticket (25,36) termine L1. Sur le même ensemble, l’ordre inversé donne (37,36) et la permutation des deux premiers maxima donne (32,35). Les deux retours laissent L1 en cours. |

## Non-régression sur les 107

**107 jeux sur 107, 692 niveaux sur 692 et 18 560 commandes autorisées.** Les reçus concordent avec le gel et avec leur ligne correspondante dans l’archive du premier assemblage. Chaque jeu a été effectivement rejoué depuis L1 avec un worker et ses plafonds historiques. Les 107 codes sont uniques. SNAR termine 6/6 en 163 commandes, SS01 8/8 en 444 et SS04 8/8 en 443. Les deux derniers ont chacun exécuté un reset. Aucun undo sur la campagne. Les champs comparés incluent effets ordonnés, budgets, scores, séries, types de trajets, reprises, arrêts et empreintes de niveau. L’identité détaillée des offres et des preuves est établie pour les témoins dont les traces ont été capturées. [Index des 107](sic-coexistence-8a424aab/qualification.json) · [Reçus originaux](sic-coexistence-8a424aab/recus.zip)

Le workflow `5b3e5ce4d4aded3e9b0dde818ccba74eb9aa3a0a` ajoute uniquement le lanceur au moteur. Le 27 novembre 2026, les contrôles ont duré 12 min 50 s (23:15:04–23:27:54 UTC), avec 24 lots et un pic de 20 simultanés. Les étapes de rejeu ont cumulé 6 257 secondes de runner. La reprise a traité 3 nouveaux reçus, puis 104 nouveaux et 3 réutilisés, puis 107 réutilisés sans écart. [Exécution GitHub](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46081419187) · [Horaires par lot](sic-coexistence-8a424aab/horaires.json)

Pour vérifier hors ligne la composition des moteurs, le rattachement des reçus et le verdict sous les plafonds historiques, exécuter depuis le banc après avoir récupéré les branches moteur et CI.

```powershell
py scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-8a424aab/recus.zip --candidate 8a424aab6ca2e2f6b902cc4b9c89313ed6947b74 --workflow 5b3e5ce4d4aded3e9b0dde818ccba74eb9aa3a0a --run 46081419187
```

## Reproduire les témoins

Depuis la branche du banc, avec un checkout propre du moteur `8a424aab` dans `$moteur`, Node 24.22.3, les dépendances verrouillées et les jeux préparés, choisir deux nouveaux dossiers de sortie. Les scripts vérifient le SHA et utilisent les fixtures des révisions qualifiées. Le second rejoue les deux justifications ZIPP et les trois sélections DICO/98 sur le vrai service.

```powershell
git fetch origin
py scripts/test-sic-coexistence.py $moteur ./dix-temoins --node node
py scripts/test-sic-coexistence-offres.py $moteur ./dix-offres --node node
```
