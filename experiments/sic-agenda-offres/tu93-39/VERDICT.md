# TU93 · verdict de la ligne 39

Le gel consomme déjà l’offre d’accès alterné. Les deux tickets du catalogue sont `ACTION4` au N1/T15 et `ACTION2` au T16. Le graphe courant a 31 nœuds et 32 arêtes. Le chemin proposé compte 18 arêtes, dont deux entrent dans le plafond de session. Les deux déplacements ordinaires sont confirmés et le préfixe se termine pendant N1. [Protocole et commande](README.md) · [Critères](ATTENDUS.md)

L’échantillon [0,+6] d’`ACTION4`, pris au vrai T4 pour la même signature, décide de l’admissibilité. Son retrait suspend l’offre au T15 et libère un essai de frontière. Une observation hors signature conserve l’offre. Un retour stationnaire construit réfute le premier déplacement, scelle le préfixe et enregistre sa clé. La frontière prend le tour suivant. Le retrait isolé de l’offre de `proposeGraph` conduit également au repli et à une nouvelle offre au T16.

Six préfixes natifs sur l’historique et le gel, et 286 tests du graphe passent. La branche de qualification conserve l’arbre de production du gel. La preuve porte sur les tickets de préfixe au catalogue et sur la revalidation de leurs déplacements.

Harnais testé à `49a971c37982154ea175294afffdf83469c1c302`. Le reçu a été écrit le 27 novembre 2026 à 23 h 01 min 02 s (UTC−3), après 7 min 48 s. L’agrégat a réussi au premier lancement. Reçu local `artifacts/qualification-tu93-39/49a971c3.json`, SHA-256 `9cd41071c7a9e30760ba018dbb06e281e44c9cef9a59405bd79a54797b4ac2cb`.
