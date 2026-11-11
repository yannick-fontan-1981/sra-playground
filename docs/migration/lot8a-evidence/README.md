# Lot 8A — accès conditionné par un motif

## État courant

Travail en cours, candidat natif **0.65.0 réservé**, sans publication ni qualification de coût de ce lot. La source de départ est le Site 101 / native 0.61.0 ; le développement est maintenant réconcilié avec le **Site 103 / native 0.62**, commit `4afcbfe6a25bd3a88223be543e443bc53b9c8814`, effectivement déployé et [observé via Sites](coordination/published10b-site103.json). Le gel final doit intégrer les publications effectives restantes 5C / 0.63 et 6B / 0.64, après 10B / 0.62 déjà intégré dans l'ordre convenu ; ces numéros ne sont pas des attestations de déploiement.

Le périmètre est la seule entrée `motif_conditioned_access`, dans `factored_material_return`. `parallel_branch_routing` reste le sous-lot 8B. Le [contrat source](contract/source-contract.md) distingue le comportement Python, l'adaptation native et les preuves encore à exécuter.

## Validation prospective

- Oracle Python inchangé sur des scènes synthétiques indépendantes, avec propositions, gardes, retours et états comparés.
- Cas positif d'acquisition d'un motif puis de réévaluation de l'accès ; ambiguïté, contradiction, contexte changé et effets inconnus.
- Parcours intégré sélection, garde actuelle, WHY/ACT, autorisation, retour acquis une seule fois, restauration depuis le magasin commun et décision suivante.
- Recherche interrompue qualifiée d'incomplète, sans inférer une impossibilité ni poursuivre sur une solution partielle.
- Non-régressions sur le gel final et coût comparé au prédécesseur effectivement publié.

Aucun résultat historique ne devient une preuve de ce candidat. Une campagne de trois niveaux par entrée n'est pas obligatoire ; la contribution propre doit rester distincte d'une non-régression. Aucune nouvelle campagne réelle n'a commencé pour 8A.

## Règle de coût

La variation de la médiane des sessions complètes doit rester **strictement inférieure à +10 % pour STCK et pour SMLP séparément**. Les dépassements par phase sont recevables quand ces deux conditions globales sont satisfaites ; tous les diagnostics, cohortes et essais déclarés sont conservés. Aucun coût 0.61 ou 0.62 n'est présenté comme le coût de 8A.

## Cas fermé

LKEY demeure définitivement fermé à **2 390,347106991 s** cumulées : aucun essai, rejeu, oracle, analyse de charge utile ou remise à zéro. Les quatre modules de tests historiques qui chargent sa géométrie restent hors du périmètre frais.
