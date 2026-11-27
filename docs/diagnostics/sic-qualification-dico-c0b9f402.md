# DICO · qualification indépendante de la ligne 87

**Le candidat `c0b9f4027f1df257d7b8c96f5656f9dbb83661f0` conserve le choix historique de DICO N1 au tour 4.** Le banc a également vérifié que remplacer l’offre sélectionnée par l’autre optimum change le ticket réellement délivré et le retour mesuré. Les sources de comparaison sont l’inventaire `8ce7ee3563fa1d5eca1639c6ad03975cfc962460` et le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le préenregistrement est `5446e42e`. Sur branche, `v6-subset-diagnosis.ts` consomme la sélection de `src/sic/subset-query.ts`. Ce raccordement est nouveau. Le comportement nominal remonte au gel. [Harnais et contrat](https://github.com/yannick-fontan-1981/sra-playground/tree/c0b9f4027f1df257d7b8c96f5656f9dbb83661f0/experiments/sic-agenda-offres/dico-87)

### Départ catalogue et mesure du retour

Depuis L1 avec le pack par défaut, le premier geste est (1,3), suivi de deux navigations de portée. Au tour 4, la famille `subset_diagnosis` pose une `subset_scope_query`. Le banc conserve la population {0,1,4,5} et les six offres copiées avant le choix. Le sceau de cet ensemble vaut `c338cb858626bd0c69d0cf33c377ab83eb4023a27a746d3a0fa39b71f0a57d5d`.

| Sous-ensemble testé | Clic | Candidats restants si GLOBAL / LOCAL | Pire cas |
|---|---|---|---:|
| {0,4} | (6,3) | 2 / 2 | 2 |
| {1,5} | (27,3) | 2 / 2 | 2 |
| {0}, {1}, {4}, {5} | (13,26), (25,26), (13,38), (25,38), respectivement | 1 / 3 pour chaque offre | 3 |

- **Choix nominal sur les trois moteurs.** Le garde admet (6,3). Les neuf images du retour du jeu donnent `LOCAL`. Le moteur garde le complément {1,5} et `matched=null`. La question suivante sur la même vue peut départager les deux survivants au pire coût 1.
- **Autre optimum sur le candidat.** Dans un processus distinct, le harnais conserve le même préfixe et le même ensemble scellé, puis substitue l’autre offre de coût 2 au point de sélection. Le service natif construit et autorise le ticket (27,3), qui porte une autre clé de question. Le jeu donne `GLOBAL`. Le moteur garde l’intersection {1,5}. Les deux décisions aboutissent au même domaine par deux retours observés différents.
- **Contrôles du retour.** Avec le ticket nominal, donner seulement la présentation précédente ou le dernier raster réel conserve les quatre candidats. La permutation de l’ordre d’insertion du domaine préserve les offres scellées, la clé et le clic nominal. Les observations de ces variantes sont archivées avec leurs tickets.

Les deux rapports catalogue détaillés, capturés séparément sur le gel et le candidat, sont égaux sur tous les champs. Le vérificateur contrôle aussi sur le moteur historique le même ensemble, la même question et le même retour. Les trois jeux de captures indépendantes de 16 commandes concordent par mode sur tous les champs exposés dans les rapports d’inventaire. En mode catalogue, DICO compte dix commandes de ligne 87, comme le total de l’inventaire historique. Les coordonnées, les clés de question et les bornes observées sont dans les reçus. [Index des offres et des tours](sic-dico-ligne-87/banc.json) · [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md)

### Curiosité d’ouverture active

Avec le même départ et `openingCuriosity: active`, le premier geste (25,36) termine le niveau 1 et relève de la ligne 98. Le quatrième geste (6,3) a lieu au niveau 2. Sa proposition est `subset_scope_navigation`. Parmi les 16 commandes de ce contrôle, sept requêtes de sous-ensemble surviennent plus tard. Ces sept occurrences appartiennent au parcours de curiosité. Le verdict ligne 87 porte sur la démarche de requête et son remplacement natif sur le candidat. L’opérateur indépendant a publié au commit `1bffa4eb` ses témoins de transfert. Le gel et le candidat produisent les deux optima de coût 2 et leurs retours temporels. La substitution au point de sélection en production et la délivrance du véritable ticket alternatif sont attestées sur le candidat. Le classement observé sur le gel établit sa capacité à choisir entre les offres sous les conditions historiques. [Preuve opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/1bffa4eb519de7d5cf0954fd1d18dbc9c81383d3/experiments/symbolic-situations/dico-ligne-87/BILAN.md) Aucun parcours intégral de la campagne des 107 jeux n’a été lancé pour ce contrôle.

### Reproduire

Utiliser Node 24.22.3. Dans un checkout dédié de `c0b9f402` contenant les objets Git du gel et de l’inventaire, préparer Pyodide puis lancer le vérificateur. Il joue les trois sources et le bras de substitution sans intervention sur le choix du jeu.

```powershell
node scripts/prepare-python.mjs
node experiments/sic-agenda-offres/dico-87/verifier.mjs --pyodide ./public/vendor/pyodide --recu ./recu-dico-87.json
```

Depuis le checkout du banc, les commandes suivantes reproduisent en plus la trajectoire de 16 commandes dans chaque mode. Pointer `$moteur` successivement sur chacun des trois SHA avec les jeux préparés et utiliser des noms de rapports neufs.

```powershell
$rev = git -C $moteur rev-parse --short HEAD
node scripts/sic-recapture-strategy-inventory.mjs $moteur "./DICO-standard-$rev.json" --offer '*' '*' '*' DICO
node scripts/sic-recapture-strategy-inventory.mjs $moteur "./DICO-curious-$rev.json" --curious --offer '*' '*' '*' DICO
```

Les six inventaires, les deux rapports détaillés du départ catalogue et le reçu du vérificateur sont archivés. Le SHA-256 de l’archive est `14325225b72345f7f442cab4f203b27c71c74e02e8da6c8b6b90d38088513717`. Les originaux restent sous `artifacts/qualification-dico-87/`. [Reçus](sic-dico-ligne-87/recus.zip)
