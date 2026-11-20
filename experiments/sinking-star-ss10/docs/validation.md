# SS10 — Publication de la version 0.3.1

Cette publication conserve à l’identique `reference/author/build-level8.mjs` du commit `7bd17908d54b738bfc9b5f81f40cd997ac2cbd32` et propage sa carte de Heroes and Water 3 dans la référence, les données jouables et les crédits. Le niveau 6 reste « Le dernier changement de sens ». Le moteur, le tutoriel partagé et le raccordement natif restent ceux de `main`.

Aucune nouvelle vérification de résolution, recherche de solution ou exécution des parcours n’a été effectuée pour cette publication, conformément à la demande utilisateur. Le parcours déjà enregistré de 214 actions appartient à cette même carte. La référence historique de campagne est de 627 actions, 58 sélections et 1 807 images ; ce ne sont pas de nouveaux résultats de test.

Les rapports JSON conservés dans `validation/` décrivent leurs versions et empreintes HTML antérieures, notamment la finale originale de la version 0.3.0. Ils ne constituent pas une validation de la version 0.3.1. Les scripts de contrôle ont été adaptés à la nouvelle carte sans les exécuter.

Le fichier d’auteur reste inchangé. Son appel direct à `Author.save` sans parcours ne constitue pas une commande de régénération complète ; la référence et son témoin existants sont conservés dans `reference/level8-design.json`. `node scripts/sync-levels.mjs` exporte ces références dans les cartes, crédits et témoins consommés par le projet.

La construction de production et l’état de publication GitHub/Site sont consignés dans le compte rendu de publication. Les témoins historiques ne prouvent ni optimalité ni unicité.
