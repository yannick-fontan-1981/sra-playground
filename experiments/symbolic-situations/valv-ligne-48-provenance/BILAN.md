# VALV/48 · qualification du témoin de changement de niveau

**Le correctif `495ea148` passe la réserve d’origine et la reproduction publique.** Sur les deux paires mal datées, le parent `699ac89e` émettait à T11 le ticket de transfert (11,35). Le correctif émet le ticket de l’expérience imbriquée (32,51). Le premier écart se produit après le même retour officiel de T10, avec les mêmes observations L1 et L2. [Critères opérateur](CONTRAT.md) · [Verdict partiel initial](../valv-lignes-44-47-48/BILAN.md) · [Reçu comparatif](recu.json)

| Départ | Parent | Correctif et retour réel |
|---|---|---|
| Témoin authentique 10→11 | Revalidation de la source (11,35). | Même ticket. Le contrôle passe d’horizontal à vertical. Le service rattache la mesure au ticket et propose la revalidation du service en (32,51). |
| Réserve initiale, paire mal datée | Accepte le transfert (11,35). | Repli imbriqué en (32,51), reçu `nested_control_response`. T12 passe à `observed_frontier` et clique en (10,35). Le jeu renvoie les mêmes pixels pour ce clic. |
| Reproduction publique 9→11 | Accepte le transfert (11,35). | Même repli, même acquisition et même suite que dans la réserve. Le vérificateur rejette le reçu de la revalidation du parent si on l’attribue au repli. |
| Déclaration absente | Repli imbriqué (32,51). | Les tickets, acquisitions et observations des deux révisions concordent jusqu’au retour de T13. |
| Contexte déjà lié, aire du récepteur changée de 81 à 82 dans le seul modèle daté à son retour | T11 reçoit la revalidation authentique. T12 continue le transfert en (32,51). | T11 et son changement d’orientation demeurent identiques. T12 clique aussi en (32,51), cette fois pour l’expérience imbriquée. Le reçu daté devient `nested_control_response` et T13 poursuit l’expérience imbriquée. |

**Dénominateurs.** Cinq départs sur chacun des deux SHA, un chargement natif du jeu par SHA et un service neuf par départ. Les deux paires mal datées sont écartées sur 2/2, le récepteur altéré en contexte lié sur 1/1. La vraie paire conserve les 6/6 occurrences nominales de la ligne 48. Les 3/3 occurrences de 44 et les 6/6 de 47 sont également identiques sur le parcours nominal de 16 gestes. Les tickets en L2 ont été exécutés tels que libérés. Le moteur enregistre `matched:null` pour ces expériences sans prédiction physique. Chaque attribution est contrôlée par le type du reçu, le ticket et les références avant et après. Cette qualification porte sur le préfixe de VALV L1/L2 et les modèles construits décrits ci-dessus.

### Rejeu

Depuis ce dossier, avec Node 24, le dossier absolu de Pyodide du Banc dans `$pyodide` et un répertoire de sortie neuf `$reçus` :

```powershell
foreach ($sha in @('699ac89e70be0e3cd9bceafa16689552576310a0','495ea14890c1d0cd69de356d40a3b243e0b86f6d')) {
  node qualifier.mjs $sha $pyodide "$reçus/$($sha.Substring(0,8)).json"
}
node verifier.mjs $reçus
```

Ces commandes rejouent les quatre départs publics par révision. L’opérateur ajoute son fichier de sélection d’origine en quatrième argument de `qualifier.mjs` pour inclure la réserve. Un deuxième argument facultatif de `verifier.mjs` relit l’archive initiale complète pour contrôler l’identité des anciens préfixes, comme dans la mesure publiée.
