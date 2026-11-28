# THER · ligne 65, ajout, coupe et contraintes conjointes

**Ligne 65 qualifiée sur le gel par le Banc.** Quatre préfixes natifs, un témoin V42 et 227 tests sur `dc9314cc1ebdfc4ac4888d5ad0e7bfa0fb62542f`, critères `d40aa32d`. Seize commandes historiques et leurs retours concordent. Premier essai à 01:05:48 le 28 novembre (UTC−3). [Contrôles](sic-ther-dc9314cc/banc.json) · [Journaux](sic-ther-dc9314cc/recus.zip)

- Aux T1 et T2 le compartiment choisi passe de longueur zéro à 3 puis à 1. Le propriétaire acquiert l'ajout puis la coupe. Si seul le retour présenté est stationnaire ou si une chaîne sœur change, la garde d'attribution suspend l'acquisition.
- Les domaines [[1],[2],[1]] donnent le premier pas confirmé au T3. La projection reste distincte de la limite officielle au T4. Les passages officiels du préfixe sont aux T4, T7, T11 et T15.
- Sur le témoin public V42/N5, les domaines [[4],[0],[1],[3],[3],[3]] justifient le clic (19,26), joué et confirmé sur le nominal natif. Dans le contrôle séparé, l'unité alignée ajoutée à (10,49) et (10,50) est bien comptée. Les totaux conjoints divergent, le calcul indique `EMPTY_DOMAIN_CONTRADICTION` et le service suspend l'offre. Ce contrôle construit n'exécute aucune commande.

Node 24, départ N1, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais avec Pyodide local, `$b` désigne le Banc et `$out` un nouveau reçu avec les actifs V42.

```powershell
node experiments/sic-agenda-offres/ther-65/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
py -3.11 "$b/scripts/check-sic-spatial-assembly.py" THER $out
```
