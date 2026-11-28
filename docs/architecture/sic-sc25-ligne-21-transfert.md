# SC25, ligne 21 — réemploi d'un motif avant ouverture

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le
[parcours officiel](https://github.com/yannick-fontan-1981/sra-playground/blob/6172e2d3579f36af9c0912578f6d58333a298343/docs/architecture/sic-sc25-ligne-21.md)
établit l'invocation du T15. Les
[terrains construits](https://github.com/yannick-fontan-1981/sra-playground/blob/4dcc659183c31502edcca85f29d661426660a426/docs/architecture/sic-sc25-ligne-21-acces.md)
établissent le déplacement depuis le support devenu visible. Cette
preuve est conservée quand on retire le reçu historique. Le présent
lot demande si le lien appris change le choix dans une vue dont
la voie demeure fermée.

- Constituer le lien sur des retours de la même famille. Vérifier le
  motif exécuté, le corps, le support inaccessible, le récepteur
  et les références d'observation. Distinguer l'obstruction
  constatée, les échantillons d'effet et l'hypothèse de liaison.
- Dans une deuxième situation fermée, rendre deux motifs admissibles
  géométriquement. Avec la preuve valide, exécuter celui que le
  propriétaire associe au récepteur courant. À même raster et même
  contrôle, retirer seulement cette liaison ou réfuter sa projection.
  Identifier le premier motif ou repli différent.
- Jouer les vrais tickets de variante et mesurer la différence de
  support après le motif choisi, puis au moins un déplacement dont
  l'empreinte entre sur le support neuf. Préserver la marche directe
  si le même support et le vecteur sont déjà observables.
- Examiner d'abord `infer_ray`, `aimFromPaths` et le choix des
  cartes de `packageProposal` dans le service. Isoler un correctif
  seulement après avoir reproduit et gelé une première décision
  erronée avec les preuves ci-dessus. Les variantes construites,
  l'épisode officiel et les éventuels changements du moteur ont
  chacun leur portée.

[Opérateur, terrain ouvert](https://github.com/yannick-fontan-1981/sra-playground/blob/bb57dc9923b0ad4b3233bd00347a430a0aaf0403/experiments/symbolic-situations/sc25-ligne-21-acces/BILAN.md)

## Le choix avant l'ouverture

Le harnais reprend la géométrie d'un panneau et d'un récepteur
des fixtures de référence. Le terrain construit calcule les
poses, les contacts, les pixels de support et les trames
intermédiaires à partir du ticket joué. Les deux bras suivent
la même histoire et passent par le `V6AgentService` du gel.

| Tour | Terrain et preuve | Décision ou retour |
| --- | --- | --- |
| T1–T3 | ACTION2 et ACTION4 établissent les vecteurs (0,1) et (2,0). Le premier essai de marcher vers [7,4] échoue. | Le propriétaire inscrit une obstruction liée à l'empreinte du corps et à la projection bloquante. |
| T4–T5 | Le service prépare le motif [0,3] et l'active par (7,24). Le corps reste en [5,4]. | Deux trames relèvent les centres du signal (21,9) puis (25,9), en coordonnées doublées. Une seule boîte stable [25,3,29,8] relie leur couleur à celle de l'obstacle [7,4,8,4]. Le reçu conserve cette hypothèse, le motif et la référence 6. |
| T6–T7 | Le corps emprunte l'espace contournant le premier obstacle et arrive en [7,5], orienté à droite. | Les deux mouvements sont confirmés. La voie devant la nouvelle pose demeure fermée. |
| T8–T9 | Même raster, mêmes vecteurs et même panneau, avec deux motifs admissibles. | Avec le reçu du récepteur, le service rejoue [0,3]. Au retrait seul du lien, en conservant la référence de l'invocation antérieure, il essaie [1,2]. Les deux choix sont joués. |
| T9–T10 | Les deux invocations effacent les bits. Avec [0,3], six pixels de la rangée 6 deviennent praticables. Avec [1,2], ils restent vides. | Le moteur libère `walk` ACTION4 dans la première situation. Le corps entre en [9,5] sur l'empreinte ouverte. Le vrai reçu de cette variante confirme le pas. |

`infer_ray` forme l'hypothèse à partir de deux centres
observés, du récepteur stable et de l'obstruction déjà
mesurée. `aim_path` ou sa variante bornée revalide la
projection du récepteur. `aimFromPaths` utilise alors
l'alignement retrouvé pour désigner la carte avant que la
route existe. Sans ce lien, `packageProposal` départage
les cartes admissibles et préfère celle qui reste à essayer.

L'ouverture du support produit ensuite une preuve distincte
pour le déplacement. À ce stade, le test indépendant du
précédent lot a confirmé qu'un support visible et un vecteur
acquis suffisent à marcher. Le présent témoin rattache le
choix du motif à un reçu réutilisé avant cette observation.
Il couvre deux poses dans la même époque construite et une
obstruction, avec un seul corps mobile. Le parcours officiel
SC25 reste dans la portée de son propre reçu. Le moteur du
gel contient déjà l'articulation employée ici.

## Reproduction

Node 24, à partir de ce lot. Le moteur d'un autre checkout peut
être chargé par `SIC_SC25_TRANSFER_ENGINE_ROOT`.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-sc25-motif-transfer.test.ts tests/v6-motif-access-kernel.test.ts tests/v6-motif-access-contract.test.ts tests/v6-motif-access-reference.test.ts
```

Le test d'intégrité des références historiques compare les
octets Git en LF. Le rejeu des tests emploie ces octets dans
un checkout Windows qui applique la conversion CRLF.

[Test du choix et des retours](../../tests/sic-sc25-motif-transfer.test.ts) ·
[Mesure, réemploi et garde](../../src/logos-engine/v6-motif-access.ts)
