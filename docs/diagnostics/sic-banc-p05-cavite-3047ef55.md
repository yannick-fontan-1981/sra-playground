# Banc indépendant du départage P05 de cavité

Candidat `3047ef55a7a06d4560a07d36dfaf08719c50c802`, parent moteur `162e45506cd9196171c15cb2402cf2ca1ee4266d`, contrat `f3a9a853`. Le Banc démarre AS66 officiel au N1 en V6, avec un quota de session de sept gestes et un quota local d'un geste. Les deux moteurs sont comparés dans le bras nominal et dans le bras où la seule question ACTION1 est temporairement ajoutée aux essais connus. [Contrat et entrée du candidat](https://github.com/yannick-fontan-1981/sra-playground/blob/3047ef55a7a06d4560a07d36dfaf08719c50c802/docs/architecture/sic-p05-departage-cavite.md)

| Bras, même observation au N2/T1 | Offres et ticket effectivement joué | Vrai retour et suite |
|---|---|---|
| Nominal | ACTION1 et ACTION4 sont applicables, avec les mêmes preuves et un coût de 1. ACTION1 est retenue dans l'ordre historique. ACTION4 porte `lower_priority`. | 80 pixels changent, vue `9e25d42a95c97b84`. Direction `[-1,0]` acquise. Au tour global 7, ACTION4 reste la seule offre d'essai. |
| Retrait de la seule question ACTION1 | Le même paquet initial `fb4c841eea2f859a` et les mêmes commandes publiques alimentent le service. ACTION4 est l'unique offre et le vrai garde autorise le ticket. | 82 pixels changent, vue `1d4db55871a6a88a`. Direction `[0,1]` acquise. Le service joue ensuite ACTION2 sous `sliding_cavity_access`, retour `matched:true`. |

Le parent et le candidat concordent sur les **84 événements et sept décisions de chaque bras**. Entre les deux bras du candidat, le premier écart apparaît au **N2/T1, événement 62**, champ `/value/actions/0/action_ref`, ACTION1 → ACTION4. Le classement à preuves et coût égaux, le retrait sélectif et la consommation du retour sont chacun observés. Les 19 tests ciblés et les 37 contrôles AS66 passent.

Le harnais opère sur l'état exporté du fournisseur. Il restaure la seule clé d'essai après la proposition, puis laisse le service autoriser, jouer et enregistrer la commande. Les premières tentatives du harnais accédaient directement aux membres du fournisseur avant de tenir compte de son enveloppe native. Le verdict repose sur les quatre nouvelles captures après cette correction.

Depuis le Banc, `$a` et `$b` désignent les deux checkouts propres. Utiliser Node 24.22.3 et un dossier neuf. [Script du Banc](../../scripts/sic-p05-cavity-native.mjs)

```powershell
node scripts/sic-p05-cavity-native.mjs $a $b 162e45506cd9196171c15cb2402cf2ca1ee4266d 3047ef55a7a06d4560a07d36dfaf08719c50c802 artifacts/sic-after-98/p05-cavite-recontrole
Push-Location $b
node --test tests/sic-p05-cavity-tiebreak.test.ts tests/sic-p05-agenda-shadow.test.ts tests/sic-p05-typed-child.test.ts tests/sic-native-resolution.test.ts
node --test '--test-name-pattern=real public AS66|prefix' tests/v6-sliding-cavity.test.ts
Pop-Location
```

Ce lot possède son propre SHA et ses propres reçus. La campagne historique du moteur commun porte sur `703cd1c3`. [Dossier du moteur commun](sic-coexistence-703cd1c3.md)
