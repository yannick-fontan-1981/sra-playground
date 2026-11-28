# Coexistence de 46 lignes SIC

Le moteur d’essai est `ba2e7c6b8d10e04edc149ff836c065178757c62d`, branche `experiment/sic-coexistence-quarante-six-lignes`, parent `09aeb9e14e40b6115269e47267b47ba8d71708fd`. La qualification croisée SEQN sur `b22cbb27` a fixé le périmètre. L’arbre `src` `643959c7759d4f9d07f01431717b7cf29b697952` et ses 33 fichiers différents du gel ont été contrôlés. TypeScript passe. [Fiche des 35 lignes parentes](sic-coexistence-09aeb9e1.md) · [Diff moteur](https://github.com/yannick-fontan-1981/sra-playground/compare/09aeb9e14e40b6115269e47267b47ba8d71708fd...ba2e7c6b8d10e04edc149ff836c065178757c62d)

Les 46 numéros sont **1, 2, 3, 4, 5, 11, 13, 14, 15, 16, 18, 22, 23, 26, 27, 28, 29, 31, 35, 36, 40, 41, 44, 47, 48, 52, 54, 57, 58, 61, 63, 66, 68, 69, 80, 81, 83, 84, 86, 87, 90, 91, 92, 96, 97 et 98.**

| Apport aux 35 | Provenance et contrôle prévu |
|---|---|
| 5 · TN36 | `0da75640`, arbre du gel. Recherche du code dans les deux époques, opérateurs distincts, finale seule et autre exemple. [Banc TN36](sic-qualification-tn36-0da75640.md) |
| 11 et 81 · SEQN | `b5dda8ec`, arbre du gel. Retrait du canal, modèle issu de la progression et deux tickets de même commande et paquet avec propriétaire différent. [Banc SEQN](sic-qualification-seqn-b5dda8ec.md) |
| 26 et 31 · WA30 | `14a185d9`. Blobs de couplage orienté et d’accès au premier contact. Vérifier acquisition et propriétaire dans les deux branches du T16. [Banc WA30](sic-qualification-wa30-14a185d9.md) |
| 40 et 54 · GRIL | `915e0601`, arbre du gel. Les preuves de changement de vue des T1 et T11 sont distinctes des soumissions T2 et T12. [Banc GRIL](sic-qualification-gril-915e0601.md) |
| 41 · TICT et SP80 | `e8df1757`, seul le fichier de placement est ajouté au parent qui contient déjà le routage SP80. Les tests des deux sélecteurs de SP80 peuvent désormais tourner ensemble. [Banc TICT/SP80](sic-qualification-tict-e8df1757.md) |
| 84 et 97 · AS66 | `484f3f0d`, accès statique isolé. L’accès horlogé a déjà sa preuve sur le gel. Les deux réglages et les retraits sont rejoués. Les sondes de 83 restent dans les contrôles de l’arbre commun. [Banc AS66](sic-qualification-as66-484f3f0d.md) |
| 86 · DICO | `d84d0b93`, bras de navigation avec le choix de partition 87 du parent conservé dans `v6-subset-diagnosis.ts`. Le blob combiné vaut `48bc80861831deac3325312d1acfee1722849e57`. Le fichier de l’ouverture 98 est identique à celui du parent. Les trois témoins portent sur ce même moteur. [Banc DICO/86](sic-qualification-dico-d84d0b93.md) |

## État du verdict

**Qualification en cours.** Le montage Git et le typage sont vérifiés. La campagne des 107 et les témoins locaux sont lancés sur cet arbre.

## Reproduire

Le commit `71a68c744d95c40367166f5e80a423cf23003e0a` ajoute le workflow des 24 lots à l’arbre moteur figé. Le run `46093798135` fournit les reçus destinés à l’audit suivant. [Campagne des 107](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46093798135)

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-ba2e7c6b/recus.zip --candidate ba2e7c6b8d10e04edc149ff836c065178757c62d --workflow 71a68c744d95c40367166f5e80a423cf23003e0a --run 46093798135
```

Reprendre les commandes de la fiche des 35 avec un checkout propre `$m` à `ba2e7c6b` et des dossiers de sortie neufs. Lancer les trois comparaisons DICO sur ce même checkout. `test-sic-coexistence.py` contient les trois conditions de 87 et `test-sic-coexistence-offres.py` contient les trois ordres d’ouverture de 98. Les deux défis publics peuvent réutiliser les reçus de référence de l’archive des 35. Ajouter les nouveaux contrôles :

```powershell
py -3.11 scripts/test-sic-coexistence-navigation.py $m ./dico-86
py -3.11 scripts/test-sic-coexistence-cavites.py AS66 $m ./as66
foreach ($jeu in 'TICT','WA30','TN36','GRIL','SEQN') {
  py -3.11 scripts/test-sic-coexistence-catalogue.py $jeu $m "./tests-$jeu"
}
```

Les sorties locales sont sous `artifacts/qualification-coexistence-46/`. Le run distant, ses reçus et l’état de reprise gardent chacun leur répertoire dans ce dossier.
