# COMB · ligne 46 · réfutation et réexécution locale

**Correctif qualifié sur la branche `24e9743683b22b2256104d9f4de2c84abb1a1de3`.** Le [lot initial](../comb-ligne-46/BILAN.md) reste le verdict du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le contrôle reprend huit départs et 69 gestes au gel, onze départs et 84 gestes sur le correctif, dont trois captures par retours construits. Le nominal concorde sur les 16 tickets et retours physiques, dont 13 tickets de la famille.

- T3 en N1 et T9 en N2. Ajouter un seul contre-exemple multifactoriel de la portée actuelle, en conservant la vue et les arêtes nominales. Le gel conserve les compilations, les anciens clics et leurs retours. Le correctif les écarte sur `factor_product_independence_refuted_in_current_scope`. Il fait jouer ACTION1 de contact au T3 et `ACTION6(45,20)` de service imbriqué au T9. Le retour du repli T3 conserve le gain officiel. Ce gain n’établit pas l’indépendance réfutée.
- T9 et arête exacte. Une arête récoltée par le réducteur sur le même tuple complet `[4,4,11] → [4,8,11]` permet `ACTION6(31,20)` comme réexécution locale d’un seul pas, malgré le contre-exemple d’un autre tuple. Le garde admet le ticket, le jeu confirme son vrai retour et le préfixe est scellé. Le T10 recommence à l’indice 0. L’ancien plan nominal aurait poursuivi le deuxième pas de son préfixe.
- Au même T9, l’arête est inutilisable avec une contradiction portant précisément sur son tuple, ou avec un ancien contre-exemple dépourvu de tuple pour ce contrôle. Donner l’arête réellement mesurée `[9,4,4] → [9,8,4]`, dont coïncident le contrôle et la valeur du facteur 1, ne suffit pas non plus. Les trois contrôles conservent l’abstention de ce producteur.
- Au T4, le contre-exemple N1 reste dans l’époque 1 et le service observe l’époque 2. Il n’est pas utilisé et ne change aucun des quatre gestes et retours de comparaison. Les contre-exemples sont acquis par le réducteur sur des images construites à partir de retours du jeu. Les gestes des plans et des replis sont ensuite réellement joués.

Préenregistrement opérateur `4efefe02`, attentes auteur `81f2d53d`, bilan auteur `9826a2663375a5c605dbc4e2310ebf4be212a085`. Premier essai à 00:37:48, verdict à 00:47:55 (UTC−3, 10 min 07 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local. Le correctif produit d’abord les preuves que le gel recevra aussi.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-comb-46-refutation-' + [guid]::NewGuid())
node qualifier.mjs candidat $py $out
node qualifier.mjs gel $py $out
node verifier.mjs $out
```
