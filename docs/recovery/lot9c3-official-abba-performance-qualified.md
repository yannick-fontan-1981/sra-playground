# Lot 9C3 — qualification officielle ABBA de `joint_channels`

Date : 13 novembre 2026 (America/Recife)

Branche qualifiée : `recovery/lot9c3-stck-joint-performance-20261113`

Commit de code qualifié : `5412c2a95a77ea9901855d1620263709b07540bf`

## Verdict

**Lot 9C3 est fonctionnellement qualifié et respecte le budget officiel de performance sur STCK et SMLP.**

Cette qualification concerne la nouvelle reconstruction bornée `joint_channels`. Elle ne revendique ni récupération de l’implémentation historique perdue, ni parité avec Site 109, ni restauration d’un point d’entrée du compteur historique 70/76.

## Chaîne causale mesurée

La variante B exécute réellement, pour chaque action du corpus :

`observation publique → producteur disponibilité ACTION6 + producteur cible visible → JointChannelOwner → CommonCampaignOwner → OP28 → action identique au corpus → retour public → acquisition par les deux canaux`

La variante A utilise exactement les mêmes jeux, seed, niveau initial, transport navigateur/Pyodide, corpus public et séquences d’actions, mais n’active pas le hook `joint_channels`.

La seule différence sémantique mesurée est donc l’exécution de la jointure réelle, de l’autorité OP28 et de l’acquisition du retour par les deux producteurs.

## Producteurs publics exercés

### STCK

Deux informations publiques distinctes sont nécessaires :

- `public_action_availability_v1` confirme que `ACTION6` est actuellement disponible ;
- `public_visible_target_v1`, via `public_stck_stack_shop_target_v1`, revalide soit une carte visible de la pile, soit le premier bouton actif du shop.

Sur l’ensemble du protocole B :

- décisions : **86/86** ;
- acquisitions par les deux canaux : **86/86** ;
- sessions terminées : **10/10** ;
- cibles carte de pile : **62** ;
- cibles bouton de shop : **24** ;
- session active résiduelle : **0**.

### SMLP

Deux informations publiques distinctes sont nécessaires :

- disponibilité actuelle d’`ACTION6` ;
- porte visible et coordonnées déterminées depuis le glyph public 64×64.

Sur l’ensemble du protocole B :

- décisions : **126/126** ;
- acquisitions par les deux canaux : **126/126** ;
- sessions terminées : **10/10** ;
- cibles porte visibles : **126** ;
- session active résiduelle : **0**.

## Protocole officiel

Ordre :

`A1 → B1 → B2 → A2`

Pour chaque série : STCK puis SMLP.

Volumes :

- **40 invocations** ;
- **8 sessions de warmup / 24 actions** ;
- **32 sessions mesurées / 400 actions** ;
- aucun échantillon mesuré retiré ;
- aucun retry interne ;
- STCK et SMLP jugés séparément ;
- seuil global strictement inférieur à `+10 %` par jeu ;
- aucune compensation entre jeux.

## Résultats officiels

| Jeu | Médiane A | Médiane B | Variation globale | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 61,45 ms | 62,90 ms | **+2,360 %** | accepté |
| SMLP | 121,95 ms | 126,55 ms | **+3,772 %** | accepté |

Les deux marges sont strictement inférieures à `+10 %`.

### Phases

STCK :

- hook joint B : médiane **2,70 ms** par session de 10 actions ;
- action jeu : `-2,296 %` ;
- politique publique : `-1,449 %`.

SMLP :

- hook joint B : médiane **4,70 ms** par session de 15 actions ;
- action jeu : `-0,468 %` ;
- politique publique : `-1,338 %`.

Le hook n’a pas de base A non nulle, donc son pourcentage de phase n’est pas défini. Il reste visible dans les preuves et ne bloque pas l’acceptation, conformément au contrat : seule la variation globale du même jeu est normative.

Un échantillon SMLP B1 présente un temps jeu de 804,8 ms. Il n’a pas été retiré. La médiane globale officielle reste calculée sur les huit sessions B, sans suppression ni compensation.

## Optimisation ayant permis l’acceptation

Le premier essai complet, avant optimisation, mesurait :

- STCK : `+29,555 %` ;
- SMLP : `+25,516 %`.

Le coût venait presque entièrement du hook commun qui matérialisait aussi des services non consommateurs : rows FieldStock, propriétaire FieldStock, propriétaire public mono-action, copie secondaire de l’image et perception répétée.

L’optimisation finale conserve la même causalité et la même autorité :

- `JointChannelOwner` inchangé comme arbitre de compatibilité ;
- OP28 toujours exécutée ;
- deux contributions toujours obligatoires ;
- acquisition toujours distribuée aux deux canaux ;
- observation toujours publique ;
- action B toujours comparée exactement à l’action A du corpus.

Elle sélectionne explicitement le seam `agent-only` du port commun :

- FieldStock désactivé pour ce owner set ;
- propriétaire mono-action désactivé ;
- aucune grille rows ni entité matérialisée ;
- observation déjà isolée empruntée en lecture seule ;
- payload canonique partagé entre les deux contributions d’une même observation.

Les comportements par défaut du Worker restent inchangés.

## Identités source

Référence A :

`lot9c-joint-v1:A:910f99e7890d9b48ac3fc2a907f578bcee012091773a724bad926499d83913a0`

Candidate B :

`lot9c-joint-v1:B:910f99e7890d9b48ac3fc2a907f578bcee012091773a724bad926499d83913a0:152317533b21cb1df84c85c3e0757d295e78674fa04b1bcd7acc17a8130e5e17`

Invariants :

- même checkout ;
- même transport `BrowserGameRuntime → game-worker.ts → Pyodide → game_bridge.py → custom-games.zip` ;
- même archive ;
- même corpus `native-joint-channel-action6-corpus-v1` ;
- seed `0` ;
- niveau initial `1` ;
- seule différence mesurée : hook joint activé en B.

## Preuves GitHub Actions

Qualification finale :

- workflow : `Lot 9C3 official native joint channels ABBA` ;
- run : `43364459043` ;
- job : `131685629232` ;
- commit qualifié : `5412c2a95a77ea9901855d1620263709b07540bf` ;
- Chrome : `157.0.8103.50` ;
- typecheck : réussi ;
- causalité SMLP/STCK : **14/14** ;
- contrats benchmark/source : **22/22** ;
- ABBA officiel : accepté.

Artifact :

- ID : `14009079375` ;
- nom : `lot9c3-official-native-joint-channels-abba` ;
- SHA-256 ZIP : `f56c9ad48784da55ab30e18bbb5a097a405fc3b225fed66062b91385fd72c22d`.

Échantillons mesurés durables :

`docs/recovery/lot9c3-official-abba-performance-qualified.json`

Le JSON conserve les 32 échantillons mesurés et leurs phases. L’artifact conserve en plus les warmups, les séquences d’actions complètes et les manifestes source.

## Essais antérieurs conservés comme diagnostics

1. Le premier lancement officiel a terminé le protocole mais a été invalidé après mesure parce que le runner n’exposait pas explicitement `startLevel` dans ses métadonnées. Aucun verdict de performance n’a été promu.
2. Le second lancement, avec métadonnées complètes mais avant optimisation, a correctement échoué au seuil avec `+29,555 %` sur STCK et `+25,516 %` sur SMLP. Aucun échantillon n’a été retiré pour obtenir l’acceptation finale.

## Limites

Cette qualification ne démontre pas :

- l’identité avec un ancien `joint_channels` ;
- un solveur général STCK ou SMLP ;
- un gain de score ARC ;
- l’activation produit par défaut ;
- la restauration du compteur des 76 ;
- une publication Site.

## Prochaine étape

Lot 9C peut être clôturé dans son périmètre reconstruit. La prochaine priorité est de reconstruire le registre actuel des points d’entrée avec des preuves explicites, avant toute revendication de compteur ou publication Site.