# PIPE · ligne 60, ports réciproques et reprise du montage

**Ligne 60 qualifiée sur le gel par le Banc.** Six préfixes et 400 tests sur `aa75791a365b1ab6edcfa6a464654c6432cb3b46`, avec l'arbre du gel et 16 gestes nominaux concordants avec `8ce7ee35`. Critères `85d1288b`, bilan auteur `28b78d80`. Premier essai à 00:57:34 le 28 novembre (UTC−3). [Contrôles](sic-pipe-aa75791a/banc.json) · [Journaux](sic-pipe-aa75791a/recus.zip)

- **Raccords et estimation.** Quatre liaisons réciproques et huit ports ouverts sont constatés au départ. En sept états explorés, le calcul trouve un graphe connexe à huit liaisons, sans port ouvert, avec quatre quarts de tour conditionnels. T1 libère seulement le clic d'expérience (16,28). Son retour relie réellement la cellule 3 à la 6 et acquiert le sens de rotation. Les variantes stationnaire et à port voisin altéré ne l'acquièrent pas.
- **Méthode consommée.** T2 garde le clic (48,28) dans les deux bras. Avec la mesure, le service prépare trois étapes conditionnelles. Sans elle, il juge le clic comme un essai unique. Le retour nominal de T2 confirme les ports et ferme néanmoins ce préfixe après un changement extérieur de 371 pixels. Les passages officiels surviennent à T4 et T12.
- **Reprise ou nouveau plan.** Le vrai T14 confirme les ports et laisse ouvert le même plan. T15 clique (14,22) à l'indice 1. Présenter le même retour avec un seul pixel extérieur ajouté conserve la confirmation des ports et scelle le plan. Le même clic (14,22) est alors libéré à l'indice 0 d'un nouveau plan de deux gestes.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais sous Node 24, `$b` désigne le Banc avec Pyodide local et `$out` un nouveau reçu. Conserver le dossier de corpus V41 pour les tests. La capture détaillée reste sous `artifacts/qualification-pipe-aa75791a`.

```powershell
node experiments/sic-agenda-offres/pipe-60/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-radial-port-parity.test.ts tests/v6-radial-port-integration.test.ts
py -3.11 "$b/scripts/check-sic-radial-port-continuation.py" $out
```
