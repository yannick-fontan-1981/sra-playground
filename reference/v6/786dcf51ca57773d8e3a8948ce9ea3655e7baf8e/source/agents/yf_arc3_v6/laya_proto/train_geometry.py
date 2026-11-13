"""Validated synthetic composition decisions; no LS20 route or hidden game input."""
import json
import random
from pathlib import Path
import sys
from geometric_observer import rotate
from memory import pack
from benchmark import durable, source_plan
from catalog import REPO, sha

INSTRUCTIONS = "Choisir un ensemble d'actions utile au but principal. Préserver les compositions déjà satisfaites. Les probes servent à établir un effet inconnu."


def generate(seed, count):
    rng = random.Random(seed)
    rows, proofs = [], []
    for index in range(count):
        # Exact finite geometric witness, independent of learned predictions.
        mask = frozenset((x,y) for y in range(4) for x in range(4) if rng.random()<.45)
        if not mask: mask = frozenset({(0,0),(1,0),(0,1)})
        shift = rng.randrange(4)
        target = rotate(mask,shift)
        aligned = mask == target
        known = bool(rng.randrange(2))
        names = rng.sample(["K","M","R","V","Q","S","T","Z"],3)
        roles = {names[0]:"corps contrôlé confirmé par déplacement", names[1]:"affichage courant supposé", names[2]:"cible supposée"}
        question = {"but_principal":"corps dans la cible avec affichage compatible",
                    "roles":roles,"composition_courante":{"forme_compatible":True,"orientation_compatible":aligned,"couleur_compatible":True},
                    "mecanisme":{"effet_connu":known,"effet_observe":"rotation compatible" if known else "inconnu"},
                    "preserver":["accord géométrique"] if aligned else [],"episode":f"scene-{seed}-{index}"}
        options = [
            ("enter", "Rejoindre puis entrer dans la cible, en conservant l'affichage actuel."),
            ("probe", "Approcher et contacter le mécanisme, puis mesurer son effet encore inconnu sur l'affichage."),
            ("transform", "Rejoindre le mécanisme et appliquer sa transformation déjà observée pour fermer le résidu d'orientation.")]
        rng.shuffle(options)
        answer = "enter" if aligned else "transform" if known else "probe"
        criteria = {f"T{j}":text for j,(_,text) in enumerate(options)}
        label = next(f"T{j}" for j,(key,_) in enumerate(options) if key==answer)
        rows.append({"state":pack(question),"questions":{"next":{"type":"choice","instructions":INSTRUCTIONS,"criteria":criteria}},"expected":{"next":label}})
        proofs.append({"case":index,"mask":sorted(mask),"target":sorted(target),"aligned":aligned,"effect_known":known,
                       "expected":answer,"validator":"exact-mask-equality + declared alignment/conservation/information goal"})
    return rows,proofs


def main():
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True,exist_ok=False)
    durable(out/"plan.json",source_plan())
    all_masks = set()
    for name,seed,count in [("train",713,768),("eval",1907,128)]:
        rows,proofs = generate(seed,count)
        # Exclude identical geometric families between training and evaluation.
        kept = []
        with (out/(name+".jsonl")).open("x",encoding="utf8") as stream:
            for row,proof in zip(rows,proofs):
                family = min(pack(sorted(rotate(frozenset(map(tuple,proof["mask"])),r))) for r in range(4))
                if name=="eval" and family in all_masks: continue
                if name=="train": all_masks.add(family)
                stream.write(pack(row)+"\n");kept.append(proof)
        durable(out/(name+"-validation.json"),{"source":"synthetic finite geometry, not human labels or LS20 replay", "count":len(kept),"proofs":kept})
        print(pack({"dataset":name,"validated":len(kept)}),flush=True)
    durable(out/"source.json",{"policy_sha":sha(Path(__file__).with_name("roles_goals.drm.json")),"training":"head-only, frozen encoder", "held_out":"disjoint rotation-equivalence shape families"})


if __name__ == "__main__": main()
