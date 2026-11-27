# ONDE · trois décisions périodiques depuis le niveau 1

Le banc a exécuté 18 parcours natifs sur `8ce7ee35` (historique), `d0e7527c` (gel) et `75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef` (candidat). **Les 16 tickets et retours du catalogue concordent sur les trois moteurs.** Le parcours atteint L4 après trois niveaux franchis. Les 16 gestes constituent le budget global de la session, avec 600 par niveau. L’agenda et la curiosité d’ouverture sont actifs, le jeu part de L1 sans graine explicite. Les tours ci-dessous sont numérotés depuis le départ de la session. [Index des 18 parcours](sic-onde-75aa3829/banc.json) · [Reçus et carte de 16 gestes](sic-onde-75aa3829/recus.zip)

| Ligne | Mesure, action et retour | Verdict de substitution |
|---|---|---|
| **28 · N1, T1** | Deux profils de période 8 donnent 1 au détecteur x=25 pour une cible de 5. Aucune loi individuelle acquise. Le ticket `ACTION3` sonde sans prédire. Le vrai jeu donne [−1,0], avec `matched:null`. Le service lie ce déplacement à la commande. Une occurrence. | Le gel et le candidat consomment l’ordre déclaré des commandes. Sur le candidat, le fournisseur expose aussi les deux offres avant sélection. Choisir la seconde sur la même liste libère `ACTION4`. Le jeu donne [+1,0] puis confirme la prédiction du prochain `ACTION4`. Le gel garde sa première offre sous cette intervention sur la liste. |
| **29 · N1, T2** | La commande reste `ACTION3`. Cette fois, le service prédit les profils à partir de la loi acquise et des 11 préimages possibles parmi 64 affectations. Le jeu franchit la frontière. Le reçu porte `official_boundary`, `matched:null`. Au N2, la prédiction du T3 est confirmée. Dix occurrences dans les 16 gestes. | **Déjà consommée par le gel.** Retirer uniquement [7,0] du domaine laisse 10 préimages. Au T2 les deux moteurs changent le focus par `ACTION6(4,32)`, puis franchissent la frontière au T3. La source du candidat qui articule les sondes des lignes 27 et 28 n’est pas requise pour cette décision. |
| **27 · N3, T7** | Deux périodes 10 et 12, trois préimages parmi 120 affectations. Le candidat présente trois offres ordonnées, en (48,3), en (57,3), puis `ACTION4`. Le ticket nominal clique en (48,3), mesure [−1,−3] et lie la loi à cette occurrence. Le T8 répète le clic avec prédiction et reçoit `matched:true`. Deux occurrences, T7 et T14. | Sur le candidat, choisir le second canal au T7, sur les mêmes offres, libère (57,3). Le retour daté mesure [+1,+3]. Au **T8**, la famille devient `public_occurrence_recall` et clique en (29,3), avec `canonical_scene_reconciliation_required`. Sur le gel la demande de substitution conserve la trajectoire nominale. |

Sur les fiches communes de palette, d’ordre déclaré, de retrait de préimage et de budget, les tickets, gardes, observations et retours concordent entre gel et candidat. La fiche d’horizon élargi donne 64 commandes à la session. Elle rend une exploitation `ACTION3` disponible au T7. Le budget qui établit la ligne 27 du catalogue reste **16**. L’absence de contraste dans les profils et l’épuisement des commandes ont aussi été éprouvés dans les variations locales du fournisseur. Les identités de parcours excluent seulement les listes d’offres inspectées séparément et ces variations effectuées sur copies. L’empreinte indépendante des 16 lignes de projection est `7a4db7cb964c704023b41dff29da5fbbb10971c00490a1873a576b6919d38247`.

La référence de victoire ONDE parmi les 107 porte sur six niveaux et 44 commandes en mode de qualification complet. Le présent verdict couvre le catalogue et ses interventions localisées. Le seul chemin moteur modifié par cette branche est `src/logos-engine/v6-periodic-sums.ts`. Les attendus sont figés à `592e8e1903fb32f30c3bf7fdfbedcbfee0d8c9e8`. [Contrat du fournisseur](https://github.com/yannick-fontan-1981/sra-playground/tree/75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef/experiments/sic-agenda-offres/onde-27-29)

## Rejouer

Depuis le checkout propre au SHA candidat avec Node 24.22.3, préparer `public/python` et fournir Pyodide. Le vérificateur de la branche exerce les quinze parcours des sept fiches d’origine. Le bloc suivant les complète par les trois parcours de 16 gestes mesurés par le banc. Extraire `catalogue-16.fiche.json` de l’archive des reçus dans le répertoire courant.

```powershell
$d = 'experiments/sic-agenda-offres/onde-27-29'
$py = (Resolve-Path ../sic-comparison-bench/public/vendor/pyodide).Path
node "$d/verifier.mjs" --pyodide $py --recu ./verification-onde.json
foreach ($source in 'historique','gel','candidat') {
  node "$d/operateur.mjs" --moteur $source --fiche ./catalogue-16.fiche.json --pyodide $py --recu "./$source-catalogue16.json"
}
```

Pour refaire la capture ciblée de la sonde alternative sur chaque moteur, utiliser `--fiche "$d/public/autre-canal.json"`. Les reçus locaux complets sont dans `artifacts/qualification-onde-75aa3829/`.
