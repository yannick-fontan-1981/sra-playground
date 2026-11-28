# SMLP · ligne 6, composer une configuration par premières arrivées

**La ligne 6 est qualifiée sur le gel.** Les trois scénarios donnent les mêmes reçus sur `d0e7527c` et `1e11472a8acfe8d4287cf33e58fe3f629e532fb9`, qui partagent le même arbre moteur. Le vrai catalogue retrouve 13/13 tickets de la démarche. [Index des décisions](sic-smlp-1e11472a/banc.json) · [Reçus du banc](sic-smlp-1e11472a/recus.zip)

En N1/T1, la frontière libère `ACTION5`. Les 75 images permettent de mesurer les premières arrivées des acteurs 9 et 12 aux indices 52 et 68, avec quatre échantillons par cellule et 24 ordres compatibles. Le producteur cite le retour T1 pour éditer le réseau en (32,26) au T2. Le reçu de réécriture lie l’édition aux observations T1 et T2. Sur le réseau ainsi modifié, T3 lance la configuration dont les 24 politiques prédisent [17,17]. La frontière officielle ajoute un niveau avec `matched:null`. Si le service ne reçoit que l’image finale du même T1, il n’acquiert aucune arrivée datée. T2 bascule vers la frontière en (10,32) et le retour reste stationnaire.

En N3/T10, les six politiques du nouvel état donnent plusieurs unplets d’arrivée. Le producteur émet une question de discrimination, l’édition est confirmée puis le lancement T11 apporte une nouvelle chronologie. Trois politiques restent compatibles. T12 les fait toutes prédire [18,18,18], dans une seule cohorte contenant 9, 12 et 15. T15 franchit la frontière officielle avec `matched:null`. Retirer la compatibilité des ordres au même état T10 donne le clic de frontière en (10,18) et la même trame. Le producteur réutilise la preuve au T11 pour revenir en (22,21) puis poursuit le lancement et la composition.

Critères `25fe4be8`. Départ N1, curiosité native, budget global 16, plafonds de 600 gestes par niveau et graine implicite 0. La sonde compare les mesures d’arrivée et les prédictions par politique. Les niveaux terminés proviennent du paquet officiel. Les deux interventions limitent la chronologie publique présentée ou la preuve d’ordre utilisée pour proposer.

Depuis le banc, avec Node 24 et les jeux préparés :

```powershell
$r = 'artifacts/rejeu-smlp'
foreach ($revision in 'd0e7527c','1e11472a') {
  py -3.11 scripts/test-sic-catalogue-lines.py $revision $r --game SMLP --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-smlp-arrivals.py $r
```
