# Qualification indépendante de la ligne 98

Depuis la racine du checkout candidat, l'opérateur peut employer son propre fichier sur les deux moteurs. Le programme lit la fiche fournie, le mode demandé et le code de la révision choisie. Les assertions et les réponses de développement sont dans un autre exécutable.

```powershell
$d = 'experiments/sic-agenda-offres/ouverture-98'
& "$d/lancer.ps1" operateur --moteur gel --mode active --fiche "$d/public/egalite.json"
& "$d/lancer.ps1" operateur --moteur candidat --mode active --fiche "$d/public/egalite.json"
```

Le contrat `sic.ouverture/1` prend exactement trois champs. `points` contient les pixels colorés `[x,y,couleur]` sur fond noir 64 × 64. Les coordonnées vont de 0 à 63 et les couleurs de 1 à 15. `clics` donne les commandes `ACTION6` admises sous forme de couples `[x,y]`. Chaque liste contient entre 1 et 256 positions distinctes. La liste de commandes peut viser le fond. La fixture construit une observation publique au niveau 1 et laisse le fournisseur natif construire et ordonner ses questions. Les modes d'ouverture acceptés sont `active`, `shadow` et `absent`.

```json
{"version":"sic.ouverture/1","points":[[10,10,3],[40,40,3],[10,7,4],[40,37,4]],"clics":[[10,10],[40,40]]}
```

La sortie JSON a deux moments de lecture. `slate.pre` contient l'observation, le rang, la question ordinaire, l'ordre des questions admissibles, leurs commandes et les preuves de voisinage mesurées, puis les références offertes. `slate.sha256` scelle cet ensemble avant le classement. Une entrée `target:null` indique une cible sans qualification positive. Un `slate:null` indique que ce point de mesure n'a pas été atteint. Ensuite `command`, `question`, `opening`, `need` et `guard` décrivent la proposition effectivement produite par `ObservedFrontier` et sa garde. Le ticket d'exécution et le retour réel s'obtiennent dans l'épreuve de service DICO du [rejeu principal](../README.md).

L'opérateur peut ajouter un voisin, déplacer sa couleur ou son côté, répéter une relation ou changer les clics autorisés. Le corpus de développement est dans [public](../public). Les fiches et verdicts indépendants restent sous la maîtrise de l'opérateur. Les deux commandes ci-dessus utilisent le même lecteur, la même sonde et la même garde. Le moteur `gel` est extrait de Git à `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, le moteur `candidat` est celui du checkout.
