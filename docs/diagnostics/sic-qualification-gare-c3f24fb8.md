# GARE · transfert 35 et analogie 36

Le banc a rejoué le catalogue depuis N1 sur `8ce7ee35`, sur le gel `d0e7527c` et sur la preuve `c3f24fb80a39604bf99686f7c0725b175c2628dd`. Chaque exécution nominale utilise le jeu réel, cible les six niveaux, autorise 600 gestes par niveau et transmet un budget global de 16, sans curiosité active ni graine explicite. Les 16 tickets et les 16 retours physiques sont comparés dans leur ordre. Les huit tests passent sur chacune des trois révisions. Les neuf sessions instrumentées ont la même empreinte sur les trois. La garde accepte chaque clic et la mesure suit son retour. Les trois substitutions sur plateau intact sont également jouées depuis N1. Les manipulations du support ou du marqueur utilisent séparément des présentations construites. [Reçus par révision](sic-gare-c3f24fb8/recus.zip) · [Index des témoins](sic-gare-c3f24fb8/banc.json)

| Ligne | Nominal | Intervention au même état et suite observée |
|---|---|---|
| **35, qualifiée sur le gel** | `observed_framed_transfer` aux T1–3 et T8–11. **7 occurrences sur GARE** parmi les 11 recensées dans tout le catalogue. T1 choisit (4,23) parmi trois offres sur une paire unique de bandes. Le retour établit une mesure de déplacement. | Retirer l’éligibilité de (4,23) produit (44,13) au T1, toujours dans 35. Le vrai retour a neuf images et se termine en `e7dd49ee7d0cc38a`. T2 émet (54,13). Retirer toute l’entrée au T1 libère séparément `information_goal` en (19,13). |
| **36, qualifiée sur le gel** | `observed_framed_analogy` aux T4–7 et T12–16, soit **9/9**. À T4, l’analogie s’appuie sur un homologue de même masque et trois références de prémisse. Le clic (9,13) mesure déplacement et remplacement. T12 retrouve l’analogie en N2. | Au T4, retirer (9,13) libère `field_service_composition` en (39,13), retour `07229f3a6c21253d`, puis reprise de 36 en (9,13) au T5. Au T5 du préfixe nominal, retirer (34,23) maintient 36 avec la projection de dépendance uniforme en (59,13). Son retour de onze images atteint `9d39afaf7dd1e657` ; T6 passe au service de champ en (44,13). |

La variation de support au T1 fait perdre le point initial. La variation d’un pixel du marqueur après le T3 fait perdre l’analogie au T4. La famille de rappel émet alors (13,23). Les deux entrées partagent le sélecteur `FramedPolicy.select` et les mesures de `FramedTransfer`. Le crédit séparé de 36 repose sur sa condition de projection et son alternative interne au T5. Les résultats portent sur le préfixe, ses retours et les substitutions ciblées. La victoire historique du jeu complet est consignée dans les reçus du gel.

L’arbre `src` de `c3f24fb8` est identique à celui du gel, `a1cbde2afc41532c7c047eb05c8637ef02b584d0`. Critères `d7e06cff`. Les sources de chaque moteur et les déclarations de sa révision sont extraites avec Git. La même sonde lit les tickets, projections, acquisitions et gardes. Le test utilise le comparateur public des images du jeu et des animations. La palette optionnelle est écartée de cette comparaison de paquets par le harnais de preuve.

Depuis le banc, sous Node 24.22.3 avec une racine de jeu et Pyodide préparés :

```powershell
$d = 'artifacts/verification-gare'
foreach ($version in '8ce7ee35','d0e7527c','c3f24fb8') {
  py -3.11 scripts/test-sic-gare-framed.py $version $d --game-root ../sic-main-delivery --node node
}
Get-FileHash "$d/*.json"
```
