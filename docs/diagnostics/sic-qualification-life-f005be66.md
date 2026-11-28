# LIFE · invitation 2, porteurs 68 et descendants 69

**La ligne 2 est qualifiée sur le gel. Les lignes 68 et 69 sont qualifiées sur `f005be662b0e4b556a0cea3d246381cd98eec7ae`.** Les six scénarios communs donnent des reçus identiques sur l’historique `8ce7ee35`, le gel `d0e7527c` et le candidat. Les dix tests du candidat passent avec le jeu actif. Les quatre cas propres au nouveau sélecteur comprennent deux substitutions exécutées et deux abstentions avant ticket. [Index par SHA et heure de mesure](sic-life-f005be66/banc.json) · [Reçus et résultats des tests](sic-life-f005be66/recus.zip)

| Ligne | Décision historique et retour | Épreuve discriminante |
|---|---|---|
| **2**, 2 des 21 occurrences du catalogue sur LIFE | N1/T1, invitation unique en (24,7). Le jeu fournit quatre images, l’image finale coïncide et l’effet était inconnu. L’acquisition fait passer T2 aux porteurs. N2/T16 retrouve l’invitation en (40,7). | Retirer seulement l’invitation ou présenter deux croix libère le porteur en (6,48). Retirer seulement l’acquisition après T1 redonne l’invitation en (24,7) au T2. Ces contrôles sont identiques sur le gel. |
| **68**, 6/6 sur LIFE | T2 choisit (6,48) parmi quatre porteurs. Le retour marque 29 pixels. Le partenaire du T3 produit un support avec 232 pixels changés. Le retour T4 lie les deux descendants au support activé. | À état identique au T2, le sélecteur de la branche choisit (23,48). Après son marquage réel, le partenaire lié est en (58,48). Son retour produit le support et T4 sélectionne (48,34). Refuser tous les porteurs suspend avant T2. |
| **69**, 8/8 sur LIFE | T5 marque le descendant (12,21). T6 tente sa livraison en (24,7), le jeu consomme le matériau et change la demande. Une demande déjà servie fait changer de descendant. | Sur la même liste de deux sujets libres au T5, choisir (19,21) donne un marquage réel. T6 livre **le même identifiant de descendant** en (56,7). Après consommation et changement de demande, T7 sélectionne (12,21). Refuser les sujets libres suspend avant T5. |

Le raccord de branche `TypedMaterialMemory.selectUnboundSubject` reçoit les sujets admissibles déjà triés. En 68, le partenaire reste contraint par le profil marqué. En 69, le sujet de la livraison reste lié au descendant engagé. La seule modification moteur par rapport au gel est `src/logos-engine/v6-typed-material-access.ts`. Le nominal, les gestes, l’animation, les liens de preuve et les gardes du gel ont été conservés dans les scénarios communs. Les retours alternatifs proviennent du jeu réel depuis N1. Les contrôles de suppression et de duplication modifient de façon ciblée une présentation, une acquisition ou une offre.

Préenregistrement `a7f40efd`. Départ N1, pack par défaut, six niveaux cibles, budget global 16, plafond de 600 par niveau, curiosité native. Le lanceur n’envoie aucune graine et le pont local charge la graine 0. Le parcours de catalogue s’arrête au plafond après le T16. Les premiers tests physiques ont commencé à 00:32:29 UTC le 28 novembre. Les bornes de capture, le temps écoulé jusqu’au verdict et les empreintes figurent dans l’index.

Depuis le banc sous Node 24.22.3, indiquer un checkout préparé contenant les jeux et Pyodide :

```powershell
$d = 'artifacts/verification-life'
foreach ($version in '8ce7ee35','d0e7527c','f005be66') {
  py -3.11 scripts/test-sic-catalogue-lines.py $version $d --game LIFE --game-root ../sic-main-delivery --node node
}
```
