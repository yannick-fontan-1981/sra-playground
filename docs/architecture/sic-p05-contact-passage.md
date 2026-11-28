# P05 au contact du commutateur de passages

Le raccord porte sur le contact encore inexploré que `planSwitchRoute` a sélectionné après avoir constaté que les connexions courantes ne donnent aucune route suffisante. Les faits sont le site mesuré, la commande publique, l’observation courante et l’absence de précédent essai dans ce contexte. Le retour du contact appartient au fournisseur de passage, qui vérifie la reconfiguration.

## Attendus fixés avant le raccord

- En mode d’observation et au quota local d’un geste, les pas d’approche, le contact, ses propres preuves et le retour de connexion concordent avec la référence.
- Au quota local nul, les pas d’approche P07 gardent leurs tickets. Le contraste n’apparaît qu’à l’offre unitaire de contact. Le classement P05 s’abstient au lieu d’autoriser l’essai. Le test tranche sur le ticket du service et sur l’absence de reconfiguration acquise.
- Le changement de palette, le miroir de la géométrie et la commande inversée exercent le même contrat sur la fixture publique existante. Le Banc conserve une réserve indépendante pour éprouver ce raccord.

## Contrôle local

Depuis N1, le service acquiert les passages jusqu’à N3. Dans les deux variantes de la fixture de développement, le quota nul conserve les deux tickets d’approche P07. Au contact, le premier champ qui diverge dans la comparaison est `selected`. Le service de cette fixture ne libère aucun ticket de contact et la connexion reste inchangée. Au quota d’un geste, le ticket P05 et le retour de reconfiguration reproduisent la référence. La garde et le traitement du retour restent ceux de `createSicPairedPassage`.

```powershell
node --test tests/sic-paired-passage-continuity.test.ts tests/sic-p05-agenda-shadow.test.ts tests/sic-effect-composer.test.ts
npm run typecheck
```

Les 21 tests ciblés couvrent la continuité, le budget local et le composeur commun. Les deux variantes citées sont des terrains construits. Le retour d’un autre moteur fait l’objet de la réserve du Banc.
