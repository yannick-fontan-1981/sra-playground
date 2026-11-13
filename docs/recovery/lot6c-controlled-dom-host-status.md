# Lot 6C — qualification sur hôte DOM contrôlé

Branche de travail :
`recovery/lot6c-controlled-dom-host-20261112`

Baseline de départ :
`recovery/site109-reconstruction-20261112` à `1a2e1e3793b653c96472701359bcc86b422cb19d`.

## Contexte vérifié

La baseline canonique contient déjà le raccordement réel :

`main.ts present() → presentProductObservation() → ports DOM/état réels`

Elle contient également :
- les 7 contrats du séquenceur d'effets ;
- les 4 gardes structurelles du raccordement `main.ts` ;
- les qualifications antérieures du dispatch et du transport Worker.

Cette étape ne duplique pas le raccordement. Elle ajoute une qualification comportementale sur un hôte DOM contrôlé reproduisant les ports réels de `main.ts` : URL, history, état mutable, peinture, attente, interface, busy et feedback.

## Tests frais

Commande locale :

`node --experimental-strip-types --test tests/product-presentation-controlled-dom-host.test.ts`

Résultat : **6/6 PASS**.

Contrats :

1. Le chemin heureux préserve les paramètres URL existants et le hash, ajoute `game` / `level`, adopte l'observation, remet `loading` / `failed` à zéro, peint les frames puis la frame finale, libère `busy`, met l'interface à jour et publie le feedback terminal.
2. Une URL déjà synchronisée ne provoque aucun `history.replaceState` redondant.
3. Un jeu sélectionné différent rend la présentation stale sans aucun effet DOM, history, paint ou état.
4. Un changement de génération de sélection pendant l'animation bloque la frame finale, le feedback tardif et la libération de `busy`.
5. Une présentation supersédée pendant l'animation bloque également tous les effets finaux.
6. Avec `releaseBusy=false`, le dispatch conserve la propriété de `busy`, tandis que l'URL, la frame finale et le feedback sont bien produits.

## Typecheck

Typecheck strict du code de production concerné : **PASS**.

Fichiers couverts :
- `src/product-presentation.ts` ;
- `src/product-presentation-effects.ts` ;
- contrat `GameObservation` minimal correspondant.

Le typecheck du fichier de test isolé n'est pas revendiqué dans le checkout de reconstruction minimal, car les déclarations `@types/node` n'y sont pas installées. Le test lui-même s'exécute avec le runtime Node 22 et passe 6/6.

## Portée

- aucun code production modifié ;
- aucun vrai jeu démarré ;
- aucun payload GABA/KLOT rouvert ;
- aucun navigateur complet ou bundle compilé lancé ;
- aucune publication Site ;
- aucune mesure officielle STCK/SMLP.

Statut : **fonctionnellement qualifié sur hôte DOM contrôlé, performance officielle à confirmer**.

## Prochaine étape

Renouveler la qualification sur un navigateur ou bundle compilé de la reconstruction GitHub courante, avec le vrai `main.ts`, le vrai canvas et un Worker synthétique, avant de reprendre une campagne réelle ou une décision de publication.
