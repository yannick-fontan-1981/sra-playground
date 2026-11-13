# OP01–OP31 : continuité durable du navigateur

Date : 13 novembre 2026

## Références

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique : `recovery/site109-reconstruction-20261112` ;
- branche de travail : `op01-op31-browser-durable-resume-20261113` ;
- canonique inclus : `549c06dc5ff4d23ecfea92ecfd260896a2a533f3` ;
- merge de réconciliation : `1bd7b8646876ae92ace1215222537b542b688b76` ;
- commit déclencheur : `89979158c27c2b3519ad7157b551189abd0edb12` ;
- run GitHub Actions : `43442779150` ;
- job : `131944377229` ;
- preuve structurée : `docs/recovery/op01-op31-browser-durable-resume-qualified.json`.

## Objectif

La tranche précédente savait restaurer une campagne, son `needId`, son retour en attente et FieldStock dans un host frais. Cette tranche rend cette frontière durable dans le navigateur sans prétendre sérialiser le processus Python.

La règle de sûreté est :

**checkpoint Agent + journal runtime déterministe + identité de chaque observation + replay avant restauration Agent.**

Une sauvegarde Agent seule est refusée. Une divergence pendant le replay invalide l'ensemble et force un chargement frais.

## Architecture

### Journal runtime

`BrowserGameRuntime` conserve une suite contiguë de commandes publiques. Chaque commande réglée est liée au digest de son observation. Une seule commande réellement envoyée peut rester en attente. Deux mutations concurrentes invalident le journal plutôt que d'inventer leur ordre.

La restauration crée un worker neuf, rejoue les commandes réglées et compare chaque observation. Si une action était physiquement envoyée au moment du checkpoint, elle est rejouée exactement une fois pour reconstruire l'état du nouveau runtime. Ce replay appartient à la reconstruction du runtime, pas à une nouvelle décision de l'Agent.

### Codec durable

`BrowserDurableSessionStore` lie le journal runtime et le checkpoint Agent. Le format V1 préserve les `Uint8Array`, impose la même observation et la même action en attente, expire après 12 heures par défaut, refuse plus de 24 heures et limite la charge à 4,5 Mo. Les états expirés, incompatibles, divergents ou surdimensionnés sont effacés.

### Produit

`main.ts` sauvegarde sur `pagehide` avant de détruire le contrôleur et le runtime. Au démarrage, il restaure d'abord le runtime, présente l'observation reconstruite, restaure ensuite l'Agent puis réactive le mode Agent. Une action Manual ou un remplacement de jeu invalide la reprise.

## Preuve Chrome/Pyodide réelle

Le scénario emploie deux vies de page dans un profil Chrome neuf :

1. chargement SMLP niveau 1 sous Pyodide ;
2. préparation puis envoi physique d'ACTION6 `(32,26)` ;
3. retour physique calculé mais retenu avant acquisition par l'Agent ;
4. sauvegarde du journal avec un `load` réglé et ACTION6 en attente ;
5. sauvegarde du checkpoint Agent avec le même `needId` ;
6. rechargement complet de la page ;
7. worker Pyodide neuf, replay `load + ACTION6` et vérification de l'observation ;
8. restauration de l'Agent et acquisition du même retour ;
9. zéro appel Agent supplémentaire à `action()` et zéro seconde présentation.

Résultats causaux :

- backend : `python-wasm` ;
- action : ACTION6 `(32,26)` ;
- pixels modifiés : **9** ;
- `needId` avant/après : identique ;
- requêtes première page : 2 ;
- requêtes de reconstruction : 2 ;
- appels Agent à l'action après restauration : **0** ;
- secondes présentations : **0** ;
- acquisition : routée, non duplicate ;
- compteur d'actions final : **1** ;
- session restaurée : `op01-op31-durable-smlp-session`.

## Qualification globale

Environnement : Ubuntu GitHub Actions, Node `22.18.0`, Chrome headless et archive Pyodide épinglée du dépôt.

- tests ciblés : **34/34** ;
- régression TypeScript complète : **413/413** ;
- échecs, annulations, tests ignorés et TODO : `0` ;
- registre V6 : valide ;
- build production : réussi ;
- modules transformés : **67** ;
- galerie : 100 jeux, 636 prévisualisations, 4 atlas natifs.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant cette tranche, restent signalées par `npm ci`.

## Disposition C1

**La continuité durable est qualifiée pour une frontière ACTION6 SMLP réelle sur Chrome/Pyodide : pagehide, stockage local versionné, rechargement, worker frais, replay vérifié, même `needId`, acquisition unique, aucun nouvel envoi Agent et aucune seconde présentation.**

## Frontière de preuve

Cette qualification ne revendique pas :

- un snapshot brut du tas Python ;
- un crash sans `pagehide` ;
- une qualification multi-navigateurs ou de tous les jeux ;
- une récupération inter-appareils ;
- une continuité lorsque le journal dépasse 4,5 Mo ;
- une qualification de surcharge sous le seuil de 10 % ;
- une publication Site.

## Étape suivante

Qualifier le crash sans `pagehide`, un second navigateur et la politique des journaux longs, puis mesurer séparément le coût du stockage et du replay avant toute revendication de performance.
