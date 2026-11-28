# DICO · qualification indépendante de la ligne 86

**Le gel choisit le trajet, acquiert ses retours et poursuit vers une question. Le candidat `d84d0b93` permet de remplacer la sélection du trajet à état identique.** Les deux moteurs ont été comparés sur sept départs et 24 gestes chacun. Les quatre tickets nominaux, leurs propriétaires et leurs vrais retours concordent. [Contrat scellé](CONTRAT.md) · [Reçu indépendant](recu.json)

### Le trajet et ses deux retours

| Tour | Ticket | Ce que le retour établit |
|---|---|---|
| T1 | La frontière joue (1,3). | Le retour transitoire GLOBAL réduit huit candidats à `[0,1,4,5]` sous l’hypothèse d’un membre fixe. |
| T2 | `subset_diagnosis / subset_scope_navigation` joue (6,3). Deux commandes visent les quatre candidats et leur effet demeure inconnu. | Les 14 images contiennent un retour GLOBAL. Les candidats demeurent identiques. La vue couvre toujours huit membres et une nouvelle forme est acquise comme test. |
| T3 | Le même besoin choisit (16,3), seule navigation restante. | La vue réelle contient six membres, `[0,1,4,5,6,7]`. Les quatre candidats sont toujours présents. Le reçu local compare les six membres vus aux quatre visés et donne faux. Le reçu du service est indéterminé et scelle le pas. |
| T4 | `subset_scope_query` joue (6,3) depuis la vue à six membres. | Deux tests de portée sont admissibles à cette vue. Leur arbitrage relève de la qualification 87. |

### Interventions

- **Substitution sur le candidat.** Le service joue (16,3) au T2 sur le même état, conserve les candidats et atteint la vue à six membres. La requête (6,3) devient disponible dès T3. Permuter l’ordre des deux offres conserve le trajet nominal.
- **Retrait sur le candidat.** Le T2 passe à la frontière en (10,23). Après son vrai retour, la famille propose de nouveau la navigation (6,3) à T3. Le gel conserve le trajet de référence lors de ces interventions, car le sélecteur interne est ajouté par la branche.
- **Retour T2 stationnaire.** Le jeu exécute le vrai clic. Le paquet servi garde les 14 images à l’état antérieur. La vue reste large. La famille garde les quatre candidats et marque la clé de (6,3) comme tentée. T3 propose (16,3) comme dans le nominal, avec une trace de tentative à la place de la nouvelle forme de test.
- **Réserve sur la seconde navigation.** Le retour T3 comporte une seule image et la règle de sélection la conserve. La requête (6,3) suit normalement. Dans le complément stationnaire, la vue reste à huit membres et les deux requêtes de la vue réduite sont absentes. Le service poursuit sous le même type `subset_scope_query`, avec une autre question en (13,26). Le vérificateur a été repris pour contrôler la commande, la portée et l’identité de la question après ce constat.
- **Provenance.** Le reçu T3 substituant la référence d’arrivée T2 est rejeté. Le garde natif refuse aussi la proposition T2 représentée sur le plateau d’après, avec `subset_scope_changed`.

Le verdict a été vérifié **1 min 44 s** après le premier essai indépendant. La reprise a concerné une assertion du vérificateur, sur les mêmes reçus. L’auteur a vérifié séparément l’assemblage avec la ligne 87. [Reçu de l’auteur](https://github.com/yannick-fontan-1981/sra-playground/blob/03bfe9f0/experiments/sic-agenda-offres/dico-86/VERDICT.md)

### Rejeu

Sous Node 24, depuis ce dossier, `$pyodide` est le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf. La sélection privée n’est requise que pour le groupe réserve.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $pyodide "$p.$g.json" $sélection
  }
}
node verifier.mjs $reçus
```
