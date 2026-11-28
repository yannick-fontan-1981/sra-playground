# GLOB · Apprendre le lancement, puis choisir l'origine

Le geste 3 vérifie si le contrôle jusque-là inerte fait fonctionner le programme après un placement. Le geste 4 utilise les déplacements réellement visibles pendant cette exécution pour choisir où replacer le marqueur. Les deux décisions historiques appartiennent à `fixed_origin`. L'accès au geste 4 existe déjà sur le gel. Le candidat rend la question du geste 3 substituable dans ce même fournisseur.

Le point de départ est GLOB N1, curiosité native et agenda du Playground, plafond global de 16 commandes et plafond de 600 par niveau. Le catalogue exécuté à `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` attribue N1/T3 ACTION5 à `fixed_origin_dependency` et N1/T4 ACTION6 à `fixed_program_origin_access`. Le checkout part de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Les [attendus](ATTENDUS.md) ont été enregistrés à `a958fd3f91d6bd06138a6c38acbabe518588e42d`.

## Ligne 13 · Vérifier le prérequis du programme

Au geste 1, ACTION5 rend la même image finale. Au geste 2, le clic en (10,16) modifie le remplissage du seul nœud 13 et conserve le mot affiché. `FixedOrigin.record` mémorise la commande inerte et lie le placement à l'observation courante. Le pré-événement de T3 contient la référence et l'empreinte de cette image, le nœud, la commande de placement et les deux références du changement. La mémoire des commandes inertes est un ensemble de noms. Le journal du premier ticket fournit la preuve supplémentaire de l'absence de changement final.

| Variation | Décision et conséquence |
|---|---|
| État nominal | Le garde accepte ACTION5. L'effet est inconnu et le retour scelle la question avec `matched:null`. Les 66 images du paquet, précédées de l'image de départ, permettent d'identifier douze transitions pour les deux symboles du mot. |
| Référence de placement étrangère, ou retrait de la seule acquisition d'inertie | Le fournisseur suspend la question. Sur le même plateau, `observed_frontier` essaie un point en (10,17). |
| Échange bijectif des noms ACTION4 et ACTION5 sur le transport public | Le service mesure ACTION4 au premier geste, puis demande ACTION4 au troisième. Le jeu reçoit la commande physique d'origine. Le lancement depuis le placement calculé atteint N2. |
| Retrait de l'offre 13 à son nouveau point de sélection, acquisitions conservées | Le gel conserve sa proposition intégrée. Sur le candidat, la frontière reprend la main. La substitution porte uniquement sur cette question. |

**Attribution 13.** Le gel sait acquérir la preuve, varier la commande selon le contrôle disponible et vérifier le contexte. La décision de poser cette question était incluse dans `FixedOrigin.propose`. Le candidat en extrait `dependencyOffer`, appelée après un éventuel accès fondé sur des exécutions antérieures. Le défaut de preuve, la substitution explicite et le retour réel sont éprouvés séparément. [Fournisseur](../../../src/logos-engine/v6-fixed-origin.ts)

## Ligne 14 · Rendre accessible l'origine

`fixedProgramSamples` lit les nœuds successifs du marqueur pendant chaque instruction. `originOffer` ajuste les relations aux exemples, vérifie le mot courant et la cible, construit les modèles de ports et demande à `calculateFixedProgram` les origines compatibles dans tous les modèles retenus. Au T4, huit modèles admettent une seule origine parmi 29 placements accessibles. Le nœud 10 mène à la cible 23. Le ticket porte ACTION6 en (31,12). Le retour confirme la présence du marqueur au bon nœud avec le même mot. Le garde valide ensuite ACTION5. Le passage officiel au N2 arrive à T5, avec `matched:null`. [Calcul des préimages](../../../src/logos-engine/v6-fixed-program-calculation.ts)

| Modification d'une preuve ou de sa présentation | Attendu et obtenu |
|---|---|
| Retirer les images intermédiaires du retour 3 et conserver exactement son image finale | Même référence de plateau au T4. L'exécution enregistrée ne fournit qu'un couple 13→13. Il manque des exemples pour le mot. L'offre 14 disparaît et la frontière est sélectionnée. |
| Déplacer de +1 en y toutes les images et inverser les coordonnées lors des clics | Même mot, mêmes transitions mesurées et même chemin de nœuds. Le placement initial passe en (10,17), le placement calculé en (31,13) et le jeu franchit le niveau. Le test vérifie les marges avant translation. |
| Permuter uniquement les remplissages publics des nœuds 23 et 24 dans l'image finale au retour 3 | Les échantillons d'instruction demeurent identiques. La cible visible devient 24. Les huit modèles conduisent au nœud 11 et au clic (37,12). Cette fiche modifie la cible présentée et s'arrête après le choix et le retour de placement. |
| Retirer l'offre de `originOffer` sur ce seul tour | La frontière choisit le clic (10,17). Le fournisseur retrouve un accès au tour suivant. Ce raccord est disponible sur le gel. |
| Rendre après le ticket T4 le plateau précédent, avec marqueur absent | La comparaison physique donne `matched:false` et scelle le préfixe. Au T5, le service propose un nouveau placement, indice 0. Le lancement de l'ancien préfixe est annulé. |

**Attribution 14.** Le gel consomme une offre d'accès distincte, recalculée sur la cible publique et les transitions observées. Il contrôle la reprise au retour de placement. Dans les deux cas de cible, le domaine admissible est un singleton. Ces essais prouvent le choix d'origine par les preuves et la substitution de l'offre dans le service. Ils ne mesurent aucun départage entre deux origines également admissibles. La nouvelle méthode de la ligne 13 ne modifie pas cette décision. Le mode SIC seul dispose d'un autre consommateur de certaines primitives géométriques, `sic_program_origin`. La qualification historique ci-dessus suit le fournisseur réellement sélectionné.

## Entrée native et qualification opérateur

Depuis la racine de la branche, utiliser Git, tar, Node.js 24.22.3 et le paquet Pyodide 314.0.7 local du Banc.

```powershell
$d = 'experiments/sic-agenda-offres/glob-13-14'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" operateur --moteur gel --fiche "$d/public/image-finale.json" --pyodide $py --recu "$env:TEMP/glob-images.json"
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/glob-qualification.json"
```

Le [corpus public](public) utilise `sic.glob/1`. `gestes` fixe la coupure de lecture. `dy` choisit la translation verticale. `commandes` permute deux noms de commandes sans point ; l'opérateur applique la permutation inverse lors de l'exécution. `intervention` désigne le geste et la preuve retirée, le retour modifié ou l'offre suspendue. `permuterCible` désigne deux nœuds du relevé géométrique et le geste après lequel échanger leur remplissage dans l'image finale. La sonde relève les faits, puis les offres calculées avant la commande. L'opérateur enregistre ensuite le ticket et le retour du jeu. Les verdicts de 13 et 14 ont leurs propres rubriques dans le reçu agrégé. [Opérateur](operateur.mjs) · [Vérificateur](verifier.mjs)
