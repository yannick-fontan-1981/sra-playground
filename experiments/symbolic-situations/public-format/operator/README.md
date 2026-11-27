# Opérateur commun aux deux familles

Le transport est celui de la qualification initiale. Pour chaque départ, il monte uniquement les fichiers du solveur dans un répertoire neuf et lance Node 24 avec les permissions de lecture limitées à ce répertoire. Le processus reçoit l’objet produit par l’exporteur `ac0235bf`, puis les retours du simulateur après ses propres commandes. L’identité du monde, les chemins de fiches, les graines et les corrigés restent chez l’opérateur. [Dialogue destiné au consommateur](../DIALOGUE.md)

## Rejeu opérateur

Depuis `public-format`, on peut essayer un solveur autonome sur le développement et conserver le reçu dans un nouveau fichier.

```powershell
node operator/run.mjs --solveur D:/outils/solveur.mjs --rapport D:/mesures/developpement.json
```

Un consommateur figé utilise `--depot`, `--sha` (40 caractères hexadécimaux) et `--entree` (chemin relatif dans le dépôt). Répéter `--dep` pour ses imports locaux ou son fichier de configuration de module. Les octets de chaque fichier proviennent de Git à ce commit, avec une empreinte SHA-256 dans le reçu. Le point d’entrée est lancé directement. Le checkout du consommateur peut contenir des changements postérieurs.

Après gel, exécuter **le même point d’entrée et le même ensemble de dépendances** avec `--partition reserve`. L’opérateur vérifie l’engagement de la clé et l’état propre de son code. Il produit un nouveau reçu privé pour chaque tentative. La sortie standard contient les compteurs agrégés et ceux de chaque famille. La racine de confiance est le code du consommateur livré pour l’essai. Les permissions de Node limitent les accès locaux usuels, sans constituer un dispositif de confinement réseau.

## Lecture des compteurs

| Compteur | Événement mesuré |
| --- | --- |
| Admission | Une commande syntaxiquement valide ou un abandon volontaire admet la fiche. Un refus explicite au premier tour est incompatible. Un problème de transport ou de syntaxe avant cette décision laisse l’admission indéterminée. |
| Actions | Propositions syntaxiquement valides, gestes exécutés et commandes refusées. Une action légale qui perd est exécutée. |
| Lectures | Demandes pour une commande à effet public `reveal`, valeurs produites, valeurs précédemment inconnues, retours suivis d’une réponse conforme (commande ou abandon), retours suivis d’une commande. Une valeur produite mesure le jeu et la réponse suivante mesure le comportement observable du consommateur. |
| Paires | L’empreinte de l’enveloppe initiale est commune aux deux mondes. Le reçu indique le nombre de tours identiques et le premier retour qui distingue les mondes pour une même action. Si le consommateur choisit deux actions différentes avant cette divergence, le reçu le signale. |
| Issues | Succès, défaites terminales, abandons, incompatibilités et arrêts techniques. Le premier écart de chaque départ est conservé. |

La sélection prospective est préenregistrée. Le tirage historique qui avait exposé le refus d’admission conserve son statut de rejeu. [Registre de sélection](SELECTION.md)

## Contrôles de développement

```powershell
node --test operator/test.mjs ../ressource/qualification/test.mjs
```

Un témoin exerce un refus de commande, une lecture et un abandon sur les 18 départs. Un second témoin calcule dans le processus isolé l’empreinte de tout le préfixe reçu jusqu’à la première observation discriminante sur les 6 paires. Deux scripts limités aux exemples publics vérifient les 4 succès de leurs deux fiches. Les tests couvrent aussi les messages mal formés, les incompatibilités, les échecs terminaux et le chargement d’un consommateur multifichier depuis Git.
