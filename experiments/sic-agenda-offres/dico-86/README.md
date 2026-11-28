# DICO · ligne 86 · naviguer vers la portée à inspecter

Le catalogue attribue DICO N1/T2 à `subset_diagnosis / subset_scope_navigation`. Les essais partent du niveau 1 avec le pack par défaut, ouverture native, plafond de session 16 et 600 gestes par niveau. Ils suivent quatre tickets depuis le vrai jeu. [Inventaire historique](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères préenregistrés](ATTENDUS.md)

## Ce que le service consomme

| Geste | Fait disponible, offre et retour |
|---|---|
| T1 | La frontière clique (1,3). La réponse transitoire GLOBAL, sous l’hypothèse d’un membre fixe, réduit huit candidats à `[0,1,4,5]`. La réponse lie une forme de commande à un test. |
| T2 | La vue couvre huit membres. Aucun test direct de portée n’est encore qualifié. Deux commandes de formes non liées à un test visent la portée `[0,1,4,5]`, qui contient tous les candidats et est strictement incluse dans la vue. Les deux effets de navigation restent inconnus. À taille égale, le tri par coordonnées choisit (6,3) avant (16,3). Le service admet et émet le ticket. Les quatorze images donnent un nouveau reçu GLOBAL qui conserve les quatre candidats. La vue garde huit membres et la forme de (6,3) rejoint les formes de test observées. |
| T3 | La même obligation de préserver les quatre candidats s’applique. (16,3) est la seule offre de navigation restante. Son retour établit une portée de six membres `[0,1,4,5,6,7]`. La comparaison locale avec les quatre membres visés donne `false`. Le service scelle le ticket et les quatre candidats restent en jeu. |
| T4 | La vue devenue plus étroite rend deux tests de portée admissibles. Le fournisseur reprend en `subset_scope_query`. La sélection et l’interprétation de ce test appartiennent au dossier 87. |

Le pré-événement est relevé après le calcul des offres admissibles et avant le choix local. Il contient la référence courante, le domaine, la portée, le nombre de tests directs disponibles, les formes apprises et les questions déjà tentées. Le service conserve son arbitre global et sa garde `current_subset_control_and_exact_declared_question`. Le reçu de famille distingue la confirmation GLOBAL, la comparaison de portée et l’autorisation du ticket. [Famille native](../../../src/logos-engine/v6-subset-diagnosis.ts)

## Contre-épreuves

| Variation au T2 | Résultat |
|---|---|
| Inverser exactement les deux offres | Le service émet encore (6,3) et conserve le préfixe nominal. |
| Sélectionner l’autre offre admissible | Le service autorise (16,3) avec sa propre clé. La portée réelle se resserre à six membres, la comparaison avec quatre rend `false` et le service atteint la requête dès T3. |
| Présenter le plateau précédent après le même ticket | Le monde a exécuté (6,3) et son paquet authentique est conservé par empreinte. Sur le retour stationnaire présenté, la navigation échoue, les candidats et les formes de test restent les mêmes, et la clé de (6,3) entre dans les tentatives. Le prochain ticket utilise (16,3). Nominal et stationnaire atteignent ainsi la même commande pour des preuves différentes. |
| Représenter la proposition T2 sur le plateau du retour | La garde locale répond `subset_scope_changed`. |
| Retirer le choix de navigation au T2 | L’arbitre global retient un essai de frontière (10,23), puis la famille retrouve la navigation par (6,3) au T3. |

**Attribution.** Le gel choisit déjà un trajet sur l’état public, en consomme le retour et reprend par une question. Le candidat introduit un point de sélection entre les offres de navigation déjà admissibles et la préparation native du ticket. La substitution de commande jusqu’au retour et la permutation éprouvent cette contribution. L’ouverture 98 conserve son propre témoin.

## Rejouer hors ligne

Depuis le checkout du SHA à qualifier, avec Node 24+, Git, tar et Pyodide local :

```powershell
$d = 'experiments/sic-agenda-offres/dico-86'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/dico86.json"
& $node24 "$d/operateur.mjs" --moteur candidat --variante autre-commande --pyodide $py --recu "$env:TEMP/dico86-autre-commande.json"
```

Le vérificateur compare huit préfixes. Le reçu ne contient que des faits symboliques, tickets, références et empreintes. Les variantes du harnais ne sont activées que dans le processus de l’opérateur. [Harnais](operateur.mjs) · [Assertions](verifier.mjs)
