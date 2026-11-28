# Réception P05 — SIC SYNC et opérateur indépendant

**Statut : paquet publié et prêt à transmettre. Les canaux de SIC SYNC et de l’opérateur indépendant ne sont pas identifiés ; aucun message adressé ni accusé de réception n’est revendiqué.**

## Source à figer

- Dépôt : `yannick-fontan-1981/sra-playground`.
- Branche : `feat/sic-p05-acquisition-dev-20261128`.
- Base imposée : `20433007224accc36e3d7976696d9ee7a783a227`.
- **SHA candidat évalué : `3e33f0f6610f28484200ed915723c39f45302f7b`.**
- [Bilan](sic-p05-development-results.md), [protocole](sic-p05-development-protocol.md), [rapport machine](sic-p05-development-evidence/report.json).
- [Run GitHub Actions](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46153159758).

## Résultats de développement remis

8 000 situations résolubles et 8 000 signatures distinctes, mille par famille, après un pilote de 80. Le candidat acquiert 31 510 effets contextualisés sans attribution erronée ni preuve injustifiée. Les huit mille ablations ciblées et compositions P09 passent. Les mille décisions discriminantes F8 sont choisies publiquement puis rejouées indépendamment.

Le sous-système figé enregistre 29 180 déplacements bruts et couvre les mouvements de 7 000 situations. Les mille différences de mouvement portent sur les effets différés F4. L’API complète de qualification est absente à cette frontière figée ; son zéro ne constitue pas un verdict du moteur SIC entier.

Les 13 345 tentatives stationnaires, 2 330 références de preuves anciennes, 96 contrastes et deux témoins scalaires ont des compteurs séparés. **Zéro partie native exécutée et zéro victoire native déclarée.**

## Reproduction publique

Node 24, au SHA indiqué :

```sh
node scripts/sic-p05-campaign.mjs --per-family 10 --seed 26112805 --out artifacts/sic-p05-pilot
node scripts/sic-p05-campaign.mjs --per-family 1000 --seed 26112805 --out artifacts/sic-p05-development
```

Les graines de développement sont 26113814, 26114823, 26115832, 26116841, 26117850, 26118859, 26119868 et 26120877. Elles ne sont pas des graines de réserve.

Empreinte des 8 000 lignes : `550d734c0ace53d7670aca970015014b07665f61782fcc6d4787639ad4d56704`.

Empreinte de l’ensemble des signatures : `465d30d1f70b0a16e4a70c393d12c3b7aa90bfcea94071a6fa360e62f336acd3`.

## Interface de réception indépendante

L’opérateur conserve ses graines, structures et 2 000 situations dans son propre environnement. Le présent lot n’a ni produit ni lu ces données. Aucun commutateur de réserve n’est fourni par le générateur de développement.

Les modules d’évaluation sont exportables : `certifyP05(spec)`, `verifyP05Claim(spec, history, claim)` et `compareP05Situation(spec)`. Le schéma d’entrée et ses hypothèses sont définis dans le protocole. Les lois privées et le certificat restent dans le processus d’évaluation ; seuls le contrat public et les retours sont remis au registre candidat.

Avant de compter un cas indépendant, vérifier que son domaine respecte le contrat annoncé. Un cas qui introduit un état persistant non observé, une phase cachée ou un délai non borné relève d’un autre domaine ; le conserver comme contraste et le signaler, sans changer silencieusement le quota ou les règles. Une certification trop coûteuse n’est pas une preuve d’impossibilité.

La réception doit garder séparément la résolubilité, les acquisitions, les erreurs, les abstentions, le coût et les victoires natives. Pour les gains, retirer seulement l’observation qui établit le lien et ses alias, conserver les autres retours, puis distinguer une autre preuve utilisable d’une récupération injustifiée du retour retiré.

**SS08–SS25 restent sous scellés.** Cette livraison n’autorise ni ne prétend avoir effectué leur ouverture. Toute intégration du registre dans le worker natif reste distincte, avec les tests de transfert et de continuité imposés par `AGENTS.md`.
