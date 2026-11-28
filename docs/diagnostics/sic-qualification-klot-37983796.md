# KLOT · ligne 82, rôle du corps effectivement déplacé

**Correctif qualifié sur `37983796259ab45f3366364896a72c55752e332d`.** Critères `cb25f346`, parent caractérisé `03fba8c8`, arbre du gel. Les deux contre-épreuves et les deux scénarios nominaux passent sur le correctif. Le contrôle compare les reçus complets capturés des deux variantes. [Contrôles](sic-klot-provenance-37983796/banc.json) · [Reçus](sic-klot-provenance-37983796/recus.zip) · [Défaut sur gel](sic-qualification-klot-a0df8a9b.md)

| Retour contrôlé | Sujet du ticket | Sujet réellement déplacé | Premier champ différent |
|---|---|---|---|
| N1/T7, autre sélection en (36,39) | 6 | 11 | Rôle du reçu |
| N1/T9, autre sélection en (20,23) | 12 | 6 | Rôle du reçu |

Le backend officiel joue dans chaque bras une sélection supplémentaire, tenue hors de l'historique du service, puis le même ACTION1 que le ticket. Le parent donne `observed_exclusive_receiver` au sujet immobile. Le correctif rend `blocked_or_unselected_remains_conditional`. La mesure de déplacement, les références, les empreintes, les poses et le nombre de modèles ne changent pas. Les deux plans sont contredits et scellés avec zéro modèle. Le service s'arrête pour `rigid_control_or_collision_model_refuted`, sans ticket supplémentaire.

Les deux scénarios à sujet correct concordent avec le gel, dont les mouvements de 11, 6 et 12 et la resélection jouée après retrait du reçu T1. Départ N1, graine implicite 0, 16 gestes au total avec horloge déterministe. Depuis le Banc, `$g` désigne les actifs du gel avec Pyodide et `$out` un nouveau dossier. Node 24.

```powershell
py -3.11 scripts/test-sic-catalogue-lines.py 03fba8c8 "$out/attribution" --game KLOT --wrong-receiver --game-root $g
py -3.11 scripts/test-sic-catalogue-lines.py 37983796 "$out/attribution" --game KLOT --wrong-receiver --corrected-receiver --game-root $g
py -3.11 scripts/test-sic-catalogue-lines.py 37983796 "$out/nominal" --game KLOT --game-root $g
py -3.11 scripts/test-sic-catalogue-lines.py d0e7527c "$out/nominal" --game KLOT --game-root $g
py -3.11 scripts/check-sic-klot-provenance.py $out "$out/nominal/d0e7527c.json"
```
