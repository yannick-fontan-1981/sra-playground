# HANO · ligne 25, sélection et dépôt sur supports mesurés

**La ligne 25 est qualifiée sur le gel.** Les trois scénarios du vrai service donnent les mêmes reçus sur `d0e7527c` et `f768bac6c4c9c34d230b63fe6cec39663164b6ae`, qui partagent le même arbre moteur. Le préfixe rejoué comporte 16 tickets de transfert ordonné. L’extension à 19 gestes relève le changement de fournisseur en N3. [Index](sic-hano-f768bac6/banc.json) · [Reçus du banc](sic-hano-f768bac6/recus.zip)

| Étape | Offre et preuve |
|---|---|
| N1/T1 puis T2 | Trois supports et la configuration [[11,7],[],[]] donnent un transfert du sommet de largeur 7, du support 0 au 1. T1 clique en (13,51) et mesure la marque de sélection. Le reçu de sélection porte `selection_observed:true` et `transfer_observed:false`. T2 clique en (31,51), avec la même clé de contexte et le même membre. La garde utilise la marque, le retour confirme le dépôt et son reçu porte `transfer_observed:true`. |
| N1/T3, puis N2/T7 | À nouveau (13,51) au T3, le membre a maintenant une largeur de 11 et la configuration est [[11],[7],[]]. Le ticket cite le retour du dépôt T2. En N2/T7, quatre supports donnent [[15,11,7],[],[],[]]. Le même calcul de transferts bornés s’applique à ce nouveau domaine. |
| Marque absente au même T1 | Le retour construit échoue à la comparaison de sélection. Les deux marques du reçu sont fausses, la clé est fermée et le préfixe est scellé. Le ticket de dépôt en (31,51) n’est pas émis. La comparaison avec l’image de T3, qui marque un autre membre, refuse aussi le plan initial. |
| Offre de transfert retirée au départ | Le service émet deux clics de cadrage en (13,50) et (13,48), confirmés par le vrai jeu. À T3, il retrouve les piles initiales et la sélection en (13,51). T4 libère le dépôt en (31,51) et le retour le confirme. |

Dans le nominal, le service expose les reçus de sélection et de dépôt ensemble à l’avance T2. Le banc les rattache aux références de leurs propres tickets et retours. Le calcul de chemin `materializeOrderedSupportTransferWitnesses` rend le premier transfert pour les trois configurations contrôlées. Les tests distinguent la règle de compatibilité calculée du transfert effectivement observé.

Critères `44d199f6`. Départ N1, pack natif, 600 gestes par niveau, graine implicite 0. Le nominal instrumenté transmet 19, le repli 8. Les 16 premiers gestes recoupent le préfixe du catalogue. Les trois tests passent sur chaque SHA. L’index donne le temps depuis le premier rejeu indépendant.

Depuis le banc, avec Node 24 et Pyodide préparé :

```powershell
$r = 'artifacts/rejeu-hano'
foreach ($revision in 'd0e7527c','f768bac6') {
  py -3.11 scripts/test-sic-catalogue-lines.py $revision $r --game HANO --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-hano-support.py $r
```
