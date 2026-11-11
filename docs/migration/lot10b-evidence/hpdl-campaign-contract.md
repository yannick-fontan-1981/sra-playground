# HPDL : campagne froide et horloge cumulative

Ces deux outils préparent une nouvelle exécution réelle du harnais de production. Ce document et le registre initial ne constituent aucun résultat de jeu. Les anciens rapports locaux non récupérés ne sont pas recréés.

## Admission et commande

Le gel doit déjà exister et inclure les deux lanceurs, leur writer JSON, le harnais, ses collecteurs Window et Preview et les déclarations effectivement lues. Le wrapper vérifie chaque fichier déclaré dans `source-archive.json`, les octets de son archive, les deux reçus de gel et l’inventaire natif complet avant et après l’exécution. Un ajout, une suppression ou une modification du natif invalide l’identité du gel. Le répertoire de sortie doit être neuf ; il ne peut pas contenir le gel existant.

```bash
python -B docs/migration/lot10b-evidence/run-hpdl-clocked-proof.py \
  --directory docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01 \
  --source-manifest docs/migration/lot10b-evidence/recovery-20261111/hpdl-freeze-01/source-manifest.json \
  --timeout-seconds 600
```

Les deux chemins de tentative et de gel dans cet exemple doivent correspondre à la préparation réelle du responsable. La commande n’a pas été exécutée lors de l’écriture de ces outils. Ne pas appeler directement `run-hpdl-campaign.mjs` : l’admission, l’horloge et l’arrêt externe appartiennent au wrapper Python.

Le jeu est fixé à **HPDL**, avec **six niveaux visés**, une seule session native froide et les limites de production du harnais. Aucun plafond d’actions supplémentaire, état acquis, réponse attendue, parcours ou solveur Python n’est fourni. Les callbacks ne font que conserver les retours publics et les rapports du harnais.

## Temps, verrous et interruptions

Le registre unique est `recovery-20261111/hpdl-clock.json`. Son débit initial de **159.45478678199166 s / 40 actions** reste historique, avec `rawEvidenceRecovered:false` et `intervalsRecovered:false`. Il laisse **2240.5452132180085 s** sur les **2400 s** autorisées. Les nouveaux reçus ne remplacent pas ces preuves perdues et ne valident pas à nouveau ces actions.

Le wrapper prend le verrou partagé `/workspace/shared/sra-coordination/performance.lock`, puis le verrou exclusif `/workspace/shared/sra-coordination/hpdl.lock`, sans attente. Il conserve les deux pendant la tentative et sa conservation de preuves. Il écrit durablement une entrée `running` avant tout lancement. Une entrée non terminalisée bloque une nouvelle tentative ; un arrêt brutal ne crée aucun remboursement implicite.

Après un accord de calme explicite avec les autres voies, l'option `--exclusive-resources` prend le verrou performance en mode exclusif pour isoler cette campagne fonctionnelle. Le mode réellement utilisé est conservé dans l'admission. Cette isolation ne transforme pas l'essai en mesure de coût officielle. Sans cette option, le mode partagé reste inchangé.

Le plafond d’activité demandé ne peut pas dépasser **600 s**. Il comprend le démarrage et la préparation du wrapper, puis tout le processus enfant, imports compris. Le temps déjà consommé par la préparation est retranché de l’autorisation restante de l’enfant. Une marge de **0,5 s** déclenche l’arrêt avant l’échéance nominale ; l’instant réel du signal et la récolte du processus sont conservés. Le wrapper tue le groupe de processus en cas de limite ou de signal reçu. La protection Linux `PR_SET_PDEATHSIG` empêche le processus enfant de survivre à la mort brutale de son parent.

L’admission exige le plafond demandé **plus 30 s de réserve minimale de conservation** sous le budget encore disponible. Après arrêt du jeu, vérification des sources, copies gzip, lecture des captures et empreintes continuent à être débitées par l’horloge monotone. La durée réelle n’est ni plafonnée artificiellement ni remboursée en cas d’erreur. Le reçu mesure jusqu’à la fin de la collecte ; le débit terminal ajoute aussi son écriture et son empreinte avant la mise à jour atomique du registre. Le reçu décrit cette frontière de mesure. Un dépassement éventuel est affiché explicitement et interdit toute admission ultérieure.

Toute future session HPDL navigateur appartient au même cumul. Elle doit être ajoutée à cette même liste d’intervalles avec son identité, son débit monotone et un reçu terminal compatible, avant une autre admission. Ce lanceur de campagne ne prétend pas observer un navigateur externe.

## Preuves conservées et portée

Le journal `hpdl-actual-public-journal.jsonl` reçoit chaque retour public réel avec sa commande, ou `null` pour le chargement initial. Chaque ligne est synchronisée sur disque. Les comptes portent sur les retours complets observés ; une action interrompue ou encore en cours ne devient pas un nombre inventé.

À chaque callback `checkpoint(report)`, le lanceur installe atomiquement `hpdl-checkpoint.json`, qui contient le rapport exact reçu et `completeCampaign:false`. `hpdl-checkpoints.jsonl` conserve l’index des sauvegardes terminées. Un arrêt entre l’installation du dernier checkpoint et l’ajout à son index peut laisser un décalage d’une entrée ; les deux observations sont conservées telles quelles.

`hpdl-campaign.json.gz` et `hpdl-public-trace.json.gz` ne sont installés sous leur nom final qu’après un véritable retour terminal du harnais et l’écriture complète de chaque fichier. Un checkpoint n’est jamais promu en rapport final. Une campagne peut avoir renvoyé son rapport alors que la conservation de la trace est encore interrompue : le statut réel du rapport et la complétude de la preuve sont alors deux champs distincts. Une preuve manquante, une lecture incomplète ou un délai externe n’est pas transformé en verdict d’échec du jeu.

Les logs, le journal et le dernier checkpoint restent présents sous leur forme brute. Le wrapper en conserve aussi une copie gzip sans perte, avec vérification de reconstruction des octets. Aucun brut n’est supprimé pendant la tentative. Leur découpage ou leur représentation pour Git relève du transport ultérieur, avec les empreintes originales préservées.

`execution-hpdl.json` lie les entrées de gel, les observations avant/après, le code de sortie réel, les signaux et la capture conservée. Il distingue `campaignStatus`, `finalExecutionEvidenceComplete` et `campaignPassedEstablished`. Le registre est mis à jour atomiquement avec ce reçu et le débit effectivement mesuré. Ni la présence d’un checkpoint ni ce wrapper n’établissent une parité du caller Python complet, une contribution propre de Window, une validation navigateur ou un verdict de coût.

## Correction de capture après l'essai 01

L'essai 01 a été interrompu par le signal externe 9. Son dernier checkpoint complet représente **177 532 943 octets** ; la cause de l'arrêt n'est pas prouvée. L'ancien writer, les lanceurs et tous leurs reçus sont conservés dans `recovery-20261111/hpdl-freeze-01` et `hpdl-live-01`.

Pour les tentatives suivantes, `stream-evidence-json.mjs` écrit le JSON par morceaux bornés, et le rapport terminal passe dans un pipeline gzip. Aucun champ, paquet ou état n'est retiré. Le métajournal comporte les observations réelles de mémoire du processus avant et après chaque checkpoint. L'enfant Node utilise un plafond de heap de **1 536 MiB**, déclaré dans sa commande et son reçu. Ces dispositions réduisent les copies globales du writer ; elles ne suppriment pas le rapport conservé en mémoire et n'attribuent pas rétroactivement la cause de l'arrêt.

La relecture statique du writer est achevée. Sa [vérification réelle](recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-01/writer-check.json) a reproduit exactement les **177 532 943 octets** du checkpoint 47, directement et après compression puis décompression. Les **28 cas courts** et **13 erreurs attendues** passent également. Ce contrôle du writer ne prouve ni une borne de mémoire du rapport complet ni la cause de l'arrêt de l'essai 01.

Le [diagnostic 02](recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-02/execution-hpdl-diagnostic.json) a ensuite conservé la comparaison originale complète du dernier checkpoint : **111 appels source, 94 restaurations, 47 préfixes et 188 ablations**, sans divergence ni adaptation native. Cette preuve reste attachée à l'ancien digest natif `318153c14c7766c9d007f1b2ede4fa03ce940d62b1369251339e0174af79c306` et à une campagne incomplète.

Après ces opérations et leur comptabilisation, le registre réel totalise **1263.3446460859916 s** et laisse **1136.6553539140084 s**. Il conserve aussi les **451 s** de travail de cas débitées conservativement et les **149.720413432 s** du premier diagnostic interrompu. Aucun débit n'est remboursé.

La prochaine tentative sur le runtime dont l'origine des délais est corrigée est préparée avec un plafond d'activité de **300 s**, un nouveau gel et un nouveau répertoire. La QA navigateur et une éventuelle nouvelle comparaison sont prises sur le même solde. Le mode exclusif n'est utilisé qu'après le calme explicite des autres voies. Le correctif d'horloge et le writer validé n'établissent pas à eux seuls la réussite des six niveaux.
