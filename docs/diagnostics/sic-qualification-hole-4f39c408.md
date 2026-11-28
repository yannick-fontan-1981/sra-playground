# HOLE · ligne 74, poche ouverte dans la vue et retour officiel du clic

Le harnais `4f39c40869cdb3c2881d4fef01d3a7eafaf196dd` a l'arbre du gel. Cinq préfixes et 102 tests passent. Le catalogue nominal retrouve les 16 tickets. Le Banc prolonge d'un geste la branche à poche ouverte dans la vue. [Contrôles](sic-hole-4f39c408/banc.json) · [Journaux](sic-hole-4f39c408/recus.zip)

- **Nominal.** T6 vérifie le puits 9, 44 pixels changés à l'intérieur. Les retours stationnaire et à pixel extérieur ne permettent pas d'acquérir cette sélection. La peinture suivante devient justifiée avec le vrai retour. Le changement de niveau survient séparément au T10.
- **Choix T8.** Ouvrir (36,11) dans la vue présentée connecte la poche à l'extérieur et change la cible de 10 à 9. T6 et T7 restent identiques. T8 choisit (43,11) au lieu de (20,32).
- **Retour T8.** Le vrai service exécute cette commande sur le plateau officiel, où la poche est encore fermée. Le jeu peint 92 pixels en 9, dont le pixel de bord original. La vue servie garde ce bord ouvert et mesure 91 pixels peints. Elle donne `write_effect_observed`, `matched:null` et préfixe scellé. Le score reste à zéro. La qualification couvre le choix topologique et l'écriture observée sur le plateau officiel fermé. Le retour d'un plateau officiel à poche ouverte reste hors du témoin.

Départ N1, pack natif, graine implicite 0, 16 gestes transmis au service. Le contrôle se termine après T8. Node 24 et Pyodide local. Depuis le checkout du Banc, `$g` désigne le gel et `$out` un nouveau dossier.

```powershell
py -3.11 scripts/test-sic-hole-projected-return.py $g $out
```

Le lanceur original reste dans `experiments/sic-agenda-offres/hole-74` du harnais. Les captures détaillées restent dans `artifacts/qualification-hole-74-4f39c408` et `artifacts/qualification-hole-74-t8-reprise`.
