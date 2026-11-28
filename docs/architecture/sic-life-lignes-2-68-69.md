# LIFE · invitation animée, essai sur porteur et sélection de descendants

## Critères préenregistrés

Références `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `8ce7ee35`. Partir de N1 avec le pack par défaut du catalogue, sans graine explicite ni option `curious`, six niveaux cibles, plafond global 16 et plafond par niveau 600. Le premier rejeu du gel prend 46,35 s. Les 16 libérations et retours concordent avec le rejeu du catalogue. [Témoin 2](sic-v8-strategies-observees.md?plain=1#L28) · [Témoins 68 et 69](sic-v8-strategies-observees.md?plain=1#L94)

| Ligne | Témoin, retour et reprise à préserver | Contre-épreuve |
|---|---|---|
| 2 · `animated_contact / measured_animated_contact` | T1 (24,7), invitation en forme de croix unique. Quatre images de retour, même image finale, aucune prédiction de contact. T2 quitte la famille. T16 en N2 retrouve une invitation en (40,7). | Retirer seulement la mesure d’invitation à géométrie constante pour les autres familles. Tester une scène à deux croix et ce que devient la décision T2 si le premier reçu n’est pas acquis. Distinguer la mémoire de l’essai et la présence actuelle des porteurs. |
| 68 · `public_occurrence_recall / typed_material_flow / typed_carrier_experiment` | T2 (6,48) sélectionne l’un des quatre porteurs mesurés. Observer le marquage local, le choix du partenaire à T3 puis le remplacement et son activation à T4. La seconde paire est éprouvée dans le même niveau. | À scène et historique constants, tester un autre premier porteur ou le retrait des offres. Une fois le premier porteur marqué, le partenaire doit garder le profil requis et différer du sujet marqué. |
| 69 · `public_occurrence_recall / typed_material_flow` | T5 (12,21) sélectionne un descendant observé au retour de T4, lié à une demande unique. T6 (24,7) tente de le livrer. Mesurer la marque, la disparition ou la modification de la demande, puis la reprise. | Tester l’autre descendant admissible à scène constante. Si le sujet est marqué et engagé, la livraison reste rattachée à lui. Retirer la preuve de sa demande unique ou de sa présence et observer le repli. |

L’arbitrage commun envisagé pour 68 et 69 se limite au choix initial parmi les sujets effectivement admissibles. Le profil du partenaire, les demandes compatibles et le sujet déjà engagé sont calculés par leur famille. Le gel départage localement par position puis signature, à deux endroits. Conserver le tri nominal, la provenance et les gardes. Pour la ligne 2, éprouver le producteur existant `animatedCrossInvitation` et les deux vrais départs avant de conclure à la nécessité d’une extraction. [Contact animé](../../src/logos-engine/v6-animated-contact.ts) · [Porteurs, flux et reçus](../../src/logos-engine/v6-typed-material-access.ts)

## Parcours natif et portée du lien causal

| Ligne | Offre, preuves et décision | Reçu physique et suite | Contre-épreuve au service |
|---|---|---|---|
| **2** | T1, `animatedCrossInvitation` reconnaît exactement une croix symétrique et donne son centre, sa référence d’entité et sa signature à `AnimatedContactAccess.proposeGraph`. Le plan `invitation` autorise (24,7) sous `current_animation_question_bound`. En N2/T16, le même producteur donne (40,7) après relecture de la nouvelle scène. | Quatre images aux deux retours. Chaque image finale égale celle d’avant le clic. `recordPacket` acquiert l’essai avec les deux observations, sans modèle de courbe. Sur le gel, omettre seulement cette acquisition fait répéter (24,7) à T2. Avec le reçu présent, T2 libère l’offre de porteur. | Deux croix sur une scène publique construite éliminent l’invitation unique. Retirer sa seule entité dans la mesure de cette famille, en laissant le vrai plateau aux autres, libère également `typed_carrier_experiment(6,48)` dès T1. |
| **68** | T2, quatre porteurs marqués actuellement mesurés, aucun contexte de contact. L’ordre nominal y/x/signature place (6,48) en tête. La famille choisit le sujet, lie le point et garde le cadre, l’époque et le score. T3 demande un autre porteur de même profil extérieur. T4 choisit le support produit. | T2 change 29 pixels autour du premier porteur et produit `local_marking`. T3 (41,48) change 232 pixels et produit `produced_support`. Le retour de T4 (16,34) établit deux descendants, chacun référencé à ce retour. T9–11 répètent ce parcours sur une seconde paire. | Un retour construit sans marquage à T2 laisse le contexte vide et le service s’arrête avant la libération de T3. Sur branche, choisir le second sujet à preuves constantes donne (23,48). Après son vrai marquage, T3 vise son partenaire (58,48), puis T4 le support en (48,34). |
| **69** | T5, `baseFlowQuestion` retrouve des descendants présents dans l’image avec une demande compatible unique par sujet. Au premier passage, la couleur du corps soutient la correspondance. Les modèles précédemment acquis peuvent ensuite qualifier le descripteur. `select` pointe le descendant, puis `deliver` pointe la demande du même descendant après marquage public. | T5 (12,21) produit `local_child_marking`. T6 (24,7) produit `material_consumed_and_request_changed`. La disparition du descendant et le changement dans la zone demandée soutiennent l’association. T7 reprend avec (19,21), T8 vise (56,7). T12–15 réutilisent le parcours sur d’autres descendants. Le dernier reçu est une frontière officielle. | Inscrire la première demande parmi les demandes déjà servies change T5 en (19,21), dès le gel. Sur le candidat, garder historique et image intacts et choisir le second descendant donne ce même clic. Son vrai marquage libère (56,7) puis l’essai revient à (12,21). Retirer tous les sujets admissibles suspend le service avant T5. |

**De 2 à 68.** Les quatre porteurs sont déjà mesurables à T1. T2 référence seulement l’observation courante, qui est aussi le retour de T1. La mémoire animée consigne l’essai, ce qui change la compétition entre familles. La famille matérielle détermine le porteur sur l’image actuelle. Le reçu animé ne lui enseigne ni profil ni loi de production. T1 et T6 ont d’ailleurs la même commande (24,7) avec des propriétaires, des objectifs et des reçus distincts. [Invitation et mémoire animées](../../src/logos-engine/v6-animated-contact.ts) · [Entrée de la famille de matière](../../src/logos-engine/v6-shared-series.ts)

**De 68 à 69.** La branche de `TypedMaterialMemory.record` reconnaît l’activation du support produit, puis `typedMaterialDescendants` mesure les nouveaux sujets. T5 peut relier son sujet au retour T4. `carrierQuestion` donne la priorité à `flowQuestion` quand des descendants restent enregistrés pour l’époque. La présence actuelle, l’unicité de la demande, le marquage et le résultat de livraison restent à vérifier pour chaque geste. Les deux contrats de retour restent inconnus au moment du clic (`matched=null`), puis le journal enregistre séparément les changements mesurés. [Sélection et acquisition](../../src/logos-engine/v6-typed-material-access.ts) · [Mesures de porteurs, descendants et demandes](../../src/logos-engine/v6-typed-material-observation.ts)

## Attribution par révision

- **2 · preuve locale rétroactive sur `d0e7527c`.** L’offre est réutilisée aux T1 et T16. Son retrait au T1 et le retrait de son acquisition donnent deux tickets différents et distinguent les causes. Le sélecteur de sujets du candidat concerne les lignes 68 et 69. LIFE recapture 2 des 21 occurrences de la ligne 2 au catalogue.
- **68 · candidat sur branche.** Le gel fournit la mesure, le premier tri, les contextes successifs et leurs gardes. Le candidat rend le choix du porteur initial substituable à liste mesurée et historique constants. Les 6 occurrences du catalogue sont recapturées sur LIFE. L’abstention du nouveau sélecteur à T2 arrête le service avant son geste.
- **69 · candidat sur branche.** Le gel fournit la demande unique, l’effet du registre des demandes servies et le rattachement d’une livraison au descendant sélectionné. Le candidat rend substituable le choix d’un descendant encore libre. Les 8 occurrences du catalogue sont recapturées. Les deux cas de substitution physique ont chacun deux retours et un ticket suivant.

Le raccord `selectUnboundSubject` reçoit les sujets admissibles triés par ligne, colonne, puis signature. Le porteur et le descendant gardent leurs signatures respectives. Le sélecteur renvoie un indice de la liste ou s’abstient. `unboundSubject` utilise exclusivement la liste fournie par l’appelant. Les partenaires imposés par un marquage et les livraisons d’un sujet engagé suivent leur propre contexte. Le code de contact animé, les règles de demande, la garde, la quantité de gestes et les noms des reçus restent ceux du gel. [Tests du parcours et des transferts](../../tests/sic-life-three-lines.test.ts) · [Quatre observations physiques alternatives](../../tests/fixtures/sic-life-alternate-returns.json.gz)

## Entrées pour les deux validateurs

Critères préenregistrés en `a7f40efd`. Node 24, depuis le candidat. Les tests utilisent les 17 premiers paquets de la trace publique. Le mode physique recharge le jeu depuis N1 pour le catalogue et les deux substitutions. Les contre-épreuves sur la croix, le reçu animé, le marquage et la demande servie sont construites. [Trace nominale](../migration/native-campaigns-v50/life-public-trace-final.json.gz)

```powershell
$env:SIC_LIFE_GAME_ROOT = 'D:/dev/ARC-AGI/SRA-Playground/sic-cartographie-p05'
node --test tests/sic-life-three-lines.test.ts
node --test tests/v6-animated-contact.test.ts tests/v6-typed-material-kernel.test.ts tests/v6-typed-material-reference.test.ts
node node_modules/typescript/bin/tsc --noEmit

$gelLIFE = Join-Path ([IO.Path]::GetTempPath()) ('life-gel-' + [guid]::NewGuid())
git clone --shared --no-checkout . $gelLIFE
git -C $gelLIFE sparse-checkout set src reference
git -C $gelLIFE checkout --detach d0e7527ca8033bd805a6d7a8bb021eff62e87021
$env:SIC_LIFE_ENGINE_ROOT = $gelLIFE
node --test --test-name-pattern='^LIFE|^2 |^68 |^69 ' tests/sic-life-three-lines.test.ts
Remove-Item Env:SIC_LIFE_ENGINE_ROOT
```

Sur le préfixe nominal, la comparaison des exécutions physiques parent/candidat retrouve les mêmes 16 libérations et retours, avec les plans, les gardes et les mêmes 17 observations complètes. Les suites de provenance vérifient les octets Git des générateurs (LF). Les verdicts indépendants et toute intégration sont suivis séparément par numéro. Le candidat passe 10/10 cas ciblés avec le jeu actif (99,50 s), 275/275 contrats et le contrôle TypeScript. Les six contrôles de comportement antérieur passent séparément sur les sources du gel.
