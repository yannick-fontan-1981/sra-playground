# Accusés matériels publics · sra.public/1.1

Le producteur peut publier un tableau optionnel `receipts` dans une fiche versionnée `sra.public/1.1`. Une entrée associe une commande complète, un libellé exact, son sens et l'effet matériel explicitement couvert. Le solveur reçoit des JSON et peut comparer ces valeurs sans interpréter la phrase française. Le dialogue sur le fil reste `fiche`, `action`, `retour`, puis arrêt ou verdict terminal. [Schéma JSON 2020-12](schema.json) · [Dialogue](../DIALOGUE.md)

| Champ | Sens et origine publique |
| --- | --- |
| `command` | Tableau exact d'une commande de la fiche. Lorsque `receipts` est présent, chaque commande possède une entrée. L'ordre des tableaux ne donne aucune priorité. |
| `status: "undeclared"` | Le producteur n'a fourni aucune déclaration d'accusé pour cette commande. Cette valeur décrit les métadonnées disponibles. |
| `status: "ambiguous"`, `source` | Une source publique signale que la déclaration de la commande est indéterminée. Aucune confirmation ne peut en être déduite. |
| `status: "declared"`, `replies[]` | Chaque objet associe un `label` distinct à `confirmed`, `refused` ou `ambiguous`. Plusieurs libellés peuvent confirmer la même commande. Deux commandes peuvent partager un libellé. |
| `replies[].source` | Lignes publiques liées à cette commande ou à ses règles. Au moins une contient le libellé entre guillemets. L'auteur désigne la signification de la déclaration à partir de ces lignes. |
| `coverage` sur une confirmation | Une liste de couples `effect`, `source` reprend les effets matériels inconditionnels `set` ou `keep` couverts et leurs citations exactes dans les règles de la même commande. La valeur `"unknown"` confirme l'exécution avec un effet matériel non établi par cet accusé. La liste peut être partielle. |
| Refus et ambiguïté | Un refus déclaré confirme la non-exécution. Un libellé ambigu laisse l'exécution indéterminée. Ces deux sortes de retour ne portent aucun effet. |

**Lecture.** Identifier d'abord la commande en vol. Le dialogue réserve `Action indisponible.` au refus sans effet et `succès` / `échec` à la fin de partie. Une lecture continue à utiliser sa règle `reveal` et son domaine. Pour un retour matériel, comparer la chaîne exacte uniquement aux déclarations de cette commande. Une chaîne sans correspondance dans une déclaration présente donne `unmatched`. L'absence de déclaration donne `undeclared`. Aucun de ces deux résultats ne confirme un effet. Un accusé de geste ne révèle aucune valeur de capteur. La fonction de lecture de référence retourne la classification et ses preuves publiques. [Interface de lecture et de validation](contrat.mjs)

**B et B3.** Les deux fiches exposent une confirmation couvrant `set([indexed,P],true)`. B emploie `indexer P` et `indexé`, B3 `caler P` et `calage enregistré`. B2 et B3, qui ont déjà les mêmes noms, produisent des tableaux `receipts` identiques malgré la reformulation de leur ligne source. Les effets conditionnels du cadran dans A restent dans les règles de la fiche. Son accusé d'indexation couvre uniquement l'indexation de P. [B](exemples/B.json) · [B3](exemples/B3.json) · [Exemple avec synonymes, refus, ambiguïté et effet inconnu](exemples/retours.json)

**Compatibilité.** Le lecteur accepte une fiche `sra.public/1` historique ou une fiche `1.1` sans tableau. Les deux exposent `undeclared` pour un accusé matériel ordinaire. Les anciens producteurs et exports continuent à livrer le format v1 par défaut. Pour un consommateur v1 strict, le producteur utilise v1 ou la projection explicite `--v1`. La projection restitue tous les champs de base. Le schéma v1 reste disponible à son emplacement d'origine.

**Production et provenance.** L'auteur rédige un registre public qui associe les annonces, les citations et les effets. Le registre contient une copie exacte des lignes relues. L'exporteur vérifie cette copie, l'appartenance des sources à la commande, la présence du libellé et la présence de l'effet inconditionnel cité. Une modification du texte rend le registre à réviser, même si le libellé y figure encore. Ces contrôles établissent la traçabilité. La fidélité du sens attribué à une phrase relève de la relecture éditoriale. Les champs du registre d'auteur sont distincts du JSON transmis au solveur. [Registre de B](exemples/B.declarations.json)

Depuis `public-format` :

```powershell
node accuses-publics/export.mjs reductions/B.json accuses-publics/exemples/B.declarations.json
node accuses-publics/exemple.mjs B3
node accuses-publics/export.mjs accuses-publics/exemples/B3.json --v1
node --test accuses-publics/test.mjs
python accuses-publics/verifier_schema.py
```

Le témoin enrichi des différents retours est une fiche de développement de l'interface. Les attestations de refus et d'ambiguïté y viennent de nouvelles phrases publiques. Les anciennes fiches du cadran et de la ressource peuvent être exportées sans registre, avec les accusés matériels indiqués comme non déclarés.
