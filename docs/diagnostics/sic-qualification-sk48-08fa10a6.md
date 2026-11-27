# SK48 · ligne 96

**Les deux priorités de reprise sont exécutables sur les mêmes preuves au T13.** Depuis L1, l’ordre historique termine le niveau en 19 gestes. L’inversion de priorité le termine en 21. Les captures du banc comparent le parcours nominal à `8ce7ee35`, puis six réglages au gel `d0e7527c` et à la preuve `08fa10a6b9986e7028551fbfc9d9e16eb83726b7`. Les empreintes des parcours appariés concordent. Le parent est le contrat `d9760e9c`. Gel et preuve ont le même arbre de production `a1cbde2afc41532c7c047eb05c8637ef02b584d0`. [Index](sic-sk48-ligne-96/banc.json) · [Rapport comparatif et deux parcours complets](sic-sk48-ligne-96/recus.zip)

**Retour T12.** Dans le mode historique de récupération, `ACTION2` translate le support de six pixels. Le support [11,24,16,29], la pointe en x=46 et la pièce 8 aux ordonnées 25…28 concordent avec la prédiction. La pièce 9 était attendue à 29…32, elle arrive à 31…34. La pièce 14 était attendue à 33…36, elle arrive à 37…40. Le moteur réfute le rapprochement prévu des pièces et conserve les quatre commandes calibrées. La translation conjointe est attestée entre les révisions 12 et 13 de la même disposition.

| Ordre avant le choix | Offre effectivement sélectionnée au T13 | Retour et fin du parcours |
|---|---|---|
| Historique | `revise_rooted_contact`, `ACTION3`, 7 gestes planifiés, 64 états visités. L’autre offre est `lower_priority`. | Pointe de 46 à 40, pièce 8 de x=42 à 36. Les six retours avant la frontière confirment la projection. Besoin satisfait au T19. |
| Repositionnement prioritaire | `reposition_root_before_contact`, `ACTION1`, 9 gestes planifiés, 78 états visités. L’autre offre est `lower_priority`. | Support de y=24 à 18, pièce 8 de y=25 à 19. Au T14, la révision ordinaire reprend depuis cette position. Huit retours confirment la projection, besoin satisfait au T21. |

Dans les deux processus, le ticket s’appelle `contact-qualification:native:13` et se rapporte à la même image `f8828ab792ad8a19`. Les commandes et les mouvements obtenus le distinguent. L’empreinte de la mémoire avant choix est identique, `b0a9599754be2bc601e27de4c22572a6a9c182d767740a2912dcea6a1069b518`. Aux deux frontières de niveau, le verdict de prédiction vaut `null`. Le niveau accompli et le besoin satisfait sont enregistrés séparément.

**Refus.** L’échange des pièces distales au seul retour T12 conserve un écart mais détruit la preuve de translation conjointe. Le fournisseur émet `conditional_contact_model_refuted` et le service s’arrête à `frontier_unknown` après 12 tickets. Une référence hors périmètre est également refusée. Une seconde réfutation clôt le besoin assigné et conserve les deux contre-exemples. En mode shadow, les deux offres sont observées sans recherche ni ticket. Avec une profondeur de 7 et le repositionnement prioritaire, cette première méthode échoue dans sa borne et la révision ordinaire délivre `ACTION3`.

**Portée du transfert depuis L1.** Sur les dix départs préenregistrés par l’opérateur pour chaque SHA, six atteignent le choix 96. Quatre reprises y réussissent et deux situations entraînent le refus attendu. Avec la permutation permanente 9↔14, quatre autres départs s’arrêtent à `frontier_unknown` après le calibrage et avant le ticket 5. Leurs quatre trajectoires échouent en amont de la ligne 96. Deux contrôles supplémentaires de refus sont documentés séparément. Ces dénominateurs viennent de la qualification opérateur. Les essais nominaux du banc et leur variante de priorité ont chacun atteint la fin de L1. [Reçu opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/5804fc7d73c6b7655d97bca777aed9fb6475acef/experiments/symbolic-situations/sk48-ligne-96/BILAN.md)

## Reproduire

Depuis un checkout complet du candidat, utiliser Node 24.22.3, les dépendances verrouillées et le paquet Pyodide du banc. Avec un checkout partiel, inclure aussi `docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz`. Le pack historique garde l’ordre natif, une profondeur de 88, un plafond de 1 000 états et de 600 commandes par niveau.

```powershell
$d = 'experiments/sic-agenda-offres/revision-96'
$py = (Resolve-Path ../sic-comparison-bench/public/vendor/pyodide).Path
node "$d/verifier.mjs" --pyodide $py --recu ./qualification-96.json
foreach ($mode in 'historique','reposition') {
  node "$d/operateur.mjs" --moteur candidat --fiche "$d/public/$mode.json" --pyodide $py --recu "./tickets-$mode.json"
  if ($LASTEXITCODE) { throw $mode }
}
```
