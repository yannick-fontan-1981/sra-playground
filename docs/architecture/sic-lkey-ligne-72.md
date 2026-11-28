# LKEY, ligne 72 — choisir selon le rang observé dans l'atelier

## Critères préenregistrés

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Catalogue
`8ce7ee35`, LKEY N1/T11 ACTION1, `public_ranked_workshop /
observed_ranked_workshop`. Départ N1, graine 0 et plafond 16.

- Retrouver les dix gestes qui précèdent ce ticket et identifier
  le retour qui autorise le mode de l'atelier. Suivre la mesure
  du profil marqué et de son voisin, l'offre, le premier effet
  observé et la suite.
- Inverser la seule énumération des entrées au sélecteur sur
  la vue historique, puis retirer séparément la preuve de
  relation mesurée et le contraste de mode acquis. Constater
  l'effet sur l'offre, la commande et la prochaine décision.
- Distinguer le rang observé dans les profils, la direction
  éventuellement apprise au retour, et une loi portable
  seulement si le service la consomme dans un autre contexte.
  Comparer une autre station ou un autre mode dans le vrai jeu.
- Garder les interventions séparées des retours officiels.
  Préenregistrer la première divergence avant un correctif
  seulement si un défaut d'acquisition ou de portée est établi.

## Vue, ordre et mode dans le jeu officiel

Le catalogue et le gel libèrent les mêmes 16 tickets et les
mêmes 16 verdicts. Les six occurrences de la ligne 72 sont
les tours globaux T11 à T16. Avant ces tours, le joueur
natif passe par des transferts encadrés et la frontière.

| Tour | Offre et preuve active | Retour mesuré |
| --- | --- | --- |
| T10, ACTION5 | La frontière choisit l'entrée de mode. | `RankedWorkshop.recordSource` observe passivement 0→1 pour le marqueur intérieur, avec les profils et leur marqueur de position conservés. La paire cite les révisions 10→11. |
| T11, ACTION1 | Deux profils non encadrés. Le profil marqué porte les hauteurs [3,1,4] et a un seul voisin au-dessus de même coupe. Le marqueur intérieur indique le mode tenu. La règle `station_profile_exchange_up` offre `adjacent_exchange_probe`. | Le marqueur monte d'un rang, avec changement géométrique dans les profils. Le reçu donne un effet géométrique courant et un déplacement d'emplacement de −1. |
| T12–T13 | Le profil de même coupe est réobservé dans la position préparée. Le service essaie le récepteur par ACTION4, puis libère le profil par ACTION5. | T12 change le récepteur. T13 mesure 1→0 pour le marqueur intérieur. |
| T14–T16 | En mode libre, le voisin de même bande en dessous fonde ACTION2. Le nouvel élément marqué a les hauteurs [1,3,2]. ACTION5 reprend la tenue, puis ACTION4 essaie le nouveau récepteur. | T14 avance le marqueur d'un rang, sans échange de géométrie. T15 confirme 0→1 et T16 donne le passage officiel. |

`RankedWorkshop.proposeSource` relit `project` et le
contraste de mode retenu. `select` teste les règles pour les
entrées disponibles et libère l'offre seulement si le groupe
de meilleur rang est unique. L'ordre des profils intervient
dans les faits géométriques courants, notamment le voisin
compatible au-dessus ou en dessous. Le rang entre les offres
est la priorité déclarée des types. Le garde revalide la
projection et l'observation exacte du ticket.

Le reçu de mode est appris sur les vrais retours. Le déplacement
d'emplacement est mesuré lui aussi. Dans les six tickets de
LKEY, `workshop_plan.extension` reste vide. La suite relit
les relations courantes des profils et les contrastes de mode.
La fenêtre ne montre pas la consommation d'une loi portable
des déplacements dans un nouveau niveau.

## Contrastes à même observation

Au T11, inverser le seul ordre d'énumération des commandes
dans le sélecteur conserve `adjacent_exchange_probe`,
ACTION1, et son déplacement réel de −1. Au même raster,
retirer le fait « un voisin au-dessus de même coupe » retire
cette offre. Retirer seulement le contraste de mode acquis
retire aussi l'offre, avant l'arbitrage. Les deux retraits
libèrent `public_framed_transfer` avec ACTION6. Les
replis sont joués et gardent le niveau courant.

Ces contrastes séparent le rang mesuré, le reçu de mode
nécessaire à l'atelier et l'énumération des entrées. Le gel
exerce déjà le filtre et les six gestes. Les tests du noyau
donnent séparément la portée de la revalidation d'une méthode
portable sur une autre scène.

## Reproduction

Node 24. `SIC_LKEY_GAME_ROOT` désigne les actifs et Pyodide.
`SIC_LKEY_ENGINE_ROOT` permet une autre révision du moteur.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-lkey-line-72.test.ts tests/v6-ranked-workshop-grounded-inquiry.test.ts tests/v6-ranked-workshop-kernel.test.ts
```

[Test du service](../../tests/sic-lkey-line-72.test.ts) ·
[Producteur, choix et reçu](../../src/logos-engine/v6-ranked-workshop.ts) ·
[Projection géométrique](../../src/logos-engine/v6-ranked-workshop-geometry.ts) ·
[Catalogue](sic-v8-strategies-observees.md#L98)
