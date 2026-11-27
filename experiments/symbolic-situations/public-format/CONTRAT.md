# Entrée publique commune · version 1

Le message initial est un objet JSON portant `"format": "sra.public/1"`. Un solveur peut lire les clés, les expressions et les commandes sans interpréter le Markdown ni les extraits français. Le schéma emploie JSON Schema 2020-12. [Schéma machine](schema.json)

| Champ | Sens et provenance |
| --- | --- |
| `format` | Constante du protocole de sérialisation. |
| `goal.command`, `criterion`, `maintain` | Commande terminale nommée par le but et le répertoire public des commandes. `minimax_actions` demande de garantir la réussite avec le moins de gestes dans le pire cas. `maintain`, facultatif, reprend une condition que le but demande de préserver. |
| `observations[]` | Un fait public, identifié par `ref`. Une déclaration explicite donne `status: "known"` et `value`. Une ignorance déclarée donne `status: "unknown"` sans valeur. Une déclaration omise peut laisser la référence sans observation. |
| `domains[]` | Valeurs possibles énumérées par la fiche. `stableWhen: true` signifie fixe sur la partie. Une expression précise une stabilité conditionnelle, par exemple après la purge. |
| `commands[].command` | Tableau des mots d’une commande publique, dans l’ordre d’envoi. Joindre ces mots par une espace restitue la commande jouable. Un gabarit est instancié à partir des listes d’objets annoncées, dans tous les couples admis par sa signature. |
| `rules[].command` | Commande concernée par une clause publique. `requires` exprime une condition d’application énoncée. `maxUses` vient d’une limite annoncée. `successRequires` est une condition nécessaire à la réussite, y compris si la commande peut être jouée trop tôt. |
| `rules[].when`, `effect` | Une conséquence annoncée s’applique si `when` est vrai, ou à chaque exécution applicable de la commande en son absence. Les effets sont `set` (modifier le fait), `reveal` (obtenir sa valeur), `keep` (conservation explicite) et `end` (terminer). Les valeurs de `end` sont `success`, `failure` ou `unspecified` lorsque le texte annonce la fin sans en garantir le résultat. Plusieurs effets peuvent s’appliquer ensemble. |
| `source` | Sur le but et chaque observation, domaine, commande ou règle, liste des numéros de ligne à l’origine de l’enregistrement. Une règle combinée cite le passage opératoire et les déclarations nécessaires à son instanciation. |
| `sources` | Dictionnaire des lignes citées de la fiche d’entrée, numérotées depuis 1 et reproduites textuellement. Ce champ permet l’audit. Les décisions utilisent les autres champs structurés. |

## Expressions et faits

Une référence est un tableau dont le premier élément désigne un prédicat et les suivants ses arguments publics. Les références s’identifient par leur contenu. Une comparaison `{"eq":[référence,valeur]}` compare un fait à une constante. Le membre droit `{"ref":référence}` compare deux faits. `all`, `any` et `not` représentent la conjonction, la disjonction et la négation. Les conditions portant sur une valeur inconnue restent indéterminées tant que les autres termes ne suffisent pas à trancher. L’ordre des règles ne porte aucune priorité.

| Référence | Signification publique |
| --- | --- |
| `["dial"]` | Sortie actuellement désignée. |
| `["mark", case]`, `["available_stamp", tampon]`, `["required_stamp", sortie]` | Marque de la case, disponibilité du tampon, tampon exigé par la sortie. Une marque connue de valeur JSON `null` signifie que la case est vierge. |
| `["held", poste]`, `["flap_open", poste]`, `["locked", poste]` | Poignée en place au clapet, clapet ouvert, butée engagée. Un retrait réussi libère la poignée. |
| `["receiver_open", poste]`, `["indexed", poste]`, `["purged", poste]` | Poste aval ouvert, poste indexé, purge faite. |
| `["archive", poste]`, `["effort", poste]` | Relevé du cycle précédent et effort du cycle courant. L’archive ne renseigne jamais à elle seule la valeur courante. |

`set` contient la paire `[référence, valeur]`. `reveal` et `keep` contiennent une référence. Quand une valeur manque, son absence ne permet de conclure ni `false` ni `null`. Une limite d’utilisation ne crée pas de compteur initial observé. Une condition nécessaire ne vaut pas garantie de succès.

Le producteur cite les lignes publiques d’une seule fiche. Les identifiants de fichiers, graines, numéros de monde, noms de stratégies, scores, offres d’Agenda et plans ne font pas partie du schéma. Les retours des commandes relèvent du contrat interactif déjà livré. Cette version définit le message initial.
