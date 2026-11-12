# OP01–OP31 — preuve spécialisée du chemin Region

## Portée

Cette note qualifie un chemin runtime réel apparu dans la reconstruction canonique :

`RegionInterventionModel → RegionInterventionOwner → RegionCallerOwnerAdapter → NeutralCommonCaller`.

Elle ne transforme pas ce chemin en appels OP génériques.

## Chaîne de preuve

### Besoin identifié

Un mécanisme Region a déjà été appris sur un séparateur observé. Un nouveau
séparateur candidat est rencontré dans la même époque, avec l'action apprise
toujours disponible.

Le besoin concret est :

**tester si la méthode Region apprise se transfère à ce nouveau séparateur**.

### Données produites

`RegionInterventionModel.propose()` produit seulement si :
- la méthode existe ;
- elle n'est pas contradite ;
- l'époque correspond ;
- l'action apprise est disponible ;
- le séparateur candidat n'est pas déjà dans les preuves.

La proposition contient :
- `methodRef` ;
- `separatorRef` ;
- `actionRef` ;
- `expectedEffectKey` ;
- `expectedAffectedRegions` ;
- `evidenceCount`.

### Appel justifié

`RegionCallerOwnerAdapter.propose()` expose cette proposition au
`NeutralCommonCaller`.

Le caller :
- ne sélectionne que s'il existe exactement une proposition ;
- retourne `ambiguous` si plusieurs propositions existent ;
- n'invente aucune priorité.

### Résultat

Après exécution physique externe, `routeSelected()` route le retour au seul
owner sélectionné.

`RegionInterventionOwner.acquire()` déduplique l'événement et appelle
`RegionInterventionModel.observe()`.

Le retour est classé :
- `learned` ;
- `confirmed` ;
- `contradicted` ;
- `stale`.

### Consommateur

Le consommateur réel est le modèle Region lui-même.

En cas de contradiction :
- `contradicted = true` ;
- la contradiction est conservée ;
- `propose()` retourne ensuite `undefined`.

### Effet sur la décision

L'effet décisionnel est démontré :
**un retour contradictoire supprime les propositions Region futures pour cette méthode.**

Les tests existants
`tests/v6-region-caller-integration.test.ts` couvrent :
- apprentissage passif ;
- proposition ;
- sélection ;
- acquisition du retour ;
- déduplication ;
- contradiction ;
- arrêt des propositions futures ;
- absence de proposition lorsque le contexte manque.

## Relation aux opérations Logos

### OP06 — Exceptions

Besoin OP06 :
confronter un retour à un effet attendu et restreindre/réfuter le modèle.

Disposition sur le chemin Region :
**fonction spécialisée équivalente démontrée.**

`RegionInterventionModel.observe()` compare directement le retour à la méthode
apprise, enregistre la contradiction et retire l'autorité de proposer.

Aucun appel OP06 supplémentaire n'est justifié sur ce chemin.

### OP29 — Comparer

Besoin OP29 :
comparer attentes et propriétés observées.

Disposition sur le chemin Region :
**fonction spécialisée équivalente démontrée pour cette famille.**

La comparaison est incorporée à `observe()` :
action, effet, époque et régions affectées doivent correspondre.

Le résultat générique OP29 reste `information_only` dans le moteur de
composition reconstruit, mais ce chemin Region possède un consommateur
spécialisé décisionnel.

Aucun raccord OP29 n'est ajouté.

### OP30 — Réviser

Besoin OP30 :
réviser une connaissance à partir d'une preuve courante.

Disposition sur le chemin Region :
**fonction spécialisée équivalente démontrée.**

Le modèle Region conserve :
- preuves confirmées ;
- contradictions ;
- dernière révision ;
- statut `contradicted`.

Ces données sont ensuite relues par `propose()`, donc la révision influence
une décision future.

Cela dépasse le `persisted_only` du chemin OP30 générique sans pour autant
constituer un appel OP30.

## Sauvegarde / restauration

`RegionInterventionOwner.snapshot()/restore()` conserve :
- le modèle Region ;
- les événements déjà acquis.

`NeutralCommonCaller.snapshot()/restore()` conserve :
- les owners ;
- les clés d'événements déjà routées.

La déduplication du retour reste donc préservée à travers la restauration.

## Conclusion

Pour cette famille :

**besoin → données → proposition spécialisée → sélection → retour → acquisition → comparaison/révision spécialisée → arrêt ou poursuite des propositions**

est démontré.

Disposition OP :
- OP06 : fonction spécialisée équivalente ;
- OP29 : fonction spécialisée équivalente sur Region ;
- OP30 : fonction spécialisée équivalente avec effet décisionnel futur.

Aucun compteur OP n'est augmenté et aucun appel générique n'est ajouté.
