# VALV/48 · rattacher le transfert à sa frontière officielle

## Premier écart attendu, enregistré avant le correctif

Le parent est l’extraction `699ac89e70be0e3cd9bceafa16689552576310a0`. Le contrôle indépendant `e835a6ee` a retrouvé les six décisions nominales de transfert et un défaut de portée. Nous reproduisons le défaut dans `V6AgentService`, depuis L1. T10 exécute le service en (32,50). Les acquisitions `nested_control_response` et `field_service_context` portent la paire **révision 10 → révision 11**, le progrès officiel et la sortie de l’epoch 1. Le modèle acquis porte un relais 7×7 et un récepteur 9×9. [Contrat initial](sic-valv-lignes-44-47-48.md) · [Contre-épreuve de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/e835a6eec139bad091b7dc9481944e2f8c5b4c14/experiments/symbolic-situations/valv-lignes-44-47-48/BILAN.md)

Nous altérons uniquement la première référence du témoin dans `FieldServiceMemory.transferEvent`. La paire revendiquée devient **9 → 11** avec deux observations authentiques. Le retour du jeu, les reçus indépendants, les références d’acquisition et l’image de L2 sont identiques. Le parent libère à T11 `field_service_transfer_experiment / revalidate_source_access`, ACTION6 (11,35), sur cette paire altérée.

**Premier écart requis.** T1–T10 conservent leurs décisions et le retour officiel. Au T11, la famille doit retirer l’offre de transfert à paire altérée. Le service doit reprendre comme en l’absence de témoin, avec `nested_control_experiment`, ACTION6 (32,51). Sur la vraie paire, il garde le ticket (11,35). Une paire authentique associée à un autre modèle de récepteur ou à une autre époque d’acquisition est également insuffisante. Éprouver le contrôle en réhydratant la mémoire et en réutilisant le contexte d’un plan déjà lié. Une acquisition légitime reste utilisable plus tard, dans une époque ultérieure, après reconnaissance des formes actuelles. Les lignes 44 et 47 doivent conserver leurs décisions.

Le code du Banc et l’extraction initiale restent des références indépendantes pour cette vérification. Le verdict final sur 48 doit comprendre un nouveau contrôle de la garde corrigée par l’opérateur et le Banc.

## Décision du correctif

Le modèle est formé pendant les appels à `FieldServiceMemory.record` qui suivent une question de service. Il conserve l’epoch d’acquisition, le relais, son orientation conductrice, le récepteur appris et la couleur de son remplissage. Au changement de niveau, la paire officielle est annoncée dans le modèle. Le défaut venait du consommateur. Il suffisait que cette paire soit non vide et que l’epoch soit différent pour ouvrir le transfert. [Production et consommation du modèle](../../src/logos-engine/v6-field-service-access.ts)

`hasTransferWitness` consulte les journaux déjà acquis. Les références restent opaques. Le contrôle ne suppose aucune convention de nommage des révisions.

| Fait nécessaire | Trace qui l’établit |
|---|---|
| Les deux observations forment une seule transition officielle. | Un même événement `nested_control_response` porte **exactement** la paire annoncée, `same_epoch=false` et `official_progress=true`. Deux références authentiques prises à des pas différents ne satisfont pas ce contrôle. |
| Cette frontière appartient à l’expérience de service à l’origine du modèle. | Le journal `field_service_context` porte cette même paire, la phase `boundary_revalidation_required` et l’epoch d’acquisition. Le champ sélectionné doit avoir la forme du relais appris et le contrôle doit porter son orientation conductrice. |
| Le récepteur est celui qui avait été acquis avant la frontière. | L’événement de transfert qui accompagne cette paire permet de retrouver le modèle immédiatement antérieur. L’epoch, la forme du relais et du récepteur, l’orientation et la couleur de remplissage doivent correspondre au modèle courant. |
| La demande de transfert porte sur une époque ultérieure. | L’observation demandée a un epoch strictement supérieur à l’epoch d’acquisition. `bindTransfer` conserve ses conditions de reconnaissance des formes et des portes du plateau courant. |

Le même contrôle précède l’offre et la liaison géométrique. Il s’applique aussi lorsqu’un contexte de transfert du niveau courant se trouve déjà en mémoire. Si la preuve échoue, la sélection reprend ses offres suivantes. Le premier écart se trouve dans la **question** de T11. Sur la paire valide, la garde autorise `field_service_transfer_experiment` à (11,35). Sur la paire altérée, elle autorise `nested_control_experiment` à (32,51), dans la même famille. Le ticket conserve `ACTION6` dans les deux cas. Aucun champ de journal supplémentaire n’est requis pour la restauration.

Les deux tests ciblés échouent sur le parent. Le premier modifie le modèle à sa production sans modifier les observations ni les reçus. Le second réhydrate les événements acquis à T11 puis à T12. Il isole les changements de récepteur, d’epoch d’acquisition, de progrès officiel, d’epoch du service et de champ sélectionné. Les témoins complets restent admissibles avant et après l’acquisition du contexte. [Tests de la ligne 48](../../tests/sic-valv-field-service-lines.test.ts)

## Reproduire

Depuis un checkout préparé (Node 24, actifs du jeu, générateurs Python aux fins de ligne du blob Git), lancer les deux contre-épreuves puis les suites communes. La variable active le vrai jeu pour le préfixe nominal. Les falsifications utilisent le même service avec les observations publiques archivées.

```powershell
$env:SIC_VALV_GAME_ROOT = (Resolve-Path .).Path
node --test --test-name-pattern='^48 ' tests/sic-valv-field-service-lines.test.ts
node --test tests/sic-valv-field-service-lines.test.ts tests/v6-field-service-kernel.test.ts tests/v6-field-service-reference.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Le préfixe du catalogue conserve les 3/3 occurrences de 44, les 6/6 de 47 et les 6/6 de 48. Le rejeu prolongé depuis L1 avec le pack par défaut et un plafond de 28 actions retrouve dans le vrai jeu **28 libérations, 28 retours et 29 paquets publics identiques** au parent `699ac89e`. Les trois premiers niveaux sont franchis et la dernière observation appartient à L4. Les deux rejeux démarrent de L1, avec la même identité de session et 600 actions par niveau. La contre-épreuve de la fausse paire est le changement de décision attendu. [Commande de capture du Banc pour les 16 gestes historiques](https://github.com/yannick-fontan-1981/sra-playground/blob/f50c67ed8b1e5d1cab054531e701c8bc8192ee85/docs/diagnostics/sic-qualification-valv-699ac89e.md)
