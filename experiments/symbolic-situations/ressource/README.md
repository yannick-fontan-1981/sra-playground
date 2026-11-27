# Lot opérateur · transfert d’une ressource partagée

Le même outil maintient un clapet ouvert pendant une purge, puis sert à sceller un autre poste. Les deux mondes exigent les mêmes opérations matérielles dans des ordres différents. La mesure du cycle en cours peut contredire un relevé archivé. Sur certains montages, l’indexation du second poste ajoute une dépendance et peut laisser deux ordres également courts.

La référence d’Agenda désignée avant exposition est `475044aa`. Les critères et la sélection de la réserve ont été déposés au commit `30cf1f05c5d697eef5b83f7091fa2a45d71fc980`, avant les essais. [Protocole opérateur](PROTOCOLE.md)

## Commandes de développement

Depuis ce dossier, avec Node.js 20 et sa bibliothèque standard :

```powershell
node generate.mjs --seed 17
node verify.mjs generated/17
node --test test.mjs ../test.mjs
```

Les quatre identifiants affichés par le générateur suivent l’ordre du protocole. Le dossier `exemple` contient le tirage 17 déjà généré. L’entrée du rejeu est un fichier Markdown public. L’opérateur reçoit les actions une à une et communique les retours au fur et à mesure.

```powershell
node play.mjs exemple/public/9d6cd17397079244694a.md --monde 1
node play.mjs exemple/public/9d6cd17397079244694a.md --monde 2
```

L’option `--monde` sert à l’opérateur. Sans elle, le rejeu tire un des mondes compatibles au hasard. Une fiche à mesure certifiée admet un seul monde. Les commandes peuvent également arriver sur l’entrée standard, une par ligne.

## Transmission publique

À chaque départ, remettre uniquement le contrat public et le contenu de la fiche choisie dans un contexte agent neuf. Pendant le jeu, transmettre la seule ligne de retour de l’action jouée. Un autre monde compatible utilise exactement la même fiche. [Contrat public d’interaction](INTERACTION.md) · [Exemple public](exemple/public/9d6cd17397079244694a.md)

## Contrôle opérateur

Les corrigés lisibles et le manifeste structuré se trouvent dans `corriges/` du tirage. Les données de réserve restent dans le répertoire local ignoré par Git. [Corrigé de l’exemple](exemple/corriges/9d6cd17397079244694a.md)

```powershell
node generate.mjs --reserve
node verify.mjs generated/reserve
```

La première commande matérialise la graine réservée et imprime les noms des quatre fiches dans l’ordre préenregistré. Pour sélectionner la première fiche sur PowerShell et ouvrir une session :

```powershell
$lot = Get-Content -Raw generated/reserve/corriges/corpus.json | ConvertFrom-Json
$fiche = Join-Path 'generated/reserve/public' ($lot.cases[0].id + '.md')
node play.mjs $fiche --monde 1
```

Remplacer l’index par 1, 2 et 3 pour les autres fiches. Les indices 2 et 3 se jouent chacun avec `--monde 1` puis `--monde 2`. L’indice, le numéro du monde, le manifeste et le corrigé restent chez l’opérateur. Le premier candidat admissible est n = 1. L’empreinte SHA-256 de la graine de réserve en UTF-8 est `0022ec7f9c0bb6be7844a0f683c4ba980c25379a9bd0af43b79d2095750c85fe`.

## Verdicts de développement

Le générateur construit les corrigés à partir des contraintes d’ordre. L’évaluateur relit les fiches Markdown, simule les actions et transmet les traces gagnantes à l’énumérateur commun aux deux familles. Une politique ne peut choisir des actions distinctes dans deux mondes tant que ses observations y sont identiques. La comparaison avec le corrigé porte sur l’ensemble exact des politiques minimales en coût maximal. [Simulateur](world.mjs) · [Énumérateur partagé](../finite-policies.mjs) · [Vérification](verify.mjs)

| Contrôle | Résultat |
| --- | --- |
| Graine 17 | 4 fiches, 6 mondes comptés par fiche, 45 plans physiques gagnants, 19 politiques gagnantes et 7 minimales. |
| Graines 17 et 1 à 8 | 36 fiches, 54 mondes, 342 plans physiques gagnants, 144 politiques gagnantes et 54 minimales. Reproduction des neuf corpus en mémoire et du tirage 17 octet par octet. |
| Mesure présente | 18 fiches. L’action matérielle justifiée vient en premier dans toute politique minimale. |
| Mesure absente, purge faite | 9 fiches. Seule une mesure initiale permet de garantir le but. |
| Mesure absente, purge à faire | 9 fiches. Toute politique gagnante commence par la purge avec la poignée en place, puis la mesure. |
| Archive et mesure | Dans chacune des 18 paires ambiguës, le premier geste suggéré par l’archive reste possible dans un monde et provoque une défaillance terminale dans l’autre. L’ordre révisé y atteint le but. |
| Rejeu public | 6 épisodes sur la graine 17. Pour chaque paire ambiguë, les retours sont identiques jusqu’à la mesure, puis le plan conditionnel réussit dans les deux mondes. |
| Faux corrigés | 3 rejets sur disque. Un corrigé anticipe la mesure, un autre persiste après une contradiction, un troisième supprime un ordre admissible. |

Ces chiffres mesurent la cohérence des situations, des retours et des corrigés. Les réponses d’Agenda relèvent de la campagne de transfert ultérieure.
