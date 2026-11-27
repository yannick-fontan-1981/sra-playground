# Entrée publique de développement · sic.essai-local/1

Depuis la racine du checkout candidat, lancer une conversation locale avec la fiche de son choix. Le même opérateur fonctionne sur les deux moteurs. `--moteur gel` extrait les sources et les déclarations du commit `d0e7527ca8033bd805a6d7a8bb021eff62e87021` depuis Git. `--moteur candidat` utilise le checkout courant. PowerShell sélectionne un Node 24 ou ultérieur.

```powershell
$lot = 'experiments/sic-agenda-offres/essai-local-23'
& "./$lot/lancer.ps1" operateur --moteur gel --fiche "$lot/developpement.json"
```

Dans une autre exécution, garder la même fiche et remplacer `gel` par `candidat`. L’entrée directe multiplateforme est `node operateur.mjs --moteur gel --fiche <chemin>` depuis ce dossier. Git et tar sont nécessaires pour extraire le gel. Le dialogue de développement utilise uniquement le moteur local et les déclarations du dépôt.

## Fiche d’ouverture

```json
{"version":"sic.essai-local/1","depart":{"fond":0,"commandes":[1,2]},"historique":[]}
```

- `fond` est l’indice de palette entier d’un plateau uniforme de 64 × 64, de 0 à 15.
- `commandes` porte le domaine public de cette occurrence. Donner de un à cinq identifiants distincts dans 1…5. Ce domaine de développement représente des commandes sans coordonnées.
- `historique` est une liste chronologique de zéro à seize plateaux publics de même format. Chaque entrée est le retour d’un geste réellement demandé par le service à l’étape précédente. Le harnais rend ce plateau avec le ticket qui vient d’être délivré. L’historique est rejeté à la première entrée qui n’a aucun ticket. Les identifiants du jeu, questions attendues, stratégies et commandes gagnantes n’ont pas de champ dans la fiche.

Pour varier la question, modifier le domaine actuel. Pour varier seulement l’expérience passée, garder le plateau et le domaine et ajouter ce même plateau à l’historique. Pour comparer les deux classements enregistrés, fournir la même fiche dans deux sessions et passer séparément `--ordre least_tried` ou `--ordre command_order`. L’ordre par défaut est celui du pack natif.

## Dialogue après l’ouverture

Le premier objet JSON de sortie contient l’historique effectivement joué et la décision sur l’occurrence courante. Le champ `pre` provient de la coupe qui précède le choix local. `ranking` contient les questions déjà classées, les deux premières alternatives selon le critère et l’écart d’usage déjà calculé. Le sceau `preSha256` conserve la projection de `02032a3d`. La commande autorisée, la garde et la libération figurent séparément dans le reçu de décision. Un ticket nul termine le dialogue.

Pour une action délivrée, envoyer une ligne JSON sur l’entrée standard en recopiant l’identifiant réellement reçu. Le plateau peut encore être identique au précédent.

```json
{"ticket":"<id reçu>","retour":{"fond":0,"commandes":[1,2]}}
```

L’opérateur rend l’acquisition associée à ce ticket, puis la prochaine décision. Un ticket étranger ou consommé produit `ticket_perime` et laisse valide le ticket en vol. Fermer l’entrée standard termine la session. L’attendu des tests est dans [mesurer.mjs](mesurer.mjs), séparé de [l’entrée publique](developpement.json) et de [l’opérateur](operateur.mjs).
