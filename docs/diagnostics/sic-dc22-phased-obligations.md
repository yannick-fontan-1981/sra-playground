# DC22 N4 et le besoin de mesure du cycle d’appui

Base `c515ea1464387c940b06e93f3ad7ecd73f782f60`. Le lot observe un seul fournisseur, `createSicRemoteSupportRoute`, sur un rejeu DC22 depuis L1 jusqu’à N4. Le moteur distribue les tickets et acquiert les retours. L’ouverture, la conservation de l’appui et le franchissement sont séparés dans l’observation du service. L’instrumentation est limitée à la commande de reproduction.

Le catalogue historique donne 22, 44 et 45 gestes pour atteindre N4. Le T1 de N4 mesure le premier support, le T14 est la dernière mesure, le T15 retrouve l’accès, le T17 change une phase en préservant l’appui et le T76 franchit la frontière officielle. La décision de reprise est mesurée avant l’émission du ticket T15, sur la même observation que celle produite au retour T14.

## Contre-épreuves définies avant le rejeu

| État d’entrée pré-T15 | Intervention | Décision attendue |
| --- | --- | --- |
| Témoin | Aucun changement | Déplacement avec le cycle clos. |
| Retrait du reçu mémorisé | Retirer seulement la référence T14 de `phaseMemory.refs`. Garder la même vue, les mêmes phases, la clôture et `lastRef`. | Si la référence sert seulement à citer le retour, la décision restera identique. |
| Retrait du fait de clôture | Remettre à faux `cycles[control].closed` pour le dernier cycle. Garder les mêmes phases, références et `lastRef`. | Mesurer ce cycle avant de franchir. Le rejeu perturbé doit laisser passer la commande par le guichet natif avant de juger son effet. |

Les deux perturbations sont d’abord proposées par deux instances indépendantes du fournisseur sur une capture locale. Elles n’émettent aucun ticket dans le rejeu témoin. Le retrait du fait de clôture possède ensuite son propre rejeu pour mesurer le retour réellement autorisé. La capture privée contient uniquement les entrées du fournisseur au T15 et reste hors de Git.

## Ce que le service distingue déjà

Le plan local garde les positions et les phases dans le même état. `offerPhased` exige le transfert du niveau précédent et une vue qui correspond à `lastRef`. `planPhasedSupport` commence par chercher un cycle ouvert. Après les mesures, il alterne déplacements et changements de phase selon l’appui calculé. `observePhaseStep` vérifie le retour de la commande, la présence du curseur et les motifs des appuis avant de mettre à jour la phase ou de reprendre la suite.

T14 confirme le retour du terrain à sa position initiale pour le deuxième contrôle. La révision 125 devient 126 et `closed` passe de `[true, false]` à `[true, true]`. T15 prend cette même révision 126 comme entrée. Il émet `ACTION2` et son retour à la révision 127 confirme l’atterrissage. T17 confirme un changement de phase du premier contrôle avec le curseur soutenu. La clôture du cycle et la tenue physique de l’appui ont des conditions et des retours distincts.

L’instrumentation témoin rejoue les quatre niveaux en 187 commandes autorisées SIC. Ses 187 effets et ses quatre empreintes cumulées concordent avec le reçu de campagne publié à `4a037c2b`.

## Effets observés au T15

| Intervention | Offre au T15 | Retour mesuré |
| --- | --- | --- |
| Témoin | `ACTION2`, déplacement sur l’appui | `landing_on_phase_support_confirmed`, révision 127, cadre `28757a3ad12c674b`. |
| Référence T14 retirée de la mémoire | Même offre, même besoin, mêmes preuves présentées | L’offre est mesurée sur la copie. `offerPhased` remet en tête la révision 126 au titre de l’observation courante. |
| Dernier cycle rouvert | `ACTION6 (56,28)`, mesure du deuxième contrôle | Le moteur autorise la commande. `support_phase_measured`, révision 127, cadre `ee7d873be60ef100`. Le curseur garde sa cellule et le cycle reste ouvert. |

Les deux rejeux ont le même préfixe jusqu’au retour de T14. La première divergence physique suit la commande T15, à partir du même cadre `26979463126c657c`. Le retrait de la référence est donc sans effet décisionnel. La valeur `closed` issue de la mesure est le fait qui change l’offre. Les deux offres conservent l’identité du besoin parent jusque dans la contre-épreuve. Les 125 premières commandes sont identiques. La branche perturbée s’arrête au plafond de N4 après 92 gestes de ce niveau, soit 203 commandes autorisées, avec trois niveaux gagnés. Le témoin termine N4 en 76 gestes, soit 187 commandes au total. [Reçu compact des deux rejeux](sic-dc22-phased-obligations-receipt.json)

## Premier besoin absent

T1, T14 et T15 déclarent tous le même besoin `reach_target_on_observed_support_phases`, avec pour parent `G_official_completion`. Aucun reçu ne porte de `prerequisite`. Le service enregistre bien la fermeture, mais la conserve comme un fait `closed` dans son propre état. La liste de références n’associe pas le fait à un reçu de fermeture distinct.

Le premier raccord à qualifier est donc un enfant stable « mesurer le cycle du contrôle », ouvert au premier test sélectionné de N4/T1. Il réutiliserait `sicNeedId` et l’écriture native `needCheckpoint`. Sa preuve porterait le contrôle, l’époque, la révision d’ouverture et le retour qui ferme le cycle. Le premier écart attendu serait l’identité du besoin à T1, avec la même commande et le même retour. À T15, le parent reprendrait sous la dépendance du dernier cycle mesuré, avec l’appui courant vérifié séparément. Un changement de phase ne constitue une preuve de maintien que si le retour conserve le même curseur et les appuis concernés. Les traversées déjà soutenues n’ont pas à déclencher un changement de phase artificiel.

Le champ natif `sicLocalDecision.prerequisite` convient à un enfant déjà attesté. `nativePlanReceipt` le lit et le moteur le clôt comme acquis avec le reçu. Il ne représente pas à lui seul un enfant encore en attente. Une fermeture manquante doit donc rester une décision de mesure distincte, avec une reprise fondée sur le retour attendu. Le contrat P05 `ControlEffectReturn` à `162e4550` peut inspirer le rattachement d’un retour au sujet et au parent. Son effet mesuré actuel est la translation d’un porteur. La fermeture d’un cycle d’appui demande sa propre observation.

## Reproduction

Utiliser Node 24 et un nouveau dossier local pour les sorties. La référence historique donne les budgets des quatre niveaux aux deux rejeux.

```powershell
$env:SIC_REPLAY_REFERENCES = 'docs/architecture/sic-replay-reference-levels-20261126.json'
$env:SIC_DC22_RECEIPT = Join-Path $out 'témoin-phases.jsonl'
$env:SIC_DC22_FIXTURE = Join-Path $out 'témoin-pré15.json'
node --import ./scripts/observe-sic-dc22-phases.mjs scripts/check-sic-chronological.mjs DC22 4 (Join-Path $out 'témoin.jsonl') 1 sic
node scripts/observe-sic-dc22-phases.mjs $env:SIC_DC22_FIXTURE

$env:SIC_DC22_RECEIPT = Join-Path $out 'réouvert-phases.jsonl'
$env:SIC_DC22_FIXTURE = Join-Path $out 'réouvert-pré15.json'
$env:SIC_DC22_REOPEN_CYCLE = '1'
node --import ./scripts/observe-sic-dc22-phases.mjs scripts/check-sic-chronological.mjs DC22 4 (Join-Path $out 'réouvert.jsonl') 1 sic
Remove-Item Env:SIC_DC22_REOPEN_CYCLE
```
