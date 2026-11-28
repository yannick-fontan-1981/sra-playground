# ZIPP · lignes 67 et 71, trace et contour

**Les lignes 67 et 71 sont qualifiées sur le gel.** Quatre scénarios identiques sur `d0e7527c`, `421dc6a58d051e8e418db80a98cf1e01755dab40` et le moteur assemblé `674b0dd1` pour les champs capturés. Les deux premières révisions partagent le même arbre moteur. Critères `29430798`. Banc de 23:26:03 à 23:28:30, témoin assemblé à 23:29:55 le 27 novembre (UTC−3). Opérateur `91fd9583`. [Reçus](sic-zipp-421dc6a5/recus.zip) · [Contrôles](sic-zipp-421dc6a5/banc.json)

**67 · extension ordonnée du champ.** Au N1/T1, ACTION6(32,12) relocalise la tête de (0,0) à (1,0). Le retour T2 établit la deuxième arête orientée. Au T3, les deux preuves autorisent un préfixe de six gestes. Retirer uniquement la réception de la deuxième arête conserve la position et ACTION6(48,28), avec un seul geste autorisé. Son retour réel ouvre un plan de cinq gestes au T4. Huit occurrences sur huit sont reproduites, dont la frontière officielle après T8.

**71 · contour à l’époque courante.** Au N2/T14, ACTION5 lie une hypothèse de contour [11,43,17,49] aux références T9–T13, époque 2. Modifier le contour à ticket égal donne `outline_or_command_changed`. Retirer la seule clôture de trace du niveau précédent conserve l’offre de contour. Le vrai T14 change zéro pixel et rend `matched:null`. Le résultat reste une hypothèse locale, sur une des onze occurrences du catalogue. Le T15 suivant, ACTION2 par `acquire_control_for_target`, est le témoin distinct de la ligne 1.

Départ N1, ouverture native, graine implicite 0, six niveaux visés, 16 gestes par session et 600 par niveau.

```powershell
$out = 'artifacts/rejouer-zipp-67-71'
foreach ($sha in 'd0e7527c','421dc6a5','674b0dd1') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha --game ZIPP $out --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-zipp-trace-outline.py $out
```
