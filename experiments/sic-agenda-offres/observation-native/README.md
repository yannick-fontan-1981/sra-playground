# G50T L4, tours 11 et 12 en observation

**Deux sélections indéterminées sur deux.** La paire montre un passage de P07 à P05 alors que les commandes publiques et le mode restent identiques. Le journal permet de reproduire le mode, la carte et la réserve. La première passe a rendu son verdict avant la lecture du nom de la famille et de sa stratégie. [Contrat temporel champ par champ](CONTRAT.md)

| Tour | Observation disponible avant la sélection | Verdict de l’agenda hors ligne | Reçu de la seconde passe | Cause |
| --- | --- | --- | --- | --- |
| 11 | Retour du tour 10 concordant, révision 135, 10 actions L4, réserve 28 | Indéterminé | `coordinate_visible_motion / sic_verify_remote_replay / P07` | Le besoin actif et l’offre de route qualifiée manquent à la coupe. Les arrêts effectifs des fournisseurs ne sont pas connus. |
| 12 | Retour du tour 11 concordant, révision 136, 11 actions L4, réserve 27 | Indéterminé | `coordinate_visible_motion / sic_verify_remote_replay / P05` | La preuve distinguant la sonde au contact d’une poursuite de route n’est pas enregistrée avant la sélection. Le changement de révision ne suffit pas à l’établir. |

| Comparaison | Accords | Écarts | Indéterminés |
| --- | ---: | ---: | ---: |
| Sélection (famille **et** stratégie) | 0 | 0 | 2 |
| Mode de raisonnement | 2 | 0 | 0 |
| Carte du mode | 2 | 0 | 0 |
| Réserve d’actions | 2 | 0 | 0 |

Aux deux coupes, l’interface expose les actions 1 à 5. Parmi les branches de l’agenda autonome, cela contredit la condition publique d’exactement deux directions de `sic_compare_available_controls / compare_alternative`. Pour `sic_recheck_directional_controls / P07`, le journal ne livre ni les directions après filtrage, ni le budget interne de réexamen, ni le premier arc vers une entrée inexplorée. Les gardes utilisent la même fonction de qualification que l’agenda. Les 16 groupes déclarés du pack, le mode `solving` et la carte `resume-objective-access` se reconstruisent avec le code figé. L’agenda n’ouvre aucune branche fictive pour combler les champs absents du journal. Le P07 de la branche manuscrite et le P07 du reçu ont des propriétaires différents.

## Rejouer les deux passes

Depuis le checkout expérimental, avec le banc dans le dossier voisin :

```powershell
$a = '..\sic-comparison-bench\artifacts\sic-comparison\run-VVq4CG'
.\experiments\sic-agenda-offres\rejouer.ps1 observation $a
.\experiments\sic-agenda-offres\rejouer.ps1 anti-fuite $a
```

L’option `--avant` de la première commande produit uniquement les prédictions et les gardes. L’option `--json` conserve aussi les reçus appariés. Avec Node ≥ 22.18, les points d’entrée portables sont `node experiments/sic-agenda-offres/observation-native/rejouer.mjs DOSSIER_RUN` et `node experiments/sic-agenda-offres/observation-native/verifier.mjs DOSSIER_RUN`.

La seule trace lue par le rejeu est `G50T-A.jsonl`, SHA-256 `3c465801169b0b29f6a84ff92182c90efd2e55915787d594b3a5bcda7f4736e5`. La première passe compte les primitives passées depuis L1 et termine respectivement aux lignes 1329 et 1339, sur la frontière du tour précédent. La seconde apparie la note `sic_native_plan` des lignes 1333 et 1343 avec la décision des lignes 1334 et 1344. Elle vérifie l’observation, l’index zéro du ticket, le propriétaire de la proposition et la stratégie locale. Le fichier auxiliaire de chaînes conserve des correspondances entre empreintes. Les valeurs internes des nœuds de connaissance n’y sont pas sérialisées. [Projection](avant.mjs) · [Lecture séparée des reçus](apres.mjs) · [Producteur des chaînes](https://github.com/yannick-fontan-1981/sra-playground/blob/6d539f7b/scripts/sic-decision-trace.mjs#L10)

## Vérification contre la fuite du résultat

Le vérificateur exécute quatre contrôles sur chacune des deux coupes. [Assertions exécutables](verifier.mjs)

1. Interdire par `Proxy` toute lecture de champ hors de la liste temporelle et toute copie globale d’un événement. Le flux lève une erreur si le prédicteur ouvre le premier événement du tour cible. Les projections et les prédictions restent identiques.
2. Substituer une autre famille et une autre stratégie au reçu, remplacer la proposition gagnante, la commande délivrée, le dispatch et l’observation du tour cible. Le comparateur voit le nouveau gagnant. La prédiction reste identique. Le test est indépendant pour chaque tour, puisque le plateau du tour 11 devient une entrée légitime du tour 12.
3. Modifier deux champs autorisés du **tour précédent**. Un retour contradictoire donne `exploration`. Un plateau à deux directions lève l’exclusion certaine de la comparaison, dont les autres gardes restent inconnues.
4. Retirer la frontière ou le plateau antérieur. Le prédicteur rend `indéterminé`. Un reçu portant une autre référence d’observation ne peut pas valider le contexte.

Un témoin manuscrit séparé exécute le chemin de sélection avec un dossier complet. Le comparateur y détecte un accord puis un écart injecté. Ces contrôles n’entrent pas dans les totaux natifs. Les 21 traces JSON complètes des cas autonomes ont également été comparées au code de `475044aa` après l’extraction de la fonction commune de qualification des gardes. Elles sont identiques.

## Quel point observer ensuite ?

**À l’échelle de la famille**, le reçu permet de localiser le discriminant après coup. Dans `proposeRecording`, `chooseRecording` a déjà produit un choix. La famille en déduit `knownInteraction`, `probing`, puis `routeSupported` et `eligibleProbe`. Au tour 11 le reçu porte `routeSupported=true, eligibleProbe=false`. Les valeurs sont inversées au tour 12. Dans les deux cas `knownInteraction=false`. Le premier point où ces faits existent ensemble est immédiatement avant `decide.run({ situation: facts })`. Une observation à cet endroit pourrait comparer le **choix local de primitive**, à condition de l’étiqueter comme postérieure à l’appel du planificateur familial. Ces faits et le besoin `coordinate_recorded_contributions_to_access_receiver` figurant sur le gagnant n’ont servi à aucune prédiction. [Calcul local](../../../src/sic/replay-access.ts#L92) · [Construction du besoin après le choix](../../../src/sic/replay-access.ts#L125)

**À l’échelle de l’agenda**, la coupe reste avant le premier fournisseur, dans `NativeV6Runtime.selectFamily`. Le plus petit ajout utile à cet endroit serait un reçu liant l’observation et l’invocation au besoin parent effectivement disponible, aux entrées filtrées et, pour chaque branche étudiée, aux gardes déjà étayées par une référence antérieure. Une garde encore interne à `chooseRecording` y demeure inconnue tant que la famille ne publie pas de description en amont. Les essais et refus effectifs peuvent ensuite être joints au reçu de sortie en respectant leur portée. [Frontière entre agenda et fournisseurs](../../../src/logos-engine/v6-native-runtime.ts#L983)

L’expérience lit les captures existantes du banc. La version réservée au lot Transfert reste `475044aa609fe2934101b6286a96ae544aa24250`.
