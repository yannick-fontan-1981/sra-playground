# Coexistence de 65 lignes SIC sur le moteur des 55

Le seuil est figé par les deux verdicts ZIPP/67 et 71, Banc `1efbe439` et opérateur `91fd9583`. Les dix numéros ajoutés sont **19, 20, 32, 39, 42, 45, 67, 71, 75 et 88**. Leur qualification individuelle porte sur le code du gel. Aucun blob de ces branches de preuve n’est importé dans le moteur assemblé.

**Les 65 lignes coexistent sur `674b0dd19d693a66687990ab2a4368d981aa8fb9`.** Les neuf groupes ci-dessous ont été rejoués sur ce SHA. Le jalon conserve la chaîne de qualification du périmètre à 55 sur ce même moteur. [Index complet](sic-coexistence-65-674b0dd1/index.json) · [Reçus des nouveaux témoins](sic-coexistence-65-674b0dd1/temoins.zip) · [Assemblage à 55](sic-coexistence-674b0dd1.md)

| Numéro | Vérification sur l’assemblage |
|---|---|
| 19 · ELAS | Deux scénarios. Échelles 2:1 et 3:1, scellement du T5 lors du changement de cible et rejet du même ACTION1 pour un autre receveur. [Banc](sic-qualification-elas-280a54b5.md) |
| 20 · LS20 | Trois scénarios. Déplacement, preuve sélective et liaison de route de T7 à T14. [Banc](sic-qualification-ls20-a0af03d0.md) |
| 32 · KATA | Trois scénarios. Aperçu et retrait du contrôle au T18 à vue égale. [Banc](sic-qualification-kata-d22d706c.md) |
| 39 · TU93 | Six préfixes. Deux déplacements du trajet, retrait de la mesure et essai scellé. [Banc](sic-qualification-tu93-49a971c3.md) |
| 42 · CATR | Cinq préfixes. Réglage 12→10, rôle du même clic ultérieur et garde liée à la vue. [Banc](sic-qualification-catr-9186a49e.md) |
| 45 · CWSE | Cinq préfixes. Même ACTION4 en question ou en accès. Les quatre pas N3 et le contrat de liaison CATR demeurent observables. [Banc](sic-qualification-cwse-71e15295.md) |
| 67 et 71 · ZIPP | Quatre scénarios. Préfixe de trace de six gestes ou un geste selon les acquis. À N2/T14, contour lié, zéro pixel et résultat ouvert. [Banc](sic-qualification-zipp-421dc6a5.md) |
| 75 · HPDL | Cinq préfixes. Méthode de même signature, erreur de réglage puis réessai et vrai passage en N2. [Banc](sic-qualification-hpdl-66ce0494.md) |
| 88 · DC22 | Deux scénarios. T9 reconfigure, puis T11 admet ACTION1 uniquement sur la surface portée par la garde. [Banc](sic-qualification-dc22-d713024a.md) |

## Campagne reprise

Le workflow `d4c1203cffef75ab9fed4e0a6de7964c4f02dedb` diffère du moteur par son seul fichier GitHub Actions. Les arbres `src`, `public/python` et `reference`, les dépendances Node, le lanceur, la liste des jeux et les paramètres historiques ont les mêmes identifiants Git. Le moteur source est strictement le même commit. La campagne **46096543568** fournit les **107 jeux, 692 niveaux et 18 560 gestes**, de nouveau réconciliés avec le gel. Les reçus ont la précision du parcours historique. Les neuf groupes supplémentaires exercent les décisions et retours ciblés, y compris leurs épreuves de retrait. [Campagne réutilisée](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46096543568) · [Reçus](sic-coexistence-674b0dd1/recus.zip)

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-674b0dd1/recus.zip --candidate 674b0dd19d693a66687990ab2a4368d981aa8fb9 --workflow d4c1203cffef75ab9fed4e0a6de7964c4f02dedb --run 46096543568
```

Depuis le banc, avec `$m` à `674b0dd1`, Pyodide préparé, Node 24 et de nouveaux dossiers sous `$out` :

```powershell
foreach ($jeu in 'KATA','LS20','DC22','ELAS') {
  py -3.11 scripts/test-sic-coexistence-catalogue.py $jeu $m "$out/$jeu"
}
foreach ($jeu in 'TU93','CATR','CWSE','HPDL') {
  py -3.11 scripts/test-sic-coexistence-recall.py $jeu $m "$out/$jeu"
}
```

Les trois captures ZIPP sont reprises par la commande de la fiche ZIPP. L’archive des témoins associe chaque reçu assemblé au SHA du moteur et à l’empreinte du reçu indépendant correspondant. Le chantier garde `main` sur le gel `d0e7527c`.
