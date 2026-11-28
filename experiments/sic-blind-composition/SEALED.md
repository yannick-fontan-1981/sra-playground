# Rejeu autonome de SS08 à SS25

## Contraste de contrôle et reprise locale

Le moteur `8025e9cb02a1ba446bc5d3f02cdd0dd56df20f46`, arbre `b7c31326212b478a939cb53ef56d6e8b65e510f6`, a d’abord qualifié les retours réels de COMB, DC22, SS01 et SS04. Le contrôle a réconcilié neuf reçus sources à budget égal. Il s’est terminé avant le premier job de rejeu. [Qualification source](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46140352121)

Les deux bras repartent du niveau 1, avec un worker par partie, 80 gestes et 90 secondes par niveau. Chaque jeu de SS08 à SS25 obtient **0/8**, soit **0/144 et 0 %** dans chaque bras. Tous s’arrêtent au niveau 1 au plafond de 80 gestes. Les deux bras exécutent chacun 1 440 gestes autorisés. Six paires ont les mêmes effets physiques et empreintes cumulées. Les douze autres ont une divergence de trajectoire sans passage supplémentaire.

Les dix-huit paires ont été réimportées et vérifiées avec leurs empreintes, leur identité de moteur, les niveaux officiels et les plafonds. Durée des rejeux 1 min 39 s, pic de 17 jobs, durée cumulée 14 min 57 s. Le résultat établit que les gains sources de cette version ne suffisent pas à augmenter le taux de résolution. [Campagne réservée](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46140383429)

## Coût des commandes dans les routes de couverture

Le candidat `0c782562f7a94058d38d3a4dee0893222a65974e` conserve l’arbre moteur `f31747a4aabd9372f24ed4e73a9cdf1891890c31` du lot source. La poussée et la traction ont économisé ensemble douze gestes dans les sept paires sources, à 20 passages dans chaque bras. Les deux qualifications ont précédé les rejeux. [Dossier de couverture](https://github.com/yannick-fontan-1981/sra-playground/blob/498559cb0c8f0bd3ab8660a9a7cb403a1da4af7f/experiments/sic-blind-composition/COVERAGE-COST.md)

Le score reste **0/8 par jeu et 0/144 par bras**, avec 80 gestes joués depuis le N1 dans chaque partie. Les 36 trajectoires physiques reproduisent celles du premier rejeu dans leur bras. Les reçus de l’actif attestent des expériences sur les effets dans onze jeux et une annulation effective. Aucune route de couverture à meilleur coût n’est choisie dans cette fenêtre. Durée des rejeux 2 min 05 s, pic de 17 jobs, durée cumulée 14 min 52 s. L’analyse utilise uniquement les totaux, les empreintes et les catégories de reçus de la réserve. [Deuxième campagne](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46141394921)

Une mesure distincte conserve exactement cet arbre moteur et donne aux deux bras 160 gestes et 180 secondes par niveau. Le premier niveau reste le point de départ et le passage officiel reste le critère de résolution. Le score au plafond initial reste publié séparément. [Mesure à budget élargi](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46141922351)
