# HANO · transférer les pièces entre supports dans l’ordre requis

## Critères avant intervention

Le témoin de la ligne 25 est HANO N1/T1, `ordered_support_transfer / conditional_ordered_support_transfer`, `ACTION6`. Le départ N1 du catalogue demande six niveaux, 600 gestes par niveau, 16 actions au total et aucune curiosité ciblée. Une extension du rejeu suit la reconfiguration après la première frontière officielle. [Catalogue](sic-v8-strategies-observees.md?plain=1#L51) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L65)

| Étape | Épreuve préenregistrée |
|---|---|
| Mesure et offre | Lire dans l’image le nombre de supports, les piles ordonnées et le repère qui identifie la destination. Suivre le premier transfert que l’opérateur calcule à partir de ces données. |
| Sélection et dépôt | Garder le même ticket T1 et comparer le retour physique à une observation sans marque de sélection. Vérifier le sort du dépôt et la preuve transmise à la question suivante. |
| Réemploi et retrait | Rejouer les deux gestes complets et une configuration d’empilement distincte du parcours officiel. Retirer seulement l’offre au même état pour identifier le repli et son retour. |
| Refus | Faire varier l’ordre ou le support dans une observation contrôlée. Distinguer une relation de compatibilité calculée d’une relation effectivement validée par une sélection et un dépôt. |

Le calcul doit consommer la configuration visible dans l’expérience. La règle de déplacement du sommet vers un support vide ou un sommet plus large reste une hypothèse de planification. [Mesure, opérateur et garde](../../src/logos-engine/v6-ordered-support.ts)

## Résultat sur le gel

Le départ historique `8ce7ee35` et `d0e7527ca8033bd805a6d7a8bb021eff62e87021` concordent sur les 16 commandes, plans, gardes, résultats et trames publiques. La comparaison entre révisions exclut la métadonnée de palette. Les **16/16** gestes de la ligne sont retrouvés. Un rejeu à 19 gestes montre la prise en charge du niveau 3 par un autre fournisseur. [Paquets du jeu](../../tests/fixtures/sic-hano-public-returns.json.gz) · [Tests via le service](../../tests/sic-hano-line-25.test.ts)

| Situation | Mesure et offre consommée | Retour et suite |
|---|---|---|
| **N1/T1 · premier choix** | `measureOrderedSupportScene` mesure trois supports structurels, les largeurs strictement décroissantes [11,7] sur le premier, deux supports vides et une paire de formes creuses symétriques qui distingue le support cible 2. `materializeOrderedSupportTransferWitnesses` énumère des chemins bornés avec les sommets accessibles et les dépôts autorisés. Son premier transfert déplace la largeur 7 du support 0 au 1. `OrderedSupportTransfer.propose` lie cette pièce et les deux points. | Le service libère `ACTION6(13,51)`. Le retour change 28 pixels et `orderedSupportSelectionMatches` reconnaît le même membre, de couleur 14, avec sa marque visible. Le reçu porte `selection_observed=true`. Le dépôt attend encore son garde. |
| **N1/T2–T6 · transfert et réemploi** | Le second garde relit la marque du membre sélectionné avant `ACTION6(31,51)`. Après ce dépôt, le même clic source (13,51) modifie un autre besoin. La pile courante ne contient plus que la largeur 11 au support 0. Le calcul prévoit 0→2 puisque le support 1 porte déjà la largeur 7. | T2 confirme [[11],[7],[]] et date `transfer_observed`. T3 porte la référence du dépôt et sélectionne 11. T4 confirme [[],[7],[11]]. T5 et T6 replacent 7 sur 11. Le retour T6 passe la frontière officielle et le reçu distingue cette progression d’une vérification locale du dépôt. |
| **N2/T7–T16 · configuration distincte** | Quatre supports et trois largeurs [15,11,7], avec destination 3. Le même opérateur calcule la route sous ces nouvelles contraintes. Le premier transfert 0→1 lie (11,50), (25,50) et la largeur 7. La suite utilise le second support intermédiaire et dépose 15 sur la cible. | Les dépôts intermédiaires sont comparés aux piles attendues. Le service confirme la frontière officielle T16 après avoir déposé 7 sur [15,11]. T17 passe à `public_framed_transfer` en N3. |

Les clics pointent vers les supports mesurés. Le premier garde exige la trame, le score, l’époque, la référence et les commandes du plan. Le second exige la sélection intermédiaire. Les événements de sélection, de déplacement et de progression restent séparés dans `OrderedSupportTransfer.record`, avec leurs références propres et l’objectif `G_official_completion`. [Producteur, gardes et acquisition](../../src/logos-engine/v6-ordered-support.ts) · [Raccord dans le service](../../src/logos-engine/v6-native-runtime.ts)

## Épreuves

- **Même ticket et marque absente.** Après le vrai ticket T1, présenter la trame antérieure produit `matched:false`. La sélection est consignée comme échouée, la clé du contexte est conservée parmi les essais clos et le dépôt en (31,51) n’est pas libéré. Présenter la véritable image de T3 comme comparaison au plan T1 est également refusé. Cette autre image porte une sélection de largeur 11, dans l’empilement suivant.
- **Retrait du transfert au même départ.** Une instance de proposition avec la politique désactivée retire la seule offre ordonnée à T1. Le propriétaire `public_framed_transfer` choisit successivement (13,50) et (13,48). Les deux retours physiques diffèrent du départ. À T3, le fournisseur ordonné redevient admissible et retrouve les piles [[11,7],[],[]]. Il libère (13,51), puis (31,51) avec un dépôt confirmé. Les retours restent acquis par le service habituel.

L’absence de marque est un retour construit. Les commandes de repli, de reprise et leurs paquets proviennent du jeu public. Les changements de pile à N1 et N2 font varier les transferts admissibles dans les scènes effectivement comparées.

**Attribution.** Le calcul des transferts bornés est déjà consommé dans la famille au gel, à partir de deux configurations publiques distinctes. La famille conserve les mesures de support, le membre sélectionné et les gardes qui rendent le dépôt admissible. La branche ajoute la caractérisation de ce contrat.

## Reproduire

Depuis la racine avec Node 24. Définir `SIC_HANO_GAME_ROOT` sur le checkout qui contient les archives Python et Pyodide pour rejouer le jeu physique. Définir `SIC_HANO_ENGINE_ROOT` pour importer explicitement le moteur du gel.

~~~powershell
node --test tests/sic-hano-line-25.test.ts
$env:SIC_HANO_GAME_ROOT = (Get-Location).Path
node --test tests/sic-hano-line-25.test.ts
node --test tests/v6-ordered-support-parity.test.ts
~~~

Le contrat de provenance utilise les octets Git de la fixture JSON de référence (LF). Les critères ont été préenregistrés au commit `44d199f6`.

Les trois scénarios de caractérisation et les 32 contrats de parité passent. Le 27 novembre 2026 (UTC−3), préparation à 22 h 31 min 05 s, contrat à 22 h 31 min 36 s, premier rejeu du gel à 22 h 31 min 41 s et verdict local à 22 h 34 min 53 s, soit 3 min 48 s.
