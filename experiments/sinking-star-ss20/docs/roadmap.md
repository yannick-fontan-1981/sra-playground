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

## Intégration native et publication

- [x] SS20 suit SS19 dans Custom 4. Le sélecteur numéroté, les liens directs et la galerie couvrent les huit salles.
- [x] L’atelier des marées ouvre la campagne avec le Marchand. Les trente découvertes sont observées au niveau 1.
- [x] L’adaptateur et le dispatcher correspondent au laboratoire sur 1 344 entrées, dont 165 sélections, et 3 821 images avec leurs durées.
- [x] Edge confirme la victoire manuelle depuis le niveau 1, l’annulation de la transition vers le niveau 2, la reprise, les dispositifs et les commandes clavier et tactiles.

Le parcours de référence compte 1 179 coups hors sélection. Les huit salles en demandent respectivement 219, 199, 80, 86, 117, 77, 79 et 322. Le contrôle interactif de SRA couvre le pas-à-pas et l’interruption.

La publication utilise le Site existant et ses accès privés. Le compte rendu relie le commit GitHub intégré à la version Site vérifiée.

[Jouer à SS20 sur SRA Playground](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS20#playground)
