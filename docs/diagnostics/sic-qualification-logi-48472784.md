# Ligne 15 · qualification indépendante sur LOGI et REWI

**La démarche `information_goal / coupled_displays / experiment` est qualifiée sur le gel `d0e7527c`.** Le banc a reproduit le choix, son retour et le ticket suivant sur deux jeux source. Le candidat `48472784` ajoute un contrat de types. La preuve s’applique rétroactivement au comportement du gel. [Contrat et caractérisation](https://github.com/yannick-fontan-1981/sra-playground/blob/48472784f1ee59b1117dddb53ef5c9fced929ec8/docs/architecture/sic-logi-ligne-15.md)

### Identité du moteur

Git relie le gel au préenregistrement `e03b78df`, puis à la preuve `7bf3c85a4183baf0dd535ca7c97d055bb6a0b958` et à son enfant `48472784f1ee59b1117dddb53ef5c9fced929ec8`. L’arbre `src` de la preuve est identique à celui du gel. Entre la preuve et l’enfant, le seul fichier d’exécution modifié est `src/logos-engine/v6-coupled-displays.ts`. Pour les trois SHA, TypeScript 5.9.3 (cible et module ESNext, commentaires retirés) émet les mêmes **9 977 octets**, SHA-256 `8178d156fa9d96a27f2d03384ad8585cb0cc01fef3758a69778d5200d445be48`. Les jeux, le lanceur, les dépendances et les paramètres du gel concordent. L’index publie les identifiants des arbres et des blobs. [Index du banc](sic-logi-ligne-15/banc.json)

### Décisions et reprise du besoin

Le banc a exécuté la suite sur le commit de preuve, puis sur l’enfant, avec Node 24.22.3 et le backend des jeux source activé. **118/118 tests sur chaque SHA.** Le service émet lui-même les tickets et reçoit les observations du jeu après les clics. La fixture de l’inventaire vérifie les observations publiques initiales et les deux premiers retours de chaque jeu. [Tests du service](https://github.com/yannick-fontan-1981/sra-playground/blob/48472784f1ee59b1117dddb53ef5c9fced929ec8/tests/sic-information-displays.test.ts)

| Jeu | Premier choix du vrai moteur depuis L1 | Retour adressé et ticket suivant |
|---|---|---|
| LOGI | Tour 1, `ACTION6(49,50)`, contrôle 2. Une seule offre d’information admissible. | Le contrôle et les lampes changent. Le service valide `coupled_switch`, contredit les deux autres hypothèses et mémorise l’essai avec sa preuve. Le tour 2 conserve le besoin et choisit le contrôle 0, `ACTION6(5,50)`, en présence d’une offre de point concurrente. |
| REWI | Une session neuve ouvre son propre besoin. Tour 1, `ACTION6(34,61)`, contrôle 5 parmi six. | Le retour inchangé valide `inert_decoration`. Le ticket suivant conserve le besoin de cette session et essaie le contrôle 4, `ACTION6(28,61)`. Le second retour reste inchangé. |

Les interventions de caractérisation distinguent le rôle des preuves. Déplacer la lampe minoritaire change le clic initial de LOGI. Une réponse limitée au contrôle valide l’hypothèse locale. Un récepteur illisible laisse les trois hypothèses inconnues et la mémoire de mesure vide. L’arbitrage entre deux offres varie lorsque seule la preuve d’engagement du parent change.

### Portée de l’inventaire et des victoires

Le lanceur historique de `8ce7ee35` a été rejoué depuis L1 sur quatre moteurs (source d’inventaire, gel, preuve, enfant), avec pack par défaut, graine 0, plafond de 16 commandes par session et 600 par niveau. Pour chacun des deux jeux, les captures concordent sur les commandes ordonnées, coordonnées, empreintes d’observation, lignes d’inventaire sélectionnées et motif d’arrêt.

| Jeu | Parcours d’inventaire observé | Reçu historique complet en mode SIC |
|---|---|---|
| LOGI | 16 commandes, toutes de ligne 15. La session atteint son budget. | 6/6 niveaux, 30 commandes autorisées, famille `sic_display_coupling`. |
| REWI | 11 commandes avant `frontier_unknown`. Les six premières relèvent de la ligne 15. | 6/6 niveaux, 31 commandes autorisées, famille `sic_follow_stable_reference`. |

Les recaptures documentent **22 occurrences** dans ces deux jeux. L’inventaire publié en compte **24** sur ses 100 jeux. Les deux autres occurrences restent couvertes par ce total historique. L’explication détaillée des hypothèses et de la reprise repose sur les deux premiers tickets de chaque jeu. [Inventaire de référence](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md)

Le banc a revalidé l’archive du gel (107 jeux uniques, 692 niveaux) et les SHA-256 des deux lignes de reçu. Leurs six niveaux partent de L1, en mode `sic`, un worker, budgets de 80 actions et 90 s par niveau. Leurs victoires sont réutilisées par identité du moteur, à la granularité du reçu historique. Les nouvelles sessions de ce lot portent sur les deux parcours d’inventaire et les tests du service. Le seul compteur fonctionnel crédité est la ligne 15. [Campagne d’origine](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46051058377) · [Reçus et références par jeu](sic-logi-ligne-15/banc.json)

### Reproduire

Depuis le checkout du banc, préparer un checkout moteur dédié et propre dans `$moteur` avec les quatre commits accessibles. Utiliser Node 24.22.3. Choisir un répertoire de sortie neuf.

```powershell
$banc = (Get-Location).Path
$moteur = (Resolve-Path ../sic-banc-ls19).Path
$sortie = (New-Item -ItemType Directory ./rejeu-ligne-15).FullName
foreach ($rev in '8ce7ee35','d0e7527c','7bf3c85a','48472784') {
  git -C $moteur switch --detach $rev
  if ($LASTEXITCODE) { throw $rev }
  Push-Location $moteur
  node scripts/prepare-python.mjs
  if ($LASTEXITCODE) { throw 'Préparation des jeux' }
  Pop-Location
  node scripts/sic-recapture-strategy-inventory.mjs $moteur "$sortie/inventaire-$rev.json" LOGI REWI
  if ($LASTEXITCODE) { throw 'Inventaire' }
  if ($rev -in '7bf3c85a','48472784') {
    Push-Location $moteur
    $env:SIC_INFORMATION_GAME_ROOT = $moteur
    node --test tests/sic-information-displays.test.ts tests/v6-point-display.test.ts tests/v6-goal-attention.test.ts tests/v6-control-attention-reference.test.ts
    if ($LASTEXITCODE) { throw 'Tests natifs' }
    Remove-Item Env:SIC_INFORMATION_GAME_ROOT
    Pop-Location
  }
}
Push-Location $moteur
npm ci
npm run typecheck
Pop-Location
node scripts/verify-sic-logi-line15.mjs $sortie "$moteur/node_modules/typescript"
```

Pour vérifier l’émission et la comparaison sans rejouer les jeux, extraire l’archive fournie et passer son répertoire à la dernière commande. Le SHA-256 de l’archive est `8472f92a192ac77b700a85c20f2a6d37a5b801c79adb1938d8c3adad385c81a8`. Le dossier local `artifacts/qualification-logi-48472784/` conserve les sorties originales. [Captures et deux rapports de tests](sic-logi-ligne-15/captures.zip)
