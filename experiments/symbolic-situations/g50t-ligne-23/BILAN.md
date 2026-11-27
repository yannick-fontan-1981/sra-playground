# Ligne 23 · G50T · résultat de l'opérateur indépendant

Le moteur des 107 jeux possède déjà la chaîne de la ligne 23 sur les cas éprouvés. Il rattache une question au plateau et au domaine (P01), classe les commandes inédites selon l'historique (P04), admet un essai d'effet inconnu (P05), autorise le geste sur l'occurrence courante (P11) et consigne son retour sous le besoin correspondant (P12). Le candidat `ba04161fbce03f9660e9e73c14ed2c14ef2538d7` formalise les contrats TypeScript du domaine, de la question et de l'accès. Le crédit fonctionnel remonte à `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.

| Mesure indépendante | Gel | Candidat |
| --- | ---: | ---: |
| G50T L1, geste 1, jeu exécuté jusqu'au retour | 1/1 | 1/1 |
| Fournisseur natif, situations locales de développement | 7/7 | 7/7 |
| Fournisseur natif, situations locales réservées | 7/7 | 7/7 |
| Fournisseur natif, accès orienté et absence de trajet, en développement puis en réserve | 4/4 | 4/4 |
| REGN L3, geste 16, négatif historique d'attribution | 1/1 | 1/1 |

**G50T.** Le même harnais produit aussi le même premier geste sur l'inventaire `8ce7ee35`. Le service libère `observed_frontier / test_local_input / experiment`, ticket 1, `ACTION1`. Le besoin `observe_untried_input_effect` est assigné à `Q_36ce889058ea8eda599b`. Le retour le fait passer à `observed` et cite la transition du ticket. Son statut est `unknown_effect_observed`, avec `matched=null`. Le sceau avant choix, la garde, le ticket et l'acquisition sont identiques sur les trois révisions. L'évaluateur rejette les deux altérations indépendantes portant sur la famille de la décision et sur la question du reçu.

**Transfert.** Quand les deux commandes sont neuves ici, l'ordre canonique départage l'égalité. Inverser la présentation du domaine conserve la question. Un essai antérieur au même index ferme la question correspondant à sa commande. Quand l'essai a eu lieu sur l'autre plateau, les deux questions restent ouvertes ici, mais leurs usages dans l'époque changent le choix. Une deuxième lecture du même plateau ferme l'essai effectué. Un nouveau plateau permet de réessayer cette commande sous un nouvel identifiant. Dans les deux partitions, la garde refuse une occurrence altérée sur chacune des dix propositions positives, dont une d'accès. D3–D6 injectent des transitions publiques au fournisseur pour faire varier exactement la commande exécutée dans le passé. Le service public impose ses propres tickets et ne permet pas d'injecter librement une ancienne action.

**Dialogue public.** Le service a rejoué deux départs dans chaque partition (cycle et permutation), puis une fixture de contrôle de la ligne 22 en développement. Sur chaque cycle, il accepte trois retours successifs en respectant le besoin et la question. Il rejette un ticket étranger et un ticket déjà consommé. Sous Windows, la conversation adaptative utilise l’entrée Node documentée. Chaque préfixe effectivement obtenu est aussi rejoué avec le lanceur officiel sous PowerShell 7. Les objets JSON correspondent à chaque tour. Windows PowerShell 5.1 ajoutait une marque d’encodage au premier retour dans notre montage par pipe.

**Contrôle de la ligne 22.** Une arête de A vers B rend la question distante accessible. Quand seule l'arête inverse est connue, le fournisseur garde le besoin d'accès ouvert. Sur la fixture à deux plateaux du service, le ticket 4 accède à une autre vue par `ACTION4`, puis le ticket 5 poursuit le même plan à l'index 1 par `ACTION3`. Ce cinquième geste est une continuation. Après épuisement, le service suspend sans ticket. Sur le vrai REGN, l'action 16 est aussi `ACTION4`, avec une projection confirmée. La famille responsable est `returned_branch_contrast`. Cela donne zéro témoin positif de la ligne 22 sur ce point de REGN.

**Émission.** Un seul module sous `src` diffère, `v6-observed-frontier.ts`. TypeScript 5.9.3 produit les mêmes octets sur les deux révisions, que les commentaires soient conservés ou supprimés. Le reçu publie les empreintes des deux compilations et des résultats complets communs vérifiés, dont le sceau, la garde, le ticket et le reçu du service. [Reçu](recu.json) · [Critères et sélection scellés avant ouverture du candidat](CONTRAT.md)

## Rejeu des entrées publiques

Ces commandes se lancent depuis ce répertoire, avec Node 24 et un checkout propre du candidat. Sur Windows, la contre-épreuve du lanceur utilise PowerShell 7 (`pwsh.exe` sur le PATH). Le jeu utilise le répertoire local de Pyodide déjà préparé. Employer des noms de reçus neufs.

```powershell
$candidat = 'ba04161fbce03f9660e9e73c14ed2c14ef2538d7'
$checkout = 'D:/dev/ARC-AGI/SRA-Playground/sic-essai-local-23'
$pyodide = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
node qualifier.mjs $candidat "$env:TEMP/23-fournisseur.json"
node operer.mjs candidat $checkout "$env:TEMP/23-dialogue.json"
node jeu.mjs $candidat $checkout $pyodide G50T "$env:TEMP/23-G50T.json"
node jeu.mjs $candidat $checkout $pyodide REGN "$env:TEMP/23-REGN.json"
```

Pour le gel, remplacer le SHA par `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le mode du dialogue par `gel`. La fiche initiale et les retours publics après ticket sont les seules entrées de jeu de l'opérateur. Les résultats attendus et la sélection réservée demeurent côté contrôle.
