# Prompt Codex — reprendre SS23, intégrer et publier sans régression

Ce prompt décrit une reprise **idempotente**. Il ne signifie pas que SS23 manque dans l’état où il sera exécuté. Au moment de sa rédaction, la qualification complète et la publication de SS23 sont encore en attente. Les preuves et l’état réel doivent être relus avant toute action.

---

Tu travailles sur le dépôt canonique `yannick-fontan-1981/sra-playground` et son Site SRA Playground. Ton objectif est de rendre **SS23 — Les Chambres de Résonance** entièrement disponible dans l’interface native et sur le Site, en complétant uniquement les éléments réellement manquants.

## 1. Inspecter l’état courant avant de modifier quoi que ce soit

Lis `AGENTS.md` à la racine, les éventuelles instructions de répertoire et les documents du laboratoire `experiments/sinking-star-ss23`. Relève la branche, le SHA local, les modifications non enregistrées, l’état de `origin/main` et la version actuellement publiée du Site avec son SHA source lorsqu’il est exposé.

Vérifie si SS23 existe déjà sur la branche canonique et dans le Site : catalogue, chargement natif, huit cartes et témoins, aide publique, tutoriel, galerie et rapports. Examine les éventuelles campagnes suivantes, notamment SS24 ou SS25, avant de choisir une base de travail.

Le commit `0ca0ec0235ba455af2e9600a7019044d1e9957f6` et le Site 195 désignent l’état historique de SS22 à l’ouverture de ce chantier. Ce ne sont pas des cibles de checkout, de reset, de publication ou de retour arrière. Aucun SHA indiqué dans ce document ne remplace l’inspection de la version courante.

Si SS23 est déjà intégré, correctement qualifié et publié depuis un état correspondant à GitHub, conserve cet état. Confirme les références observées et termine sans dupliquer le jeu, refaire l’intégration ou publier une version antérieure. Si le Site et GitHub divergent, identifie et conserve les changements des deux côtés, puis réconcilie-les avant publication.

## 2. Préserver le contrat de SS23

La campagne comporte huit salles et le quatuor **Marchand / Guerrier / Magicien / Barde**, sans Voleur. L’ordre public est `merchant`, `warrior`, `wizard`, `bard`, soit les touches 1, 2, 3, 4 et les tuiles `M W Z B`.

- Le Marchand pousse un occupant ; le Guerrier pousse toute une file contiguë.
- Le Magicien échange avec la première cible de sa visée, peut viser à travers l’eau et les faces blanches des miroirs, puis marche d’une case quand aucune cible n’est accessible. Un rayon revenant s’anime sans déplacer ni faire progresser les contacts.
- Le Barde entraîne les occupants admissibles de son carré de 5 × 5 avant le pas. Les miroirs ne suivent pas. Les appuis libres glissent seulement d’eau en eau ; un héros sur un appui ou l’arrivée du Barde l’ancre.
- Un héros transporté ne déclenche pas sa capacité. L’échange du Barde laisse son groupe en place ; le Magicien chanté ne vise pas ; le Guerrier chanté ne pousse pas une pièce hors de portée.
- Les monstres ne poursuivent personne. Les contacts orthogonaux et l’élimination mutuelle sont simultanés après les mécanismes.
- Les quatre héros vivants doivent occuper les quatre destinations ensemble. Les 36 découvertes du niveau 1 sont pédagogiques, sans condition cachée de victoire.

La spécification détaillée et les tests font foi. Préserve les mêmes garanties de caisses, eau, appuis, miroirs, boutons, portes, presses, plateformes et Undo ; n’ajoute pas de pouvoir implicite pour faciliter un témoin.

## 3. Compléter seulement les raccordements absents

Réemploie directement le moteur TypeScript et les niveaux du laboratoire. L’intégration doit être native, via `src/games/sinking-star-ss23.ts` et `src/runtime/native-game-dispatcher.ts`, sans iframe ni backend Python pour ce jeu.

Vérifie l’entrée unique SS23 dans `src/games/catalog.ts`, après SS22, avec l’identifiant `ss23-c4000001`, la famille `sinking_star_quartet`, huit niveaux et le titre **Les Chambres de Résonance**. Conserve tous les jeux existants, y compris ceux qui auraient été intégrés après SS23.

Vérifie dans `src/main.ts` et `src/styles.css` les quatre boutons, leurs couleurs, les raccourcis 1–4, Tab, le clic, les directions, ACTION5, Undo, Reset, Restart, le choix de niveau, les aides contextuelles, les liens de référence, les animations interrompues et le mode de réduction des animations.

L’aide `src/games/sinking-star-ss23-help.ts` réemploie les 36 prompts publics du laboratoire. La détection pédagogique et la sélection doivent rester fondées sur les observations publiques, sans accès à un état privé ou à un témoin.

Vérifie le raccordement de `scripts/native-game-gallery.mjs` et les attentes de catalogue dans `tests/custom4-native.test.ts` et `scripts/verify-ss01-browser.mjs`. Génère les aperçus depuis les huit cartes finales uniquement. Ne réutilise pas une galerie ou un HTML d’un état de travail différent.

## 4. Valider l’état exact à livrer

Ne qualifie pas une campagne dont des références, des cartes ou des témoins sont encore provisoires. Les huit références d’auteur doivent correspondre à `src/levels.ts`, à `src/level-info.ts` et aux huit témoins. Vérifie que chaque adaptation distingue son principe de référence des changements effectués.

Lorsqu’une modification est nécessaire, exécute les contrôles pertinents sur l’état final. Pour une livraison complète de SS23 :

```sh
cd experiments/sinking-star-ss23
npm test
npm run validate
npm run validate:ui
npm run validate:design
cd ../..
node --test tests/custom4-native.test.ts tests/ss*-native.test.ts
npm run typecheck
npm run test:sic-continuity
npm run build
```

Le fichier `tests/custom4-native.test.ts` doit être nommé explicitement : le glob `tests/ss*-native.test.ts` ne l’inclut pas. Les dépendances et scripts disponibles doivent être relus dans les `package.json` courants ; n’écrase pas une installation ou une instruction plus récente pour reproduire une commande historique.

Le test natif de SS23 doit comparer toutes les observations, images intermédiaires et durées des huit témoins avec la session du laboratoire, vérifier Undo après chaque victoire et constater les 36 découvertes au niveau 1 seulement. Le contrôle du HTML doit exercer les vrais événements DOM et les pixels peints. Une vérification visuelle de l’interface native dans le navigateur complète ces preuves ; distingue-la d’une exécution Happy DOM.

Ne relance pas des batteries sans rapport avec un risque restant. Si aucune modification n’est requise et que des preuves de l’état exact existent, utilise ces preuves et les vérifications d’état nécessaires au constat idempotent. Toute preuve réutilisée doit identifier son état source.

Conserve les rapports réels dans `validation/` et `docs/migration/ss23-evidence/`, puis mets à jour `docs/migration/ss23-native-integration.md`. Ne copie pas des mesures, un statut de succès ou un hash d’un état antérieur. Les témoins prouvent la jouabilité par les commandes publiques ; ils ne prouvent pas une résolution autonome SRA. N’altère aucun apprentissage, planificateur, arbitrage ou seuil SIC pour obtenir une victoire SS23.

## 5. Enregistrer sur GitHub, intégrer puis publier

Suis le protocole de `AGENTS.md` : travail et tests, commits cohérents, push vers GitHub, intégration sur la branche canonique, publication du Site depuis cet état, puis vérification de la correspondance GitHub/Site.

Utilise la branche courante appropriée ou une branche de travail issue de la version canonique actuelle. Préserve les modifications des autres lots. Si une PR existe déjà, poursuis-la au lieu d’en créer un doublon. Respecte les contrôles requis et ne contourne pas un contrôle en échec ou encore en cours.

Après intégration, publie le Site depuis l’état canonique qui contient SS23 et toutes les modifications plus récentes. Vérifie l’ouverture native de SS23 et relève la version effectivement publiée ainsi que le SHA source. Si le Site est déjà à cet état, une nouvelle publication n’est pas nécessaire.

## 6. Compte rendu final

Donne le résultat réellement observé, le lien de jeu, la branche, le SHA local, le SHA poussé, le commit intégré, la version Site et son SHA source. Indique la concordance ou la divergence éventuelle entre GitHub et le Site, les contrôles exécutés ou réutilisés et les limites restantes.

Consigne les huit victoires et le tutoriel seulement s’ils ont effectivement été reproduits sur l’état livré. Actualise la feuille de route d’après l’état courant : SS23 représente le jalon de création **23/25 jeux, soit 92 %, et 184/200 niveaux à sa clôture**. Ne diminue pas ces compteurs si des campagnes suivantes sont déjà présentes. La prochaine composition prévue après SS23 est **SS24 : Marchand / Voleur / Magicien / Barde**.

---

Ce prompt conserve les garde-fous d’une reprise ; le compte rendu et la note d’intégration doivent fournir les checkpoints de livraison réels au moment de leur production.
