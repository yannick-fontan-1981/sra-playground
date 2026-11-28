# Composer selon le nombre de commandes réellement jouées

Les mesures existantes associent les commandes aux déplacements, aux poussées et aux tractions observés. Pour la couverture par poussée, la recherche d’origine compte chaque poussée comme une étape et regroupe la marche qui la prépare. Pour la traction, elle donne un poids double à une estimation du placement restant. Dans les deux cas, un trajet retenu peut demander plus de commandes qu’un autre trajet conforme aux mêmes effets mesurés.

Le bras de comparaison conserve d’abord la route native. Il utilise les états de recherche encore disponibles pour vérifier une route strictement plus courte en comptant chaque commande. Les deux recherches partagent la même borne de 6 000 états examinés par décision. Une alternative doit entrer dans le budget de commandes restant. Le moteur revérifie les appuis, les retours et le passage officiel comme dans le parcours de référence.

## Premier contrôle local

| Source | Repère | Gestes de référence | Gestes avec comparaison |
| --- | --- | ---: | ---: |
| SS02 N1 | Couverture par poussée | 40 | 32 |
| SS03 N1 | Couverture par traction | 47 | 43 |

Les deux bras activent le contraste de contrôle et la reprise locale. Seule la comparaison du coût varie. Les quatre départs vont du N1 au premier passage officiel, avec les mêmes plafonds de gestes et de temps et un worker. Sur SS02, la première proposition estimée à 20 gestes au lieu de 38 arrive au geste 13. Le premier effet physique différent survient au geste 15. Sur SS03, la première proposition estimée à 37 gestes au lieu de 41 arrive au geste 7, puis le premier effet différent au geste 21. Les estimations concernent le suffixe proposé. Les nombres du tableau proviennent des commandes réellement autorisées et jouées. Le lot reste limité à SS01–SS07 avant le verdict de sa campagne source.

## Rejeu indépendant des sept sources

Le moteur `af0fdaf8ea4e7624333889098d7f9b8edcd99813`, arbre `f31747a4aabd9372f24ed4e73a9cdf1891890c31`, reproduit les deux gains et les deux premiers écarts physiques. Les sept paires ont les mêmes plafonds et valident 20 des 21 niveaux dans chaque bras. SS06 s’arrête au troisième niveau après 80 gestes dans les deux. Le total passe de 916 à 904 gestes autorisés. Les cinq autres paires gardent leurs trajectoires physiques. Les trois propositions de coût retenues utilisent 6 000, 3 547 et 6 000 états, dans la borne commune. Les empreintes des sept dossiers ont été vérifiées. Durée de campagne 2 min 23 s, pic de sept jobs avec un worker par partie. [Campagne source](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46140846955)
