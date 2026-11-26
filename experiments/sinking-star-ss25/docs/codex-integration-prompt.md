# Prompt Codex — reprendre SS25 et publier l’état courant

Ce prompt est **idempotent** : il ne suppose pas que SS25 manque dans la version où il sera exécuté. Les huit cartes sont déjà créées et raccordées au moteur natif. L’intégration finale sur `main` et la publication doivent être vérifiées dans l’état courant de GitHub et du Site avant toute action.

---

Tu travailles sur le dépôt canonique **`yannick-fontan-1981/sra-playground`** et son Site **SRA Playground**. L’objectif est de rendre **SS25 — Les Derniers Équilibres** disponible et correctement qualifié dans l’interface native et sur le Site, en conservant les autres jeux et toutes les améliorations plus récentes.

L’utilisateur a autorisé l’intégration directe dans le projet, l’intégration sur `main` et la republication du Site avec les accès existants. Complète uniquement les éléments réellement manquants. Si SS25 est déjà intégré, qualifié et publié depuis un état correspondant à GitHub, constate cet état et termine sans dupliquer le jeu ni republier une version antérieure.

## 1. Inspecter les instructions et l’état réel

Lis **`AGENTS.md` à la racine** ainsi que les instructions applicables aux répertoires concernés. Lis le laboratoire `experiments/sinking-star-ss25`, en particulier `README.md`, `docs/specification.md`, `docs/source-audit.md`, `docs/validation.md`, `docs/roadmap.md` et `docs/migration/ss25-native-integration.md` à la racine du dépôt.

Relève la branche, le SHA local, les modifications non enregistrées, les commits de la branche distante et l’état actuel de `origin/main`. Inspecte aussi le Site courant : version publiée, état source associé et SHA lorsqu’il est exposé. Identifie la PR pertinente depuis les références réelles du chantier ; ne suppose pas un numéro de PR et n’en crée pas un doublon.

Vérifie l’existence et l’état de SS25 sur la branche canonique puis dans le Site : entrée de catalogue, chargement natif, huit cartes, aide, tutoriel, galerie, témoins et rapports. Examine également les jeux et modifications intégrés après le checkpoint du laboratoire. Les fichiers partagés doivent être adaptés à leur version actuelle, jamais remplacés en bloc par une copie historique.

La base `4a546a139f9064422c078ef5f40b8c22133c39a8`, le Site 198 et la branche de création `feat/sinking-star-ss25-20261126` sont des repères historiques. Ils ne constituent pas des instructions de checkout, de reset, de merge forcé ou de publication. La note d’intégration et le reçu final donnent les références de livraison réellement constatées.

Si GitHub et le Site divergent, conserve les changements utiles des deux côtés, identifie leur provenance puis réconcilie-les avant publication. Respecte la source canonique GitHub et le protocole de `AGENTS.md`.

## 2. Préserver le contrat du jeu

La campagne contient huit niveaux et le quatuor **Guerrier / Voleur / Magicien / Barde**, sans Marchand. L’ordre public est `warrior`, `thief`, `wizard`, `bard`, soit les tuiles `W T Z B`, les touches 1–4 et les couleurs rouge, vert, violet et magenta.

- Le Guerrier pousse la file contiguë entière. Une butée bloque l’ensemble. Il ne possède ni attaque spéciale ni immunité aux monstres.
- Le Voleur tire uniquement l’occupant immédiatement arrière après un pas libre et soutenu. Une deuxième pièce alignée reste en place ; un appui immergé ne se tire pas.
- Le Magicien échange avec la première cible accessible. Son rayon traverse l’eau nue et peut tourner sur les faces blanches des miroirs. Sans cible, il tente un pas ; un rayon qui revient au Magicien ne fait pas progresser le monde.
- Le Barde agit sur le carré de 5 × 5 mesuré avant son pas. Les membres bloqués restent en place, les miroirs ne suivent jamais et les appuis libres glissent seulement d’eau en eau. Un héros sur un appui et l’arrivée immédiate du Barde l’ancrent.
- Un partenaire transporté n’active pas sa capacité. Une sélection n’est pas un tour physique. Les commandes refusées n’ajoutent pas un tick de combat.
- Les monstres restent immobiles sans transport explicite. Leurs contacts orthogonaux sont simultanés après les mécanismes ; deux monstres voisins s’éliminent et attaquent encore leurs voisins héros pendant cette même vague.
- Quatre héros vivants doivent occuper les quatre destinations. Les **39 découvertes de N1** sont pédagogiques et ne sont jamais une condition cachée de victoire.

Préserve les invariants des caisses, de l’eau, des appuis, des miroirs, des portes, des presses latérales, des plateformes, des animations et d’Undo. La spécification et les tests décrivent leur comportement. Ne change pas une règle pour forcer le succès d’un témoin.

## 3. Compléter seulement les raccordements absents

Réemploie le moteur TypeScript et les cartes du laboratoire. L’intégration native repose sur `src/games/sinking-star-ss25.ts` et `src/runtime/native-game-dispatcher.ts`.

Vérifie l’entrée unique **`ss25-c4000001`** dans `src/games/catalog.ts`, le groupe **Custom 4**, la famille `sinking_star_quartet`, les huit niveaux et le titre **Les Derniers Équilibres**. Conserve SS01–SS24 et tous les autres jeux présents, y compris ceux qui auraient été ajoutés ultérieurement.

Vérifie les raccordements de `src/main.ts`, `src/styles.css` et `src/games/sinking-star-ss25-help.ts` : boutons de rôle, sélection par clic, touches 1–4 et Tab, directions, ACTION5, Undo, Reset, Restart, choix du niveau, aides contextuelles, références des cartes, interruption des animations et préférence de réduction des animations. L’aide native doit réemployer les 39 prompts publics du laboratoire.

La sélection et les découvertes pédagogiques doivent continuer à utiliser les observations publiques ; le tutoriel reste réservé à N1. Un état privé, un parcours témoin ou un solveur d’auteur ne vaut pas preuve d’acquisition. Dans l’apprentissage et la planification SRA de production, l’identifiant du jeu ou du niveau et les coordonnées fixes ne doivent pas décider du comportement.

Vérifie `scripts/native-game-gallery.mjs`, `tests/custom4-native.test.ts` et `scripts/verify-ss01-browser.mjs`. La galerie doit être générée depuis les sources courantes. Ne remplace pas les aperçus, le HTML ou les attentes de catalogue par ceux d’un ancien checkpoint.

Si des cartes d’auteur ont réellement changé, utilise `node scripts/sync-levels.mjs` dans le laboratoire, puis contrôle la concordance des huit `reference/levelN-design.json`, de `src/levels.ts`, de `src/level-info.ts` et de `tests/witnesses.json`. Recompile et requalifie ces mêmes sources. Ne relance pas la génération des cartes déjà finalisées sans modification justifiée.

## 4. Valider l’état exact à livrer

Le checkpoint documentaire de création rapporte les preuves suivantes : **137 tests de laboratoire**, **102 tests natifs**, **45 configurations DOM et huit parcours HTML**, **97 contrôles de conception**, **1 209 entrées dont 201 sélections**, **3 296 images publiques**, ainsi qu’un build de **125 jeux / 836 aperçus**. Ces nombres sont des résultats historiques, pas des valeurs à imposer à une version plus récente.

Le rapport Chrome archive une session Manual complète N1→N8, les **39/39 découvertes en N1**, le panneau **VICTORY** et Undo suivi de la reprise du dernier geste. La [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) suit ce chantier et conserve son reçu final. Relis le résultat de continuité, les contrôles GitHub, le commit intégré et la publication dans leurs preuves réelles ; ne déduis jamais leur succès du seul build.

Relis les scripts et dépendances des `package.json` courants. Pour une nouvelle qualification complète de SS25 après modification, les commandes de ce checkpoint sont :

```sh
cd experiments/sinking-star-ss25
npm test
npm run validate
npm run validate:ui
npm run validate:design
node scripts/package-delivery.mjs
cd ../..
node --test --test-reporter=tap tests/ss25-native.test.ts tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts tests/ss23-native.test.ts tests/ss24-native.test.ts
npm run typecheck
npm run test:sic-continuity
npm run build
```

`tests/custom4-native.test.ts` doit être nommé explicitement : le glob des seuls tests SS ne l’inclut pas. Protège aussi les jeux et contrats ajoutés depuis ce checkpoint. Respecte les contrôles requis de la version courante et attends la fin réelle des tâches lancées avant d’en annoncer le résultat.

Les contrôles natifs comparent les observations, images intermédiaires et durées des huit témoins avec la session de référence, vérifient Undo après les victoires et réservent les découvertes au niveau 1. La validation HTML utilise les vrais événements DOM et le tampon de pixels, avec Happy DOM. Elle ne remplace pas une session Chrome native.

Avant d’annoncer une victoire dans l’interface livrée, reproduis-la par ses commandes publiques dans le mode et depuis le niveau de départ annoncés, conformément à `AGENTS.md`. Pour la qualification de campagne, vérifie le parcours Manual N1→N8, les 39 découvertes, les transitions, la victoire finale et Undo. Archive le résultat réel et distingue ce rejeu des tests automatisés.

Conserve les preuves pertinentes dans `experiments/sinking-star-ss25/validation/` et `docs/migration/ss25-evidence/`, puis actualise `docs/migration/ss25-native-integration.md`. Les empreintes et résultats doivent correspondre à l’état testé. Les témoins, solveurs et scripts d’auteur restent exclus du jeu livré.

Si aucune modification n’est nécessaire et que les preuves désignent déjà l’état exact publié, réutilise ces preuves avec les vérifications de concordance nécessaires. Ne relance pas des batteries sans risque restant. Ne copie jamais le statut de succès ou le hash d’un artefact différent.

Les témoins prouvent la jouabilité ; ils ne prouvent pas une résolution autonome par SRA. N’altère pas un apprentissage, un planificateur, l’arbitrage ou un seuil SIC pour reproduire le parcours d’auteur. Toute modification de SIC doit suivre ses exigences spécifiques de généricité, de transfert, de composition et de continuité dans `AGENTS.md`.

## 5. Enregistrer sur GitHub, intégrer sur `main`, puis publier si nécessaire

Applique la chaîne imposée par `AGENTS.md` : **travail → tests → commits cohérents → push GitHub → intégration sur la branche canonique → publication Site → vérification GitHub/Site**.

Utilise une branche adaptée à la base canonique actuelle et préserve le travail des autres lots. Si une PR pertinente est encore ouverte, poursuis-la. Respecte les contrôles requis ; ne contourne pas un échec ou une exécution encore en cours. Enregistre régulièrement les changements cohérents sur GitHub afin que le checkout temporaire ne soit pas leur unique détenteur.

Après toute nouvelle modification qualifiée, intègre l’état final sur `main`, puis publie le Site avec les accès existants depuis cet état canonique. Conserve les jeux récents et les réglages d’accès du Site. Si le Site est déjà publié depuis l’état attendu, une publication supplémentaire n’est pas nécessaire.

Vérifie l’ouverture native de SS25 dans **SRA Playground → Custom 4** sur la version réellement publiée. Relève la version Site et son SHA source lorsqu’il est disponible, puis établis la correspondance avec le commit intégré sur GitHub. Une publication ne remplace pas la sauvegarde du code dans le dépôt canonique.

## 6. Produire un compte rendu fidèle et une reprise exploitable

Donne le lien de jeu, le résultat observé, la branche, le SHA local, le SHA poussé, le SHA intégré sur `main`, la PR, la version Site et son SHA source. Indique explicitement si GitHub et le Site concordent, les contrôles exécutés ou réutilisés, leur provenance et les limites restantes. Si une étape échoue, conserve le diagnostic et poursuis les corrections autorisées avant de la déclarer terminée.

Actualise la feuille de route en séparant trois états : **création des campagnes**, **qualification et publication**, **résolution autonome SRA**. Le jalon de création de SS25 est **SS01–SS25 créés, 25/25 jeux et 200/200 niveaux, soit 100 %**. Ne diminue pas les compteurs si l’état courant est plus avancé. Aucune campagne SS26 n’est prévue par ce prompt ; la phase suivante est l’évaluation et l’équilibrage des campagnes existantes, avec une évaluation SRA distincte.

---

La [validation](validation.md), la [feuille de route](roadmap.md) et la [note d’intégration native](../../../docs/migration/ss25-native-integration.md) doivent être relues lors de chaque reprise. Elles fournissent les faits et références de livraison ; ce prompt fixe la méthode sans imposer un retour à une version ancienne.
