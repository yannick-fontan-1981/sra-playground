# Activation locale de l’agenda P05

## Cas de référence préenregistré

Le lot descend du shadow `189b96ee533c66dafd3066bb932535e4ed854aae`. Il donne au service une option explicite de budget pour la seule offre unitaire P05 déjà préparée par `SlidingCavity.proposeDirectionQuestion` ou par la branche `probe` de `createSicVerifyRemoteReplay`. Une unité suffit à l’essai si les gardes locales passent. À zéro, le classement s’abstient et le service poursuit sa recherche ordinaire. Le budget de session et le garde natif continuent de s’appliquer.

Le premier écart prévu est le propriétaire du premier ticket de G50T en mode SIC, N1, référence publique de départ et budget de session identiques. Avant le changement, une intervention sur le shadow qui retire uniquement l’offre préparée reproduit le repli suivant dans le vrai jeu.

| Départ | Offre et décision | Garde native | Retour |
|---|---|---|---|
| Référence et budget local d’une action | `sic_verify_remote_replay` sélectionne P05 et libère ACTION1. Le porteur, le contact et les faits restent ceux du départ. | `current_replay_and_carrier_bound` | `compare_replayed_motion_and_remote_return`, `matched:null`. |
| Budget local nul | L’agenda s’abstient sur la même offre. `sic_public_input_exploration` libère ACTION1 avec sa propre justification. | `current_public_input_bound` | `observed_public_input_return`, `matched:null`. Le vrai paquet physique concorde. |

Le budget local s’applique à cette offre et se combine avec le budget restant du service. L’abstention liée au budget ne fournit aucune preuve supplémentaire sur le contrôle. L’option absente conserve le parcours de référence. Les contrôles maintiennent le cas sans preuve et le cas avec prémisse contraire, ainsi que la séparation entre P05 et P07. La priorité entre deux offres reste hors observation, les appelants exposant une seule offre à ce point.

## Raccord actif

Configurer `createNativeV6Runtime` avec `controlTrialAgenda: { mode: 'active', actionBudget: 0 }` ou un budget de 1. L’agenda prend le minimum du plafond local et du budget restant transmis à l’appelant. Il applique la même sélection que le shadow. L’observateur facultatif expose la sélection et la première différence sur un canal distinct. En mode actif, le choix est calculé avant l’appel de l’observateur. Le verdict du garde et le ticket continuent d’appartenir au service natif. [Sélection et budget](../../src/sic/control-effect-next.ts) · [Entrée native](../../src/logos-engine/v6-native-runtime.ts)

Si la sélection s’abstient, `SlidingCavity` rend la main avant d’inscrire un témoin P05 et `sic_verify_remote_replay` rend la main avant de produire sa proposition. Le SRC de rejeu et le garde natif restent requis pour l’offre qu’ils peuvent libérer. La variante `sic_learn_remote_replay` conserve son raccord shadow, et l’approche P07 garde son chemin. [Raccord cavité](../../src/logos-engine/v6-sliding-cavity.ts) · [Témoin natif](../../src/sic/missing-control-strategy.ts) · [Raccord rejeu](../../src/sic/replay-access.ts)

## Verdict sur les préfixes

Deux départs indépendants de G50T sur le shadow reproduisent le premier ticket, son garde et son retour. L’activation avec un geste local conserve les 16 commandes libérées, 16 retours et 17 observations de chaque rejeu natif de N1, AS66 en V6 et G50T en SIC. Les huit comparaisons de classement concordent. Au T6 de G50T, le même ACTION4 sous P07 reste une marche appuyée par le vecteur acquis au T5.

Avec zéro geste local, le service G50T à même observation et à budget de session d’un geste suit le repli préenregistré. Le premier champ divergent est `selected` dans le comparateur local. Le premier changement de ticket est le propriétaire. Les deux départs jouent ACTION1 avec les mêmes paramètres et produisent le même paquet public. Le garde natif du repli est admis et son propre motif figure dans le reçu. Les tests couvrent aussi le refus de réutiliser la proposition de cavité sur une observation plus récente, l’abstention faute de preuve ou sous contradiction et l’isolation du canal de diagnostic. [Tests du lot](../../tests/sic-p05-agenda-shadow.test.ts)

```powershell
$nodeSic = (Get-Command node.exe -All)[-1].Source
& $nodeSic --test tests/sic-p05-agenda-shadow.test.ts tests/sic-native-resolution.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-recorded-pulse.test.ts
npm.cmd run typecheck
```

## Point de raccord pour l’enfant typé

Le prochain lot peut ouvrir un enfant au point où la famille remet l’offre unitaire et les faits à l’agenda. Le parent y transmet son besoin, le sujet et sa portée, l’observation courante, l’offre, les preuves de ses prémisses et le geste alloué. L’enfant attend le reçu natif de la commande autorisée avant de rendre un effet mesuré, une contradiction ou une abstention rattachée à la même observation et au même sujet. Le parent décide ensuite s’il peut réutiliser cette mesure. La preuve d’accès P07 et son plan restent au raccord de la famille qui pourra les établir.
