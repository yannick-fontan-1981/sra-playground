# Profil CPU diagnostique WA30 du L9

Source figée `8fd38588ee11d7b051eadc7812def30f36b4f29b`. Rejeu SIC depuis L1, un worker, mêmes plafonds, Node 24 sous Windows. Le diagnostic s’arrête au L9 après 56 commandes sous son plafond de 51 000 ms. Les sept fragments contiennent la transition L8→L9 et les 55 premiers retours du L9. L’inspecteur prélève sur le même budget et consomme environ 6,5 s dans ce profil. Ces résultats servent à l’analyse de coût.

Préparer les ressources Python avec `node scripts/prepare-python.mjs`. Définir `SIC_REPLAY_REFERENCES` à `docs/architecture/sic-replay-reference-levels-20261126.json` et `WA30_PROFILE_DIR` à un dossier de sortie existant. Charger `profile-wa30-native.mjs` via `NODE_OPTIONS=--import=file:///chemin/absolu/profile-wa30-native.mjs`, puis exécuter `node scripts/check-sic-chronological.mjs WA30 9 /chemin/absolu/diagnostic.jsonl 1 sic`. Arrêter toute autre campagne locale lourde pendant ce diagnostic.

`node summarize-wa30-cpu.mjs /chemin/du/profil` produit la synthèse. `profile-summary.json` contient les mesures de ce rejeu. Les millisecondes inclusives se recouvrent. Le propriétaire de livraison orientée emploie moins d’une seconde dans les fragments. Les principaux coûts se trouvent dans la conservation de l’état natif, la canonisation et le graphe d’exécution. Les fragments CPU bruts restent dans le répertoire local du diagnostic.
