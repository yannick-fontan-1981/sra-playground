# Portage natif du composeur de pression · verdict indépendant

Le raccord `c515ea1464387c940b06e93f3ad7ecd73f782f60` reproduit les décisions et retours du moteur de référence `0aef4289e97ce094782dfd03f5a79ace6eae5fd2` sur les quatre parcours ciblés. **208 commandes natives par SHA**, dont 116 autonomes, 90 dans les deux parcours guidés et deux commandes de repli. Contrat opérateur préenregistré à `cd02e71f`.

| Parcours | Résultat sur les deux SHA |
| --- | --- |
| SS05 autonome depuis N1 | Un niveau en 36 commandes, plafond de niveau 44. Arrêt sur cible. |
| SS11 autonome depuis N1 | Zéro niveau en 80 commandes, arrêt au quota. |
| SS05, appui T6 puis fermeture T14 | 14 commandes d’acquisition, puis 32 commandes de reprise et gain de N1. |
| SS05, fermeture T6 puis appui T12, vue recolorée | 12 commandes d’acquisition, puis 32 commandes de reprise et gain de N1. |

Les suites autonomes comparées gardent les mêmes effets, autorités, reprises et empreintes de préfixe. Dans chaque reprise guidée, la première commande admise est ACTION1 pour réserver le poids. Le bâtissage débute à l’indice 7 et la traversée à l’indice 15. Le fournisseur confirme 31 projections sur les retours intermédiaires. Le trente-deuxième geste termine officiellement le niveau.

**Fermeture.** Au même plateau, retirer seulement la référence de fermeture retire l’offre de réserve dans le fournisseur. Il libère ACTION2 comme repli. Ce geste est admis et joué dans un jeu neuf au même état physique. Il déplace l’acteur à `14,41` sans gain. Retirer une autre référence de l’historique conserve l’ACTION1 et la même pose projetée. Rétablir la fermeture rétablit le choix de réserve et sa citation.

**Retour contraire.** Le vrai retour d’ACTION1 confirme le déplacement. Présenter la vue stationnaire de départ à la place, avec la projection originale, fait produire `pressure_projection_contradicted`, `matched:false` et clôt la décision. Le contrôle d’acquisition ajoute un seul refus à la pose et conserve les références de fermeture et d’appui. La proposition de réserve suivante passe à ACTION4 dans ce bras construit.

Deux tests du fournisseur sur la référence et six tests du fournisseur et du composeur sur le candidat passent. Les titres autonomes attestent les parcours au plafond indiqué. Les reprises guidées établissent le raccord de réserve et son acquisition dans SS05. Ce contrôle couvre ce fournisseur et ces retours.

## Rejeu

Dans chaque checkout au SHA exact, copier [parcours.mjs](parcours.mjs) dans `tests/operateur-pression.mjs`. Avec Node 24, exécuter les commandes suivantes et conserver les deux jeux de reçus hors du checkout moteur. Utiliser `base` ou `candidat` pour `<version>`. Les ressources de référence V6 et les sources de jeu SS05 et SS11 doivent être présentes.

```powershell
node tests/operateur-pression.mjs > <reçus>/<version>.controle-final.json
$env:SIC_REPLAY_REFERENCES = 'docs/architecture/sic-replay-reference-levels-20261126.json'
node scripts/check-sic-chronological.mjs SS05,SS11 1 <reçus>/<version>.service-complet.jsonl 1 sic
node <dossier-opérateur>/verifier.mjs <reçus>
```

[Reçu réduit](recu.json).
