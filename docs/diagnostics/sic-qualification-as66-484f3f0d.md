# AS66 · qualification des lignes 84 et 97 sur 484f3f0d

**La ligne 84 est qualifiée sur la branche. Le raccord horlogé de la ligne 97 est qualifié sur le gel.** Les 16 commandes et paquets du catalogue et les 19 du parcours de couverture concordent avec les captures indépendantes de `47ae8531` sur le gel. Les 12 préfixes du vérificateur comparent l’historique, le gel et le candidat, puis éprouvent le retrait des offres et la reprise. [Reçus et comparaison](sic-as66-484f3f0d/recus.zip) · [Référence indépendante](sic-preparation-as66-84-97.md)

| Ligne | Choix et preuve | Interventions et suite |
|---|---|---|
| **84 · accès statique** | Au T5 de N1, la direction [1,0] d’`ACTION2`, acquise au retour T2, et la mesure de la surface autorisent l’arrêt en (24,38). Le ticket `ACTION2` termine N1 avec `matched:null` à la frontière officielle. En N2/T8, les sondes T6 et T7 ont lié deux directions au nouveau corps. Le premier geste de l’accès, `ACTION1`, confirme sa projection et le plan reprend à l’indice 1. | Au T5, retirer seulement l’offre du nouveau raccord `SlidingCavity.proposeAccess` conserve les acquisitions. La frontière libère `ACTION3` et un nouvel accès `ACTION2` est libéré au T6. Sur le gel, le même contrôle n’a pas ce raccord et le ticket T5 reste `ACTION2`. Les sept tickets du catalogue sont conservés. |
| **97 · accès horlogé** | Les retours T12 et T13 mesurent le même masque de 12 × 12 avant le mouvement de l’acteur, aux positions (16,6) et (20,6), pour deux commandes distinctes. En N3/T14 le catalogue dispose de trois gestes et reprend par la frontière avec `ACTION2`. La couverture admet un accès de six gestes. Au même pré-événement, les horizons 1 à 5 sont refusés et 6 suffit. | Retirer le producteur temporel laisse la frontière émettre `ACTION2`, puis la famille replanifie au T15, indice 0. Après le vrai ticket T14, présenter au service le plateau précédent élimine les deux hypothèses et scelle le pas. Le reçu conserve le résultat réellement joué et le plateau présenté. T15 repart à l’indice 0. |

Pour 97, les cinq premières projections sont confirmées. Au retour T16, une seule hypothèse reste compatible. T19 porte `matched:false` et termine N3. Retirer le seul sens d’`ACTION1` conserve le nom de commande à T14 mais change la décision en question de direction. Les acquisitions de 83 gardent leurs cinq contrôles, exécutés sur le candidat avec le vrai jeu. Les 80 tests des deux producteurs passent.

Le candidat `484f3f0d066b7c00a3e2ad68c983ad556be3a3ac` modifie un seul fichier moteur depuis le gel, `v6-sliding-cavity.ts`. Critères `7651ad0e`. Les deux parcours partent de N1, avec agenda et curiosité natifs, graine 0 du pont et plafond de 600 par niveau. Le catalogue transmet 16 pour la session. Le parcours de couverture omet ce plafond global et s’arrête après trois niveaux. L’URL historique de la session ciblée reste inconnue.

Le vérificateur a relu `HEAD` en fin de capture et inscrit `776625f9`. Pendant la mesure, ce commit a ajouté uniquement la fiche `VERDICT.md`. Le contrôle Git et le reçu publié rattachent l’exécution à l’arbre moteur commun. Le banc a rapproché les deux sorties nominales du vérificateur et les 35 paquets de sa propre archive. [Contrôle indépendant opérateur a1e0f3ae](https://github.com/yannick-fontan-1981/sra-playground/commit/a1e0f3ae)

Depuis le checkout `484f3f0d`, sous Node 24, avec le banc voisin préparé et un dossier `$r` créé pour les reçus :

```powershell
$d = 'experiments/sic-agenda-offres/as66-84-97'
$p = '../sic-comparison-bench/public/vendor/pyodide'
node "$d/verifier.mjs" --pyodide $p --recu "$r/qualification.json"
foreach ($cas in 'catalogue','couverture') {
  node "$d/operateur.mjs" --moteur candidat --fiche "$d/public/$cas.json" --pyodide $p --recu "$r/$cas.json"
}
py -3.11 ../sic-comparison-bench/scripts/check-sic-as66-access.py "$r" ../sic-comparison-bench/docs/diagnostics/sic-as66-preparation-84-97/recus.zip
```
