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

## 8d6e19d · activation explicite et pression

Le moteur `8d6e19d5ef6e4ffc5b6ce647dfeebd17aaabfce8` porte les six blobs exacts du P05 actif `09b9a509` et les deux blobs exacts du composeur. Son arbre `src` est `9ffc440d90bc70574303dea88427081ce61aa1d0`. Par rapport à `096bc103`, les six fichiers du P05 sont les seuls chemins moteur modifiés. L'activation est transmise par une option explicite du runtime.

| Témoin | Verdict sur 8d6e19d |
|---|---|
| AS66 · V6, quota local 1 | 16 commandes et 168 événements identiques à la référence. Deux choix et preuves concordants. |
| G50T · SIC, quota local 1 | 16 commandes et 163 événements identiques à la référence. Six choix et preuves concordants. |
| G50T · SIC, quota local 0 | Au N1/T1, premier écart à l'événement 2 sur `/value/family`. `sic_public_input_exploration` remplace `sic_verify_remote_replay` avec sa propre garde et son propre motif de retour. ACTION1 et le paquet physique concordent. |
| SS05 · reprise après passage puis fermeture | 32 commandes et gain N1. Même suite de projections. La preuve de fermeture retirée et la projection contredite donnent les mêmes refus ciblés. |

[Activation qualifiée isolément](sic-banc-p05-actif-09b9a509.md)

```powershell
$sha = '8d6e19d5ef6e4ffc5b6ce647dfeebd17aaabfce8'
node scripts/sic-p05-shadow-native.mjs $a $b $sha "$out/p05-actif" --active
py -3.11 scripts/test-sic-pressure-composer-port.py $a $b $sha "$out/pressure-actif" --one
```
