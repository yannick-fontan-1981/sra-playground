# Opérateur de qualification

Le premier essai fige Agenda à `475044aa` et les situations à `fa627087`. [Référence et verdict agrégé à communiquer](BILAN.md) · [Reçu détaillé de l’opérateur](mesure-475044aa.json)

## Rejouer la mesure

Depuis `experiments/symbolic-situations/ressource`, préparer la réserve puis lancer les six départs. Le lanceur PowerShell choisit un Node.js 24 ou ultérieur sur le PATH. Avec ce runtime actif, la commande portable équivalente est `node qualification/operer.mjs`.

```powershell
node generate.mjs --reserve
.\qualification\qualifier.ps1 -Rapport generated/mesure.json
```

L’opérateur relit uniquement le dossier `public` du lot. Les états initiaux et les retours viennent du simulateur déjà livré. Le choix du monde et le journal restent côté opérateur. Le reçu conserve l’empreinte de la fiche réellement présentée, celle de chaque fichier du solveur, chaque commande, son retour, le premier écart et le verdict de chaque départ. L’agrégat sépare les incompatibilités initiales, les commandes refusées, les victoires, les défaites et les interruptions.

Le rejeu hors ligne utilise les trois blobs d’Agenda présents dans la base Git locale au SHA complet du reçu. Il appelle directement l’interface `PartiePublique` du lanceur d’origine, dont le chemin de fiche est fixé en dur. Le transport standardise les fins de ligne et retire le dernier saut de ligne comme le faisait ce lanceur. Le solveur garde ses méthodes d’origine `next()` et `record(action, feedback)`.

## Exécuter un autre solveur

Le point d’entrée accepté localement est un exécutable JavaScript autonome au format `.mjs`, avec ses dépendances applicatives incorporées. Pour développer sur le jeu de mise au point, utiliser la commande suivante :

```powershell
.\qualification\qualifier.ps1 -Lot exemple -Solveur D:\outils\solveur.mjs
```

Les échanges sont en UTF-8, à raison d’un objet JSON par ligne. Les accolades ci-dessous décrivent le transport et les contenus entre chevrons sont à remplacer.

| Émetteur | Moment | Ligne |
| --- | --- | --- |
| Opérateur | Ouverture | `{"fiche":"<texte public complet>"}` |
| Solveur | Décision | `{"action":"<une commande>"}` |
| Opérateur | Réponse à cette commande | `{"retour":"<retour public>"}` |
| Solveur | Format incompatible, avant toute commande | `{"incompatible":"<raison>"}` |
| Solveur | Arrêt volontaire | `{"arret":"<raison>"}` |

Après un retour terminal, l’opérateur ferme l’entrée standard. Une commande refusée laisse la partie ouverte. L’opérateur relève le premier écart même si une commande ultérieure termine la partie. Une absence de réponse pendant cinq secondes, un message mal formé et la limite de 32 commandes proposées disposent de verdicts techniques distincts d’une défaite dans le jeu.

## Isolation contrôlée

Chaque processus est lancé dans un nouveau dossier temporaire contenant uniquement son programme. L’opérateur n’hérite aucune variable d’environnement applicative vers le solveur. Le lancement Node autorise la lecture du seul dossier de programme, sans autorisation d’écriture, de sous-processus ou de workers. Aucun numéro de monde, graine, chemin de fiche ou chemin de rapport ne figure dans les arguments ou les messages du solveur de la mesure.

Les tests passent un fichier témoin privé à un solveur de contrôle, constatent le refus effectif de lecture et d’écriture et vérifient les messages reçus. Le contrôle positif utilise la même isolation pour le cadran. La portée de ce contrôle est l’interface standard et les permissions locales du runtime sur des solveurs de confiance. L’isolation réseau et l’exécution de binaires natifs tiers demanderaient un bac à sable système.

```powershell
node --test qualification/test.mjs
```
