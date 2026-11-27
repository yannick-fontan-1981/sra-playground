# FOGW · ligne 61

**L’extraction `e2e5b52f` conserve le comportement du gel, y compris la continuation périmée dans 3/3 changements de demande. Le correctif `21fd159e` renouvelle l’attente dans ces 3/3 cas.** Le changement est observable dès le reçu de T17. Le premier ticket dont la justification diffère est T18. Son identifiant ordinal et sa commande restent `native:18 / ACTION4`. [Protocole indépendant préalable](https://github.com/yannick-fontan-1981/sra-playground/blob/b0bff2d1d4f3fae736a11b9773bcb2e2526dba80/experiments/symbolic-situations/fogw-ligne-61/CONTRAT.md).

| Observation | Gel et extraction | Correctif |
|---|---|---|
| Retour T17, demande changée | Le ticket émis pour la croix reçoit la confirmation physique de stationnarité. Le préfixe reste ouvert. | Le même ticket reçoit `matched:true`, puis `seal_prefix:true / reception_subject_changed`. La mémoire conserve la demande nouvellement visible et retire l’autorisation de maintien répétée. |
| Ticket T18 | ACTION4, indice 1 d’une série de 8 préparée à la révision 17 pour la croix. | ACTION4, indice 0 d’un essai unitaire préparé à la révision 18 pour le nouveau sujet. La position, le support et l’objectif parent `G_official_completion` sont conservés. |
| Deuxième retour stationnaire construit | T18 reçoit la confirmation physique. T19 continue la série initiale, indice 2. | Le reçu de T18 est lié à son ticket et à la nouvelle demande. T19 ouvre une série confirmée de 8 pour ce sujet, indice 0, préparée à la révision 19. |
| Budget d’attente | Les tickets T16, T17 et T18 ont chacun été exécutés une fois. | Une, deux, puis trois attentes dépensées. Renouveler le sujet conserve le budget consommé. Le contrôle vérifie le compteur acquis et les trois couples ticket/retour. |

**Deux paires indépendantes** partagent l’intégralité des pixels du terrain à l’intérieur de chaque paire. Seul l’afficheur choisit entre la croix et un sujet en escalier. La réserve translate la scène, le récepteur et l’afficheur, et réfléchit l’escalier. Dans les deux géométries, une demande inchangée conserve la série avec les trois moteurs. Les deux changements d’escalier et le L du témoin publié donnent les trois ruptures attendues. Le vérificateur rejette un reçu dont on a substitué le sujet de la croix, même à commande et support identiques.

**Extraction.** Le gel et `e2e5b52f` produisent des reçus strictement identiques sur leurs sept départs communs. À partir de l’extraction, le point `offerStationaryObservation` permet de remplacer la première offre confirmée T17 par une mesure unitaire. Le service l’exécute et T18 ouvre alors une série fraîche, indice 0. Cette contre-épreuve passe aussi sur le correctif.

**Couverture.** 23 exécutions dans le comparatif final : sept sur le gel, huit sur l’extraction et huit sur le correctif. Chacun comprend un départ au plafond nominal de 16 actions, un parcours prolongé à 32 actions, les quatre bras indépendants et le témoin du L. Les deux versions disposant du point extrait ont un départ supplémentaire de substitution. Les 16 tickets du catalogue et les 32 du prolongement concordent entre les trois moteurs. Sur le parcours historique, le niveau change après T18 et la première commande de L2 est une nouvelle sonde. Le jeu Python a reproduit séparément les 33 observations de la fixture, animations incluses. Les variantes d’afficheur et les seconds retours stationnaires sont construits. [Reçu et références des tickets](recu.json).

### Rejeu opérateur

Depuis ce dossier, avec Node 24, `$pyodide` désigne le dossier absolu de Pyodide du Banc. Employer un répertoire de reçus neuf et réserver la sélection de graine à l’opérateur. Le témoin du L et la paire de développement sont publics et rejouables sans graine.

```powershell
node jeu.mjs $pyodide
$gel = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021'
foreach ($sha in @($gel,'e2e5b52fe4476f169c1ab1988d23a5f5368e305c','21fd159e8339ee464a5b7bee0824b93ccefe9995')) {
  $groupes = @('catalogue','historique','développement','réserve','témoin')
  if ($sha -ne $gel) { $groupes += 'extraction' }
  foreach ($groupe in $groupes) {
    node qualifier.mjs $sha $groupe "$reçus/$($sha.Substring(0,8)).$groupe.json" $selection
  }
}
node verifier.mjs $reçus
```
