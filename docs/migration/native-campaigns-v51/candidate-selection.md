# Prochaine étape après v51 : transfert des relations encadrées

**Priorité d’évaluation déclarée : GARE, après transfert générique de `observed_framed_transfer`.** LKEY reste un second candidat nouveau. Cette priorité organise la prochaine évaluation ; elle ne désigne pas un candidat unique calculé par la source et n’ajoute aucune règle fondée sur le nom du jeu.

## Résultats conservés

Les deux analyses lisent les mêmes 100 vues publiques initiales conservées. Elles vérifient les 1 786 fichiers de la source épinglée `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` avant et après. Leurs compteurs indiquent zéro hôte de jeu chargé, exécution de jeu, proposition d’agent, acquisition, action envoyée et état privé consulté.

La première analyse, [`candidate-selection.json`](candidate-selection.json), appelle `framed_window_access.measure` pour `framed_window_composition` : **0 candidat sur 100 vues**. Ce résultat négatif demeure conservé. Il concerne l’applicabilité de cette mesure sur les scènes initiales ; il ne démontre pas une impossibilité après acquisition de nouvelles observations.

La seconde analyse, [`framed-transfer-candidate-selection.json`](framed-transfer-candidate-selection.json), mesure les candidats géométriques de `framed_transfer.geometry.candidates` avec mémoires de déplacements, reçus et tentatives vides. Elle vérifie ensuite les conditions déclaratives avec `FramedPolicy.holds`, sans appeler `FramedPolicy.choose` ni `FramedTransfer.propose`.

| Jeu | Offres géométriques | Offres éligibles | Statut pour la suite |
|---|---:|---:|---|
| HANO | 2 | 2 | Jeu déjà validé dans une campagne antérieure ; témoin disponible |
| GARE | 3 | 3 | Premier nouveau candidat à évaluer, priorité déclarée |
| LKEY | 2 | 2 | Second nouveau candidat à conserver |

Les sept offres satisfont uniquement `projection.exploration.parallel_solid_band_interface_question`. Leurs faits conservent `framed_reception_analogy=false`, `point_span_locus_binding_count=0` et `candidate_execution_count=0`. Le JSON garde donc `evaluationGame=null` et la liste complète `HANO, GARE, LKEY`. HANO possède déjà une [preuve antérieure sur quatre niveaux](../native-campaigns-v45/hano-four-levels.json) ; cette analyse n’en exécute aucun de nouveau.

**Statut actuel : candidats seulement, aucune action exécutée et aucun niveau supplémentaire validé par cette sélection.** Les trois offres de GARE motivent un premier cas d’évaluation disposant de plusieurs interfaces mesurées ; leur nombre ne prédit ni réussite ni meilleure probabilité de résolution.

## Travail générique proposé

Transférer les mesures de supports encadrés, l’acquisition des `point_motion_spans` et des remplacements encadrés, puis la conservation des reçus avec leurs preuves dans le graphe commun. Relier chaque rappel à la géométrie, au point, à l’observation et à l’époque courants. Le module source [`framed_transfer/family.py`](../../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/framed_transfer/family.py) distingue déjà les archives `historical_not_current_permit` des autorisations présentes et remesure les candidats avant admission.

Introduire ensuite `observed_framed_analogy` seulement lorsque les acquisitions et les conditions source justifient cette continuation. Une similitude hypothétique demeure distincte d’un reçu observé. La prochaine validation visée sera une campagne GARE à froid et continue, avec objectif d’au moins trois niveaux, comparée au composant source inchangé et conservant tout refus ou échec réel.

## Références et empreintes SHA-256

| Élément | SHA-256 |
|---|---|
| [`candidate-selection.json`](candidate-selection.json) | `f437a571c635f969e167936fcfb4a9c6c803b93e9a6cec45ecbe4b03f31cb526` |
| [`framed-transfer-candidate-selection.json`](framed-transfer-candidate-selection.json) | `1d42b7c228b12d0f4ec0d9b7298e8441531dcc9380f41f2d1e82a4813d79b174` |
| [`select-v51-next-candidate.py`](../../../scripts/select-v51-next-candidate.py) | `ae05f80103f874aba6375d9238cd34c4a7ce0c2e6fc372501cede0f605cf9840` |
| [`select-v51-framed-transfer-candidate.py`](../../../scripts/select-v51-framed-transfer-candidate.py) | `de7943fdaec1a4c3ceaff86fb18a239d55b6f65d42727095e718ea9ebf9d3973` |
| [Corpus des 100 vues initiales](../../../tests/fixtures/v6-linked-packet-initial-public.json.gz) | `3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2` |
| Source `laya_proto/framed_window_access.py` | `0f9cd56a77b669eab0a73b34197b590443b069f9a070125ff4bf74fb986d4a49` |
| Source `framed_transfer/geometry.py` | `0254af065eb007e0ce75cfee98e04a82d61b8c705f7ae439f5411a9b15cbace3` |
| Source `framed_transfer/policy.py` | `e36956396070c612e98713b66a554a1699223f9ed89f9b37df7549dc4a2ec09d` |
| Source `framed_transfer/family.py` | `1d0c28e7db7811dbe9308144e4634465bf28a5f1c3e82aa5b6b1a314c4f51eca` |

Les listes d’imports effectivement utilisés et leurs chemins complets figurent dans les deux JSON. Les scripts et JSON de sélection restent inchangés ; cette note ajoute uniquement la priorité d’évaluation GARE.
