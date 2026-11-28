# WA30 · essai d’accouplement orienté et accès à un contact

## Critères figés avant changement

Le témoin d’inventaire de la ligne 26 est N1/T3, `oriented_coupling / conditional_oriented_coupling`, `ACTION5`. Celui de 31 est N1/T16, `pre_score_contact / observed_effect_access`, `ACTION1`. Les deux sont retrouvés sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` depuis N1 avec les options de l’inventaire, six niveaux, 600 actions par niveau et au plus 16 gestes, sans curiosité ciblée. Une extension distincte à 19 gestes sert à examiner la reprise après T16. [Matrice 26 et 31](sic-v8-composition-des-98-strategies.md?plain=1#L66) · [Catalogue 26](sic-v8-strategies-observees.md?plain=1#L52) · [Catalogue 31](sic-v8-strategies-observees.md?plain=1#L57)

| Ligne | Ce qui doit être préservé | Épreuve discriminante |
|---|---|---|
| 26 | T2 produit une invitation devant un porteur orienté. T3 essaie la relation par interaction. Le seul changement de contour autorise une hypothèse. Le déplacement conjoint ultérieur fournit une autre preuve. | Retirer uniquement l’invitation ou réduire la preuve de retour. Identifier le propriétaire, la commande et le reçu suivants à état courant comparable. Vérifier que la première interaction ne suffit pas à établir le transport solidaire. |
| 31 | T16 est une sonde de premier contact depuis (36,33). Deux sites immédiatement atteignables sont déclarés, en (36,29) et (32,33). Le mouvement connu, l’effet distant encore inconnu et la marque d’essai doivent rester distincts. | À situation identique, vérifier le choix de l’autre site ou le refus du site déjà essayé. Rattacher le résultat au bon ticket, puis retrouver ce que le prochain besoin peut encore demander. |

Un crédit concerne la démarche de son propre ticket. Le nom de contact et l’existence d’un même porteur sur le plateau ne suffisent pas à attribuer aux deux familles le même besoin ou le même effet. [Couplage orienté](../../src/logos-engine/v6-oriented-coupling.ts) · [Accès aux effets](../../src/logos-engine/v6-effect-access.ts)

## Parcours et contre-épreuves

Le gel et le commit historique `8ce7ee35` produisent les mêmes 16 décisions et retours. Au budget de 19 gestes, le candidat et le gel concordent sur les 19 décisions, plans, gardes et retours publics. Les vingt observations de ce second rejeu concordent avec le préfixe de l’archive WA30. Cela retrouve 13 des 13 occurrences d’inventaire de la ligne 26 et 1 des 11 de la ligne 31. T17 documente la reprise de 31 au-delà de cette fenêtre d’inventaire. [Archive publique de WA30](../migration/native-campaigns-v54/baseline-wa30/wa30-public-trace.json.gz) · [Deux suites de retours alternatifs du jeu public](../../tests/fixtures/sic-wa30-alternate-returns.json.gz)

| Étape | 26 · tester le contact entre deux contours orientés | 31 · rendre accessible un contact pour en observer le retour |
|---|---|---|
| Besoin courant | La frontière déplace le porteur lors de T2. `OrientedCoupling.record` observe un changement sur le seul contour devant lui et inscrit `front_contour_invitation` avec la référence du retour. Le porteur est en (8,10) dans le repère du réseau, orienté (0,−1), avec un contour invité en (8,9). | `NativeCallerCoordinator.preScoreOffer` passe par le journal de l’épisode. `EffectAccess.propose` reconnaît le rôle et sa surface dans la scène courante. Deux déplacements mesurés rendent le contact immédiatement testable depuis le point public (36,33). L’épisode ne contient encore aucun contact non local de ce rôle. |
| Offre et autorité | `OrientedCoupling.propose` prépare `ACTION5` pour cette invitation. Le verrou d’essai comprend pose, orientation, site et apparence de la pièce. Le garde `before` vérifie la pose, les masques, l’orientation et la trame courante. Le premier ticket porte une prédiction nulle. | Les offres de premier contact sont (36,29) par `ACTION1` et (32,33) par `ACTION3`. Le plan retenu lie l’époque, le rôle, la surface, les preuves de déplacement, la prémisse et l’essai. Le garde vérifie l’époque, le score, la référence initiale, la commande disponible, le masque à l’origine et la surface mesurée au site. Le ticket nomme `unknown_then_observe` avec un déplacement mesuré et aucune prédiction de retour distant. |
| Retour physique et reprise | T3 change 12 pixels. Le propriétaire inscrit `visible_relation_change_candidate` et conserve un site candidat `held`, avec `coupled = false`. T4 `ACTION1` change 44 pixels. Le porteur et la pièce se déplacent ensemble d’une maille vers le haut. Le propriétaire inscrit `public_rigid_pair_translation` et établit `coupled = true`. Chaque mesure pointe vers son propre retour. | T16 laisse la trame intacte. `EffectAccess.record` lie `pre_score_effect_contact` au rôle, à la clé d’essai et aux références avant et après. Le résultat public reste sans prédiction confirmée. T17 exclut l’essai enregistré et examine le second site. Son retour change 44 pixels sans établir d’effet distant du rôle. Le couplage reprend à T18. |
| Variation | Retirer la seule offre frontale à T3 libère `ACTION1` chez la frontière. Le jeu renvoie la même trame. À T4, l’invitation encore disponible donne le ticket `ACTION5`, puis son retour physique permet `ACTION1` chez le couplage. Dans le contre-exemple construit où T3 garde `ACTION5` mais retourne la trame précédente, la clé d’essai est consommée sans candidat d’attachement. La frontière reçoit T4. | Choisir le second site à T16 libère `ACTION3` chez `pre_score_contact`. Le reçu tente (32,33) et la suite retourne au couplage dès T17. Retirer l’offre entière à T16 donne également `ACTION3`, avec le même paquet physique. Le couplage en est alors propriétaire et aucun reçu `pre_score_effect_contact` n’est acquis. À l’inverse, garder le vrai ticket `ACTION1` et masquer l’acquisition de son reçu fait répéter (36,29) à T17. |

Le retrait du raccord et les substitutions ont été provoqués dans le service. Les observations après retrait ou substitution proviennent du jeu. L’image stationnaire du cas 26 est construite. Le masquage du reçu de 31 garde l’image réelle et change seulement la mémoire d’essai.

## Attribution du candidat

**26 · offre frontale retirable sur branche.** Le gel contient déjà la détection, la condition d’admission, le journal d’essai et la preuve de transport. Le candidat rend consommable `OrientedCoupling.frontalContactTrial`, qui fournit la clé actuelle ou s’abstient. La commande d’interaction et les mesures demeurent du ressort de `OrientedCoupling`. Le second contexte attesté réutilise la même proposition à T4 après une autre commande physique et un nouveau reçu. [Source du couplage](../../src/logos-engine/v6-oriented-coupling.ts)

**31 · site de sondage remplaçable sur branche.** Le gel construit déjà les sites atteignables, journalise leur essai et change d’offre en conséquence. Le candidat raccorde `EffectAccess.selectInitialContact` au choix déjà classé. Il reçoit les couples site–commande d’un modèle de rôle et rend un indice admissible ou s’abstient. La recherche géométrique, l’identification du rôle, l’ordre entre plusieurs modèles concurrents et l’interprétation du retour restent chez le producteur. Les retours attestent deux essais et leur suite. La portée du résultat de ces essais est une tentative datée avec effet distant encore inconnu. [Source de l’accès](../../src/logos-engine/v6-effect-access.ts) · [Entrée du fournisseur](../../src/logos-engine/v6-native-caller.ts)

Le service commun donne un ticket au plan admis et distribue le retour au propriétaire. La ligne 26 reconnaît un état de relation entre deux contours. La ligne 31 épuise des sites de sondage attachés au rôle courant. Ces deux preuves motivent des raccords distincts, chacun vérifié à son point de consommation. [Libération et acquisition natives](../../src/logos-engine/v6-native-runtime.ts)

## Reproduire

Depuis la racine de la branche sous Node 24. La première commande utilise les paquets du dépôt. Avec `SIC_WA30_GAME_ROOT` pointant vers un checkout avec les archives Python et Pyodide, les scénarios nominaux et les deux substitutions sélectionnées rejouent aussi le jeu public. Définir `SIC_WA30_ENGINE_ROOT` sur un checkout du gel fait vérifier les parcours historiques et les contre-épreuves indépendantes des nouveaux raccords.

~~~powershell
node --test tests/sic-wa30-contact-lines.test.ts
$env:SIC_WA30_GAME_ROOT = (Get-Location).Path
node --test tests/sic-wa30-contact-lines.test.ts
node --test tests/v6-coupling-metric.test.ts tests/v6-prospective.test.ts tests/v6-outline-arbitration.test.ts tests/v6-native-caller.test.ts tests/sic-oriented-delivery-continuity.test.ts
npm run typecheck
~~~

Les sept scénarios ciblés passent sur le candidat, dont six dans la passe avec rejeu officiel et le dernier après correction de son assertion et exécution ciblée. Sur le gel, quatre scénarios passent et les trois exercices des interfaces ajoutées sont exclus. Les 397 tests de contrat et de continuité passent ainsi que le typage. Les contrats de provenance existants attendent les octets Git des fixtures JSON, avec fins de ligne LF. Les critères ont été figés au SHA `3c93db1d`. La validation indépendante de 26 et 31 se fait séparément à partir de ce même candidat.

Le 27 novembre 2026 (UTC−3), préparation à 21 h 51 min 17 s, premier rejeu du gel terminé à 21 h 52 min 22 s, verdict local à 22 h 04 min 25 s, soit 13 min 08 s. Le harnais a été repris pour comparer la palette seulement lorsqu’elle figure dans la capture, et pour vérifier l’absence de reçu de contact chez le propriétaire plutôt que l’absence d’appel à son journal.
