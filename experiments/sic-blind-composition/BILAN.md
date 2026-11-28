# Banc SIC à l’aveugle sur trois familles de mécaniques

Le banc fixe un maximum de 12 commandes et de 12 000 états de recherche par départ et par bras. Toutes les parties démarrent à froid. Le bras figé recherche un préfixe commun et peut sonder puis réévaluer. Le bras actif compose aussi des continuations conditionnées aux retours publics. Les deux utilisent le `composePlan` de production et les mêmes informations hypothétiques publiques. L’opérateur garde les mondes vrais et les traces détaillées hors du dépôt.

Le moteur de base est `fb8d6913addd23f5dd1cc375f96f9a69b2410b21`. Les deux candidats de banc conservent son arbre `src` exact, `c6be00220e0691619413e9244101f9c6a302c144`. Aucun des niveaux SS08–SS25 n’a servi au développement, à l’inspection ou au rejeu.

## Premier lot, comparateur isolé

Le candidat [f9d5b1fd](https://github.com/yannick-fontan-1981/sra-playground/tree/f9d5b1fdc0363f7f57b7f8ec56f6e57fc5fb8363/experiments/sic-blind-composition) a été figé après le scellement de la réserve par l’opérateur.

| Famille | Figé | Actif | Gain |
|---|---:|---:|---:|
| Fenêtre d’accès après un effet différé | 0/5 | 4/5 | +4 |
| Ordre d’actions couplées | 0/5 | 4/5 | +4 |
| Ressource et changement d’interface | 0/7 | 4/7 | +4 |
| **Total** | **0/17** | **12/17** | **+12** |

Le composeur gagne les douze cas robustement résolubles de l’oracle indépendant. Trois impossibles restent sans solution. Les deux mondes indiscernables produisent une abstention dès le départ dans les deux bras. Aucun geste illégal ni régression. Première décision différente au T1 dans cinq cas et au T2 dans sept, avec cinq parcours aux décisions identiques.

Les 8 gestes du bras figé et les 86 de l’actif incluent toutes les parties, avec 3 332 et 577 états de recherche respectivement. Aucun succès commun ne permet de comparer les gestes à résultat égal. Quatre acquis sont exportés sur les quatre transferts. Le retrait du seul acquis change une action exécutée dans un transfert. Les deux versions du transfert gagnent chacune quatre cas en 27 gestes cumulés.

Le réaudit indépendant a vérifié 42 bras et 148 transitions, les plafonds et la revalidation des acquis. Dans un cas ressource/interface, même geste et même retour public au T1. Le figé s’arrête au T2 et le composeur choisit une continuation conditionnelle, puis gagne en neuf gestes.

| Empreinte SHA-256 | Premier lot |
|---|---|
| Corpus privé | `57c3346c56f92d34e2027a69c517256b9b900d50baf63c59f5e1e5fd67e94d76` |
| Oracle et attendus privés | `224751527567f53092e1fa6d51d743872333d053c8cca8101655202279b9f8e4` |
| Résumé | `b940985492f047f84c18dc2553dccb2b9a0618bbb64de8d99ec289eb4319f3f3` |
| Reçu privé | `b6da5ba0ee02ec2bc4f174c9526e6add540190c1c131ed71fe864d940c8f0c30` |

## Deuxième lot, gestes autorisés par V6

Le candidat [c3f932fa](https://github.com/yannick-fontan-1981/sra-playground/tree/c3f932fa4e3e85e7827c74e9ee9cc874af5da943/experiments/sic-blind-composition) a rejoué une réserve fraîche, scellée avant sa remise. Chaque bras passe par le même service natif. Chaque geste joué a un ticket V6 et un retour comparé puis scellé.

| Famille | Figé | Actif | Gain |
|---|---:|---:|---:|
| Loquet et fenêtre différée | 0/4 | 3/4 | +3 |
| Séquencement couplé | 0/4 | 3/4 | +3 |
| Transport sous charge | 0/6 | 3/6 | +3 |
| **Total** | **0/14** | **9/14** | **+9** |

Les neuf cas robustement résolubles gagnent. Les trois impossibles restent sans solution et la paire indiscernable produit deux abstentions dès le départ, sans commande dans chaque bras. Aucun geste illégal ni régression. Première décision différente au T1 dans cinq cas, au T2 dans quatre, avec cinq parcours aux décisions identiques. Dans un cas de séquencement, le T1 donne le même geste et le même retour dans les deux bras. Le composeur agit à partir du T2 et gagne en neuf gestes.

Le figé joue 6 gestes et compte 1 328 états de recherche. L’actif joue 68 gestes et compte 463 états. Les trois acquis de transfert sont exportés. Deux modifient une commande qui est revalidée par son retour. Le bilan reste à trois victoires en 21 gestes avec ou sans rappel. Le réaudit indépendant couvre 34 trajectoires et 116 transitions avec leurs tickets et retours scellés, relectures à froid comprises.

| Empreinte SHA-256 | Deuxième lot |
|---|---|
| Corpus privé | `9835f6ee9514f8154764bb0cecd8f041e664fb221d10dfbfc740ec7af71c52ae` |
| Oracle et attendus privés | `46ec3890366e8d4cf29c45fad851cc496658286400df60a27978e12c672fb537` |
| Résumé | `f29b0da91b2bb2d070e7f69be6ae983f2c35f2c47bbad35f074fdf6d42c05a85` |
| Reçu privé | `939a688224728403e48edfc411a0e177b913af6a190d38ae7fa1f896e071433c` |

## Portée et suite

Le seuil préenregistré passe dans les deux lots. Le second confirme aussi le raccord d’une famille expérimentale au service V6 avec autorisation, retour et reprise effectifs. Les hypothèses sont fournies et les rasters du second lot encodent des vues symboliques. Le résultat qualifie la décision conditionnelle dans cette interface de banc.

Le prochain contrôle démarre sur des jeux sources autorisés. Les hypothèses y proviendront des observations et des mesures que le moteur acquiert pendant le jeu. Un premier témoin doit présenter deux besoins actifs au même retour public, comme poursuivre un accès ou confirmer sa condition d’ouverture. La comparaison gardera le même budget et vérifiera le premier retour qui change l’ordre des besoins, avant d’étendre à une autre mécanique. Le parcours SS08–SS25 reste scellé pendant cette validation.

Vérification de développement sous Node 24 avec `node --test experiments/sic-blind-composition/comparison.test.mjs`. Quatre tests passent. L’opérateur peut rejouer le banc avec `node experiments/sic-blind-composition/compare.mjs --cases <corpus> --sha256 <empreinte> --report <reçu>` et ajouter `--native` pour le second lot.
