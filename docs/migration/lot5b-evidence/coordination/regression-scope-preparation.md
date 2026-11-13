# Lot 5B — préparation du périmètre de régression

Statut : **préparation, pas validation**. Le relevé détaillé, les empreintes des reçus, les chemins des rapports et journaux, les manifestes de fragments et les commandes prévues figurent dans `regression-scope-preparation.json`. Aucun test, rejeu, jeu, profil, coût ou reconstruction n'a été exécuté pour cette préparation. Les autres checkouts ont uniquement été lus.

## Ascendance et union des tests

| Origine | Preuve disponible | Apport à l'union |
| --- | --- | ---: |
| 7B, Site 89, native 0.55 | Reçu publié : 4 327 tests, 112 fichiers | 112 fichiers |
| 10A, Site 91, native 0.56 | Reçu publié : 1 538 tests, 45 fichiers de contrats affectés | 6 fichiers absents des 112 |
| 4C, native 0.57 prévue | Plan de 121 fichiers ; publication finale attendue | 3 fichiers Facet prévus |
| 5B, native 0.58 prévue | Référence originale, extensions Addressed, FieldStock, boucle commune | 4 fichiers |

L'union ordonnée provisoire contient **125 fichiers**. Les cinq métadonnées 7B/10A relues correspondent exactement aux octets de leurs commits publiés `4cea66731c0809f08288ea6f7287ef3dd7a392bd` et `5659ddc9420c7624df4865f0afc628782296a186`. Les nombres historiques de tests ne s'additionnent pas : les périmètres se recouvrent.

Le plan final devra déclarer `inherited` à partir des reçus réels de 7B, 10A et 4C, `addedTestFiles`, l'union ordonnée `testFiles` et `declaredAt` **avant** les tests formels. Aucun reçu, identifiant de publication ou digest final 4C n'est anticipé ici.

## Trajectoires retenues et portée

Le plan observé comprend **CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV, TRIA, CRAF et ISOS**, soit **170 contrôles prévus**, à raison de 17 par cas. Pour la comparaison prévue 0.57 → 0.58, les rapports finaux réellement publiés par 4C devront être épinglés lorsqu'ils existent. Les rapports historiques conservent leur identité d'origine.

Les 17 comparaisons gardent leurs règles : commandes, paquets publics complets, animations, frontières primitives et de niveaux, choix de famille, préfixes, coordination, compteurs et résultat public. Aucune normalisation des actions ou des paquets ; seule la partie propre à une session neuve des champs de coordination désignés est normalisée. Les temps, les charges complètes des fournisseurs, l'égalité intégrale du moteur original et les états des nouvelles familles ne sont pas couverts. `passiveOwnerRequirements: []` n'ajoute aucun contrôle d'état propriétaire.

7B conserve sa contribution CRAF : 3 niveaux, 36 actions, 144 appels originaux et 432 vérifications exactes, puis 36 préfixes restaurés et 252 contrôles de restauration. 10A n'établit pas de contribution Axial propre en jeu. LKEY reste une qualification partielle distincte : 25 actions, 2 niveaux, arrêt `frontier_unknown`, statut brut `failed`. Aucun budget WEAV n'est réinitialisé.

## Reconstruction et lancement ultérieurs

Les commandes ci-dessous sont documentées, **non exécutées**. La liste exacte des répertoires et chaque `argv` sont dans le JSON.

```sh
flock -s /workspace/shared/sra-coordination/performance.lock python3 -B scripts/evidence-byte-parts.py restore DIRECTORY
flock -s /workspace/shared/sra-coordination/performance.lock python3 -B scripts/freeze-v53-native-source.py restore DIRECTORY
```

Le premier outil restaure les originaux manquants depuis leurs fragments ordonnés ; il refuse les octets existants incohérents. Le second reconstruit seulement l'archive gelée. Les fragments ISOS et les archives finales 4C restent à relever après publication.

Le précontrôle ultérieur utilise `run-recorded-public-regressions.py MANIFEST --preflight`. Le lancement séquentiel durable utilise `run-released-public-regressions-streamlog.py MANIFEST DIRECTORY --source-manifest SOURCE --node-old-space-mib 1536 --timeout-seconds 2400`, sous le même verrou partagé. Le manifeste exige des pins exactement `{path, sha256}` ; les tailles restent dans les métadonnées. Le manifeste 4C relu respecte désormais cette contrainte. Le délai du rejeu ne renouvelle aucun budget de campagne.
