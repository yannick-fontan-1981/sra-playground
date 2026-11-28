# Banc indépendant de l'enfant typé P05

Parent `09b9a509e5e07894b9fccf170f22ae26cbeffbda`, candidat `162e45506cd9196171c15cb2402cf2ca1ee4266d`, critères `fd3e21de`. G50T officiel démarre en N1, mode SIC, plafond global de 16 gestes, quota local 1 sur les deux moteurs et horloge de planification déterministe. [Contrat de l'enfant](https://github.com/yannick-fontan-1981/sra-playground/blob/162e45506cd9196171c15cb2402cf2ca1ee4266d/docs/architecture/sic-p05-enfant-type.md)

Les 16 commandes, les 17 observations, les gardes et les retours physiques concordent. Le premier écart ordonné est au **N1/T1, événement 5**, champ `/value/controlEffectChild` du reçu de plan natif. Le parent ne publie pas ce champ. Le candidat publie l'enfant rattaché au ticket, en attente d'un retour. Six enfants sont clos dans la fenêtre vérifiée, dont quatre avec un déplacement mesuré et deux avec un résultat indéterminé.

| Tour | Preuve et consommation |
|---|---|
| N1/T1 | ACTION1 laisse le sujet immobile. Le résultat est `unresolved`. |
| N1/T5 avant retour | ACTION4 libère un ticket portant l'enfant en attente, lié au besoin parent, au sujet, à l'époque et à r5. La mémoire du parent n'a encore acquis aucun vecteur ACTION4. |
| N1/T5 après retour | L'enfant est clos sur la paire de références r5 → r6. Le sujet avance de `[6,0]`. La mémoire du parent contient ce vecteur et la référence r6. |
| N1/T6 | P07 joue le même ACTION4 et prévoit le point `[26,8]`. Le ticket et son observation portent r6. |

Le banc a remplacé la seule référence d'ouverture au moment où le fournisseur acquiert le vrai retour T5. Les cinq premières commandes et leurs paquets physiques restent ceux du nominal. Le reçu typé et les champs du vecteur ACTION4 restent absents. Le T6 perd la sélection P07. La remesure rejette également un couple destination-vecteur fabriqué, cohérent numériquement et incompatible avec les observations de ce ticket. Les 31 tests ciblés passent.

Depuis le Banc, utiliser Node 24.22.3, deux checkouts propres, et un nouveau dossier de sortie.

```powershell
node scripts/sic-p05-child-native.mjs $a $b 09b9a509e5e07894b9fccf170f22ae26cbeffbda 162e45506cd9196171c15cb2402cf2ca1ee4266d artifacts/sic-after-98/p05-enfant-recontrole
Push-Location $b
node --test tests/sic-p05-typed-child.test.ts tests/sic-p05-agenda-shadow.test.ts tests/sic-native-resolution.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-recorded-pulse.test.ts
Pop-Location
```
