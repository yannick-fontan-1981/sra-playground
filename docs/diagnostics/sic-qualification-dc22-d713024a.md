# DC22 · ligne 88, de la reconfiguration à l’accès contrôlé

**Ligne 88 qualifiée sur le gel.** Rejeu indépendant de 23:13:26 à 23:15:16 le 27 novembre (UTC−3). Deux scénarios identiques sur `d0e7527c` et `d713024aa7f9b45c8fbd114b86209d36c4efd6ba`, arbre moteur commun. Critères `40982b07`. [Reçus](sic-dc22-d713024a/recus.zip) · [Contrôles](sic-dc22-d713024a/banc.json)

- **T2.** La question `ACTION2` porte une position attendue inconnue et `matched:null`. Le vrai retour acquiert [2,0] et lie le mouvement au support courant.
- **T7–T9.** Trois questions distinctes malgré le même clic (48,19) aux deux premiers tours. Le T9 clique (48,36) et le retour mesure puis ferme la question de reconfiguration. À cet instant, l’utilité de l’effet reste ouverte.
- **T11.** Après reconfiguration, la surface visée (10,36) est [9,9,9,9]. Le service admet `ACTION1` et le jeu confirme l’arrivée. En sautant le clic de reconfiguration dans le vrai jeu, la même zone reste [4,9,9,4]. À commande et plan nominaux identiques, le garde refuse cette surface avec `support_binding_changed`. Jouée directement dans le jeu alternatif, la commande ne produit pas le support nominal. Le reçu du service garde le ticket nominal et son inspection de garde séparément.

Départ N1, curiosité native, graine implicite 0, six niveaux visés, 16 gestes par session et 600 par niveau. Les essais portent sur l’acquisition et la liaison du plan au support avec son contre-exemple physique.

```powershell
$out = 'artifacts/rejouer-dc22-88'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game DC22 $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py d713024a --game DC22 $out --game-root ../sic-main-delivery
py -3.11 scripts/check-sic-dc22-support.py $out
```
