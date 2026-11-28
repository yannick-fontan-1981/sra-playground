# FT09 · ligne 94 · tester une contrainte soutenue par plusieurs fenêtres

Le témoin de catalogue est N1/T1 `window_constraints / multiscale_constraints / public_window_constraint / ACTION6`. Le départ est L1, ouverture native, 16 gestes de session et 600 par niveau. Le rejeu compare `8ce7ee35` et le gel `d0e7527c`. Le préfixe reproduit les quatre tickets de la stratégie. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères](ATTENDUS.md)

## Du motif répété au clic

Le fournisseur mesure quatre sources aux origines (12,10), (46,10), (12,44) et (44,44). Les glyphes 3 × 3 sont lus dans les cellules de 6 × 6, au pas 8 × 8. La règle retient l’ancre (1,1) et attribue au symbole 0 le rôle d’égalité et au symbole 2 celui de différence. La vérification par fenêtre laissée de côté obtient 28 accords sur 32, contre 20 pour la référence constante. Une seule mise en correspondance subsiste.

La règle induite donne 32 contraintes, dont quatre en désaccord. La cellule (36,36) de palette 9 est comparée à la palette 8 fournie par la fenêtre (44,44). Le service autorise le point (38,38), unique commande de cette cellule dans les entrées courantes. La première offre suppose une contrainte, avec effet du clic encore inconnu. La garde contrôle l’adresse, la valeur uniforme et l’empreinte de la projection avant d’émettre. [Induction, contrainte et retour](../../../src/logos-engine/v6-field-constraints.ts)

| Tour | Décision et observation |
|---|---|
| T1 | `ACTION6(38,38)` mesure la réécriture 9→8, qui satisfait la contrainte. Deux pixels changent hors du champ lié. Le ticket donne `matched:null` et se scelle. |
| T2 | `ACTION6(38,46)` mesure la même réécriture à la deuxième adresse distincte. Le geste reste une question ouverte. |
| T3–T4 | Les deux réécritures permettent de prévoir la valeur 8. Le T3 confirme la première projection. Le deuxième pas du même plan valide N1 au T4 et se scelle à la frontière officielle. |

## Contre-épreuves

| Intervention | Résultat vérifié |
|---|---|
| Ne laisser qu’une source à l’inférence T1 | La mesure physique est identique. Avec le seul glyphe (12,10) transmis à l’inférence, le fournisseur ne produit aucune contrainte. La frontière clique (12,10). La contrainte reprend au tour suivant. |
| Retirer le point (38,38) des entrées du seul fournisseur T1 | Le champ et les quatre violations sont identiques. Le service autorise (38,46), et le vrai retour réécrit la cellule (36,44). |
| Présenter l’ancien plateau après le vrai ticket T1 | Le paquet physique reste celui du jeu. Sur l’image présentée, aucune réécriture n’est acquise. La valeur 9 à cette adresse est marquée comme essayée. Le prochain ticket utilise (38,46). |
| Au T3, offrir au planificateur une seule des deux réécritures acquises | Même contrainte, même clic (38,54) et même paquet physique. La prévision de valeur 8 disparaît, le plan est ramené à une seule question et le retour donne `matched:null`. |

## Comparaison avec HPDL/75

| Vrai ticket | Besoin courant | Preuve qui autorise le clic et rôle du retour |
|---|---|---|
| HPDL N1/T4 `ACTION6(14,30)` | Mettre les champs des deux boîtes dans une configuration de couverture conditionnelle du mot courant. | La méthode de même signature issue de T3 ouvre le calcul `plansCooperative` du noyau de fenêtres. Le DRM choisit le réglage. Le retour mesure un changement de capacité. |
| FT09 N1/T1 `ACTION6(38,38)` | Tester une cellule qui contrevient à la règle d’égalité ou de différence inférée sur des fenêtres répétées. | `induceFields` et `fieldConstraints` construisent la contrainte depuis les quatre sources de l’image courante. Le retour mesure une réécriture et contrôle la contrainte. Il faut deux réécritures distinctes pour en prédire une troisième. |

Les deux tickets emploient l’opération native `OP18`, un point rattaché à l’observation courante et l’objectif parent `G_official_completion`. Leurs premiers retours scellent une question à effet ouvert. Le service conserve l’autorité d’émission. HPDL régénère l’offre avec sa méthode et sa géométrie. FT09 revalide le point dans la cellule et l’empreinte du champ projeté. Les calculs et les besoins locaux sont propres à chaque fournisseur. [Fournisseur HPDL](../../../src/logos-engine/v6-window-question.ts) · [Verdict et reçu HPDL](https://github.com/yannick-fontan-1981/sra-playground/blob/fd09caee/experiments/sic-agenda-offres/hpdl-75/VERDICT.md)

**Attribution.** Le gel consomme la règle répétée, rattache son offre au service, mémorise les effets et les utilise pour la reprise. La qualification exerce ces articulations du moteur avec le vrai jeu.

## Rejouer

Depuis le checkout avec Node 24+, Git, tar, Pyodide local et le reçu HPDL vérifié.

```powershell
$d = 'experiments/sic-agenda-offres/ft09-94'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$hp = '../sic-hpdl-75/artifacts/qualification-hpdl-75/66ce0494.json'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --hpdl $hp --recu "$env:TEMP/ft09-94.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante sans-adresse --point '38,38' --pyodide $py --recu "$env:TEMP/ft09-sans-adresse.json"
```

Le vérificateur joue six préfixes FT09 et vérifie l’empreinte du reçu HPDL. Le rejeu HPDL au SHA `66ce0494` régénère ce reçu. Le harnais conserve les pré-événements, les tickets, les retours et les empreintes de progression. [Harnais](operateur.mjs) · [Assertions](verifier.mjs)
