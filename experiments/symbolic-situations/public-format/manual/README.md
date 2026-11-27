# Une partie dans une fenêtre ChatGPT ordinaire

Copier le [message initial autonome](DEPART.md) dans un nouveau chat. Il contient le but, les observations et toutes les commandes de l’exemple public de développement. Il demande une seule commande par tour. Le texte reprend les règles de la fiche et remplace la demande finale de plan par une invitation à jouer.

Depuis `experiments/symbolic-situations/public-format`, l’opérateur lance le jeu et conserve le numéro du monde de son côté :

```powershell
node manual/operer.mjs --monde 1
```

À chaque tour, saisir exactement la commande proposée par ChatGPT. Le programme imprime uniquement le retour public. Copier cette ligne seule dans le chat. Une commande indisponible rend `Action indisponible.` et le dialogue continue. Arrêter au verdict terminal. Choisir `--monde 2` au départ permet de jouer l’autre monde avec le même message initial.

## Reprendre dans un nouveau chat

Conserver les couples publics `action` et `retour` dans leur ordre, sur le modèle du [préfixe de deux tours](prefixe.json). La commande suivante vérifie que le préfixe est possible, puis imprime un message autonome avec la fiche et l’historique. Copier ce message dans le nouveau chat. Il demande la prochaine commande après le dernier retour.

```powershell
node manual/operer.mjs --message --prefixe manual/prefixe.json
```

L’opérateur peut continuer sa partie déjà ouverte. Si le processus du jeu a également été fermé, le relancer avec le préfixe :

```powershell
node manual/operer.mjs --prefixe manual/prefixe.json
```

Le programme rejoue chaque action et vérifie le retour correspondant avant de reprendre. Si plusieurs mondes sont encore compatibles, fournir aussi le `--monde` conservé au départ. Un retour contradictoire empêche la reprise.

## Dialogue de développement vérifié

| Commande du joueur | Seule ligne rendue par l’opérateur |
| --- | --- |
| `lire` | `X4c94cf` |
| `marquer X022d46 X03a3e1` | `marqué` |
| `marquer Xfc26f3 X03a3e1` | `marqué` |
| `valider` | `succès` |

Le même script de quatre commandes a été exécuté sur l’interface manuelle et via l’opérateur de qualification isolé. Après reprise du préfixe des deux premiers tours, les deux derniers retours sont à nouveau `marqué`, puis `succès`. Ce témoin vérifie le dialogue et la restauration de l’état. [Message à copier seul](DEPART.md)
