# AS66 · deux accès à la cavité sur le vrai jeu

**Ligne 84.** Le gel calcule et joue l’accès par glissade. Le candidat `484f3f0d` permet de retirer l’offre complète à l’intérieur du fournisseur. **Ligne 97.** La qualification du choix en fonction de la phase, de sa révision au retour et du retrait de l’offre temporelle est établie dès le gel. [Contrat opérateur scellé](CONTRAT.md) · [Reçu vérifié](recu.json)

### Ligne 84 · catalogue, plafond global de 16

Au T5 de N1, `sliding_cavity_access` lie le corps en (24,26) à la cavité en (24,38) par la surface observée et le sens d’ACTION2, acquis au T2. Le ticket joue ACTION2 et attend l’arrêt en (24,38). Le retour du jeu termine le niveau, scelle le pas et donne `matched:null`. En N2, les sondes T6 et T7 renseignent des directions nouvelles. Au T8, ACTION1 vise l’arrêt en (40,30), que le retour confirme. Le plan continue à l’indice 1.

| Variation | Ticket et retour |
|---|---|
| Retrait de la seule direction d’ACTION2 à pixels identiques | Sur les deux SHA, T5 appartient à `observed_frontier` et joue ACTION3. Après ce retour, T6 reprend l’accès ACTION2 et termine le niveau. |
| Retrait de l’offre statique complète | Sur le candidat, même repli et même reprise. Le gel possède le calcul et conserve le ticket nominal, car le point de retrait intérieur `proposeAccess` y est absent. |
| Retour T5 construit, niveau et pixels antérieurs | Le jeu a réellement terminé N1. Le paquet servi expose toujours N1 et le plateau antérieur, sous une nouvelle référence. Le retour contredit l’arrêt et scelle le pas. Le service redemande ACTION2 avec une nouvelle proposition à l’indice 0. Le vérificateur rejette un reçu qui attribue le niveau terminé à ce paquet construit. |

Le parcours compte sept tickets de glissade, T5 et T8 à T13. Leurs retours donnent trois confirmations, deux contradictions et deux absences de comparaison sur changement de niveau. [Référence du Banc](https://github.com/yannick-fontan-1981/sra-playground/blob/47ae8531/docs/diagnostics/sic-preparation-as66-84-97.md)

### Ligne 97 · coverage, arrêt après trois niveaux

Les deux réglages produisent les mêmes paquets physiques jusqu’au T13. À l’entrée de T14, le catalogue communique trois gestes restants et donne ACTION2 sous `observed_frontier`. Le parcours coverage communique 600 par niveau, omet le plafond global et s’arrête à la fin de N3. Avec 598 gestes restants dans le niveau à T14, le service donne ACTION1 sous `clocked_cavity_access`. L’URL et le budget exacts de la session ciblée d’origine restent inconnus. [Réglages et comparaison du Banc](https://github.com/yannick-fontan-1981/sra-playground/blob/47ae8531/docs/diagnostics/sic-preparation-as66-84-97.md)

Les retours T12 et T13 contredisent les accès statiques. Ils montrent aussi le même masque de 12 × 12 décalé de (+4,0), sous ACTION2 puis ACTION3. Le vérificateur compare les pixels des paquets archivés aux paquets réellement joués. Pour chacun des deux retours, il retrouve le masque à sa nouvelle position dès la deuxième image, alors que le corps occupe encore sa position de départ et ne la quitte qu’à la troisième. Cela recoupe les deux références utilisées par la proposition en T14.

- **Parcours nominal.** T14 à T19 jouent ACTION1, ACTION1, ACTION1, ACTION1, ACTION4, ACTION1, aux indices 0 à 5. Cinq projections sont confirmées. Le retour T16 élimine l’une des deux hypothèses de rebond. T19 termine N3 et la comparaison du plateau donne `matched:false`. Le plan est scellé.
- **Interventions à état égal.** Attribuer les deux mesures à ACTION2 ou retirer seulement le producteur temporel fait perdre l’accès horlogé au T14 sur les deux SHA. La frontière joue ACTION2. Après son vrai retour, le service propose un nouvel accès horlogé au T15, à l’indice 0, et confirme cette nouvelle projection.
- **Réserve opérateur.** La règle scellée a sélectionné T14 parmi les cinq tickets confirmés suivis d’une continuation. C’est aussi le tour utilisé par le contrôle physique de l’auteur. Le jeu exécute le vrai ticket. Le service reçoit le plateau antérieur dans toutes les images, dont le nombre est conservé. Il élimine les deux hypothèses, rend `matched:false` et scelle le pas. Le ticket suivant reprend ACTION1 à l’indice 0.

### Décompte et rejeu

Huit départs et 96 gestes exécutés **par SHA**. Les quatre départs catalogue totalisent 33 gestes. Les quatre départs coverage totalisent 63 gestes. Un ticket lu après un retour stationnaire reste hors du total des gestes joués. Les deux parcours nominaux concordent avec les nombres de tickets, les retours comparés et les scores du Banc. Le verdict indépendant a été vérifié 5 min 25 s après le scellement du contrat. L’agrégat des douze préfixes de l’auteur relève de sa propre vérification.

Sous Node 24, depuis ce dossier, `$pyodide` désigne le répertoire `public/vendor/pyodide` du Banc et `$reçus` un dossier neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','484f3f0d066b7c00a3e2ad68c983ad556be3a3ac')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  node qualifier.mjs $sha nominal $pyodide "$p.nominal.json"
  node qualifier.mjs $sha développement $pyodide "$p.développement.json"
  node qualifier.mjs $sha réserve $pyodide "$p.réserve.json" $sélection "$p.nominal.json"
}
node verifier.mjs $reçus
```
