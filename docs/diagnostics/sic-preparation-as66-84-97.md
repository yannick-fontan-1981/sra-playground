# AS66 · références de départ pour les lignes 84 et 97

**Sur `8ce7ee35` et le gel `d0e7527c`, les deux réglages reproduisent le même préfixe physique jusqu’au T13 inclus. Au N3/T14, le catalogue émet `ACTION2` et le parcours de couverture `ACTION1`.** Chaque réglage reproduit exactement ses propres commandes, empreintes de paquets publics et offres de cavité sur les deux SHA. [Index et paramètres](sic-as66-preparation-84-97/banc.json) · [Quatre captures](sic-as66-preparation-84-97/recus.zip)

| Réglage depuis N1 | Résultat du préfixe | Témoin |
|---|---|---|
| Catalogue, cible complète, plafond global 16, 600 par niveau | 16 commandes, deux niveaux terminés, arrêt `session_action_budget`. La trace physique égale le reçu historique réexécuté pour 83. | **84** · N1/T5, `sliding_cavity/sliding_cavity_access`, `ACTION2`, `OP18`. Le retour termine N1 avec `matched:null`. Sept tickets de cette offre aux T5 et T8–13. Aucune offre 97 dans ce réglage. |
| Réglage publié de `qualifyActionCoverage`, cible trois niveaux, sans plafond global explicite, 600 par niveau | N3 terminé au T19. La famille dirige six tickets `clocked_cavity_access` en N3. | **97** · N3/T14, `ACTION1`, `OP18`, projection confirmée. T14–19 donnent `ACTION1, ACTION1, ACTION1, ACTION1, ACTION4, ACTION1`. Les cinq premiers retours confirment leur projection. Le dernier porte `matched:false` et termine N3. |

Les deux parcours usent de l’agenda natif, du pack de récupération par défaut, de la curiosité native et de la graine 0 du pont. Le lanceur réutilise la fonction `run` du catalogue à `8ce7ee35` avec son observateur d’offres et le service natif. Le relevé des commandes et des paquets reste ordonné ; le filtre de famille porte uniquement sur les offres détaillées. Les six tickets 97 constituent des commandes d’accès, avec continuation éventuelle au sein d’un plan. Ce relevé prépare le travail de branche et les substitutions.

**Provenance.** `2a17e14b` donne le témoin AS66 N3/T14 et le compteur six pour une session ciblée. La mention de curiosité active y concerne DICO. Les archives du banc attestent le réglage du catalogue de 16 et la fonction publique `qualifyActionCoverage` avec sa cible AS66 de trois niveaux. L’URL et le plafond exacts de la session ciblée d’origine restent inconnus. L’équivalence entre les deux SHA porte sur les relectures décrites ici. [Inventaire historique](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Parcours de couverture](https://github.com/yannick-fontan-1981/sra-playground/blob/8ce7ee35/tests/helpers/sic-qualification.ts)

Depuis le banc, avec Node 24.22.3, un checkout propre du SHA à mesurer en `$m`, les jeux et Pyodide préparés, employer deux fichiers de sortie neufs :

```powershell
node scripts/sic-recapture-strategy-inventory.mjs $m catalogue.json --offer sliding_cavity '*' '*' AS66
node scripts/sic-recapture-strategy-inventory.mjs $m couverture.json --target-levels 3 --session-budget none --offer sliding_cavity '*' '*' AS66
```
