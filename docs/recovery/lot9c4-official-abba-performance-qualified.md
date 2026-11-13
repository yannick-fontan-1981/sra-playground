# Lot 9C4 — qualification officielle ABBA de la jointure stricte

Date : 13 novembre 2026 (America/Recife)

Branche qualifiée : `recovery/lot9c4-official-joint-performance-20261113`

Commit de code qualifié : `f98f490359908fd30e2177d819b98fdd958f6f20`

## Verdict

**Le périmètre reconstruit strict de `joint_channels` est fonctionnellement qualifié et respecte le budget officiel de performance sur STCK et SMLP.**

Cette qualification porte sur une nouvelle reconstruction bornée. Elle ne revendique ni l’identité avec l’implémentation historique perdue, ni la parité avec Site 109, ni la restauration d’un point du compteur historique 70/76 ou 71/76.

## Sémantique stricte préservée

### STCK

La cible publique n’existe que lorsqu’une **seule** carte de pile est visible :

- aucune carte : aucune proposition ;
- plusieurs cartes : ambiguïté conservée, aucune proposition ;
- une seule carte : `ACTION6` sur le centre de cette carte ;
- aucun classement entre plusieurs cartes ;
- aucun bouton de shop inventé comme fallback ;
- aucun accès à `at_shop`, au contenu interne de la pile ou à un identifiant de bouton.

Chaque décision cible STCK est obtenue après trois actions publiques de préparation identiques :

- `ACTION6(4,52)` ;
- deltas publics attendus : `211`, `138`, puis `95` pixels ;
- cible stricte : `ACTION6(4,50)` ;
- delta cible attendu : `64` pixels.

Les trois actions de préparation sont exclues **symétriquement** du chronométrage A et B, mais conservées intégralement dans les métadonnées de chaque échantillon. Les 400 actions du protocole restent 400 décisions cibles mesurées. Au total, les deux variantes ont exécuté 516 actions STCK de préparation exclues.

### SMLP

La cible est la porte publique détectée dans l’image 64×64 :

- disponibilité actuelle d’`ACTION6` ;
- géométrie publique de la porte ;
- coordonnées adressées produites depuis le glyph visible ;
- delta cible attendu : `9` pixels ;
- aucun état moteur caché ni trajectoire préparée.

## Différence A/B mesurée

A et B partagent :

- le même checkout ;
- le même Worker navigateur et le même Pyodide ;
- la même archive `public/python/custom-games.zip` ;
- le même seed `0` et le même niveau initial `1` ;
- les mêmes règles publiques de sélection ;
- les mêmes actions de préparation et les mêmes actions cibles ;
- le même périmètre de chronométrage.

La seule différence sémantique est que B exécute :

`deux contributions publiques → JointChannelOwner → CommonCampaignOwner → OP28 → action cible → retour sélectionné → acquisition par les deux canaux`

Le benchmark ne facture ni FieldStock ni un propriétaire fallback non consommateur.

## Protocole officiel

Ordre : `A1 → B1 → B2 → A2`.

Volumes :

- 40 invocations ;
- 8 sessions de warmup et 24 actions cibles de warmup ;
- 32 sessions mesurées et 400 actions cibles mesurées ;
- aucun échantillon mesuré retiré ;
- aucun retry interne ;
- STCK et SMLP jugés séparément ;
- seuil strictement inférieur à `+10 %` pour chaque jeu ;
- aucune compensation entre jeux.

## Résultats finaux

| Jeu | Médiane A | Médiane B | Variation globale | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 46,80 ms | 49,40 ms | **+5,556 %** | accepté |
| SMLP | 99,30 ms | 99,20 ms | **−0,101 %** | accepté |

Les deux jeux respectent indépendamment le seuil strict de `+10 %`.

### Phases STCK

- hook joint B : médiane `0,90 ms` ;
- action jeu : `+2,457 %` ;
- politique publique : `0 ms` dans les médianes A et B ;
- variation globale : `+5,556 %`.

### Phases SMLP

- hook joint B : médiane `1,55 ms` ;
- action jeu : `−1,477 %` ;
- politique publique : `−25,000 %` sur une phase très courte ;
- variation globale : `−0,101 %`.

Le hook n’a pas de base A non nulle, donc son pourcentage de phase n’est pas défini. Son coût absolu reste visible et ne bloque pas l’acceptation lorsque la variation globale du même jeu passe.

## Couverture causale du protocole B

STCK :

- décisions : `86/86` ;
- acquisitions : `86/86` ;
- cycles cibles stricts : `86/86` ;
- sessions du protocole : `10/10` ;
- actions de préparation exclues côté B : `258` ;
- actions de préparation exclues A+B : `516`.

SMLP :

- décisions : `126/126` ;
- acquisitions : `126/126` ;
- cycles cibles : `126/126` ;
- sessions du protocole : `10/10`.

## Optimisations admises

Le premier ABBA strict complet a correctement échoué :

- run `43366018422` ;
- job `131690494127` ;
- commit `b760e2b5fa16aab61270d37b9a0a0b362eea80b9` ;
- STCK : `+13,083 %` ;
- SMLP : `+22,965 %` ;
- artifact `14009972928` ;
- aucun échantillon retiré.

L’acceptation finale provient uniquement d’optimisations structurelles qui préservent la décision :

- une perception publique qualifiée partagée entre les deux canaux d’une même observation ;
- un seul payload OP28 scellé et partagé entre contributions compatibles ;
- suppression des empreintes déterministes lorsque les deux contributions transfèrent exactement le même objet immutable ;
- acquisition sans copie supplémentaire uniquement pour les canaux publics qui déclarent explicitement le contrat `readonly` ;
- maintien des clones détachés pour tous les canaux génériques ;
- revalidation complète des contextes clonés, externes ou périmés.

Les tests de garde-fou démontrent que le chemin rapide ne s’applique qu’au candidat public qualifié de la même observation.

## Identités source

Référence A :

`lot9c4-strict-joint:A:2c7219c7ebf0104fbb8ef7136ec9a6a38f873b7646417c79dcf680ce8bb3fa0a`

Candidate B :

`lot9c4-strict-joint:B:2c7219c7ebf0104fbb8ef7136ec9a6a38f873b7646417c79dcf680ce8bb3fa0a:60162233df3b98bb76863dd67b4e9ccf8198397528fbe48cedbbb36055a9ed2e`

## Preuves GitHub Actions

Qualification finale :

- workflow : `Lot 9C4 official strict joint channels ABBA` ;
- run : `43366962676` ;
- job : `131693534425` ;
- commit : `f98f490359908fd30e2177d819b98fdd958f6f20` ;
- Chrome : `156.0.8078.79` ;
- build de production : réussi ;
- seams stricts SMLP/STCK et garde-fous de partage : réussis ;
- qualifications sur les deux vrais moteurs : réussies ;
- contrats ABBA, adapter et identités source : réussis ;
- suite TypeScript complète : réussie ;
- ABBA officiel : accepté.

Artifact :

- ID : `14010801556` ;
- nom : `lot9c4-official-strict-joint-channels-abba` ;
- SHA-256 du ZIP téléchargé : `f217e045993c91e27d79fde58143e96013dd72651797517dbf25e02f166f9b30`.

Les 32 échantillons mesurés, les 8 warmups, les phases, les identités source et le rejet diagnostic sont conservés dans :

`docs/recovery/lot9c4-official-abba-performance-qualified.json`

## Limites

Cette qualification ne démontre pas :

- l’identité avec l’ancien `joint_channels` ;
- un solveur général STCK ou SMLP ;
- un gain de score ARC ;
- la parité avec Site 109 ;
- la restauration du compteur historique ;
- une publication Site.

## Étape suivante

Le périmètre reconstruit de Lot 9C peut être clôturé fonctionnellement et en performance. La prochaine priorité canonique est la reconstruction du registre actuel des points d’entrée, avec une preuve d’implémentation, de consommation et de qualification pour chaque entrée avant toute revendication de compteur.
