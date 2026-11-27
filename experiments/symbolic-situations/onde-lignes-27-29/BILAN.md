# ONDE · attribution indépendante des lignes 27, 28 et 29

Douze départs et 92 tickets avec retour sur chacun des deux moteurs, dont deux départs réservés de 16 gestes. Les deux réserves atteignent le vrai N3/T7. Les dix départs sans substitution par indice conservent les mêmes tickets, gardes, mesures et retours. La comparaison utilise le moteur gelé `d0e7527c` et le candidat `75aa3829`. [Présélection scellée](CONTRAT.md) · [Témoin historique](GEL.md) · [Reçu vérifié](recu.json)

| Ligne | Ce que démontre le gel | Apport mesuré du candidat |
|---|---|---|
| **28 — mesurer un contrôle initial** | N1/T1, ACTION3 sans prédiction. Inverser l’ordre des hypothèses déclarées ou marquer seulement ACTION3 comme déjà essayée libère ACTION4. Son retour confirme le sens opposé et T2 exploite la loi. Avec les deux questions déjà essayées sur la même scène, le fournisseur s’abstient et le service libère `information_goal` en (29,3). **L’ordre déclaratif est déjà remplaçable sur le gel.** | À déclaration inchangée, le candidat propose deux offres datées. Sélectionner la seconde donne ACTION4 avec son propre retour. Avec la même demande de substitution, le gel conserve ACTION3. |
| **29 — atteindre une cible de phases** | N1/T2, les deux profils de période 8 admettent 11 préimages sur 64 affectations. ACTION3 dispose d’une prédiction qui satisfait toutes les sommes. Le reçu officiel de passage de niveau porte `matched:null`. Retirer la seule loi individuelle et sa référence transforme le même ACTION3 en sonde. Retirer seulement la préimage de la solution à un pas conserve dix cibles, libère le clic (4,32), mesure le changement de focus, puis le niveau passe à T3. **La recherche consomme le domaine substitué sur le gel.** | Le candidat reproduit ces changements à l’identique. Les deux sélections par indice de la campagne portent sur des questions des lignes 27 et 28. |
| **27 — choisir un canal à sonder** | N3/T7, le clic (48,3) est justifié par une question collective ouverte. Si ce clic a déjà été essayé, le service choisit (57,3). Son propre retour donne le déplacement des deux bandes. T8 passe au rappel d’occurrence et T9 reprend la recherche de cible. Après épuisement des deux canaux collectifs, une question individuelle ACTION4 demeure admissible. **Le choix selon l’historique et l’acquisition de la réponse fonctionnent sur le gel.** | À historique inchangé, le candidat expose deux offres collectives et une individuelle. Imposer la seconde donne le vrai ticket (57,3). Le gel conserve (48,3). L’arbitrage par indice entre offres admissibles a donc une preuve sur branche. |

**Réserve.** Sur les deux révisions, renommer les canaux préserve les 16 commandes et leurs réponses sur le trajet nominal. Dans le second départ renommé, épuiser le seul clic nominal au T7 change le ticket et sa suite comme prévu. Les décalages individuels et collectifs ont été vérifiés par rotation exhaustive des profils avant et après chaque sonde contrôlée. Le contrôle construit supplémentaire énumère les douze phases de son propre monde, garde deux premiers pas optimaux quand les preuves le permettent et rejette trois reçus erronés. Ces contrôles portent sur les décisions et leurs premières suites.

### Rejeu

Depuis ce dossier avec Node 24 et les deux commits disponibles dans Git :

```powershell
node historique.mjs $pyodide "$reçus/gel.json"
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef')) {
  foreach ($groupe in @('repères','choix','historique')) {
    node qualifier.mjs $sha $groupe $pyodide "$reçus/$($sha.Substring(0,8)).$groupe.json"
  }
}
```

Pour la campagne complète, l’opérateur génère les deux cartes avec `node reserver.mjs "$reçus/gel.json" $sélection "$reçus/cartes.json"`, ajoute le groupe `réserve` pour chaque SHA avec le chemin des cartes en dernier argument et lance `node verifier.mjs $reçus`. Les contrôles d’historique sont introduits chez le fournisseur pendant la mesure. L’exécution et les retours de chaque ticket passent par le parcours natif.
