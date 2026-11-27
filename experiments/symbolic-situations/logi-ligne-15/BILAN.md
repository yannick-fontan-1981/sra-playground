# LOGI · ligne 15 · qualification opérateur

**Le crédit fonctionnel remonte au gel des 107 jeux, `d0e7527c`.** La révision de preuve `7bf3c85a` et le candidat TypeScript `48472784` reproduisent les mêmes commandes, les mêmes mesures et les mêmes décisions suivantes sur les neuf départs. Le premier écart entre les trois révisions est absent des préfixes éprouvés.

| Périmètre par révision | Départs admis par l’évaluateur | Contrôles de l’évaluateur |
| --- | ---: | ---: |
| LOGI historique, deux clics libérés et deux retours | 1/1 | 15/15 |
| REWI historique, un clic exécuté, son retour et le choix suivant | 1/1 | 8/8 |
| Développement construit, égalité, rareté et localisation du retour | 4/4 | 42/42 |
| Réserve construite et scellée, même départ observable | 3/3 | 33/33 |

Les neuf départs sont identiques d'une révision à l'autre, soit 27 passages natifs en session neuve. Le montage a chargé le service du SHA demandé et lui a présenté successivement les observations publiques. Les deux parcours historiques utilisent des captures d'exécutions des jeux. Les sept interventions construites testent les relations observables sur l'horizon de leurs fiches. [Contrat de l’évaluateur](CONTRAT.md) · [Sélection scellée avant lecture et exécution des révisions](GEL.md)

**LOGI.** Au tour 1, trois contrôles sont comparables au sein du producteur et une offre arrive à l'élection, `coupled_displays`. Le clic (49,50) change le contrôle de droite. Les valeurs des récepteurs passent de [11,11,3] à [3,11,11]. Seule la prédiction `coupled_switch` correspond. Au tour 2, deux offres sont admissibles, `coupled_displays` et `point_contrast`. Le planificateur essaie uniquement la première et libère (5,50) pour le parent déjà engagé. La frontière de niveau laisse les trois prédictions du deuxième essai inconnues. Sur les trois SHA, le diagnostic séparé de l'élection conserve à l'identique les tickets et les mesures du parcours ordinaire.

**REWI.** Six contrôles et cinq récepteurs donnent une autre géométrie. Après (34,61), les six contrôles gardent la valeur 3 et les récepteurs gardent [13,13,13,13,9]. Le résultat `unchanged` valide la prédiction inerte pour cet essai. Le service écarte ce contrôle et libère (28,61). La qualification s'arrête à ce choix.

**Interventions construites.** Les quatre exemples publics vérifient un choix parmi trois ex æquo, une question centrale imposée par la rareté, puis deux retours couplés de même histogramme. Dans ces deux derniers cas, le même premier clic (49,50) produit la même modification locale. Une réponse distante à gauche conduit à (27,50), une réponse au centre à (5,50). Le second retour contredit les trois hypothèses dans les deux cas. Sur la réserve, deux réponses globalement couplées produisent aussi deux questions différentes, puis une confirmation locale. Le troisième retour contredit les trois prédictions. Le reçu natif donne une classe globale. L’attribution spatiale a été vérifiée dans les valeurs et les positions reprises par la question suivante.

**Témoins altérés.** Sur chacune des trois révisions, l'évaluateur rejette 4/4 altérations des reçus de développement : le changement du récepteur attribué, le réemploi de la révision précédente, une hypothèse couplée validée à tort et le deuxième clic emprunté à l'autre départ. Ces contrôles s'ajoutent aux neuf départs. [Vérification des paires et des refus](auditer.mjs)

**Antériorité.** `d0e7527c` et `7bf3c85a` ont le même arbre `src`, `a1cbde2afc41532c7c047eb05c8637ef02b584d0`. Sur `48472784`, seul `src/logos-engine/v6-coupled-displays.ts` diffère dans cet arbre. TypeScript 5.9.3 émet des octets JavaScript identiques pour le module, avec une cible ES2022 et des modules ESNext. L'empreinte des résultats natifs est identique pour chacune des trois partitions comparées. Le verdict porte uniquement sur la ligne 15. [Reçu des trois révisions](recu.json) · [Comparateur](comparer.mjs)

## Rejeu public

Depuis ce répertoire, avec Node 24.22.3 et les objets Git des deux branches disponibles, utiliser des noms de reçus neufs. Le script `offres.mjs` vérifie en plus que son observation de l'élection conserve les mêmes sorties que le reçu ordinaire.

```powershell
$sha = '48472784f1ee59b1117dddb53ef5c9fced929ec8'
$dossier = New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString()))
$public = Join-Path $dossier.FullName 'logi.json'
node qualifier.mjs --sha $sha --rapport $public
node auditer.mjs $public
node offres.mjs $sha $public
node rewi.mjs $sha (Join-Path $dossier.FullName 'rewi.json')
```

Le choix des départs réservés et leurs traces de session sont conservés chez l'opérateur. Les empreintes publiées permettent de vérifier les reçus lors d'un rejeu autorisé.
