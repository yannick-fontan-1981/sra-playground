# DC22 — Enfant natif de mesure du cycle

## Attendus figés avant raccord

Base `b0574d0d45d3253c38fd6a72e52074874b6a0da6`. Témoin discriminant `9e96585ac3d6c7bcc450e173592211238cdc0ee0`. L’option est exercée exclusivement sur DC22 par le harnais expérimental.

| Point | Attendu |
| --- | --- |
| N4/T1, après 111 gestes inchangés | Même `ACTION6 (46,28)`. Le premier changement est l’ouverture à l’autorisation d’un enfant de mesure du contrôle, rattaché au besoin de traversée. |
| N4 avant T14 | Chaque cycle ouvert continue à recevoir ses mesures. Un retour intermédiaire ne satisfait pas cet enfant. |
| N4/T14 | Même `ACTION6 (56,28)`. Le retour à 126 clôt l’enfant du deuxième contrôle avec la paire 125→126. |
| N4/T15 | Même `ACTION2`. Le plan du parent cite la preuve déjà acquise pour chaque cycle, dont celle de T14. L’autorité vérifie cette preuve avant le ticket. |
| Un seul cycle rouvert | Repli sur `ACTION6 (56,28)`, sans franchissement au T15. |
| Mauvais contrôle ou référence périmée | Contre-épreuves indépendantes sur l’entrée pré-T15. Le même `ACTION2` proposé doit être refusé avant délivrance du ticket. |
| Préfixe nominal | Même suite du départ L1 jusqu’à N4/T76, mêmes commandes et effets physiques, mêmes empreintes aux quatre fins de niveau. |

Le champ générique `prerequisite` du moteur atteste l’accès de frontière selon un autre contrat. Pour les cycles, la preuve est produite au scellement du retour de mesure, puis vérifiée et citée par le parent.

## Raccordement

Le fournisseur crée un enfant stable par contrôle observable. L’identité combine le besoin parent, l’époque et le rectangle du contrôle. Le clic est celui du rectangle réellement lié au ticket. Le budget à l’autorisation est le minimum du budget d’actions restant du parent et du nombre de phases encore admissibles, plus la mesure de clôture. La borne de 12 vient du modèle existant et s’applique à chaque cycle. Les tests exercent plusieurs tailles de cycle, deux géométries et des retours hors époque.

Les points partagés sont `nativePlanReceipt`, `NativeV6Runtime.authorize` et le scellement natif. Le premier expose le reçu du cycle et son prérequis. Le deuxième vérifie les preuves déjà inscrites sur les enfants avant la reprise et inscrit l’ouverture avant le premier ticket de mesure. Le scellement lie la mesure au couple réel d’observations et écrit « satisfait » uniquement pour une fermeture confirmée. Les dépendances du parent pointent vers les preuves déjà acquises. Le reçu d’accès de frontière et le type P05 de translation gardent leurs contrats.

## Résultats

| Variante | T14 et T15 |
| --- | --- |
| Nominal | L’enfant est ouvert avant le ticket T1. T14 clôt l’enfant du deuxième contrôle sur 125→126. T15 vérifie les deux enfants satisfaits, puis émet `ACTION2`. |
| Cycle rouvert | Le deuxième enfant est rouvert sur la vue 126. `ACTION6 (56,28)` est autorisée. Le retour confirme la nouvelle mesure et l’enfant reste assigné. |
| Autre contrôle | Le couple de fermeture du premier contrôle est substitué à celui du deuxième. La garde refuse le ticket T15. |
| Référence périmée | Le couple du retour T13, du même contrôle, remplace celui de T14. La garde refuse le ticket T15. |

Le premier écart nominal est l’ouverture typée du besoin à N4/T1. Le trajet et les résultats physiques concordent sur 187 commandes, depuis N1 jusqu’à la fin de N4. Les trois contre-épreuves ont les mêmes 125 premiers effets. Les deux preuves substituées laissent le moteur sans préfixe admissible à ce point. Le cycle rouvert atteint le plafond de N4 après 92 gestes dans ce niveau, soit 203 commandes autorisées. Le premier lancement concurrent de ce bras avait atteint la limite de temps murale. Le rejeu isolé a livré ses 203 effets. [Reçu réduit](sic-dc22-phase-child-receipt.json)

## Rejeu local

Node 24, avec `node scripts/prepare-python.mjs`. Les six bras utilisent un dossier neuf et les mêmes références historiques. Le bras `base` relit les modules modifiés dans les objets du SHA de base et `off` prend les modules candidats avec le réglage de production par défaut. Les autres bras activent l’option du fournisseur uniquement dans le processus DC22. Le rejeu option coupée retrouve les 187 effets et les quatre empreintes de la base. TypeScript et 22 tests ciblés, dont les témoins P05, passent.

```powershell
$out = Join-Path ([IO.Path]::GetTempPath()) ('sic-dc22-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $out | Out-Null
$env:SIC_REPLAY_REFERENCES = 'docs/architecture/sic-replay-reference-levels-20261126.json'
foreach ($arm in 'base','off','active','reopen','wrong-control','stale') {
  $env:SIC_DC22_PHASE_ARM = $arm
  $env:SIC_DC22_PHASE_TRACE = Join-Path $out ($arm + '-phase.jsonl')
  node --import ./scripts/observe-sic-dc22-phase-child.mjs scripts/check-sic-chronological.mjs DC22 4 (Join-Path $out ($arm + '.jsonl')) 1 sic
  if ($LASTEXITCODE -ne 0) { throw "Échec du rejeu $arm" }
}
node scripts/check-sic-dc22-phase-child.mjs $out
```
