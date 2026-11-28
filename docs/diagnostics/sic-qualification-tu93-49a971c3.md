# TU93 · ligne 39, accès par transitions alternées

**Ligne 39 qualifiée sur le gel.** Six préfixes rejoués sur le vrai jeu entre 23:03:38 et 23:06:13 le 27 novembre (UTC−3). Harnais `49a971c37982154ea175294afffdf83469c1c302`, critères `f27f6439`, même arbre moteur que `d0e7527c`. Le nominal historique `8ce7ee35` concorde. [Reçus](sic-tu93-49a971c3/recus.zip) · [Contrôles](sic-tu93-49a971c3/banc.json)

- **Offre et retour.** Après quatorze essais, le calcul trouve un graphe de 31 nœuds, 32 arêtes et une projection de 18 gestes. Le plafond permet d’en jouer deux. T15 `ACTION4` lit la translation [0,+6] acquise au vrai T4 pour la signature courante. T16 `ACTION2` mesure [+6,0] et se rattache au retour précédent. Les deux gestes confirment un déplacement. N1 reste en cours.
- **Interventions.** Retirer cette seule mesure ou retirer l’offre entière donne le même repli `ACTION3`, puis un nouvel `ACTION4` dont le déplacement est confirmé. Ajouter [0,−6] à une signature étrangère laisse l’offre et les retours nominaux identiques.
- **Échec de la projection.** Présenter le plateau stationnaire au même vrai T15 conserve l’empreinte du paquet physique. L’observation alternative affaiblit la projection, scelle et mémorise cet essai avec `graph_displacement_or_extra_effect_diverged`, puis libère `ACTION3` en frontière.

Depuis N1 en ouverture native, graine implicite 0, 16 gestes par session et 600 par niveau. Depuis le checkout épinglé à `49a971c3` sous Node 24 avec Pyodide préparé :

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/tu93-39'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-tu93-alternating-access.py" qualification.json
```
