# Contrôle synthétique du collecteur Window

Ces fichiers proviennent de la reconstruction fraîche du lot10B. Ils ne restaurent aucune preuve de l’environnement perdu et ne constituent pas une campagne de jeu. Le pilote démarre le vrai runtime commun à froid, sans mémoire apprise injectée, puis lui fournit les retours publics contrôlés de la fixture indépendante. Les commandes attendues sont vérifiées après leur sélection ; elles ne sont jamais fournies à l’agent comme décisions.

## Tentatives conservées

| Tentative | Résultat observé | Portée |
| --- | --- | --- |
| `synthetic-common-runtime-01.json.gz` et `synthetic-source-parity-01.json.gz` | Capture puis comparaison passées : 10 appels, 7 restaurations, 3 acquisitions et 3 préfixes ; aucune différence | Première version du contrôle. Elle ne liait pas encore les animations à une trace publique indépendante et sa projection des faits événement ne conservait pas `episode`. Les preuves restent conservées avec cette limite. |
| `synthetic-common-runtime-02.json.gz` et sa trace publique | Capture passée : 10 appels, 7 restaurations, 3 acquisitions et 3 préfixes | Paquets complets capturés, avant l’ajout autorisé de `episode` au collecteur. Aucun nouveau verdict de comparaison n’a été produit pour cette tentative. |
| `synthetic-common-runtime-03.json.gz`, sa trace publique et `synthetic-source-parity-03.json.gz` | Capture puis comparaison passées : 10 appels, 7 restaurations, 3 acquisitions, 3 préfixes, 4 paquets publics complets ; aucune différence | Vérification du paquet initial, des rasters et métadonnées de chaque observation, du paquet complet de garde, des animations acquises et de leurs empreintes physiques. Les faits événement et le fait d’état retiennent et comparent `episode`, `key`, `value`, `evidence`, `revision`. |

La tentative03 inclut deux acquisitions actives Window et une acquisition passive étrangère. Le Python original a été créé à froid ; ses propositions propres alimentent ses gardes et ses acquisitions. Les états natifs sont des comparandes, jamais des états initiaux du Python. Les sept restaurations natives observées sont rapprochées de l’état atteint indépendamment et de leurs curseurs réels. Chacune des trois transitions scellées couvre exactement un appel `recordSource`.

Les seize interventions de mémoire de la tentative03 ont été exécutées sans erreur. Sept retirent une mémoire non vide ; six changent l’action ou l’abstention. Elles retirent les éditions, les méthodes transportées, les tentatives ou les deux sources de méthodes, aux mêmes entrées publiques. Ce résultat porte sur les choix du composant dans ce parcours contrôlé ; il ne mesure ni une amélioration d’une partie entière ni la parité du caller Python complet.

Les 1786 fichiers originaux épinglés ont été vérifiés avant et après chaque comparaison. La tentative03 n’a rencontré aucune adaptation de refus natif : les retours complets des fonctions originales ont donc correspondu. Les compteurs et les qualifications détaillés figurent dans `parity-03.log` et dans le reçu compressé.

## Outil exécutable et copies historiques

L’outil exécutable est `scripts/compare-window-question-public-parity.py`, depuis la racine du dépôt :

```sh
flock -s /workspace/shared/sra-coordination/performance.lock \
  python3 -B scripts/compare-window-question-public-parity.py \
  CHEMIN/hpdl-campaign.json.gz \
  --trace CHEMIN/hpdl-public-trace.json.gz \
  --output CHEMIN/NOUVEAU-window-source-parity.json.gz
```

La sortie doit être nouvelle. Le comparateur refuse un journal en cours ou l’absence de rapport/trace complet. Il ne lance aucun jeu et ne reconstitue aucun résultat manquant. Les copies `comparator-01.py` et `comparator-02.py` sont des instantanés des octets antérieurs : leur calcul de racine correspond à leur ancien emplacement `scripts/`, pas à cet emplacement d’archive. Elles ne doivent pas être lancées directement ici.

`capture-synthetic-common-runtime.mjs` reste un pilote diagnostique distinct des sources de production. Il doit être invoqué depuis la racine du dépôt avec un nouveau chemin de sortie explicite. `capture-synthetic-common-runtime-01.mjs` et `capture-helper-before-episode.ts` conservent les versions précédentes. Le pilote et les reçus ne revendiquent aucun niveau officiellement réussi, aucune action de jeu réelle ni aucun temps de jeu consommé.

## Tests ciblés et validation finale

La suite de référence fraîche avait passé173 tests avant l’extension des métadonnées événement. Après cette extension, seuls les trois contrats du collecteur ont été relancés, tous passés ; leur sortie est conservée dans `../window-oracle/capture-contracts-03.tap`. La validation intégrée finale doit lier les octets définitifs du collecteur, des tests et des sources communes. Les résultats historiques ne remplacent pas cette liaison finale.
