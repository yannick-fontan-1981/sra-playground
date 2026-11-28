# AR25 · mesure du déplacement et couverture réfléchie

Les deux témoins sont répertoriés dans le catalogue depuis L1, en ouverture native, avec plafond global de 16 et plafond de 600 par niveau. Les essais partent sur `8ce7ee35`, `d0e7527c` et le candidat. Les retours d’AR25 sont produits par le jeu local, puis transmis au service sous forme publique. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères préenregistrés](ATTENDUS.md)

## Ligne 8 · distinguer la pièce mobile du bord de cavité

| Épreuve | Pré-événement, décision et retour |
|---|---|
| N1/T1 nominal | Une silhouette pleine de 45 pixels, couleur 4, se trouve en (36,15). Sa forme correspond à la seule cavité, en (51,45). Le corps contrôlé et l’effet des cinq commandes simples restent inconnus. En ordre de référence, la calibration essaie `ACTION1`. |
| Retour nominal | La réidentification conjointe des poses retrouve le même corps en (36,12). Les 35 pixels de bord de la cavité gardent leur valeur 9. La famille fixe le corps actif à 0 et rattache le vecteur [0,−3] au retour de `ACTION1`. Le ticket de calibration lui-même a `matched:null`, car son effet était ouvert. Le T2 essaie la commande suivante encore inconnue, `ACTION2`. |
| Substitution au T1 | Du même domaine de commandes, la sélection expérimentale retire uniquement la première et le service émet `ACTION2`. Le corps atteint (36,18), le bord garde sa valeur et la famille apprend [0,+3]. Le T2 essaie alors `ACTION1`. |
| Même ticket, retour stationnaire construit | Le service reçoit l’ancienne image, alors que l’empreinte du vrai retour reste disponible. La famille ne lie aucun vecteur et garde le corps actif indéterminé. Elle mémorise `ACTION1` sans mouvement aux mêmes poses et propose `ACTION2` à la reprise. |

Le gel calcule l’admissibilité des calibrages, réidentifie les poses et consomme déjà les mesures. Le changement du candidat isole `Containment.chooseCalibration` dans cette articulation. Le témoin caractérise la mesure de déplacement. Les modes `contact`, `walk` et `selection` restent des cas distincts de ce fournisseur. [Source du fournisseur](../../../src/logos-engine/v6-containment.ts)

## Ligne 77 · compléter une couverture réfléchie

Les trois premiers retours publics apportent des covariations au producteur de réflexion, qui reconstruit lui-même la grille et le mouvement. En cellules de pas 3, il relève [0,−1], [0,+1], puis [−1,0] pour `ACTION1`, `ACTION2` et `ACTION3`. Les références de ces trois retours autorisent la projection sur les deux axes. Le T4 lie le marqueur au corps 0 et l’axe vertical à la colonne 10. Le placement de coût 14 garde l’axe et demande un déplacement [−4,+10]. Le premier pas est `ACTION3`, indice 0. Aucune des cinq cellules cibles n’est déjà couverte à cette coupe. Les treize pas d’offre entrent dans le budget de la session de 16 et leurs retours confirment chacun la projection de masque. Le niveau officiel continue au terme de ce préfixe.

| Épreuve sur le gel | Résultat natif |
|---|---|
| Retirer à la seule famille réflexion l’acquisition du vrai retour T3 | Le retour physique et le reçu de contenant sont conservés. La famille réflexion ne dispose que de la mesure verticale. Elle s’abstient au T4 et le service émet `containment / ACTION4`. |
| Retirer le résultat de `ReflectedCover.solve` au T4 | Même monde lié et mêmes covariations avant l’appel. Le service émet `containment / ACTION4`, puis reprend l’offre réfléchie au T5. |
| Rendre l’ancien plateau après le vrai ticket T4 | La comparaison de masque signale `reflection_or_control_contradiction` et scelle le plan. La reprise émet un nouveau `ACTION3` à l’indice 0. |
| Borner la première offre à douze actions et rejouer | Les seize paquets physiques restent identiques au nominal. Au T16, la famille calcule une nouvelle offre à l’indice 0. Le pré-événement contient déjà la cellule réfléchie (17,15). Le placement garde l’axe et repart avec un résidu [0,+2]. Le nouveau pas `ACTION2` conserve (17,15), couvre (17,16) et obtient `matched:true`. |

Le gel produit, consomme et vérifie déjà le placement via le raccord `ReflectedCover.solve`. L’exemple T16 montre une conservation effective pour ce placement. Le solveur impose la couverture complète et minimise le déplacement. Le test ne généralise pas la conservation à chaque placement admissible. La suppression d’un retour de réflexion cible sa mémoire propre. Le fournisseur de contenant ne fournit à la couverture ni son vecteur, ni sa liaison de corps. [Source du fournisseur](../../../src/logos-engine/v6-reflected-cover.ts)

## Rejeu opérateur

Depuis le checkout du SHA à éprouver, avec Node 24+, Git, tar et Pyodide local :

```powershell
$d = 'experiments/sic-agenda-offres/ar25-8-77'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/ar25-qualification.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante reprise-reflet --gestes 16 --pyodide $py --recu "$env:TEMP/ar25-reprise.json"
```

Le vérificateur examine dix préfixes. Le reçu conserve les faits avant le choix et leur empreinte, le ticket autorisé et la réponse. Il enregistre le vrai paquet et le plateau présenté séparément quand le harnais substitue un retour. Les variantes de choix, de preuve et d’horizon sont limitées au processus de rejeu. [Opérateur](operateur.mjs) · [Vérificateur](verifier.mjs)
