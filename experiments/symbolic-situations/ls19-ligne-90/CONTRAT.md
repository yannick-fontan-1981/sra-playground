# Ligne 90 · observer au-delà d'un bord

Le [contrat de SIC 2](https://github.com/yannick-fontan-1981/sra-playground/blob/13ebd79de759b1052e1b261d9c6c3f5b2205d7f9/docs/architecture/sic-ls19-ligne-90.md) est figé à `13ebd79de759b1052e1b261d9c6c3f5b2205d7f9`. Le contrôle indépendant appelle le service natif `V6AgentService` du SHA soumis, avec les déclarations du même commit. Le service consomme son mécanisme normal de sélection de branche. Le travail se situe dans un répertoire expérimental autonome.

**Entrée du moteur.** Une session neuve reçoit le budget et la première observation (images publiques, actions disponibles, état, niveau, pas), puis uniquement l'observation qui suit son propre ticket. Les images proviennent des deux fixtures publiques du gel de référence. L'opérateur exclut leurs instantanés internes et résultats attendus de l'entrée. Le moteur dispose d'un répertoire temporaire contenant ses sources et ses déclarations sous permissions de lecture Node 24, sans la table des transitions, les critères, le nom de la situation ni la réserve. Une commande hors du parcours capturé clôt le rejeu comme écart à localiser. Le dispositif ignore ce qui se serait passé dans le jeu pour cette commande.

| Situation et observation proposée | Règle de jugement préenregistrée |
| --- | --- |
| D1, déplacement puis retour de vue. Le seul bouton de la fixture `viewport-three-prefixes` devient `ACTION3`. Les deux premiers mouvements rendent observable un déplacement de trois pixels vers la droite. Les deux départs ont le même préfixe jusqu'à la troisième commande incluse. | Avant les deux témoins, aucune branche de bord. À la troisième commande, accès admis, vecteur [3,0], surface conditionnelle de 192 pixels. Le retour enregistré donne `expanded`, 192 pixels. Si l'opérateur présente à la place la même image qu'avant le geste, la clôture doit donner `no_new_area`, zéro pixel et aucun prochain ticket. |
| D2, passage puis obstruction. Les images LS19 sont réfléchies horizontalement. Le mouvement vers le haut est attesté deux fois. Sur le parcours long, trois pas du même plan avancent, le quatrième diverge. Un nouvel accès est ensuite essayé dans l'autre sens et rencontre à son tour une obstruction. Le départ alternatif immobilise l'image dès le troisième geste. | Au premier accès, vecteur [0,−8], surface conditionnelle de 512 pixels et garde d'admission. Les poses confirmées préservent le sous-objectif. Les clôtures aux gestes 6, 12 et 13 donnent zéro gain au sous-objectif effectivement libéré. Le nouvel accès et la confirmation d'obstruction ont deux identités distinctes du premier plan et l'agenda consomme une preuve d'obstruction. Au retour du geste 3, le parcours libre poursuit par `ACTION1` et le retour immobilisé exige `ACTION2`. Recopier le quatrième ticket historique échoue sur ce départ. |

**Identités mesurées.** Le besoin de vue est `observe_view_access` sous le but supérieur `G_official_completion`. Son identifiant reste stable au sein de la session. Chaque plan de vue porte un sous-objectif libéré. La clôture désigne le sous-objectif dont le ticket a effectivement été exécuté. Le verdict distingue le choix de branche, l'admission, la pose intermédiaire et la surface effectivement gagnée.

**Portée.** Ces cas construits éprouvent la décision, son garde et le rattachement du retour dans le service natif, sur des transitions publiques déterminées. Les contrefactuels modifient la géométrie, le bouton offert ou le retour visuel. Cette mesure ne complète aucun niveau du jeu, n'établit pas une généralisation à tous les plateaux et ne décide pas de l'intégration de la ligne dans les 98.

Rejeu depuis ce répertoire dans un clone contenant le contrat et le candidat, avec Node 24 et `tar` :

```powershell
node qualifier.mjs --sha 13ebd79de759b1052e1b261d9c6c3f5b2205d7f9 --depot .
```

Le paramètre `--sha` sélectionne les sources natives, indépendamment du checkout courant. `--rapport` désigne un nouveau fichier de reçu. [Générateur des situations et paramètres publics](fixture.mjs) · [Critères exécutables](criteres.mjs)
