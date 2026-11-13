# Lot 5B — propriétaire commun de campagne et retour corrélé

Date : 12 novembre 2026

Branche de travail :
`recovery/lot5b-common-campaign-owner-20261112`

Baseline canonique :
`87a538a1c776fb974a1767f30fea735aac28ded9`

## Objectif de la tranche

Raccorder les producteurs reconstruits FieldStock/OP18 et action publique
unique/OP28 derrière un propriétaire persistant de campagne, sans introduire de
classement arbitraire entre mécanismes.

La chaîne visée est :

`observation publique → mesure visible → propositions propriétaires → sélection
neutre → autorisation OP → action → observation suivante → retour corrélé →
révision du propriétaire → décision suivante`.

## Mesure publique

`src/runtime/v6-public-observation-measurement.ts` transforme uniquement le
contrat public du worker :

- pixels 64×64 de palette publique ;
- actions publiquement disponibles ;
- état et progression officiels ;
- composants monochromes 4-connexes mesurés depuis ces pixels.

Aucun masque engine, fixture, rôle caché ou coordonnée privée n'est importé.
Les identités d'observation et de frame sont déterministes et liées à la
session et à la séquence publiques.

## Arbitrage neutre

`src/runtime/v6-common-campaign-decision-port.ts` possède un
`NeutralCommonCaller` et des adaptateurs spécialisés :

- `PublicSingleActionCallerOwnerAdapter` pour le contrat OP28 déjà qualifié ;
- `FieldStockCallerOwnerAdapter` pour la connaissance adressée revalidée et OP18.

Les propriétaires produisent d'abord des candidats. L'autorisation OP18 ou OP28
n'est appelée qu'après que le caller a établi qu'une seule proposition existe.
Deux propositions restent donc ambiguës : aucune autorisation et aucune action
ne sont exécutées en coulisse.

## Corrélation du retour

Pour chaque décision libérée, le propriétaire commun conserve :

- le propriétaire sélectionné ;
- la proposition spécialisée ;
- le bundle ;
- l'action ;
- le `needId` produit par l'autorité ;
- l'observation publique avant action.

L'observation publique suivante est routée :

- au propriétaire sélectionné comme retour `selected`, avec le même `needId` ;
- aux autres propriétaires comme preuve `passive` ;
- au plus une fois par propriétaire et événement physique.

FieldStock consomme ce retour avec `afterStock()` puis `recordStock()` avant de
traiter une éventuelle frontière officielle. Ainsi, une réponse observée peut
confirmer, réfuter ou borner réellement la proposition suivante.

## Limites conservées

- Le worker par défaut ne reçoit aucun `prior` FieldStock artificiel.
- La tranche prouve la consommation d'un prior explicitement fourni au
  propriétaire, mais ne reconstruit pas encore l'acquisition initiale complète
  d'un champ adressé depuis une campagne navigateur.
- Region n'est pas activé sans producteur public de candidat/méthode.
- `main.ts` n'instancie pas encore le worker agent ; le produit reste honnêtement
  indisponible en mode SRA.
- Cette tranche ne revendique aucune parité binaire avec l'ancien Site 109.
- La performance officielle STCK/SMLP reste à mesurer avec les runners natifs
  qualifiés et le seuil global strictement inférieur à +10 % par jeu.

## Qualification

Candidat initial : `004786bda6372c1cf0189fabac7d443992e80079`.

La qualification GitHub Actions de branche est en cours. Le résultat final, le
nombre total de tests et le commit qualifié seront inscrits ici avant
intégration canonique.
