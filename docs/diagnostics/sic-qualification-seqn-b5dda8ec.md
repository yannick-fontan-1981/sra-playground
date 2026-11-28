# SEQN · retour factorisé 11 et réécriture revalidée 81

**Les deux lignes sont qualifiées sur le gel.** Les cinq scénarios de test et leurs reçus concordent sur `d0e7527c` et `b5dda8ecb17b1725816bae09b44973449869dbae`. Les deux révisions partagent le même arbre moteur. Les 16 premiers gestes reproduisent quatre tickets de 11 et cinq de 81. L’extension à 19 suit le passage en N3. [Index des preuves](sic-seqn-b5dda8ec/banc.json) · [Reçus du banc](sic-seqn-b5dda8ec/recus.zip)

| Ligne | Témoin | Contre-épreuve au même état |
|---|---|---|
| **11** | N1/T8, après retour à la trame initiale, les témoins T1, T3 et T4 habilitent la partition matérielle et la bande des rangées 60–62. `ACTION1` confirme les deux canaux. T9 et T10 confirment aussi leurs projections. | Retirer le témoin de la bande fait libérer `ACTION4` par la frontière et le jeu répond à ce ticket. Garder le ticket `ACTION1` et présenter la bande périmée conserve la projection matérielle. Le canal de bande échoue, le service scelle le plan et aucun échantillon de réécriture n’est produit pour ce pas. |
| **81** | L’avance T11, `ACTION4` et passage officiel en N2, livre trois échantillons rattachés aux observations des tickets T8–10, puis le modèle qualifié par le score. N2/T12 lit la référence de frontière et les trois témoins, relocalise le masque près de (16,34) et confirme `ACTION1`. | Retirer seulement le modèle du choix T12 donne également `ACTION1` via la frontière, avec exactement le même paquet physique. Aucun `scored_rewrite_test` n’est produit. Le modèle rétabli donne `ACTION2` au T13. Dans le bras distinct où le ticket T12 prédit le masque mais où un pixel est remis à sa valeur source, le reçu réfute `ACTION1` pour cette époque et la reprise donne `ACTION2`. |

Le transfert de preuve passe par `ScoredRewriteAccess.record`, qui sélectionne les échantillons des pas du retour factorisé. À la frontière officielle, `scoredModel` qualifie les trois échantillons. Avec un seul, le vérificateur mesure un résultat nul. Le modèle retenu traverse la frontière et autorise une réécriture relocalisée. Les deux décisions gardent des gardes propres.

Départ N1, six niveaux et 600 gestes par niveau, curiosité native et graine implicite 0. Préenregistrement `57601dca`. Le banc instrumente les cinq scénarios avec le budget explicite de 19 et recoupe les 16 premiers tickets du catalogue. Les paquets construits isolent un canal ou un pixel. Les paquets des tickets nominaux et des replis viennent du jeu.

Depuis le banc sous Node 24.22.3 avec les jeux et Pyodide préparés :

```powershell
$r = 'artifacts/rejeu-seqn'
foreach ($revision in 'd0e7527c','b5dda8ec') {
  py -3.11 scripts/test-sic-catalogue-lines.py $revision $r --game SEQN --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-seqn-rewrites.py $r
```
