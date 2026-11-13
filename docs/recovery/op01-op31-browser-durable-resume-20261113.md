# OP01–OP31 : continuité durable du navigateur

Date : 13 novembre 2026

## Références

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique : `recovery/site109-reconstruction-20261112` ;
- branche de travail : `op01-op31-browser-durable-resume-20261113` ;
- canonique final inclus : `e465e78aa48b69e81e8b5afadbc094428387cfe9` ;
- merge final de réconciliation : `a8d4615b08c2beac9e44d3963a4a7b490b08716d` ;
- commit déclencheur : `00fa3deb1d937c3bfb21b01406f192f9c7de5096` ;
- run GitHub Actions : `43443562882` ;
- job : `131947080084` ;
- preuve structurée : `docs/recovery/op01-op31-browser-durable-resume-qualified.json`.

## Objectif

La tranche rend durable une frontière Agent sans sérialiser le processus Python. Elle lie un checkpoint Agent à un journal runtime déterministe, à l'identité de chaque observation et à un replay vérifié avant restauration de l'Agent. Une sauvegarde Agent seule est refusée ; toute divergence invalide la reprise et force un chargement frais.

## Architecture durable

`BrowserGameRuntime` conserve une suite contiguë de commandes publiques. Chaque commande réglée est liée au digest de son observation et une seule commande réellement envoyée peut rester en attente. La restauration crée un worker neuf, rejoue les commandes réglées et vérifie chaque observation. Une action en attente est rejouée exactement une fois pour reconstruire le runtime ; ce replay ne constitue pas une nouvelle décision de l'Agent.

`BrowserDurableSessionStore` lie le journal et le checkpoint Agent, préserve les `Uint8Array`, impose la même observation et la même action en attente, expire après 12 heures par défaut, refuse plus de 24 heures et borne la charge à 4,5 Mo. `main.ts` sauvegarde sur `pagehide` avant destruction, restaure le runtime avant l'Agent et invalide la reprise sur action Manual ou remplacement de jeu.

## Preuve durable Chrome/Pyodide

Le scénario emploie deux vies de page dans un profil Chrome neuf : chargement SMLP niveau 1, envoi physique d'ACTION6 `(32,26)`, sauvegarde avant acquisition, rechargement complet, worker Pyodide neuf, replay `load + ACTION6`, vérification du retour, puis acquisition avec le même `needId`.

Résultats :

- backend : `python-wasm` ;
- pixels modifiés : **9** ;
- même `needId`, même `sessionId` et compteur final **1** ;
- appels Agent à `action()` après restauration : **0** ;
- secondes présentations : **0** ;
- acquisition routée, non duplicate.

## Fixture canonique complémentaire requalifiée

La tête canonique ajoute une fixture indépendante de reprise de session en mémoire sur deux vrais Workers Chrome/Pyodide. Elle a été réexécutée dans le même run final :

- vrais Workers qualifiés : **2** ;
- actions physiques qualifiées : **2** ;
- réactivation contrôleur : **1** ;
- retour envoyé repris : **1** ;
- actions rejouées par le contrôleur : **0** ;
- présentations dupliquées : **0**.

Cette fixture complète la preuve durable : elle qualifie les frontières host/contrôleur dans une même vie de runtime, tandis que la preuve durable qualifie le rechargement de page et la reconstruction d'un worker neuf.

## Qualification globale

- tests ciblés continuité durable : **34/34** ;
- contrats de la fixture canonique : **5/5** ;
- régression TypeScript complète : **413/413** ;
- échecs, annulations, ignorés et TODO : `0` ;
- registre V6 : valide ;
- build production : réussi, **67** modules, 100 jeux, 636 prévisualisations et 4 atlas natifs ;
- deux vulnérabilités de dépendances de sévérité haute, préexistantes, restent signalées par `npm ci`.

## Disposition C1

**La continuité durable est qualifiée sur la tête canonique `e465e78aa48b69e81e8b5afadbc094428387cfe9` pour une frontière ACTION6 SMLP réelle : stockage local versionné, `pagehide`, rechargement, worker frais, replay vérifié, même `needId`, acquisition unique, aucun nouvel envoi Agent et aucune seconde présentation. La fixture canonique complémentaire est également requalifiée.**

## Frontière de preuve

Cette qualification ne revendique pas un snapshot brut du tas Python, un crash sans `pagehide`, une couverture multi-navigateurs ou de tous les jeux, une récupération inter-appareils, une continuité au-delà de 4,5 Mo, une surcharge sous le seuil de 10 %, ni une publication Site.

## Étape suivante

Qualifier le crash sans `pagehide`, un second navigateur et les journaux longs, puis mesurer séparément le coût du stockage et du replay.
