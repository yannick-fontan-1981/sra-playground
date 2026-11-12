# C1 — contrat de trace légère pour OP01 à OP31

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Ce document prépare l'instrumentation C1 sans modifier les décisions du runtime. Il définit les événements, identités, bornes et scénarios nécessaires pour démontrer la chaîne :

**besoin → données produites → appel/réutilisation/non-appel → résultat → consommateur → effet décisionnel**

## 1. Principes

- La trace n'appelle jamais une OP pour l'observer.
- Le signal de besoin est émis avant le routage de l'OP.
- Les événements distinguent exécution, réutilisation de cache, non-requis et blocage faute d'information.
- Un résultat lu sans effet sémantique reste `information_only`.
- Les identités incluent épisode, époque de niveau, observation et révision.
- Les entrées lourdes ne sont pas sérialisées en mode normal ; seules leurs références, tailles et empreintes sont conservées.
- Les événements sont bornés par session et exportés progressivement en mode audit.
- Toute autorisation d'action ou écriture de connaissance revalide époque et révision même si un résultat de calcul pur vient du cache.

## 2. Événements minimaux

### need

Émis par le producteur ou décideur avant sélection de l'opération.

Champs :
- `need_id`
- `need_kind`
- `reason`
- `producer`
- `episode_id`
- `level_epoch`
- `observation_id`
- `observation_revision`
- `focus_ref` si pertinent
- `objective_ref` / `strategy_ref` si réellement disponibles
- `dependency_refs`
- `completeness`: complete | partial | unknown

### operation

Un événement par tentative logique.

Champs :
- identités du besoin
- `op`: OP01..OP31
- `caller`
- `mode`: executed | cache_reused | not_required | blocked
- `reason`
- `input_refs`
- `input_sizes`
- `dependency_revisions`
- `result_status`: complete | partial | unknown | not_produced
- `result_summary`
- `prepare_us`
- `execute_us`
- `trace_bytes`

### consumption

Émis seulement lorsqu'un composant lit réellement le résultat.

Champs :
- `need_id`
- `op`
- `consumer`
- `decision_ref`
- `effect_kind`: filter | guard | prioritize | maintain | revise | stop | information_only
- `before_summary`
- `after_summary`
- `semantic_effect`: true | false | unknown
- `reason`

## 3. Invalidations

Un cache d'OP est invalide si au moins une dépendance déclarée change :
- nouvelle observation pertinente ;
- changement d'époque de niveau ;
- révision du modèle ou des faits ;
- changement du focus exact ;
- changement d'objectif/stratégie lorsque ceux-ci font partie du contrat ;
- restauration vers un snapshot dont les révisions diffèrent.

La restauration ne crée pas artificiellement un nouvel appel. Elle restaure les identités/révisions et permet la réutilisation uniquement si les dépendances correspondent exactement.

## 4. Chaîne témoin prioritaire C1/C2

### OP18 — Explorer

Besoin : une composition non observée répond à une question ouverte.

Preuve à obtenir :
1. `need` produit avant sélection ;
2. données : composition, question ouverte, état observé et révisions ;
3. OP18 exécutée ou cache valide réutilisé ;
4. release/admission lit le résultat ;
5. une expérience est libérée seulement si les gardes restent valides ;
6. cas voisin sans question ouverte : `not_required`, sans préparation lourde.

### OP28 — Réaliser

Besoin : réaliser une composition par un bundle courant déjà admis.

Preuve :
1. bundle identifié, admis, actions non vides ;
2. OP28 appelée par l'autorité ;
3. résultat lu par release ;
4. contribution distinguée d'une répétition redondante de l'admission amont ;
5. bundle non admis ou vide : rejet sans libération.

### OP29 — Comparer

Besoin : comparer un retour à des attentes du même événement.

Preuve :
- expected/observed ont la même identité d'événement et révision ;
- résultat confirmed/refuted/unknown ;
- lecteur réel identifié ;
- si seulement journalisé, disposition `information_only`.

### OP30 — Réviser

Besoin : filtrer des mises à jour de connaissance étayées à la révision courante.

Preuve :
- provenance et preuve présentes ;
- doublons et révisions périmées refusés ;
- le propriétaire autorisé persiste effectivement la mise à jour, ou l'usage reste documentaire ;
- une lecture ultérieure permet de distinguer relevé conservé et apprentissage réellement consommé.

### OP31 — Réexaminer

Besoin : une nouvelle preuve peut changer le statut d'un objectif.

Preuve :
- assessment relié à l'objectif exact ;
- consommateur qui maintient, termine, suspend ou réoriente ;
- effet sur la suite démontré, ou usage classé `information_only`.

## 5. Scénarios C1 obligatoires

### S-C1-1 besoin présent
OP18/OP28 puis retour OP29→OP30→OP31 sur un préfixe réel ou enregistré.

### S-C1-2 besoin absent
Même état de voisinage sans question ouverte / sans bundle admissible. Aucun appel ni construction lourde induite.

### S-C1-3 information insuffisante
Focus, attentes, preuve ou révision manquante. Le résultat reste unknown/partial ou l'appel est blocked ; aucun faux verdict.

### S-C1-4 dépendance modifiée
Une nouvelle observation/révision invalide précisément le cache concerné puis autorise un nouveau calcul si le besoin subsiste.

### S-C1-5 sauvegarde/restauration
Reprise avec mêmes identités : cache réutilisable ; reprise avec révision différente : invalidation. Les événements dupliqués ne produisent pas plusieurs écritures du même fait.

## 6. Bornes d'instrumentation

Mode normal :
- compteur par OP et mode ;
- résumé du dernier événement par besoin ;
- aucune copie de graphe complet ;
- aucune sérialisation des états complets ;
- buffers bornés et export progressif.

Mode audit :
- références d'entrée/résultat détaillées pour les scénarios ciblés ;
- aucune activation globale des 31 OP ;
- taille de trace mesurée séparément.

## 7. Performance C1

Comparer la session complète sur STCK puis SMLP, séparément.

Pour chaque jeu :
- baseline stable du chantier ;
- même configuration, graines et chauffe ;
- instrumentation désactivée ;
- instrumentation légère activée ;
- diagnostic détaillé mesuré séparément.

Critère de clôture C1 : médiane session complète strictement sous +10 % pour chaque jeu séparément.

Mesurer également :
- préparation des entrées ;
- appel/routeur ;
- sérialisation de la trace ;
- taille produite ;
- coût du rejeu ciblé hors métrique de session.

Une mesure concurrente est marquée `non isolée`.

## 8. Critère de fin C1

C1 n'est complet que si :
- le runtime réel est instrumenté ;
- comportement de référence inchangé ;
- besoin/appel/non-appel/cache/consommation sont distinguables ;
- S-C1-1 à S-C1-5 sont exécutés ;
- le coût est qualifié.

Tant que le checkout contenant `src/logos-engine/v6-*` n'est pas accessible, le statut reste :

**C1 préparé, intégration runtime non commencée.**
