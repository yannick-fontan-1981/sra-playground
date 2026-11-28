# SC25, ligne 21 — accès après l'activation d'un motif

## Critères préenregistrés

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le précédent
lot `6172e2d3` a retrouvé le catalogue SC25 depuis N1, dont
l'invocation officielle du T15. Garder cette trajectoire distincte
des configurations ci-dessous et de tout verdict de qualification
du jeu.

1. Dans deux configurations construites, le corps bicolore calibre sa
   direction par un déplacement exécuté. Une piste mène à une cible
   encadrée mais une coupure empêche de la rejoindre. La seconde
   configuration tourne la piste et le pas mesuré d'un quart de tour.
2. Rejouer chacune avec le même état public jusqu'à la même commande
   d'invocation, selon que le motif active ou laisse intacte la piste.
   Les bits s'effacent dans les deux cas. Mesurer la seule différence de
   support après le retour, la référence lue et le premier ticket
   différent. La seconde configuration conserve le même panneau.
3. En cas d'ouverture, jouer jusqu'au premier pas dont le corps occupe
   une portion de support qui manquait auparavant. Contrôler la
   direction mesurée, la garde et le retour physique de ce pas. En
   l'absence d'ouverture, relever le repli et son exécution.
4. Passer par le véritable `V6AgentService` et ses tickets. Le petit
   environnement calcule les déplacements et les obstacles sur le
   raster. Il ne renvoie aucun paquet présélectionné selon le numéro du
   tour. Une anomalie causale hypothétique ferait l'objet d'un écart
   préenregistré avant tout changement au moteur.

## Ce qui ouvre la marche sur le gel

Le harnais reprend uniquement le raster initial de la fixture de
géométrie du motif. Un petit terrain indépendant calcule les réponses
à partir des coordonnées du corps, du support, de l'état des bits et
de la commande du vrai ticket. Les deux terrains partagent le panneau
et le même clic d'invocation. Ils diffèrent par l'axe d'alignement du
corps, de la coupure et de la cible. Chaque paire reprend exactement le
même raster public avant la libération du clic.

| Configuration | Contrôle acquis au T1 | T3, même ACTION6(7,24) | Premier pas dépendant de l'ouverture |
| --- | --- | --- | --- |
| Piste horizontale | ACTION4, déplacement (2,0) jusqu'à [5,4] | Le motif [0,3] efface les bits. Avec activation de la piste, dix pixels publics de support apparaissent. | T4 atteint [7,4] sur l'ancien support. T5 atteint [9,4] et le corps occupe la première colonne ajoutée. |
| Piste verticale | ACTION4, déplacement (0,2) jusqu'à [11,3] | Même motif et même effacement. Les dix pixels de support apparaissent dans l'autre axe. | T4 atteint [11,5] sur l'ancien support. T5 atteint [11,7] et le corps occupe la première ligne ajoutée. |

Pour chaque configuration déconnectée, le même retour d'invocation
efface les bits et conserve la pose et la piste. Le service libère
`toggle` ACTION6(7,20), dont le retour active le bit du motif
alternatif en laissant le corps immobile. Après ouverture, il libère
`walk` ACTION4. T5 est admis et son déplacement est confirmé dans
les deux configurations. Le reçu de T5 est acquis lorsque le
préfixe se ferme. Le jeu construit ne produit aucun gain officiel.

Les tickets suivants citent la référence de la calibration et celle
de l'invocation courante. `MotifAccess.record` mesure le déplacement
cardinal et retient l'effacement parmi les observations d'invocation.
`motifRoute` teste l'empreinte du corps sur le support réellement
visible. `packageProposal` utilise la route et le vecteur acquis
pour préparer le préfixe. `before` vérifie le corps, l'époque et
les bits du ticket et `after` compare le retour physique. À bits
effacés et commande identique, la différence de support suffit à
changer l'enchaînement.

## Portée

Ce témoin établit le lien causal sur la variante construite et le
raccord complet au service du gel. Le [témoin officiel SC25](https://github.com/yannick-fontan-1981/sra-playground/blob/6172e2d3579f36af9c0912578f6d58333a298343/docs/architecture/sic-sc25-ligne-21.md)
établit l'invocation, son effacement et la reprise dans une autre
famille. La consommation de l'ouverture dans un épisode officiel SC25
reste à établir. La ligne 21 reste partielle au compteur strict.
Le moteur du gel suffit pour les deux terrains et leurs replis.

## Reproduction

Depuis la branche de qualification, sous Node 24. Le terrain utilise
une fixture Git et le service local. `SIC_SC25_ACCESS_ENGINE_ROOT`
permet la comparaison de deux moteurs avec le même harnais.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-sc25-access-transition.test.ts tests/v6-motif-access-kernel.test.ts
```

[Test du service](../../tests/sic-sc25-access-transition.test.ts) ·
[Propriétaire du motif](../../src/logos-engine/v6-motif-access.ts) ·
[Calcul de route](../../src/logos-engine/v6-motif-access-geometry.ts)
