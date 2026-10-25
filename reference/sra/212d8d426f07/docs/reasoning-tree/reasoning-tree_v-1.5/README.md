# Arbre V1.5 — clés définitives et TODO SRC vides

La demande du 12 octobre 2026 promeut les 114 nouvelles clés de V1.4.1 :
57 opérations et 57 calculs. Les 5 081 adresses et l'ordre sont conservés,
ainsi que les déclarations revues, à la substitution exacte des références près.
V1.4.1 et les versions antérieures restent intactes.

Chaque clé possède un workflow et une étape `pending_implementation` dans
`agents/yf_arc3_v5/src/arc3/reasoning_tree_v15_todos.src`. Ce fichier est inclus
dans `production_src_paths()` et chaque workflow possède son contrat de
compilation de production. Il s'agit donc de liens SRC vérifiables, et non de
commentaires documentaires seuls. Le corps vide contient uniquement le TODO et
`STOP null` : aucun appel, calcul, effet, sélection ou commande de jeu.

Ces liens restent TODO, jamais CODED/UNIT_TESTED/USED_BY. Ils ne publient aucune
signature mécanique disponible et ne sont pas ajoutés au chemin d'exécution
des jeux. Les statuts de suivi V1.3 restent sous leur autorité existante,
sans recopie ni rétrogradation. Par décision explicite de Yannick du 12 octobre
2026, V1.5 est l'arbre normatif officiel actif, remplaçant V1.3. Cette activation
documentaire ne rend pas les TODO exécutables comme mécanismes de jeu.

Les trois fichiers de registre/couverture cités par V1.4.1 ne sont pas fournis
dans ce checkout. Aucun contenu ni certification de ces fichiers n'est inventé.
Le registre V1.5 certifie uniquement la promotion et les liens SRC effectifs.

Reproduction : `api/.venv/Scripts/python.exe docs/reasoning-tree/reasoning-tree_v-1.5/generate_v15.py`.
Vérification sans écriture : ajouter `--check`. Le source V1.4.1 est qualifié par
son empreinte LF. La validation source dédiée, la compilation de production,
le chargement DRM et le garde-fou d'autorité sont consignés séparément.
Aucun test unitaire ou résultat de jeu n'est revendiqué.

## Implémentations raccordées après création

114 entrées ont maintenant un contrat typé et un appel SRC concret. 0 restent vides. Le texte normatif et ses identités restent inchangés. La présence d'un raccord ne certifie ni comportement, ni usage, ni transfert ; les promotions de cycle de vie exigent leurs preuves séparées.

## Extensions exécutables du 17 octobre 2026

La demande utilisateur de corrections conditionnées autorise des clés supplémentaires : `runtime_extensions.json` relie chacune à une projection DRM exécutée et à son consommateur SRC existant. Le générateur vérifie ces raccords, sans créer de TODO vide ni modifier la promotion historique. CODED décrit le raccord source ; les preuves comportementales et de transfert restent séparées.
