# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 13 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique de la tranche FieldStock browser :
  `510642125e1f5994b30e4f71b884a2278dcc91a8`
- Branche de travail :
  `recovery/op01-op31-browser-field-stock-context-20261112`
- Commit combiné qualifié :
  `d45f2ce6566d052bbd3477c5653e99ae24381a0a`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Chaîne OP18 :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`
- Propriétaire commun :
  `docs/recovery/op01-op31-common-campaign-owner-20261112.md`
- Hôte navigateur :
  `docs/recovery/op01-op31-browser-campaign-host-20261112.md`
- Hôte Worker :
  `docs/recovery/op01-op31-worker-common-campaign-20261112.md`
- Contrôleur Agent actif :
  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`
- Contexte navigateur FieldStock :
  `docs/recovery/op01-op31-browser-field-stock-context-20261112.md`

Le présent fichier est l’état courant consolidé. Les versions antérieures
restent dans Git et dans les documents de recovery afin de conserver les
preuves, mesures et décisions détaillées.

## Règle de qualification

Une utilisation réelle suit la chaîne :

**besoin identifié → données produites → appel justifié → résultat →
consommateur → effet sur la décision.**

Les niveaux restent distincts :

1. calcul correct ;
2. données produites par le chemin concerné ;
3. appel observé ;
4. résultat consommé ;
5. contribution démontrée ;
6. coût qualifié.

Un compteur, un import ou une trace sans consommateur ne suffisent pas. Aucune
opération n’est ajoutée pour atteindre artificiellement 31 appels.

## Statut global

La campagne commune possède maintenant :

- une autorité Logos bornée ;
- un propriétaire de décision et de retour corrélé ;
- un seam Worker qualifié ;
- un seam produit/browser qualifié ;
- un contrôleur Agent explicite et unique activé dans `main.ts` ;
- un transport FieldStock navigateur enregistré mais inerte sans prior ;
- un chemin Manual toujours séparé.

Le contrôleur produit choisit uniquement le seam navigateur direct. Le seam
Worker reste disponible pour les autres runtimes et les tests, mais n’est pas
instancié par `main.ts`. Les deux ne contrôlent donc pas la même session.

Statut global :

**activation fonctionnelle du contrôleur Agent qualifiée ; C7 accepté séparément sur STCK et SMLP.**

Cette reconstruction ne prouve pas une identité binaire avec le Site 109
historique ni une parité totale V5/V6/V7.

## Architecture runtime pertinente

### Produit navigateur actif

- `src/main.ts` : sélection explicite Manual / Agent et ports produits ;
- `src/runtime/browser-games.ts` : transport jeu navigateur ;
- `src/agent-product-dispatch.ts` : disponibilité, génération, `busy`, timing,
  ACTION6 et erreur ;
- `src/product-presentation-effects.ts` : présentation et effets DOM ;
- `src/runtime/v6-browser-agent-observation.ts` : conversion publique 64 × 64 ;
- `src/runtime/v6-browser-common-campaign-host.ts` : dispatch, retour et
  acquisition avant présentation ;
- `src/runtime/v6-browser-agent-controller.ts` : propriétaire unique de la
  session Agent, boucle bornée et causes d’arrêt ;
- `src/runtime/v6-browser-field-stock-campaign.ts` : mesure publique,
  revalidation et transport du contexte FieldStock/OP18.

### Seam Worker conservé

- `src/runtime/v6-public-observation-measurement.ts` ;
- `src/runtime/v6-common-campaign-decision-port.ts` ;
- `src/runtime/v6-agent-worker-core.ts` ;
- `src/runtime/v6-agent-worker.ts`.

Le Worker acquiert correctement les retours OP18/OP28, y compris les retours
terminaux ou sans budget de décision. Il n’est pas utilisé par le contrôleur
produit actuel.

### Autorité Logos et propriétaires

- `src/logos-engine/v6-native-authority.ts` ;
- `src/logos-engine/v6-neutral-common-caller.ts` ;
- `src/logos-engine/v6-common-campaign-owner.ts` ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts`.

### Modèles spécialisés

- `src/runtime/observed-addressed-material-runtime.ts` ;
- `src/logos-engine/field-stock.ts` ;
- composants Region et leurs propriétaires spécialisés.

## État C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés et dispositions explicites | maintenir les statuts par besoin |
| C1 | **contrôleur produit actif avec deux propriétaires enregistrés** | session unique, OP28 actif, FieldStock inertiel sans prior, retour acquis avant frontière et présentation | snapshot produit et acquisitions passives multi-propriétaires |
| C2 | **OP18 transportée dans le browser lorsqu’un prior réel est fourni ; OP28 active sans régression** | revalidation publique, ACTION6 mesurée, retour spécialisé puis frontière ; OP28 inchangée avec runtime vide | acquisition initiale réelle du prior et propriétaire OP31 |
| C3 | **calculs et recouvrements qualifiés** | OP03/04/08/09/11/12/14/26 auditables | appeler uniquement depuis un producteur réel |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | aucun raccord artificiel |
| C5 | **retours spécialisés préservés** | FieldStock/Region couvrent notamment OP06/29/30 avec effet futur | contrat physique Region complet |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccord sans preuve de blocage ou reprise |
| C7 | **accepté** | 335 tests, build, parité Worker/Pyodide, 24 contrats et deux exécutions ABBA acceptées | maintenir les sourceRef si le chemin mesuré change |

## Contrôleur Agent produit

`BrowserAgentController` est activé uniquement après sélection explicite du mode
Agent. Il utilise `BrowserCommonCampaignHost` et n’instancie pas le Worker.

Il garantit :

- une seule campagne en vol ;
- observation courante exacte avant démarrage ;
- aucun choix d’action local ;
- aucune action par défaut ;
- arrêt sur `none`, `ambiguous`, `pending`, `blocked`, terminal, obsolescence,
  erreur ou limite ;
- limite par défaut de 64 actions ;
- acquisition du retour avant décision suivante ;
- transfert Agent → Manual après règlement de l’action déjà en vol ;
- priorité du remplacement de jeu sur une simple demande Manual ;
- fermeture `disposed` stable pendant `pagehide`.

Le mode Manual reste direct et n’appelle aucune campagne Agent.

## Chaîne OP18 : FieldStock

### Besoin

Un prior adressé réellement acquis existe, la scène publique actuelle le
revalide et une demande typée reste insatisfaite alors qu’ACTION6 est disponible.

### Production navigateur

`BrowserFieldStockOwnerTransport` :

- reste inerte si le runtime est vide ou réfuté ;
- mesure uniquement l’observation publique 64×64 ;
- matérialise les composants visibles seulement pour revalider un prior ;
- rétrograde un stock provenant d’une autre session avant toute utilisation ;
- expose `FieldStockCampaignContext` seulement après revalidation courante.

`FieldStockCallerOwnerAdapter` produit alors le bundle OP18 et l’action ACTION6
coordonnée. Le retour suit l’ordre :

1. acquisition corrélée au même `needId` ;
2. `afterStock()` ;
3. `recordStock()` ;
4. frontière et rétention locales ;
5. présentation.

Le scénario qualifié revalide un prior public, propose ACTION6 vers `(22,20)`
et enregistre une réécriture conjointe observée en matériau de type 2.

Disposition OP18 : **chaîne navigateur qualifiée depuis un prior fourni jusqu’au
retour spécialisé et à la rétention de frontière.**

Dette produit : acquérir honnêtement le prior initial. Le contrôleur par défaut
crée un runtime vide et n’invente jamais cette connaissance.

## Chaîne OP28 produit active

Le fallback public strict produit une proposition uniquement lorsque
l’observation expose exactement une action simple distincte hors RESET et ne
requiert aucune coordonnée manquante.

La chaîne active est :

1. observation publique ;
2. adaptation en `AgentObservation` ;
3. proposition propriétaire OP28 ;
4. validation du bundle ;
5. autorité Logos ;
6. dispatch produit ;
7. retour public ;
8. acquisition avec le même `needId` ;
9. présentation ;
10. arrêt ou décision suivante.

ACTION6 seule sans coordonnées ne produit rien. Plusieurs actions publiques
produisent `none`. Plusieurs propriétaires produiraient `ambiguous`. Aucun
fallback n’est autorisé.

Disposition OP28 : **première chaîne Logos réellement active dans le produit,
sous contrat mono-action strict.**

## Disposition des 31 opérations

| OP | Disposition courante | Producteur/consommateur démontré ou dette précise |
| --- | --- | --- |
| OP01 | calcul qualifié, usage produit non démontré | aucun regroupement structurel consommé par le runtime actif |
| OP02 | calcul qualifié, usage produit non démontré | aucun domaine complet de chemins équivalents produit et consommé |
| OP03 | producteur générique manquant | préconditions spécialisées gardées dans leurs familles |
| OP04 | calcul qualifié, usage produit non démontré | aucun réseau commun d’ouvertures consommé |
| OP05 | calcul qualifié, usage produit non démontré | ambiguïté de campagne traitée structurellement sans appel artificiel |
| OP06 | fonction spécialisée démontrée | contradictions FieldStock/Region affectent les propositions futures |
| OP07 | producteur runtime manquant | aucune frontière liée à un objectif ouvert n’est produite |
| OP08 | manquante ou recouverte familialement | aucun graphe transversal fiable `effect → requires` consommé |
| OP09 | calcul qualifié, usage produit non démontré | aucune preuve de domaine complet d’alternatives |
| OP10 | calcul qualifié, usage produit non démontré | aucun propriétaire de buts terminaux ne consomme le résultat |
| OP11 | calcul qualifié, usage produit non démontré | aucun réseau commun de déblocages produit puis choisi |
| OP12 | manquante ou recouverte familialement | inconnues spécialisées sans chaîne générique démontrée |
| OP13 | calcul qualifié, consommateur générique absent | portée bornée dans les modèles spécialisés |
| OP14 | admission bridge présente, release native absente | aucun besoin produit ne justifie encore cette autorité physique |
| OP15 | calcul qualifié, usage produit non démontré | aucun sélecteur réel d’objectif intermédiaire |
| OP16 | calcul qualifié, usage produit non démontré | aucun producteur de blocage global prouvé |
| OP17 | calcul qualifié, usage produit non démontré | aucune reprise autorisée avec préservation complète |
| OP18 | **chaîne Worker complète et transport browser qualifié avec prior fourni** | revalidation publique, bundle, ACTION6 mesurée, retour spécialisé puis frontière ; acquisition initiale absente |
| OP19 | calcul qualifié, usage produit non démontré | aucun préfixe forcé prouvé produit |
| OP20 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’objet liée à une stratégie active |
| OP21 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’espace liée à un objectif actif |
| OP22 | calcul qualifié, usage produit non démontré | aucun effet distant attribué et consommé transversalement |
| OP23 | calcul qualifié, usage produit non démontré | aucun cycle autonome prouvé n’alimente un plan réel |
| OP24 | calcul qualifié, usage produit non démontré | aucun générateur de chemins alternatifs vérifiés |
| OP25 | calcul qualifié, usage produit non démontré | non-réfutation conservée sans fausse preuve de faisabilité |
| OP26 | manquante ou recouverte familialement | aucun domaine commun d’accès vérifiés vers une cible |
| OP27 | calcul qualifié, usage produit non démontré | aucune permutation avec préservation complète |
| OP28 | **chaîne produit active sous condition stricte** | bundle admis, action physique, même `needId`, acquisition avant suite |
| OP29 | fonction spécialisée démontrée | `afterStock()` et Region comparent les retours utiles |
| OP30 | fonction spécialisée démontrée | `recordStock()` et Region changent les propositions futures |
| OP31 | appel générique disponible, contribution absente | aucun propriétaire d’objectif produit ne maintient ou réoriente la suite |

## Qualification

Qualification du code du contrôleur :

- run GitHub Actions : `43351836350` ;
- job : `131644500100` ;
- commit : `50948c69806d8682313ed61d7364399e699b365f` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck : réussi ;
- régression complète : **325/325** ;
- build de production : réussi ;
- galerie générée : 100 jeux, 636 prévisualisations ;
- câblage : `logos-product-wiring-present`.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées par `npm ci`.

Qualification FieldStock browser et contrôleur par défaut :

- run GitHub Actions : `43353708964` ;
- job : `131650593632` ;
- commit : `400d9bcc1062130508d27e62f1508f82011d2ea7` ;
- typecheck : réussi ;
- régression complète : **332/332** ;
- build de production : réussi ;
- galerie : 100 jeux, 636 prévisualisations et 4 atlas ;
- aucune ACTION6 inventée avec runtime FieldStock vide.

## Performance C7

Le protocole strict A1/B1/B2/A2 est exécuté avec quatre runners explicites, les mêmes jeux, corpus, seed, séquences et volumes. Seul B active le hook Region réel.

Run principal 43359480072, job 131669316899, SHA d45f2ce6566d052bbd3477c5653e99ae24381a0a :

| Jeu | Médiane A | Médiane B | Delta | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 59,35 ms | 56,70 ms | −4,4650 % | accepté |
| SMLP | 114,70 ms | 120,05 ms | +4,6643 % | accepté |

Chaque jeu respecte séparément le seuil strict inférieur à +10 %. Aucune compensation entre jeux ni suppression d’échantillon n’est utilisée.

Le run complet 43359480115, job 131669385975, répète une mesure acceptée : +2,0423 % sur STCK et −0,9298 % sur SMLP. Il passe aussi 335/335 tests, le typecheck, le build, la parité Worker/Pyodide et 24/24 contrats natifs.

Verdict : **C7 accepté pour l’identité mesurée.**

Preuve : `docs/recovery/op01-op31-c7-official-acceptance-20261113.md`.

## Limites ouvertes

- aucun mécanisme produit n’acquiert encore le prior FieldStock initial ;
- le runtime FieldStock du contrôleur par défaut reste donc vide ;
- aucune persistance de cette connaissance entre activations n’est revendiquée ;
- aucun contrat physique commun complet pour Region ;
- acquisitions passives multi-propriétaires non orchestrées dans le produit ;
- aucune sauvegarde/restauration d’une session Agent en attente ;
- aucun propriétaire OP31 ;
- C7 accepté pour les sourceRef et le SHA mesurés ;
- aucune publication Site dans cette tranche.

## Feuille de route actualisée

### Étape immédiate : acquisition initiale FieldStock

1. identifier une observation publique qui justifie l’acquisition adressée ;
2. produire le prior compact sans utiliser d’état privé ;
3. conserver la provenance, les témoins et la qualification locale ;
4. injecter ce prior dans le runtime produit avant revalidation ;
5. démontrer la découverte, OP18, le retour et la décision suivante sur une vraie
   campagne navigateur.

### Étape suivante : élargissement symbolique

1. compléter le contrat physique Region ;
2. orchestrer les acquisitions passives sans double consommation ;
3. ajouter snapshot/restauration du propriétaire et de ses connaissances ;
4. identifier un propriétaire d’objectif réel avant OP31.

### Après clôture C7

1. intégrer la tranche qualifiée dans la branche canonique sans écraser les autres lots ;
2. acquérir honnêtement le prior FieldStock initial ;
3. compléter le candidat produit Region et les acquisitions passives ;
4. ajouter snapshot/restauration ;
5. ne publier le Site qu’après liaison explicite au SHA GitHub canonique.

## Requalification C7 de l’identité 5669bb2e

Le commit `5669bb2edf38b1fa431050a2ca996833aad86876` remplace l’identité courante de mesure après ajout du contrat de configuration et du rapport fail-fast du benchmark.

- garde strict : run `43361492824`, job `131675839595` ;
- STCK : +0,8464 %, accepté ;
- SMLP : −5,0546 %, accepté ;
- qualification complète : run `43361492842`, job `131675894613` ;
- 339/339 tests, build, parité Worker/Pyodide et 24/24 contrats réussis ;
- répétition : STCK +0,4643 %, SMLP +0,1379 %, acceptés.

L’ancienne mesure reste historique et n’est pas transférée à cette identité.
