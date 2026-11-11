# Lot 10C — OrderedRecruitment

## État du travail

Le composant `ordered_recruitment` est porté dans le moteur TypeScript et raccordé au propriétaire commun `public_ordered_recruitment`. Le développement part du moteur publié 0.62 / Site 103 et de son checkpoint documentaire `2981a62d456802d39dcde316734793e905fb0ebf`.

Les **173 tests de référence** et les **quatre tests du noyau commun** passent. Ces preuves sont des contrats synthétiques de composant et de raccordement. La qualification finale sur les prédécesseurs effectivement publiés, les essais en jeu, le navigateur, les régressions, le coût officiel et la publication 10C restent à établir séparément.

## Sources et cible

Le V6 original est conservé à la révision `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Aucun fichier original n'est modifié.

| Source originale | Cible native | Contrat conservé |
|---|---|---|
| `ordered_recruitment/geometry.py` | `v6-ordered-recruitment-geometry.ts` | Composants publics, légende, connecteurs, ordre des salles, spirale des files, boutons et quotas ; refus hors domaine mesuré. |
| `ordered_recruitment/projection.py` | `v6-ordered-recruitment-projection.ts` | Recherche conditionnelle dans l'ordre source, réduction locale, continuations et tous les plans/traces ; une recherche incomplète n'établit pas l'impossibilité. |
| V5 `ordered_front_reduction_d.py` et modèles consommés | `v5-ordered-front-reduction.ts` | Réduction effectivement appelée, requêtes, règles de duel/rang/égalité, bornes, frontière et reprise. |
| `ordered_recruitment/policy.py`, `recruitment.drm`, `recruitment.src` | `v6-ordered-recruitment-policy.ts` | Exécution réelle de `v6.ordered_recruitment.choose` et de son callback `recruitment.select` ; priorité, coût, survivants puis ordre source. |
| `ordered_recruitment/family.py` | `v6-ordered-recruitment.ts` | État source, calibration par retour, propositions, garde courante, acquisition et revalidation. |
| Appelant commun et ordre DRM | `v6-native-runtime.ts` | Un propriétaire, entrée déclarée à sa position source, WHY/ACT, acquisition unique, persistance et restauration communes. |

Les sept champs source sont `epoch`, `order`, `methods`, `portable`, `attempts`, `continuation` et `last`. Le checkpoint natif complet conserve ces champs séparément de la publication conditionnelle de `recruitment_state`.

## Acquisition et autorisation

Une méthode de légende provient du contraste réellement retourné : passage COMBAT vers RECRUIT, même salle, file alliée conservée, ennemi unique disparu et correspondance de légende unique. La projection ne transforme pas cette observation locale en loi complète des affrontements futurs.

Le propriétaire sélectionné reçoit son retour une seule fois. Le passage passif exclut ce propriétaire, puis traite les retours étrangers à la position originale, après Workshop et avant les propriétaires suivants. Les paquets d'animation publics complets sont transmis.

Le Python original n'a pas de branche `recruitment_plan` dans son choix de clé pour le retour sélectionné. **La clé active reste donc `window_constraint:<revision>` ; la clé passive est `recruitment_event:<revision>`.** Ce détail est conservé et vérifié dans le noyau commun.

`recruitment_state` est publié/restauré lorsque `methods`, `portable` ou `attempts` est non vide. L'ordre et le dernier constat seuls restent conservés dans le checkpoint complet sans inventer de méthode source publiée.

Chaque action proposée garde `expected_after:null`. La garde recontrôle l'observation, l'époque, la trame, la légende, la file, les boutons et la charge exacte. Un plan retenu n'autorise pas directement une action. Une continuation exige le contexte courant attendu et les mêmes légende et ordre ; le retour effectif la confirme ou la réfute. Aux frontières, les méthodes portables gardent l'autorité `revisable_method_not_current_permit`.

## Preuve indépendante

L'exportateur exécute les fonctions Python originales. Les sorties attendues ne proviennent pas du port natif.

- **1 786 fichiers originaux** vérifiés avant et après chaque génération.
- **726 fichiers consommés** identifiés par empreinte ; **4 389 entrées de profil d'appels** conservées.
- Fixture finale : **1 008 627 octets**, SHA-256 `bfcc4444286bd5a55252eacd11f6cdc06cbf0163924796a9debef302586f2460`.
- **166 cas, trois résumés et quatre contrôles de provenance/cache/état : 173/173 tests passés**.
- Le cache original est réellement exercé : **31 accès, 28 appels au V5, trois réutilisations**.

Les comparaisons gardent les mesures, les plans complets, les actions, les traces de consommation, les propositions, les liaisons de point, les reçus DRM/SRC, les gardes et les sept champs d'état. Les anciennes fixtures et les échecs initiaux restent dans [oracle](lot10c-evidence/oracle/). Le reçu final est [reference-tests-03.execution.json](lot10c-evidence/oracle/reference-tests-03.execution.json).

Le [contrat source détaillé](lot10c-evidence/source-contract.md) précise les fonctions consommées, les cas et les limites de domaine.

## Boucle froide du noyau commun

Le scénario synthétique démarre sans méthode acquise et emploie la vraie fabrique commune. Une primitive étrangère est réellement libérée, puis son retour public calibre la méthode. La décision suivante exécute le programme SRC, passe par OP18/WHY-ACT et libère un append courant. Le retour passe par OP29/OP30/OP31, conserve l'événement et le checkpoint, puis une restauration depuis le graphe commun permet la continuation suivante.

Les quatre tests vérifient également l'identité unique du propriétaire, le contexte d'exécution courant après annulation d'un ancien appel, le refus d'une garde périmée, la non-répétition d'une tentative sans effet et la conservation d'un état sans méthode publiable. Aucune connaissance apprise n'est injectée pour établir la première acquisition. Les restaurations délibérées vers un propriétaire froid vérifient que seul le checkpoint commun restitue la connaissance réellement acquise.

Le reçu [kernel-attempt03/run.json](lot10c-evidence/development/kernel-attempt03/run.json) établit **4/4 tests passés** sur une fixture et un test inchangés. Les deux tentatives antérieures restent conservées : la première avait une hypothèse erronée du test sur la forme de la commande ; la seconde omettait une image du paquet de retour fourni par l'oracle. Les entrées du test ont été raccordées à la commande réellement observée et au paquet original complet, sans retoucher les sorties attendues.

## Adaptations natives déclarées

Le chemin source conserve l'ordre et les sorties originales, y compris les plans déjà obtenus lorsque la borne source est atteinte. Le chemin natif coopératif applique des bornes d'exécution et refuse explicitement les recherches interrompues ou incomplètes. Il conserve la raison et la frontière ; cette adaptation ne constitue pas une preuve de parité exacte pour un appel interrompu.

La recherche native vérifie le signal et l'échéance du contexte d'exécution courant. Ses bornes par défaut sont 50 000 visites et 1 000 ms, avec restitution coopérative toutes les 32 étapes. Chaque réduction V5 conserve ses propres bornes source de 4 096 et 1 000 ms.

Le domaine portable impose des entiers exactement représentables. Deux frontières sont explicitement testées : un entier dépassant la précision sûre JavaScript et le digest générique contenant `2.5`. Les sorties Python correspondantes sont conservées ; le refus natif reste une limite déclarée, sans égalité hors domaine inventée.

## Qualification de livraison restant à établir

RECR, « Recruit Army », a été proposé à partir du titre et de la description du catalogue public. Aucun résultat en jeu n'est déduit du scénario synthétique. Le cas aura un seul registre cumulé de 2 400 secondes pour les campagnes, diagnostics et essais navigateur ; les échecs et la rétention sont débités et aucun redémarrage ne remet le compteur à zéro.

Le critère de coût demandé reste celui de la **médiane des sessions complètes, strictement sous +10 % pour chacun de STCK et SMLP**. Un dépassement de phase peut être accepté lorsque le critère global de ce même jeu passe. Toutes les sessions mesurées, les phases et les refus stricts réels restent conservés ; aucune compensation entre jeux n'est admise.

La parité de l'appelant complet et les six portes de migration complète restent ouvertes. Ce lot n'efface aucune réserve antérieure, notamment HPDL et le cas LKEY clos.
