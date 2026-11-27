# VALV/48 · rattacher le transfert à sa frontière officielle

## Premier écart attendu, enregistré avant le correctif

Le parent est l’extraction `699ac89e70be0e3cd9bceafa16689552576310a0`. Le contrôle indépendant `e835a6ee` a retrouvé les six décisions nominales de transfert et un défaut de portée. Nous reproduisons le défaut dans `V6AgentService`, depuis L1. T10 exécute le service en (32,50). Les acquisitions `nested_control_response` et `field_service_context` portent la paire **révision 10 → révision 11**, le progrès officiel et la sortie de l’epoch 1. Le modèle acquis porte un relais 7×7 et un récepteur 9×9. [Contrat initial](sic-valv-lignes-44-47-48.md) · [Contre-épreuve de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/e835a6eec139bad091b7dc9481944e2f8c5b4c14/experiments/symbolic-situations/valv-lignes-44-47-48/BILAN.md)

Nous altérons uniquement la première référence du témoin dans `FieldServiceMemory.transferEvent`. La paire revendiquée devient **9 → 11** avec deux observations authentiques. Le retour du jeu, les reçus indépendants, les références d’acquisition et l’image de L2 sont identiques. Le parent libère à T11 `field_service_transfer_experiment / revalidate_source_access`, ACTION6 (11,35), sur cette paire altérée.

**Premier écart requis.** T1–T10 conservent leurs décisions et le retour officiel. Au T11, la famille doit retirer l’offre de transfert à paire altérée. Le service doit reprendre comme en l’absence de témoin, avec `nested_control_experiment`, ACTION6 (32,51). Sur la vraie paire, il garde le ticket (11,35). Une paire authentique associée à un autre modèle de récepteur ou à une autre époque d’acquisition est également insuffisante. Éprouver le contrôle en réhydratant la mémoire et en réutilisant le contexte d’un plan déjà lié. Une acquisition légitime reste utilisable plus tard, dans une époque ultérieure, après reconnaissance des formes actuelles. Les lignes 44 et 47 doivent conserver leurs décisions.

Le code du Banc et l’extraction initiale restent des références indépendantes pour cette vérification. Le verdict final sur 48 doit comprendre un nouveau contrôle de la garde corrigée par l’opérateur et le Banc.
