# Contact P05 après une approche P07 · qualification indépendante

Candidat `40f140f8dceb78c7ad1e448751a9f103bfc01362`. Référence `86e0f172bfd4f743bccd985a57ce1811001a6d7e`, dont l’arbre moteur est celui du parent de préenregistrement du candidat. Contrat opérateur fixé à `1ed157a5` avant lecture des paramètres. Deux variantes construites rejouées par le vrai service, **10 départs par SHA**, 128 gestes sur la référence et 126 sur le candidat.

Les dix gestes d’apprentissage et les deux tickets d’approche P07 sont les mêmes sous toutes les interventions pour chaque géométrie. Sur le candidat, budget local 1, le contact P05 est admis et joué sous ACTION4 dans la première géométrie et ACTION3 dans le miroir. Le vrai retour de la fixture est `passage_connections_rewritten_at_landing`, `matched:true`, avec reconfiguration observée. Le résultat concorde avec la référence et l’option absente.

| Intervention au point de contact | Résultat |
| --- | --- |
| Budget local zéro | Les deux P07 restent identiques. Premier écart `selected` à preuve égale. Le candidat ne libère aucun contact dans les deux variantes et la connexion reste inchangée. La référence libère encore le contact. |
| Ordre des commandes inversé | Même commande P05, même cible, mêmes références et même image de retour dans les deux variantes. |
| Seule commande de contact retirée | Approche acquise et même image au point de contact. Aucun ticket et aucune reconfiguration, sur les deux SHA. |
| Référence de l’observation précédente, image courante | Le garde refuse la réutilisation des 14 offres P05 par rapport à leur version courante admise. |

Le verdict porte sur la libération et l’acquisition du contact dans ces deux terrains construits. Les chemins métier hors de cette fixture ont leur qualification propre. Les 21 tests ciblés du candidat passent. [Reçu réduit](recu.json)

## Rejeu

Copier [parcours.mjs](parcours.mjs) dans `tests/operateur-contact-p05.mjs` dans chaque checkout exact. Le helper `tests/helpers/sic-paired-passage-room.ts` provient du candidat. Placer les deux sorties dans le même dossier sous `base.json` et `candidat.json`.

```powershell
node tests/operateur-contact-p05.mjs base <reçus>/base.json
node tests/operateur-contact-p05.mjs candidat <reçus>/candidat.json
node <dossier-opérateur>/verifier.mjs <reçus>
```
