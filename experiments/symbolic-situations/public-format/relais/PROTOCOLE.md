# Relais de qualification conjointe

Les quatre gels d'attribution reçoivent le message v1 d'origine. Le lecteur structuré reçoit la même fiche en v1.1, enrichie uniquement par le producteur. La projection en v1 doit restituer l'objet initial entier. Un second passage du lecteur sur le v1 historique mesure séparément la compatibilité. Chaque départ lance le point d'entrée et les blobs Git annoncés dans un processus neuf, sous Node 24, par le transport de l'opérateur qualifié. Sur l'entrée standard passent uniquement `{"fiche":…}`, puis `{"retour":"texte réellement livré"}`. La sortie est une seule action ou un arrêt. La classification du retour, le monde, le corrigé et le résultat attendu restent chez l'opérateur.

Le producteur prend uniquement l'objet public. Sur les formes éditoriales auditées, il rattache un libellé exact aux lignes citées par la commande ou ses règles. Dans les fiches structurelles, « Le retour est toujours … » est lié à l'indexation correcte par les citations des règles. La phrase de chaque ouverture nomme son récepteur et son retour. Les effets d'indexation et d'ouverture y sont **conditionnels**. Le contrat `857e606e` permet de déclarer la confirmation avec `coverage:"unknown"` et conserve les gardes dans les règles de base. Une fiche qui ne donne aucun libellé matériel reste `undeclared` pour cette commande. La lecture rend la valeur brute du capteur, le refus standard et les terminaux gardent leur libellé protocolaire. Aucun reçu d'exécution ne sert à construire la fiche.

Les contrôles portent sur les huit anciens départs structurels, les 18 départs de développement des deux familles, les 18 anciens départs opérateur et les cinq départs A/B/C. X1 et X2 partagent une fiche et une commande en vol. X1 livre la confirmation annoncée de P. X2 substitue le libellé de Q. La conduite attendue est une validation pour X1 et un arrêt pour X2. Le verdict physique fortuit de X2 est distinct de la justification de la décision.

La nouvelle réserve est celle de l'[engagement initial](../reductions/GEL.md). Sa graine, ses fiches v1, l'ordre, la physique et le critère minimax restent figés. Le même traducteur public sera appliqué à chaque fiche après vérification du manifeste et réception du SHA final. La seule modification sur le fil sera le message initial v1.1. Une nouvelle sérialisation du manifeste v1 d'origine doit reproduire son empreinte avant tout lancement. L'opérateur publie les admissions, commandes exécutées ou refusées, lectures, succès, conformité des politiques et premier écart. Une divergence est illustrée par un petit exemple de développement, indépendant des identifiants de réserve.

## Parcours manuel et rejeu public

Depuis `experiments/symbolic-situations/public-format`, générer le premier message et le coller dans une fenêtre ChatGPT ordinaire. L'opérateur conserve le numéro du monde. Il saisit chaque objet `action` dans le terminal et transmet uniquement la ligne `retour` produite.

```powershell
node relais/manuel.mjs --fiche A --message
node relais/manuel.mjs --fiche A --monde 2
```

Pour reprendre, enregistrer les couples publics `action`, `retour` dans un tableau JSON. Ajouter `--prefixe prefixe.json` aux commandes. Le premier message contient alors la même fiche et le préfixe rejoué. Après la lecture, le préfixe distingue déjà les deux mondes. Le test a rejoué les deux parcours complets et leur reprise.

```powershell
node --test relais/test.mjs
node relais/mesurer.mjs --sha <SHA-complet> --depot <checkout> --format v1.1 --entree <chemin-Git> --dep <import-Git>
```

Répéter `--dep` pour chaque fichier du montage. Pour un contrôle de compatibilité du même exécutable, remplacer le format par `v1`. L'option opérateur `--historiques` inclut les anciennes partitions locales et `--rapport` exige un fichier de sortie neuf.

Montage effectivement qualifié, depuis `public-format`, avec Node 24 dans le PATH :

```powershell
$repo = 'D:/dev/ARC-AGI/SRA-Playground/sic-agenda-accuses-structures'
$base = 'experiments/sic-agenda-offres'
$v = "$base/public-v1"
$montage = @('--sha','2c8168f2e1df1eaa6961c0f39a473ffdf0cde147','--depot',$repo,'--entree',"$v/solveur.mjs",
  '--dep',"$v/admission.mjs",'--dep',"$v/planifier.mjs",'--dep',"$v/schema.json",
  '--dep',"$v/protocole-1.1/contrat.mjs",'--dep',"$v/protocole-1.1/schema.json",
  '--dep',"$base/agenda.mjs",'--dep','src/sic/reasoning-mode.ts')
node relais/mesurer.mjs @montage --format v1.1
node relais/ecarts.mjs @montage
```
