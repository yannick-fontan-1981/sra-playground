# Banc de coexistence après les 98 lignes

Référence `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`. Les comparaisons de ce dossier portent sur des scénarios ciblés. La campagne historique des 107 jeux reste attachée à la référence. [Campagne historique](sic-coexistence-0aef4289.md)

## 096bc103 · shadow et composeur de pression

Les six fichiers moteur du shadow `189b96ee` et les deux du port pression `c515ea14` sont présents au blob exact dans `096bc103fa5ec1af6b141968d39566e20051496e`. Le banc a rejoué les deux raccords sur cet assemblage.

| Témoin | Verdict sur 096bc103 |
|---|---|
| AS66 · V6 · shadow explicite | 16 décisions jouées par bras, 168 événements identiques, deux sélections et preuves shadow concordantes |
| G50T · SIC · shadow explicite | 16 décisions jouées par bras, 163 événements identiques, six sélections et preuves concordantes |
| SS05 · reprise après passage puis fermeture | 32 commandes et gain N1 dans le vrai jeu. Projections et commandes identiques. Retrait de la fermeture et contradiction de la pose vérifiés sur ce même moteur. |

[Shadow isolé](sic-banc-p05-shadow-189b96ee.md) · [Port pression isolé](sic-banc-pressure-composer-c515ea14.md)

Depuis le Banc, utiliser Node 24.22.3, `$a` pour la référence et `$b` pour l'assemblage. Réserver un nouveau dossier `$out`.

```powershell
$sha = '096bc103fa5ec1af6b141968d39566e20051496e'
node scripts/sic-p05-shadow-native.mjs $a $b $sha "$out/p05"
py -3.11 scripts/test-sic-pressure-composer-port.py $a $b $sha "$out/pressure" --one
```
