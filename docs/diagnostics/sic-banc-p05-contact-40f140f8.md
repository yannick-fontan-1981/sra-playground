# Banc P05 sur le passage apparié natif

Référence moteur `86e0f172bfd4f743bccd985a57ce1811001a6d7e`, candidat `40f140f8dceb78c7ad1e448751a9f103bfc01362`. Le candidat change un seul fichier moteur, `src/sic/paired-passage.ts`. La réserve indépendante a été scellée avant sa remise, puis ouverte sur ce SHA. L'original local porte l'empreinte `85ea022abf3923da7b7c38bed0800d8645c148e74eaf84591103bd2c91db0e1c`. La copie publiée reprend son contenu avec un dernier saut de ligne LF, empreinte `6babcfd983c6a32c6610a61c7003db87d93313ac5aa7f07bdab10e85664ce673`. [Cas publié après ouverture](sic-banc-p05-contact-40f140f8/attendus.json) · [Tests sur le terrain construit](https://github.com/yannick-fontan-1981/sra-playground/blob/40f140f8dceb78c7ad1e448751a9f103bfc01362/docs/architecture/sic-p05-contact-passage.md)

**PORT officiel, depuis N1.** Le banc utilise le service natif en mode SIC, avec un travailleur, les plafonds historiques d'actions par niveau et une horloge de planification déterministe. Le quota local d'un geste produit **6/6 niveaux, 116 commandes et 844 événements identiques** sur les deux moteurs. Au N4/T6, P07 garde son ticket d'approche. Au **N4/T7** puis au **N6/T6**, le contact P05 joue ACTION4 et le vrai retour reconfigure les connexions. Le candidat publie à ces deux positions un reçu de classement, avec la même sélection et les mêmes preuves que le qualificateur de référence.

**Ablation au quota local nul.** Le premier écart est au **N4/T7, événement 454**, champ `/value/family`. Le reçu local diverge sur `selected` avant l'émission. Le moteur officiel poursuit sa recherche et propose `sic_cavity_access`, qui joue ACTION1 avec le retour `observe_slide_and_stop`. Le paquet physique de cette action diffère de celui du contact nominal. La reconfiguration du passage n'est pas acquise au point du repli. La fixture de développement s'arrête sans ticket de contact. Le parcours officiel joue un autre ticket.

Depuis le Banc, utiliser Node 24.22.3 et deux checkouts propres. Les traces sont dans le dossier de sortie local.

```powershell
$case = 'docs/diagnostics/sic-banc-p05-contact-40f140f8/attendus.json'
node scripts/sic-p05-contact-native.mjs $a $b 86e0f172bfd4f743bccd985a57ce1811001a6d7e 40f140f8dceb78c7ad1e448751a9f103bfc01362 $case artifacts/sic-after-98/p05-contact-recontrole
```
