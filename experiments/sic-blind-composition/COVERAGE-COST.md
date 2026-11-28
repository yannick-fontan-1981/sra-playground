# Composer selon le nombre de commandes réellement jouées

Les mesures existantes associent les commandes aux déplacements, aux poussées et aux tractions observés. Pour la couverture par poussée, la recherche d’origine compte chaque poussée comme une étape et regroupe la marche qui la prépare. Pour la traction, elle donne un poids double à une estimation du placement restant. Dans les deux cas, un trajet retenu peut demander plus de commandes qu’un autre trajet conforme aux mêmes effets mesurés.

Le bras de comparaison conserve d’abord la route native. Il utilise les états de recherche encore disponibles pour vérifier une route strictement plus courte en comptant chaque commande. Les deux recherches partagent la même borne de 6 000 états examinés par décision. Une alternative doit entrer dans le budget de commandes restant. Le moteur revérifie les appuis, les retours et le passage officiel comme dans le parcours de référence.

## Premier contrôle local

| Source | Repère | Gestes de référence | Gestes avec comparaison |
| --- | --- | ---: | ---: |
| SS02 N1 | Couverture par poussée | 40 | 32 |
| SS03 N1 | Couverture par traction | 47 | 43 |

Les deux bras activent le contraste de contrôle et la reprise locale. Seule la comparaison du coût varie. Les quatre départs vont du N1 au premier passage officiel, avec les mêmes plafonds de gestes et de temps et un worker. Sur SS02, la première proposition estimée à 20 gestes au lieu de 38 arrive au geste 13. Le premier effet physique différent survient au geste 15. Sur SS03, la première proposition estimée à 37 gestes au lieu de 41 arrive au geste 7, puis le premier effet différent au geste 21. Les estimations concernent le suffixe proposé. Les nombres du tableau proviennent des commandes réellement autorisées et jouées. Le lot reste limité à SS01–SS07 avant le verdict de sa campagne source.
