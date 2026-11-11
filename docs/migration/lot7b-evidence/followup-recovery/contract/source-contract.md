# Suivi Workshop : contrat source et extension native reconstruite

Revue enregistrée le **2026-11-11T12:05:46.515336+00:00**. Référence Python immuable : **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. Base publiée récupérée : **Site 95 / native 0.58.0**, commit **`3a70463039768f7114edae7d94d7dd33b7f36aa8`**. Le [constat de récupération](../coordination/recovery.json) distingue les fichiers disponibles des observations conservées dans la conversation.

## Portée et statut des preuves

Ce complément reconstruit une **extension explicite de coordination native** après un contact stationnaire sans effet. Il modifie deux fichiers de production : `src/logos-engine/v6-native-runtime.ts` et `src/logos-engine/v6-ranked-workshop.ts`. Il n’ajoute ni entrée au registre, ni propriétaire de mémoire, ni workflow. Les changements des autres lots restent distincts de ce delta.

L’ancien candidat non publié `d9b2c2bd61499eda2532fccd7b64ab203ce9963d` et ses preuves brutes n’ont pas été récupérés. Aucune identité octet pour octet avec ce candidat n’est revendiquée. Ses 5 285 tests et cinq contrôles, rapportés avant la perte de l’environnement, ne valident pas les octets reconstruits. Le gel final, les contrôles formels, les régressions autorisées et le coût doivent être produits sur le nouveau candidat intégré.

Les contrôles ciblés de développement rapportés à ce stade portent sur **11 cas d’appelant et six cas Workshop**. Ce sont des résultats provisoires de développement, distincts du reçu formel sur source gelée. Les scènes sont construites indépendamment dans les tests ; elles ne proviennent pas d’une trajectoire ou d’une image de jeu. Les fournisseurs synthétiques des tests d’appelant attestent le contrat d’arbitrage, tandis que les tests Workshop acquièrent les contrastes par le véritable `recordSource` avant de demander une proposition au SRC/DRM existant. Aucun de ces tests ne démontre une réussite physique en jeu ni la parité complète de l’appelant Python.

## Sources relues et empreintes recalculées

Les chemins du tableau sont relatifs à `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/`. Les empreintes SHA-256 ont été recalculées dans le checkout récupéré pendant cette revue. Elles portent sur les sources et déclarations, sans ouverture de charge utile LKEY. Leurs chemins complets et tailles figurent aussi dans le [constat de récupération](../coordination/recovery.json).

| Source | Lignes examinées | SHA-256 | Contrat |
|---|---|---|---|
| `laya_proto/animated_contact_access.py` | 93–95 | `be3d4d1a574b2a44a5484c558eec75086579221c4c3cc769679d9954e003710a` | Refus global après contact sans continuation justifiée |
| `laya_proto/common_animated_contact.py` | 22–23 | `a224e77adc32343bc107b2dc5e9ee138ccc2de98c74262e71da423a04c0ec69c` | Transmission du refus par la famille source |
| `morphology_policy/strategy.py` | 159–188 ; 330–398 | `425aca6c30e7abb38a537dfcef38f92c418bc4dfa35201ae52dc42ba4390fa55` | Ordre déclaré, arrêt sur le refus goal_access et entrée Workshop matérielle |
| `laya_proto/common_frontier_runtime.py` | 464 | `bcc9bc79d04287c830efedce48b4cc2ab89b5600b8a77fe09782c35d1c05c064` | Arrêt de l’appelant sur une proposition non proposée |
| `morphology_policy/ranked_workshop/family.py` | 29–62 ; 63–117 | `d5e597658994d23659fc086ae9fd66d031501d1fd8a319ce95f38579bd8bb95d` | Sélection/proposition, gardes, acquisition et état source |
| `morphology_policy/ranked_workshop/methods.py` | 14–35 ; 71–77 | `385ca82f1019822f00529c23d62068f62da7e1e093b6544ca49b56885811960d` | Signature, changements et revalidation portable |
| `morphology_policy/ranked_workshop/geometry.py` | 18–29 | `a3b72041268907e90addca0c6780504c56952fdb6f44532ab05afa4280d01ffe` | Projection et contexte stable |
| `morphology_policy/ranked_workshop/preparation.py` | 24–30 | `67e07fe07f12ca0f064a27ee0145b72879bbb20c16b8fedea365330a5740faae` | Méthode de mode requise par les préparations |
| `morphology_policy/ranked_workshop/workshop.drm` | document complet | `f46249629bb6d9fc4ed1276a4f287fe5dee250fc9f2fd908e47c244a1f2f8cee` | Règles et ordre de choix existants |
| `morphology_policy/ranked_workshop/workshop.src` | document complet | `999c1cc9247db04ca14d36a67ee9172f54602cb7ce018eadad28e34eeab35aff` | Workflow source de mesure et sélection existant |

Le Python donne une réponse non proposée et bloquante lorsque l’historique de contact ne justifie aucune continuation (`animated_contact_access.py`, lignes 93–95). Son enveloppe transmet cette réponse (`common_animated_contact.py`, lignes 22–23). `goal_offer` la retourne immédiatement dans l’ordre déclaré (`strategy.py`, lignes 159–188), puis l’appelant arrête la boucle sur le statut non proposé (`common_frontier_runtime.py`, ligne 464). L’entrée Workshop appartient à la suite matérielle de cette stratégie. Le nouveau passage vers une question indépendante constitue donc une extension native et ne peut être présenté comme une correction d’un oubli du port original.

## Arbitrage après le contact stationnaire

Le témoin de contact reste produit par l’acquisition réelle du préfixe sélectionné dans le Kernel. Les restrictions existantes sur l’historique d’invitations sans modèle, l’époque, le score, l’état public, le domaine d’actions, le dernier événement, son image, ses références de preuve et sa commande sont conservées.

L’appelant inspecte ensuite le reste du groupe courant puis les groupes suivants dans leur ordre déclaré. Il conserve chaque résultat de consultation, y compris `null` et les entrées sans nom. Un fournisseur sans proposition n’a pas à fournir de témoin. Un refus courant `block_unrelated_probe` conserve le blocage ; un `sourceGroupStop` ferme seulement le reste de son groupe.

La première proposition non nulle doit avoir le statut `proposed`, au moins une action, son propre témoin `acquired_context_for_unknown_effect` lié à l’observation actuelle et une garde `before` admise. Une proposition inconnue, sans témoin, avec témoin périmé, vide, refusée par sa garde ou exigeant un témoin de service courant empêche de chercher une justification chez une famille ultérieure. Les services courants conservent leur voie d’admission distincte.

Le reçu conserve `preferred_proposal_id: null` lorsque la proposition source n’a pas d’identifiant. Aucun identifiant n’est fabriqué. L’adaptateur de sous-question transmet le témoin Workshop sans modifier ses données source.

## Témoin Workshop transitoire

La sélection, la géométrie, le SRC, les règles DRM, l’acquisition et les huit champs de l’état source restent ceux du port publié. La construction de la proposition conserve les **onze champs source** : `status`, `kind`, `actions`, `steps`, `facts`, `binding`, `workshop_plan`, `compositions`, `question`, `route_refs`, `bundle_template`. La modification conserve séparément une copie transitoire de cette proposition et de son observation ; elle n’ajoute pas ce sceau à l’état persistant.

Le sceau est annulé au début de chaque consultation, après restauration et lors du nettoyage transitoire, y compris lorsque `restoreNative` reçoit le même checkpoint et emprunte sa sortie rapide. Un témoin exige la même observation complète et les mêmes onze champs. Les annotations de routage ajoutées par l’appelant restent hors du sceau.

Deux acquisitions peuvent justifier une question conditionnelle :

- **Revalidation portable** : méthode, signature, référence et commande correspondent ; les deux contrastes publics `0→1` et `1→0` ont réellement été acquis avec des références distinctes ; le contexte courant est compatible et aucune réfutation ou aucun rejet applicable dans l’époque courante ne subsiste. La méthode doit encore être éprouvée dans le nouveau contexte.
- **Continuation actuelle** : un contraste de mode de l’époque courante conserve les profils et la position du marqueur, correspond à la méthode retenue et au singleton final mesuré. La commande sélectionnée peut différer de la commande qui a révélé le mode ; elle doit toutefois être exactement celle de la proposition issue du SRC actuel.

Lire ce témoin n’acquiert aucun effet et ne modifie aucun état source. Son statut indique un contexte acquis pour un **effet encore inconnu**.

## Autorisation, acquisition et restauration

Le reçu de coordination ne libère aucune action. Après la sélection, la protection de l’appelant, `bind`, la vérification de cible, la garde ordinaire `before`, le domaine du point, la préservation et la libération WHY/ACT continuent de s’appliquer. La signature existante de `before` reste à quatre arguments. Le test de refus à la garde finale vérifie qu’une anticipation admise peut encore se terminer sans libération de commande.

Le retour public réellement reçu reste acquis après scellement du préfixe. La persistance conserve les champs source existants ; la restauration garde les méthodes acquises tout en supprimant l’autorité transitoire d’une ancienne sélection. Une nouvelle consultation est nécessaire après restauration pour émettre un témoin courant.

## Réserve LKEY et récupération

L’[horloge LKEY est fermée](../coordination/lkey-closed-clock.json) à **2 390,347106991 secondes cumulées**, avec **9,652893009 secondes résiduelles**, sans remise à zéro. Ce nouveau fichier est un checkpoint dérivé de la conversation ; il ne remplace pas le reçu temporel original perdu. Aucun essai, rejeu, oracle ou examen supplémentaire de charge utile LKEY n’est autorisé dans cette reconstruction.

La réussite navigateur de trois niveaux, 44 actions et 44 plans reste une **observation de la conversation précédente**, sur l’ancien gel de 302 fichiers `f270d02d8449f36327e3f46315524fb5a693ad9014912bddf0cd9a81b2b30d8d`. La capture et les preuves brutes de ce suivi n’ont pas été retrouvées. Cette observation ne constitue ni une nouvelle preuve de jeu ni une preuve applicable au candidat reconstruit. La tentative antérieure interrompue à 38 actions et l’échec JSON antérieur à 26 actions sont conservés séparément dans le constat de récupération.
