# REWI · ligne 49, une fenêtre exacte sur la vue courante

**Ligne 49 qualifiée sur le gel.** Quatre scénarios sur `d0e7527c` et `9b41b8ba322fceb2737a99dfa264a4d809055bad`, arbre moteur commun. Critères `5842b75e`, opérateur `707c4389`. Rejeu indépendant de 23:38:17 à 23:41:30 le 27 novembre (UTC−3). Les champs capturés concordent aussi sur `674b0dd1`, capture terminée à 23:43:26. [Reçus](sic-rewi-9b41b8ba/recus.zip) · [Contrôles](sic-rewi-9b41b8ba/banc.json)

- **T9 après la ligne 15.** Les six clics d’information constituent le préfixe, puis deux `ACTION3` remettent la vue en position. Le retour T8 révèle la fenêtre unique en [27,18]. Le domaine est complet sur 1 749 fenêtres. Le T9 en (33,24) cite la seule vue courante. À ce même tour, introduire une seconde correspondance exacte fait disparaître l’offre.
- **Un tour plus tôt.** Le vrai jeu permet de cliquer (33,24) après T7 et reste en N1. Le cadre exact n’est pas encore mesuré et la garde du futur ticket refuse la vue antérieure avec `window_context_or_payload_changed`.
- **Retour.** Le vrai T9 valide N1 avec `matched:null` pour l’effet de fenêtre. L’événement lie ses deux observations et décrit le passage d’époque 1→2. Le T10 ouvre une nouvelle question. Un retour stationnaire construit au même ticket ferme cette seule tentative sans gain officiel ni adoption d’une loi de transfert.

Départ N1, curiosité native, graine implicite 0, six niveaux visés, 16 gestes par session et 600 par niveau.

```powershell
$out = 'artifacts/rejouer-rewi-49'
foreach ($sha in 'd0e7527c','9b41b8ba','674b0dd1') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha --game REWI $out --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-rewi-window.py $out
```
