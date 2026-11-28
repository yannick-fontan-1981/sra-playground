# CATL · ligne 50

**Qualification indépendante au gel.** Sur CATL, le service classe un mot avec les exemples publics, revalide le bouton courant et rattache chaque retour à la soumission jouée. Le harnais `fad120b559f52767208ba2620dd48b5a5f530dff` utilise le même arbre moteur que `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Sur les deux SHA, les sept départs et les 37 gestes exécutés par référence donnent les mêmes reçus.

- Au N1, les vingt exemples observés s’accordent avec la présence de 8. La permutation indépendante `[8,9,9,9] → [9,9,8,9]` change l’égalité des extrémités et conserve l’étiquette 15 ainsi que le clic `(43,52)`.
- Au N2, les vingt nouveaux exemples s’accordent avec l’égalité des extrémités. Permuter le premier token avec celui d’indice 3 change `[9,8,11,11,11]` en `[11,8,11,9,11]`, et bascule de 12 `(56,52)` à 15 `(43,52)`. Échanger seulement les indices 1 et 2 donne `[9,11,8,11,11]` et conserve 12. Pour les trois permutations, mêmes exemples, boutons, palette, échelle et multiensemble de tokens. Le nouveau ticket est libéré et le jeu officiel n’exécute pas ce ticket construit.
- Au T2 nominal, les vingt exemples du T1 sont réutilisés devant le nouveau mot et le bouton 12 est revalidé. Forcer le recalcul garde les mêmes identifiants d’exemples, caractéristiques et décision. L’empreinte complète du calcul change. Enlever seulement les deux enveloppes de boutons retenues à image identique fait perdre la question et le service joue le clic de frontière `(10,11)`. La garde nominale admet 16/16 tickets, refuse 16/16 substitutions d’un pixel au point du bouton et 16/16 références périmées.
- Les 16 retours nominaux portent les références exactes avant/après, sont scellés et laissent `matched:null`. Les T8 et T16 donnent des passages officiels. Les deux prédicats compatibles de chaque départ s’accordent sur l’étiquette dans la grammaire exercée. Le reçu ne conclut ni à une loi unique, ni à l’acquisition du mot soumis comme exemple. Un retour stationnaire construit de T1 conserve la commande officielle jouée, donne la même empreinte publique avant/après et suspend la répétition de la soumission.

Présélection `ce54d90f`, attentes auteur `4ab9c99b`, bilan auteur `3335f9636c6f6b8e08f339a5993dbbb52ca9c20b`. Premier essai à 00:15:32, premier verdict vérifié à 00:22:58 (UTC−3, 7 min 26 s). L’assertion sur la recomputation a été corrigée pour distinguer l’identifiant de l’exemple et l’empreinte du calcul. Les parcours ont été conservés. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-catl-50-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
