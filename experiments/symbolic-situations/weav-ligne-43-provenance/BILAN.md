# WEAV · ligne 43 · provenance de la paire

**Correctif qualifié sur la branche `b01ca9bfde92510eb622a105e1f1470c796dc8e0`.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` conserve le défaut mesuré dans le [lot initial](../weav-ligne-43/BILAN.md). Neuf départs et 97 gestes exécutés par SHA. Les deux moteurs concordent sur les 16 gestes nominaux, et leurs décisions et retours publics du rejeu de 32 gestes concordent aussi.

- Au vrai T5, le retour authentifie la paire d’entrées des deux axes ACTION1 et ACTION3, le propriétaire 0, l’époque et les deux références du passage. Son empreinte est celle de l’événement de paire. T7 réutilise la paire dans le ticket ACTION1 et le vrai retour confirme sa projection.
- Au T7, garder identiques la vue, les entrées d’axes et la progression, puis substituer soit la référence du retour horizontal T2, soit l’époque de la paire. Le gel joue encore ACTION1 et donne le même retour nominal dans les deux cas. Le correctif retire la reprise et fait jouer le clic de frontière `ACTION6(28,61)`, avec admission et retour `matched:null`. Le résultat est le même après reconstruction d’un journal altéré de chacune des deux façons.
- Reconstruire le journal intact conserve le ticket et son retour. Enlever la paire ou conserver seulement l’ancien événement dépourvu de reçu donne le même repli que les substitutions sur le correctif. Les six variantes font jouer leur ticket après le préfixe commun.
- La prolongation à 32 gestes passe en N2 après le T27. Au T28, paire et empreinte du reçu sont conservées dans le journal. Aucune décision N2 de cette fenêtre ne réutilise la paire N1. La preuve inter-époque se limite à sa conservation.

Préenregistrement `4efefe02`, attentes auteur `fd53da26`, bilan auteur `c110009e`. Premier essai à 00:37:48, verdict à 00:45:07 (UTC−3, 7 min 19 s). La comparaison de la paire conservée a été corrigée pour ignorer l’ordre de sérialisation des clés. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-weav-43-provenance-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
