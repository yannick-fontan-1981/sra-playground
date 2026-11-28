# Activation locale de l’agenda P05

## Cas de référence préenregistré

Le lot descend du shadow `189b96ee533c66dafd3066bb932535e4ed854aae`. Il donne au service une option explicite de budget pour la seule offre unitaire P05 déjà préparée par `SlidingCavity.proposeDirectionQuestion` ou par la branche `probe` de `createSicVerifyRemoteReplay`. Une unité suffit à l’essai si les gardes locales passent. À zéro, le classement s’abstient et le service poursuit sa recherche ordinaire. Le budget de session et le garde natif continuent de s’appliquer.

Le premier écart prévu est le propriétaire du premier ticket de G50T en mode SIC, N1, référence publique de départ et budget de session identiques. Avant le changement, une intervention sur le shadow qui retire uniquement l’offre préparée reproduit le repli suivant dans le vrai jeu.

| Départ | Offre et décision | Garde native | Retour |
|---|---|---|---|
| Référence et budget local d’une action | `sic_verify_remote_replay` sélectionne P05 et libère ACTION1. Le porteur, le contact et les faits restent ceux du départ. | `current_replay_and_carrier_bound` | `compare_replayed_motion_and_remote_return`, `matched:null`. |
| Budget local nul | L’agenda s’abstient sur la même offre. `sic_public_input_exploration` libère ACTION1 avec sa propre justification. | `current_public_input_bound` | `observed_public_input_return`, `matched:null`. Le vrai paquet physique concorde. |

Le budget local s’applique à cette offre et se combine avec le budget restant du service. L’abstention liée au budget ne fournit aucune preuve supplémentaire sur le contrôle. L’option absente conserve le parcours de référence. Les contrôles maintiennent le cas sans preuve et le cas avec prémisse contraire, ainsi que la séparation entre P05 et P07. La priorité entre deux offres reste hors observation, les appelants exposant une seule offre à ce point.
