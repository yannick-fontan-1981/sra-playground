# SYME · ligne 78, miroir et abstention en cas de périodicité ambiguë

**Ligne 78 qualifiée sur le gel par le Banc.** Six préfixes, huit tests et 16 tickets nominaux concordants avec `8ce7ee35`. Harnais `85194a499e1b81c4c26e418efbd171bf469d00d1`, bilan auteur `e485e5b1`. [Contrôles](sic-syme-85194a49/banc.json) · [Journaux](sic-syme-85194a49/recus.zip)

- Au départ, le miroir de même ligne mesure 27 paires égales et neuf contrastes. Le correspondant (53,33) détermine la couleur 9. Changer seulement cette valeur à 8 garde le clic (7,35) et change la couleur demandée par la relation. L'effet de la commande demeure inconnu à l'émission.
- Le vrai retour T1 mesure que la cellule visée devient 9. Présenter 0 dans le même paquet exécuté conserve le contraste contraire, désactive la branche et change la suite.
- Deux interprétations de période [2,2] prescrivent des réparations disjointes dans la grille construite. La famille s'abstient. En changeant une seule case entière, l'accord devient unique et la famille propose (13,13), même clic que le repli dans la première grille. Aucun de ces deux tickets construits n'a été joué.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais sous Node 24, `$b` désigne le Banc avec Pyodide local et `$out` un nouveau reçu.

```powershell
node experiments/sic-agenda-offres/syme-78/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-field-parity.test.ts tests/v6-motif-access-kernel.test.ts
```
