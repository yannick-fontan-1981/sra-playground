# Rattachement de l’observation courante — revue indépendante

## Conclusion

La proposition construite depuis le paquet terminal réel de la campagne 0.43 devient admissible sans modifier son plan, son identité, ses commandes ou la mémoire acquise. La différence complète entre la proposition 0.43 et celle corrigée se limite à trois champs : `bundle_template.evidence`, `question.hypothesis_refs` et `route_refs`. Chaque champ reçoit la référence de l’observation courante, effectivement remesurée et admise par le projecteur.

Il s’agit d’une **extension native explicite**. La source Python conservée présente le même défaut que 0.43 sur ce contexte réel ; cette correction ne doit donc pas être décrite comme une parité complète supplémentaire avec cette source. Aucun fichier source original ni résultat de campagne antérieur n’est modifié.

## Preuve sur les observations conservées

Le script `scripts/prove-exposed-current-evidence.mjs` restaure deux mémoires à partir des mêmes **19 événements propres effectivement acquis**, puis utilise le dernier raster public et les commandes disponibles du journal 0.43. L’une charge directement les composants du worktree publié 0.43 ; l’autre charge les composants corrigés. Il ne charge aucun état issu d’une proposition future pour initialiser ces mémoires.

| Élément | 0.43 publiée | Correction |
| --- | --- | --- |
| Scène après l’action 19 | Admise | Identique |
| Scène après l’action 20 | Absente | Identique |
| Acquisition propre du retour 19→20 | Aucun événement | Identique |
| Scène après l’action étrangère 21 | Admise | Identique |
| Proposition terminale | Une `ACTION1` | Identique |
| Plan complet et identité | Référence publiée | Identiques |
| Historique propre | 19 événements ; 15 références dans l’état courant | Identique |
| Référence courante dans l’enveloppe | Absente | Présente, 16 références au total |
| TargetTree | Refus `unbound_action_set` | Admission `independent_current_contribution` |
| Garde Exposed avant exécution | Blocage préalable de TargetTree | Plan courant lié |

Le script vérifie que la proposition produite par le worktree 0.43 est exactement celle du diagnostic Python déjà conservé. Il vérifie les SHA-256 des deux entrées réelles de campagne avant de les utiliser et compare les empreintes du projecteur et de TargetTree : ces deux autorités sont inchangées.

Les différences complètes, les références et les empreintes sont dans `current-evidence-result.json`. La proposition corrigée complète est conservée dans `candidate-terminal-proposal.json`. Ce diagnostic n’exécute aucune action ; une admission de composant ne démontre ni l’effet futur de cette action ni la réussite du troisième niveau.

## Revue des frontières

La correction intervient après la mesure de scène, la sélection des commandes et la construction du plan. Les retours `null` ou `unknown` et les conditions existantes d’un préfixe borné restent inchangés ; un résultat incomplet ne devient pas une preuve de résolution. L’évidence ajoutée justifie la proposition à partir de l’observation courante ; elle n’affirme aucun effet encore non observé.

La mémoire acquise est copiée dans l’état du plan avant cette correction. Les événements, l’historique d’évidence, les commandes apprises, les modèles et la révision ne sont donc pas actualisés par `propose`. Le plan conserve sa même identité. Lorsque l’époque ou la disposition de l’ancienne mémoire ne correspond pas, la règle existante de création d’un état de proposition neuf reste applicable.

TargetTree continue à vérifier le rattachement de l’objectif, l’époque et la référence courantes, la relation entre enfant et parent, l’égalité des commandes et la présence de l’observation courante dans l’évidence. La garde `exposedReceptionBefore` reste responsable de l’identité du plan, des commandes, du raster initial, de la référence, de l’époque, du score, de la disponibilité de l’action et de la disposition mesurée. Une enveloppe d’évidence valide ne dispense d’aucun de ces contrôles.

La borne reste **16 références**. Si la référence courante est absente de la fenêtre retenue, seule la plus ancienne référence de cette fenêtre est retirée lorsqu’elle est déjà pleine, puis la référence courante est ajoutée. Si elle est déjà présente, l’ordre et les doublons historiques sont conservés.

## Contrôles opposés

Quatorze contrôles passent dans le script. Les modifications de référence, d’époque, de disposition mémorisée, de commandes, de point, de disponibilité et de raster sont explicitement des **sondes de contrat synthétiques**. Elles ne sont pas présentées comme des résultats supplémentaires du jeu.

Ils vérifient l’abstention sur le paquet réellement non mesurable ; les refus des références et époques périmées ; le refus d’une action modifiée, y compris lorsque les commandes du bundle sont modifiées avec elle ; le refus d’un point ajouté et d’un raster modifié ; la disponibilité de l’action ; la création d’un état local neuf pour une époque ou une disposition différente ; la borne 16 ; la préservation de l’ordre lorsque la référence est déjà présente ; son rétablissement lorsqu’elle se trouvait hors de la fenêtre ; l’absence d’alias avec les snapshots ou propositions rendus au caller ; et la reproduction exacte après restauration des seuls événements propres acquis.

La nouvelle suite de tests lit la campagne par `readEvidenceSync` pour vérifier directement les partitions suivies dans Git. Ce lecteur évite de dépendre d’un gros fichier `.gz` seulement restauré dans l’espace de travail. Le script de preuve utilise lui aussi ce lecteur vérifié.

La revue du test oracle `propose:after_observed_control` confirme une seule divergence intentionnelle nommée. Le test vérifie exactement les trois enveloppes corrigées, puis compare tous les autres champs avec le résultat original inchangé. Il ne modifie pas la fixture et n’applique aucune normalisation globale ou tolérance.

Le gel de livraison 0.44 annoncé après cette preuve porte le digest `e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255`, enregistré dans `../final/source-manifest.json`. Le résultat de composant lie séparément les empreintes exactes de l’accès, du projecteur et de TargetTree ; ces fichiers n’ont pas changé après la preuve. Le script n’importe pas le runtime dont le numéro de version est passé à 0.44.

## Reproduction

Depuis la racine du dépôt, avec un worktree de la publication 0.43 au commit `e9fd144112b05a65af5c88e9f05c541f43ed8ed7` :

```sh
node scripts/prove-exposed-current-evidence.mjs --baseline-root /workspace/sites/sra-published-043
```

Le paramètre `--baseline-root` accepte un autre chemin vers ce checkout. `--out` permet de placer les deux résultats dans un autre sous-répertoire. Le lecteur reconstruit les octets des entrées partitionnées en mémoire et en vérifie les empreintes ; il ne réécrit aucun fichier de campagne.

Cette revue couvre le correctif et les contrats de composant. La validation globale, les campagnes réellement exécutées, le budget de temps cumulé et les mesures de coût sont rapportés séparément par la validation de livraison.
