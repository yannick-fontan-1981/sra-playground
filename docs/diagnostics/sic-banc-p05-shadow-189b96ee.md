# Banc indépendant du shadow P05 sur 189b96ee

Référence `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`, candidat `189b96ee533c66dafd3066bb932535e4ed854aae`, critères `c21bc482`. Le vrai moteur et le vrai jeu démarrent en N1. Les préfixes de chaque mode ont un quota global de 16 commandes, un travailleur et une horloge de planification déterministe. Seul B fournit `observeControlTrialShadow`. Le reçu de classement est collecté séparément du ticket actif. [Contrat et préenregistrement](https://github.com/yannick-fontan-1981/sra-playground/blob/189b96ee533c66dafd3066bb932535e4ed854aae/docs/architecture/sic-agenda-local-p05-shadow.md)

| Parcours | Commandes par bras | Événements natifs identiques | Classement shadow |
|---|---:|---:|---|
| AS66 · V6 | 16 | 168 | Deux questions `sliding_cavity`, T6 ACTION1 sur r6 puis T7 ACTION4 sur r7 |
| G50T · SIC | 16 | 163 | Six offres `sic_verify_remote_replay` aux tours 1–5 et 9 |

Les deux comparaisons ordonnées n'ont trouvé aucun premier écart. Le choix de référence, le choix shadow et les références de preuve concordent pour les huit offres effectivement soumises. Ces interfaces présentent chacune une offre préparée, que le shadow classe face à l'abstention. Les traces comparent les propositions, les gardes, les tickets, les commandes et les retours, y compris 17 observations par bras.

Sur G50T au T5, la sonde P05 joue ACTION4 depuis `[14,8]` avec une position finale encore inconnue. Au T6, la position courante est `[20,8]` et P07 propose le même ACTION4 en projetant `[26,8]`. Le vrai retour du T6 confirme cette projection. L'écart entre les deux justifications est visible à commande identique.

**Contre-épreuves.** Les 25 tests ciblés passent. Le retrait des références donne une garde indéterminée, l'effet déjà connu donne une garde inapplicable et le budget nul fait diverger d'abord `selected` dans le reçu shadow de la fixture. Une mutation du reçu par l'observateur suivie d'une exception laisse intactes les preuves du témoin natif. Ces interventions ciblent les entrées du classement et les fixtures de famille. Le parcours réel nominal exerce la collecte sans mutation. [Tests scellés](https://github.com/yannick-fontan-1981/sra-playground/blob/189b96ee533c66dafd3066bb932535e4ed854aae/tests/sic-p05-agenda-shadow.test.ts)

Depuis le Banc, utiliser Node 24.22.3. Les checkouts `$a` et `$b` sont propres et fournissent les actifs Pyodide vérifiables. Les traces et reçus sont conservés en local, dans le dossier d'état choisi.

```powershell
node scripts/sic-p05-shadow-native.mjs $a $b 189b96ee533c66dafd3066bb932535e4ed854aae artifacts/sic-after-98/p05-189b96ee
Push-Location $b
node --test tests/sic-p05-agenda-shadow.test.ts tests/sic-native-resolution.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-recorded-pulse.test.ts
Pop-Location
```

Ce verdict qualifie le shadow à activation explicite dans les deux modes et préfixes indiqués. La qualification d'un classement actif et celle d'une composition sur une mécanique réservée ont chacune un protocole propre. [Banc de continuité après les 98 lignes](sic-banc-apres-98.md)
