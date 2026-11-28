# KLOT · ligne 82, sélection et attribution du déplacement

**Qualification partielle au gel.** Le moteur de `a0df8a9b13b51e63d08b5ca184c996ba20453e9c` a le même arbre `src` que `d0e7527c`. Deux scénarios de sélection et une contre-épreuve d'attribution par SHA. Critères `3252ff2f`. [Contrôles](sic-klot-a0df8a9b/banc.json) · [Reçus](sic-klot-a0df8a9b/recus.zip)

- **Sélection.** T1 clique (28,31) et modifie la décoration de la pièce 11. Toutes les poses restent identiques. Le reçu retient un destinataire hypothétique. T2 ACTION4 déplace exclusivement la pièce 11 de [1,3] à [2,3] et réduit la recherche de 24 à 6 modèles, avec `matched:null` pour cette sonde.
- **Réutilisation.** T7 et T9 jouent tous deux ACTION1. Après les vrais clics T6 et T8, le premier déplace la pièce 6 et le second la 12. Ils reprennent les sélections respectives. Retirer seulement le reçu de T1 à vue identique rend le vrai clic de resélection, puis la sonde ACTION4.
- **Mauvais destinataire.** À T7 le ticket attend la pièce 6. Le backend officiel joue, en plus, la sélection (36,39) de la pièce 11 avant le même ACTION1. Cette intervention est retenue hors de l'historique montré au service. Seule la pièce 11 bouge. Le plan est contredit et scellé. Le reçu attribue pourtant `observed_exclusive_receiver` à la pièce 6 avec zéro modèle compatible.
- **Suite.** Le service termine avec `rigid_control_or_collision_model_refuted`. La dernière famille reste `selected_rigid` dans l'instantané. Aucun nouveau ticket ne consomme le reçu erroné. Le défaut d'attribution garde 82 hors strict.

Départ N1 sur les actifs officiels, graine implicite 0, 600 gestes par niveau et 16 au total avec horloge déterministe. La reprise du contrôle traite explicitement l'arrêt du service. La preuve mesure les décisions et les retours de ces préfixes.

```powershell
foreach ($sha in 'd0e7527c','a0df8a9b') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $nominal --game KLOT --game-root $g
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $controle --game KLOT --wrong-receiver --game-root $g
}
```

`$g` désigne le checkout des actifs du gel avec Pyodide. Utiliser Node 24 et de nouveaux dossiers de reçus.
