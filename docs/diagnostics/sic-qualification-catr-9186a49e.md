# CATR · ligne 42, accéder par les relations entre chambres

**Ligne 42 qualifiée sur le gel.** Cinq préfixes natifs sous `9186a49ea207caff1fee6a1386b506739b22d4a3`, arbre moteur du gel, critères `44fa72aa`. Historique `8ce7ee35` et gel concordent. Rejeu indépendant de 23:09:41 à 23:11:09 le 27 novembre UTC−3. [Reçus](sic-catr-9186a49e/recus.zip) · [Contrôles](sic-catr-9186a49e/banc.json)

- **T1–T3.** Le calcul retient une configuration conditionnelle et trois commandes à changer. Le clic (31,47) expérimente le réglage 12→10. Le vrai retour change seulement la commande attendue et scelle ses deux références. T2 (27,51) et T3 (35,51) exploitent ce réglage. Le retour T3 confirme officiellement N1, avec `matched:null` pour la relation.
- **Même prochain clic, autre raison.** Présenter l’image antérieure au même T1 conserve le paquet du vrai jeu, mais scelle la tentative sans acquérir le réglage. Le clic (27,51) est alors une expérience, avec `known:false`.
- **Interventions distinctes.** Retrait de l’offre seule, repli `animated_contact` en (31,51), puis reprise du clic initial et confirmation. Relation contradictoire au même contexte, `shared_relation_rows_contradicted` et arrêt avant tout ticket. Référence étrangère à pixels égaux, `relation_binding_changed` sur le garde sondé. Le ticket nominal reste intact.

Départ N1, graine implicite 0, ouverture native, 16 gestes par session, 600 par niveau. Sous Node 24 dans le checkout `9186a49e` avec Pyodide préparé :

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/catr-42'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-catr-chamber.py" qualification.json
```
