# OP01–OP31 — qualification combinée du contrôleur Agent navigateur

Date : 12 novembre 2026

## Références

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Branche de travail : `op01-op31-browser-agent-controller-20261112`
- Baseline commune initiale : `4bf27669ce8f2945aa7672f134ffe1cefcac35ae`
- Canonique Region ACTION6 réconciliée : `67602172665b79e2b282b37b63f80dc24feff3b0`
- Merge de réconciliation sur la branche de travail : `39eca6250a1a3a7480cb9224a491fb8bdeb15f01`
- PR de réconciliation : `#48`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Rapport fonctionnel : `docs/recovery/op01-op31-browser-agent-controller-20261112.md`
- Suivi consolidé : `docs/migration/op01-op31-progress.md`

## Objet

La branche canonique a intégré le lot Region ACTION6 complet pendant le
développement du contrôleur Agent navigateur. Avant la PR finale, les 17
commits canoniques concernés ont été fusionnés dans la branche contrôleur afin
de qualifier le résultat combiné réel.

Les fichiers du lot Region ne chevauchaient ni :

- `src/main.ts` ;
- `src/runtime/v6-browser-agent-controller.ts` ;
- les tests du contrôleur ;
- le suivi OP01–OP31 ;
- le rapport fonctionnel du contrôleur.

La réconciliation conserve donc simultanément :

- le corpus et les runners Region ACTION6 intégrés ;
- le contrôleur navigateur unique ;
- le chemin Manual séparé ;
- le seam Worker disponible mais non instancié dans le produit ;
- les dispositions OP01–OP31 actualisées.

## Qualification GitHub Actions combinée

- run : `43352319786`
- job : `131646081995`
- commit qualifié : `39eca6250a1a3a7480cb9224a491fb8bdeb15f01`
- Node : `22.18.0`
- `npm ci` : réussi
- `npm run typecheck` : réussi
- régression TypeScript complète : **325/325 réussis**
- échecs : `0`
- annulés : `0`
- ignorés : `0`
- build Vite de production : réussi
- modules transformés : `48`
- catalogue généré : `100` jeux
- prévisualisations générées : `636`
- atlas d’images natifs : `4`
- rapport de câblage : `logos-product-wiring-present`
- fichiers source hors `src/logos-engine` analysés par la garde : `22`

La qualification confirme notamment :

- l’activation exclusive du contrôleur navigateur dans `main.ts` ;
- l’absence d’instanciation du seam Worker dans le produit ;
- le transfert Agent vers Manual après règlement du retour en vol ;
- l’absence de fallback d’action ;
- la limite dure d’actions ;
- la conservation de l’état `disposed` pendant une annulation en vol ;
- les contrats Worker et Region déjà intégrés ;
- la construction complète du site sans publication.

`npm ci` signale deux vulnérabilités de dépendances de sévérité haute déjà
présentes. Elles ne sont pas introduites par cette tranche.

## Nettoyage

Le workflow temporaire
`.github/workflows/op01-op31-browser-agent-controller-qualification.yml` a été
supprimé après la qualification combinée.

Commit de suppression :
`e23641b50e6b825736ff6d98967046691cf64c10`.

Le workflow ne doit pas être intégré dans la branche canonique. Les preuves de
son exécution restent dans GitHub Actions et dans le présent rapport.

## Performance

Cette qualification prouve la correction fonctionnelle, le typecheck, la
régression TypeScript, le build et le câblage. Elle ne ferme pas le critère C7
de performance des sessions complètes.

Le seuil reste strictement inférieur à +10 % de médiane pour chacun des jeux de
référence STCK et SMLP, sans compensation entre jeux.

Verdict :

**état combiné fonctionnellement qualifié ; coût officiel C7 à confirmer.**

## Publication

Aucune publication Site n’est incluse. La source durable reste GitHub. Toute
publication ultérieure devra partir du commit canonique d’intégration et être
vérifiée GitHub ↔ Site.
