# Remise à l'opérateur indépendant — P14

**SHA du code à évaluer : `05b9e74ad2a293ac91420d6f727b873f82c99686`.**

Base figée : `20433007224accc36e3d7976696d9ee7a783a227`.
Branche : `feat/sic-p14-temporal-dev-20261128`.
Node utilisé : `24.22.3`.
Empreinte des sources exécutables : `a0daee679f53af0d70a4b583cb4d7e9cfec2af516d3adb76817dabed0c8f3895`.

Les **2 000 situations réservées restent sous votre contrôle**. Elles n'ont été ni consultées ni produites pendant le développement ; SS08–SS25 n'ont pas été exécutés. Le générateur livré ne constitue pas une réserve indépendante.

## Contrat d'entrée

Le contrat complet est `scripts/sic-p14/PROTOCOL.md`. Le sujet reçoit exclusivement `spec.public`, `spec.budget`, puis les observations. Les mondes, horloges, graines, familles, certificats et solutions restent dans le processus d'évaluation. Le comparateur ne transmet aucun de ces champs au sujet.

API réutilisable sur vos propres situations, sans appeler le générateur de développement :

```js
import { certifyPolicy } from './scripts/sic-p14/oracle.mjs';
import { compareCase } from './scripts/sic-p14/compare.mjs';

// privateSpec reste chez l'opérateur ; il respecte PROTOCOL.md.
const certificate = certifyPolicy(privateSpec, { includePolicy: false });
if (!certificate.solvable) {
  // Distinguer absence de certificat et borne de recherche atteinte.
  throw new Error(certificate.reason);
}
const receipt = compareCase(privateSpec, { ablate: true });
// Conserver certificate et receipt côté évaluation, sous vos scellés.
```

Les budgets de développement sont 180 gestes, 360 ticks et 20 000 états de composition/recherche. Comparer les deux bras sous les mêmes plafonds. La réussite d'une situation exige la réussite qualifiée de tous ses mondes déclarés. Les gardes des mouvements, transitions indépendantes, mesures, premiers écarts et ablations sont produits par le même comparateur.

## Référence de développement, non résultat réservé

Graine publique : 26112814 ; quotas : 1 000 cas pour chacune des huit familles. Figé 767 / 8 000, candidat 7 844 / 8 000, 7 083 gains et six régressions. Les régressions, les limites d'induction et le domaine fini de la preuve oracle sont documentés dans le bilan ; aucun taux de victoire native n'est déduit de ces chiffres.

```bash
git switch --detach 05b9e74ad2a293ac91420d6f727b873f82c99686
node --test tests/sic-p14-*.test.mjs
node scripts/sic-p14-campaign.mjs --count 8000 --seed 26112814 --state artifacts/sic-p14/development-8000
```

Empreinte déterministe attendue pour ce développement :
`defe844d64e8ffbe9cd2656a054d324bc96bba9df3141ea025c1f7b3376a85e4`.

## Réception

Ce message est prêt et publié avec le dossier. L'identité routable et le canal exact de l'opérateur n'ont pas été retrouvés ; aucune transmission directe ni aucun accusé de réception ne sont présumés. Le SHA et cette interface peuvent être remis sans ouvrir la réserve.
