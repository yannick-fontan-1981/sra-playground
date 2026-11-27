# Restauration des points de reprise natifs

La version `a6cae856` part de `ac7790f0` et diffère dans la famille commune des effets préparés. Après restauration d'un état complet validé par l'hydratation autoritaire, elle conserve l'objet immuable jusqu'à la première demande mutable. La planification, l'acquisition et l'accès public à l'état reçoivent leur copie détachée. Un objet étranger ou un ancien état nécessitant des valeurs par défaut garde le chemin ordinaire de copie.

Le diagnostic utilise 74 retours publics conservés dans `wa30-last-part-public.jsonl.gz`, dont l'empreinte SHA-256 est `5b7309fc6242bcc7566a36025126ce8acf7c6274317634d698fcfde7d5bc0236`. Il acquiert un état commun depuis ces retours. Chaque échantillon chronomètre 40 répétitions de deux restaurations suivies d'un accès mutable et vérifie l'égalité du graphe canonique complet après sauvegarde.

| Version | Durées en ms | Médiane |
| --- | --- | ---: |
| `ac7790f0` | 506, 491, 480, 482, 482 | 482 |
| `a6cae856` | 249, 241, 237, 253, 271 | 249 |

Le graphe canonique de 3 564 991 octets a le même SHA-256, `53158e7388d6edbbc2453d2f643c3af9d3fd8bee376f9b3c48b4914980576956`. Le gain mesuré est d'environ 5,8 ms par cycle. Cette mesure porte sur les restaurations et ne constitue aucune qualification chronologique.

Pour reproduire sous Node 24, extraire le répertoire `src` du commit `ac7790f0` dans un dossier de référence, puis lancer depuis le checkout candidat.

```text
node docs/diagnostics/sic-27-wa30-20261127/benchmark-native-restoration.mjs <dossier-de-référence>
```
