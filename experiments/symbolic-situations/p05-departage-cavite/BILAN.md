# AS66 · concurrence des offres P05 au même état

Candidat `3047ef55a7a06d4560a07d36dfaf08719c50c802`, référence `162e45506cd9196171c15cb2402cf2ca1ee4266d`. Contrat opérateur `86a96195` avant lecture de l’implémentation. **Quatre départs et 28 gestes natifs par SHA**, depuis N1 avec quota global communiqué de 16. Les commandes, paquets, gardes et acquisitions concordent entre les deux SHA dans chaque bras.

Les cinq premiers gestes sont identiques. Au T6, N2/T1, tous les bras ont la même observation `fb4c841eea2f859a`, les mêmes commandes publiques et les mêmes directions déjà acquises. Le candidat expose simultanément ACTION1 et ACTION4 à une unité, avec les mêmes preuves et les deux offres applicables. Il retient ACTION1 dans l’ordre historique. L’interposition retire les clés indiquées pendant la sélection uniquement et les restaure avant l’exécution.

| Intervention au T6 | Ticket et vrai retour | Suite réellement jouée au T7 |
| --- | --- | --- |
| Aucune | ACTION1 de `sliding_cavity`, 80 pixels changés, direction `[-1,0]` | ACTION4, essai de direction |
| Seule question ACTION1 retirée | ACTION4 sous le même garde de cavité, 82 pixels changés, direction `[0,1]` acquise sous la référence de son propre retour | ACTION2 sous `sliding_cavity_access`, `matched:true` |
| Seule question ACTION4 retirée | ACTION1, reçu identique au nominal | ACTION4, reçu identique au nominal |
| Les deux questions retirées | ACTION2 sous `observed_frontier`, reçu de ce propriétaire, aucune direction nouvelle inscrite | ACTION1 de cavité sur la nouvelle observation |

Le raccord qualifie le départage actif d’offres concurrentes à coût égal et l’acquisition de la direction effectivement jouée. La référence possédait déjà les trajets de chaque bras. Les 19 tests des quatre suites ciblées passent sur le candidat. Le lot reste distinct du moteur commun 703. [Reçu réduit](recu.json)

## Rejeu

Copier [parcours.mjs](parcours.mjs) à la racine de chaque checkout au SHA exact sous `operateur-cavite.mjs`. Utiliser comme racine de jeu celle du Banc local avec Pyodide.

```powershell
node operateur-cavite.mjs base <racine-jeu> <reçus>/base.json
node operateur-cavite.mjs candidat <racine-jeu> <reçus>/candidat.json
node <dossier-opérateur>/verifier.mjs <reçus>
```
