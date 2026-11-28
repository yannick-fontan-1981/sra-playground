# RE86 · ligne 7, de la mesure à la couverture conjointe

**Ligne 7 qualifiée sur le gel.** Les trois scénarios sont identiques sur `d0e7527c` et `8e820aa64f321153bb858040d462d7f766178947`. Ces deux révisions ont le même arbre `src`. Critères `7b271706`. Premier essai indépendant à 22 h 49 min 37 s et reçus complets à 22 h 52 min 43 s le 27 novembre. [Reçus](sic-re86-8e820aa6/recus.zip) · [Contrôles](sic-re86-8e820aa6/banc.json)

- **Mesure.** T1 ouvre l’acquisition à mémoire vide. Les quatre premiers retours donnent successivement [0,−3], [0,3], [−3,0] et [3,0]. T4 attribue au propriétaire 0 les 53 pixels de palette 9. T8 attribue au propriétaire 1 les 45 pixels de palette 11. T9 cite ce dernier retour.
- **Choix puis retour.** Après la sélection de l’autre commande admissible au premier tour à vue égale, N1/T9 utilise le même premier propriétaire et la même pose [36,45]. La pose consommée du second propriétaire passe de [18,24] à [18,30]. Le vrai jeu confirme la couverture dans les deux parcours. En nominal, T20 mesure la sélection sous occlusion et le plan de T21 mobilise le propriétaire 1. Avec le ticket T1 nominal mais un plateau stationnaire présenté au comparateur, aucun vecteur ni support n’entre en mémoire. Le T2 essaie `ACTION2`.
- **Score officiel et nouvelle époque.** Le catalogue de 16 gestes contient 16/16 occurrences de la famille attendue, sans niveau terminé. Les séances prolongées passent en N2 après T26 en nominal et T28 après substitution. Aux premiers tickets de N2, l’acquisition reprend sans support transféré.

Départ N1, graine 0 implicite, limite 600 gestes par niveau. Le catalogue communique 16 gestes au service. Les témoins prolongés et le bras stationnaire utilisent leurs propres plafonds fixés par le test natif.

Depuis la branche du banc avec Node 24.22.3 et `../sic-main-delivery` épinglé au gel, Pyodide préparé :

```powershell
$out = 'artifacts/rejouer-re86'
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c --game RE86 $out --game-root ../sic-main-delivery
py -3.11 scripts/test-sic-catalogue-lines.py 8e820aa6 --game RE86 $out --game-root ../sic-main-delivery
node scripts/sic-recapture-strategy-inventory.mjs ../sic-main-delivery "$out/catalogue.json" RE86
py -3.11 scripts/check-sic-re86-ownership.py $out
```
