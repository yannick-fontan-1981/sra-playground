# Banc indépendant de l'agenda P05 actif

Candidat `09b9a509e5e07894b9fccf170f22ae26cbeffbda`, issu du shadow `189b96ee`. Le témoin natif est `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`. Les bras jouent le vrai jeu et le vrai service depuis N1, à budget de session égal et horloge de planification déterministe. L'activation est explicite dans B. [Critères de l'auteur](https://github.com/yannick-fontan-1981/sra-playground/blob/09b9a509e5e07894b9fccf170f22ae26cbeffbda/docs/architecture/sic-agenda-local-p05-actif.md)

## Budget local d'une action

Sur **AS66 en V6**, les 16 décisions et 168 événements natifs concordent, ainsi que les deux classements et leurs preuves. Sur **G50T en SIC**, les 16 décisions et 163 événements concordent, ainsi que les six classements et leurs preuves. Au T6 de G50T, le même ACTION4 reprend le vecteur acquis sous P07. Les 28 tests ciblés passent, y compris le refus d'une ancienne proposition sous une observation plus récente.

## Budget local nul · G50T

Deux départs indépendants sur le même candidat disposent d'un geste de session. Le quota local passe de 1 à 0. Le comparateur natif relève le premier écart au **N1/T1, événement 2**, sur `/value/family` dans l'événement de proposition. Le reçu de classement diverge d'abord sur `selected`.

| Quota local | Proposition et garde admise | Retour natif |
|---|---|---|
| 1 | `sic_verify_remote_replay` · P05 · `current_replay_and_carrier_bound` | `compare_replayed_motion_and_remote_return`, `matched:null` |
| 0 | `sic_public_input_exploration` · `current_public_input_bound` | `observed_public_input_return`, `matched:null` |

Les deux tickets jouent ACTION1 avec les mêmes paramètres. Les observations initiales et les paquets physiques après le geste ont les mêmes empreintes. Le repli modifie donc la proposition, l'autorisation et l'attribution du retour à commande identique. Le premier essai du Banc lisait le groupe de besoin de l'agenda pour le champ « famille ». La mesure a été corrigée pour lire le propriétaire dans la garde, puis le jeu a été recapturé.

## Rejouer

Depuis le Banc avec Node 24.22.3, `$a` est le checkout de référence et `$b` le checkout du candidat. Réserver un dossier de sortie neuf.

```powershell
node scripts/sic-p05-shadow-native.mjs $a $b 09b9a509e5e07894b9fccf170f22ae26cbeffbda artifacts/sic-after-98/p05-actif-recontrole --active
Push-Location $b
node --test tests/sic-p05-agenda-shadow.test.ts tests/sic-native-resolution.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-recorded-pulse.test.ts
Pop-Location
```

Les preuves d'activation portent sur une offre préparée et l'abstention. Un classement entre plusieurs offres et le transfert sur une troisième mécanique restent à éprouver à leurs raccords. [Shadow qualifié](sic-banc-p05-shadow-189b96ee.md)
