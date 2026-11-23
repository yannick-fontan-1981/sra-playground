# SS19 — La Chasse Noire

Laboratoire autonome en cours de qualification : Guerrier, Magicien et Barde.

Le moteur ajoute une poursuite déterministe des monstres après chaque action effective. Le héros sélectionné est leur cible ; ils choisissent l’axe de plus grande distance, avec priorité verticale en cas d’égalité. Les obstacles les arrêtent sans détour. Les contacts sont résolus avant puis après la poursuite, et la victoire vient après ces effets.

Ce premier point de sauvegarde contient le moteur, ses tests et les premiers ateliers d’auteur. La campagne complète, l’interface et les rapports de validation seront intégrés dans les commits suivants. Il ne constitue pas encore une livraison jouable qualifiée.

Contrôle moteur : compiler `src/core.ts` avec TypeScript, puis exécuter `node --test tests/trio.test.mjs tests/hunt.test.mjs`.
