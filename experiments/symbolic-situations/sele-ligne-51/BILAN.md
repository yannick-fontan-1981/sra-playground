# SELE · ligne 51

**Qualification indépendante au gel.** Le harnais `77df94e33aa8bae8ecc7f81c8b57e062943dffa6` et le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` donnent les mêmes reçus sur huit départs et 91 gestes par SHA. Les 16 tickets nominaux sont scellés, avec `matched:null`. Les gains officiels et les mesures de liaison ou de front ont leurs propres preuves.

- N1/T1. ACTION6`(32,52)` acquiert le seul support qui change avec le motif extérieur, en `(30,24)`. Le même clic suivi d’un retour stationnaire construit ne lie aucun support et propose ACTION3 de frontière.
- N1/T4. Le vrai ACTION5 rend 16 trames, deux segments et un seul front attribué au support du T1, aux ordinaux 8–13. Sa trame finale égale la vue avant geste. Le reçu porte la paire d’observations et le front est ancré à la référence de départ du paquet. Au T5, ACTION3 cite l’observation du retour et exploite le front. Ne servir que la dernière trame, ou conserver aussi la première, laisse le même paquet officiel joué et la même vue finale, sans front ni lancement acquis. Le service libère alors le clic de frontière `(10,61)`.
- N2/T10. Le remplacement réciproque des valeurs centrales rattache `(43,52)` au nouveau support `(44,28)`. Le retour construit modifie seulement l’ancien centre, conserve les deux supports parmi les zones changées et rend la liaison indéterminée. Le service reteste le clic `(43,52)` au lieu de lancer ACTION5.
- N2/T18 dans la prolongation à 20. Les 25 trames officielles montrent le front du support `(18,28)` aux ordinaux 5–9 puis celui de `(44,28)` aux ordinaux 12–15. Le préfixe concorde avec la projection et le score passe à deux niveaux. Servir la finale seule conserve le passage et le prochain clic N3, avec aucune nouvelle mesure de front. Permuter les deux segments intermédiaires dans le vrai paquet, tout en gardant le même geste, la finale et le score, inverse leur ordre mesuré `[6,8]`, puis `[12,15]`. La comparaison du préfixe devient `unknown_or_missing_expected_front`. Le prochain clic N3 reste `(12,52)`.

Présélection `93920362`, attentes auteur `421e12dc`, bilan auteur `22f992a1a2dc8c76ffd305c274325208f64e1507`. Premier essai à 00:41:12, verdict à 00:47:55 (UTC−3, 6 min 43 s). Le vérificateur a été corrigé pour comparer la paire de références du paquet et l’ordre des ordinaux. Les trames du retour permuté sont construites à partir du même paquet officiel. Le lot ne porte pas sur la ligne 75. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-sele-51-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
