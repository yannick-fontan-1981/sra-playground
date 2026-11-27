# Reçu de développement du consommateur figé

Consommateur `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6` · opérateur `514cf4a83d168d1c5eb3131af00f3b1b1022b315` · partition `developpement` · Node v24.22.3. Le processus reçoit uniquement le message initial et le retour de chaque commande jouée. Les huit fiches cadran et les quatre fiches ressource donnent 18 départs en tenant compte des mondes compatibles.

| Famille | Départs admis | Actions proposées et exécutées | Lectures suivies d’une nouvelle commande | Succès terminaux |
| --- | ---: | ---: | ---: | ---: |
| Cadran | 12/12 | 44/44 | 8/8 | 12/12 |
| Ressource | 6/6 | 30/30 | 4/4 | 6/6 |
| Ensemble | 18/18 | 74/74 | 12/12 | 18/18 |

Les refus d’action, abandons, échecs terminaux et incidents techniques sont tous à zéro dans le reçu du montage figé. Un premier essai avec le fichier d’entrée seul avait produit 18 erreurs de chargement avant l’admission. L’opérateur recopie chaque dépendance déclarée dans le processus isolé. L’essai ci-dessous monte les six fichiers nécessaires.

Depuis la racine du checkout Agenda, avec le checkout de l’opérateur dans le dossier voisin et Node 24 :

```powershell
$programme = 'experiments/sic-agenda-offres/public-v1'
$operateur = '../symbolic-public-format/experiments/symbolic-situations/public-format/operator/run.mjs'
$rapport = Join-Path $env:TEMP ((New-Guid).Guid + '.json')
node $operateur --partition developpement --depot (Get-Location).Path `
  --sha f296ac1c2e18f9d02b8e3045c3a225c61553c0e6 --entree "$programme/solveur.mjs" `
  --dep "$programme/admission.mjs" --dep "$programme/planifier.mjs" --dep "$programme/schema.json" `
  --dep experiments/sic-agenda-offres/agenda.mjs --dep src/sic/reasoning-mode.ts --rapport $rapport
```

L’horizon de décision est de dix gestes et les cinq accusés matériels de développement sont traités explicitement. Les réussites sur les ressources sont mesurées par le jeu après scellement. Ce reçu porte exclusivement sur le développement. [Règles d’admission et de décision](README.md)
