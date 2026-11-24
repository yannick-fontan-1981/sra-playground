# SS20 — feuille de route

## Campagne 0.1.0 : Le Relais des Îles

SS20 est une nouvelle campagne de huit salles pour le trio **Marchand / Voleur / Barde**. Elle conserve les monstres stables et les dispositifs lisibles de la série, et propose de nouveaux problèmes de manutention, d’accès, de transport et de réemploi.

Les huit cartes et leurs témoins sont présents dans `reference/`. **L’atelier des marées** ouvre la campagne avec trente découvertes observables depuis les pixels publics. **Le chargement à rebours** suit au niveau 2, sans eau, monstre ou miroir. Les niveaux 3 à 8 alternent verrou optique, quais, rencontre préparée, appui réutilisé, relève et chantier démontable.

| Étape | Référence de suivi |
| --- | --- |
| Cartes, crédits, étapes et témoins des huit salles | `reference/level1-design.json` à `reference/level8-design.json` |
| Moteur et tutoriel M/T/B | `src/core.ts`, `src/tutorial.ts`, tests du laboratoire |
| Qualification du laboratoire | Réussie : 90 tests, 8 victoires, 30/30 découvertes, 91 contrôles ciblés ; [rapports](validation.md) |
| HTML autonome qualifié | `dist/SS20-demo.html`, 136 889 octets ; empreinte dans `validation/delivery-manifest.json` |
| Sauvegarde du laboratoire | Branche `feat/sinking-star-ss20-20261123` ; le compte rendu de livraison donne le SHA poussé |
| Livraison du laboratoire SS20 sur main | [PR #123](https://github.com/yannick-fontan-1981/sra-playground/pull/123) ; version qualifiée `aa1fe3f2aa3d864698ec623d033dae6d5b3d8bcd`, avec les évolutions concurrentes de main préservées |
| Adaptateur natif, galerie, catalogue et Custom 4 | Phase suivante décrite dans le [prompt Codex](codex-integration-prompt.md) |
| Publication de SRA Playground | Après intégration distante et qualification native ; version Site et SHA source à consigner |

Cette feuille de route ne marque pas l’intégration native ou la publication de SS20 comme accomplie. SS19 reste déjà présent sur `main` et doit être préservé. Les numéros, le tutoriel et les cartes de SS19 ne sont pas réaffectés à SS20.

## Avancement de la série

La création des huit niveaux SS20 porte le plan de la série à **20 jeux sur 25** et **160 niveaux sur 200**, à raison de huit niveaux par jeu. Ce décompte décrit les campagnes créées ; il ne constitue pas un décompte de Sites publiés ou de campagnes autonomement résolues par SRA. La qualification et l’intégration de chaque livraison restent tracées séparément.

Il reste **cinq jeux, soit quarante niveaux**, pour le lot **SS21–SS25**. Ce lot couvre les cinq compositions à quatre personnages. L’ordre précis n’est pas attribué ici sans plan numéroté confirmé.

| Composition restante | Personnage absent |
| --- | --- |
| Guerrier / Magicien / Voleur / Barde | Marchand |
| Marchand / Magicien / Voleur / Barde | Guerrier |
| Marchand / Guerrier / Voleur / Barde | Magicien |
| Marchand / Guerrier / Magicien / Barde | Voleur |
| Marchand / Guerrier / Magicien / Voleur | Barde |

Dans cette feuille de route, `M` désigne le Marchand, `W` le Guerrier, `Z` le Magicien, `T` le Voleur et `B` le Barde. SS20 lui-même utilise uniquement **M/T/B** et trois destinations ; le passage aux quatuors demandera son propre contrat et ses propres cartes.

## Prochaine phase : intégration native et publication

La prochaine intégration ajoute SS20 après SS19 dans SRA Playground, avec les huit images de départ, les crédits, le lien direct, les commandes et le tutoriel au niveau 1. Elle compare les observations et animations natives à la référence du laboratoire et exécute les contrôles du dépôt, dont `npm run test:sic-continuity`.

La sauvegarde et la publication suivent les règles de [AGENTS.md](../../../AGENTS.md) et de la [politique GitHub/Site](../../../docs/migration/git-site-sync-policy.md) : tests, commit, push, intégration sur la branche canonique, publication depuis cet état puis vérification du résultat. Le Site est le déploiement du code sauvegardé ; il ne remplace pas sa sauvegarde GitHub.

Le compte rendu de cette phase doit relier **branche → SHA local → SHA poussé → SHA intégré → version Site → SHA source publié**, ou préciser quand ce dernier n’est pas fourni. En cas de divergence, préserver les deux états et les réconcilier avant toute affirmation de synchronisation.

Les témoins, leurs longueurs et les contrôles de ressources ne démontrent ni difficulté optimale, ni solution unique, ni résolution autonome de SRA. Les variantes conformes aux règles restent autorisées.
