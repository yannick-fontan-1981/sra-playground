# ZIPP · ligne 1 · qualification sur le gel et sur branche

**Sur le vrai préfixe ZIPP, la réplication est justifiée et son effet attendu ne se produit pas.** Au niveau 2, le ticket 10 `ACTION2` déplace le sujet de (11,31) vers (11,43). Au ticket 15, le même sujet est en (11,43). La famille `acquire_control_for_target` demande `replicate_translation` et prévoit (0,12). La garde admet `ACTION2`. Au retour, le sujet est toujours en (11,43), déplacement (0,0). Le moteur publie `matched=null`. Le ticket 16 est un clic de frontière en (14,10).

L'offre cite dans l'ordre les révisions 15, 10 et 11. La paire et la signature lient la prévision à son sujet. L'évaluateur a localisé le masque de 7 × 7 pixels, unique sur chacune des quatre grilles comparées, indépendamment de la couleur. Le reçu de T15 ne publie ni sous-objectif satisfait ni essai `test_missing_control`. Le contrôle porte sur un point de catalogue parmi les huit commandes historiques de ce triplet.

| Monde construit | Premier retour | Prévision au deuxième ticket | Mesure du deuxième retour |
| --- | --- | --- | --- |
| Répétition | déplacement v | v | v |
| Arrêt | déplacement v | v | (0,0) |
| Inversion | déplacement v | v | −v |
| Premier essai sans déplacement | (0,0) | nouvel essai sans prévision de translation | (0,0) |

Les trois premiers mondes gardent la même scène et le même ticket jusqu'à la deuxième action. Sur le développement, v vaut (0,2). Une translation différente de la scène et un mouvement diagonal donnent les quatre départs réservés. À chaque vraie réplication construite, une seconde mesure dans les pixels confirme physiquement le vecteur. Le champ `matched` du moteur reste nul, y compris dans ce cas.

**Dénominateurs par révision.** Un parcours historique de 16 tickets à partir de L1, quatre départs construits de développement et quatre réservés. Parmi les huit départs construits, six demandent la réplication et deux la réalisent. Dans les deux autres départs, l'absence de mouvement à l'essai initial conduit à un nouvel échantillonnage de commande. Deux reçus altérés sont rejetés par partition : réutilisation du mouvement antérieur comme nouvelle mesure, puis substitution de `matched=true` au reçu natif.

**Raccordement du candidat.** Le comportement nominal existait au gel `d0e7527c`. Sur `16f3c5e8`, la famille appelle `offerTranslationReplication`. Dans un départ supplémentaire sur branche, le retrait de l'offre émise par ce producteur à T15 conserve exactement les quatorze tickets antérieurs et l'observation courante. La nouvelle décision appartient à `observed_frontier` et libère également `ACTION2`. Une lecture limitée à la commande masquerait donc le changement de raison. [Reçu comparatif](recu.json) · [Critères et réserve](CONTRAT.md)

## Rejeu public

Depuis ce répertoire, avec Git, `tar` et Node 24. Employer des noms de reçus neufs.

```powershell
$sha = '16f3c5e8d300903e475400fb9b67a513f2834663'
node qualifier.mjs $sha ZIPP "$env:TEMP/1-historique.json"
node qualifier.mjs $sha construit "$env:TEMP/1-construit.json"
node qualifier.mjs $sha retrait "$env:TEMP/1-retrait.json"
```

Le service reçoit les observations du jeu capturées ou les pixels du monde construit, un retour à la fois. [Génération des situations](situations.mjs) · [Évaluateur](verifier.mjs)
