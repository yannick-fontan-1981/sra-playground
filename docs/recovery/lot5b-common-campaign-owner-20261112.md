# Lot 5B — propriétaire commun de campagne et retour corrélé

Date : 12 novembre 2026

Branche de travail :
`recovery/lot5b-common-campaign-owner-20261112`

Baseline canonique réconciliée avant intégration :
`6304bec8c99a05b0023692f8fe7f432394acaa11`

Commit de code initial :
`004786bda6372c1cf0189fabac7d443992e80079`

Commit qualifié après fusion du dernier canonique :
`4c5060f8ab3523c3ed4cb85ead8441397d985c7c`

## Objectif de la tranche

Raccorder les producteurs reconstruits FieldStock/OP18 et action publique
unique/OP28 derrière un propriétaire persistant de campagne, sans introduire de
classement arbitraire entre mécanismes.

La chaîne obtenue est :

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
traiter une éventuelle frontière officielle. Le test intégré démontre qu'un
retour inchangé enregistre l'échec du locus `{x: 22, y: 20}` et que la décision
FieldStock suivante se déplace vers `{x: 21, y: 20}`. Le résultat de l'opération
n'est donc pas seulement tracé : il modifie la décision suivante.

## Worker reconstruit

`src/runtime/v6-agent-worker.ts` utilise désormais
`V6CommonCampaignDecisionPort` par défaut.

Ce port :

- conserve l'ambiguïté plutôt que de classer artificiellement les propositions ;
- libère l'action publique simple unique via OP28 ;
- n'invente jamais les coordonnées d'ACTION6 ;
- ne produit aucune proposition FieldStock tant qu'aucun prior explicite et
  aucune revalidation courante ne l'autorisent.

## Limites conservées

- Le worker par défaut ne reçoit aucun `prior` FieldStock artificiel.
- La tranche prouve la consommation d'un prior explicitement fourni au
  propriétaire, mais ne reconstruit pas encore l'acquisition initiale complète
  d'un champ adressé depuis une campagne navigateur.
- Region possède son owner et son binding public de retour, mais n'est pas encore
  inscrit comme producteur du propriétaire commun sans candidat public qualifié.
- `main.ts` n'instancie pas encore le worker agent ; le produit reste honnêtement
  indisponible en mode SRA.
- Le propriétaire commun ne possède pas encore de snapshot/restauration complet
  de ses mémoires et décisions en attente.
- Cette tranche ne revendique aucune parité binaire avec l'ancien Site 109.
- La performance officielle STCK/SMLP reste à mesurer avec les runners natifs
  qualifiés et le seuil global strictement inférieur à +10 % par jeu.

## Qualification

Qualification initiale du code :

- run : `43346432911` ;
- commit : `004786bda6372c1cf0189fabac7d443992e80079` ;
- `npm run typecheck` : réussi ;
- régression complète : **276/276 tests réussis**.

Qualification finale après fusion du canonique `6304bec8` :

- run : `43346937074` ;
- commit qualifié : `4c5060f8ab3523c3ed4cb85ead8441397d985c7c` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **280/280 tests réussis** ;
- aucun échec, test annulé, ignoré ou marqué TODO.

Les preuves nouvelles couvrent :

- mesure publique sans fuite par référence ;
- chemin OP28 commun ;
- même `needId` entre besoin OP18, admission, décision et retour sélectionné ;
- effet du retour sur la décision FieldStock suivante ;
- refus d'ACTION6 sans prior/revalidation ;
- ambiguïté sans autorisation OP ni action cachée.

Le workflow temporaire de qualification est supprimé avant intégration
canonique.

## Statut

**Propriétaire commun, arbitrage neutre, OP18/OP28 différés, retour corrélé et
effet FieldStock sur la décision suivante fonctionnellement qualifiés.**

**Raccord produit live, acquisition initiale FieldStock, intégration Region au
caller commun, restauration du propriétaire et performance officielle restent à
qualifier.**
