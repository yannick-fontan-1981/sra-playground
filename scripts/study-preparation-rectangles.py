"""Compare preparations at equal duration, with both subsequent commands fixed."""
import argparse
import json
from pathlib import Path


def delta(start, end):
    return tuple(b-a for a,b in zip(start,end))


def classify(data):
    buttons, root, setups, cells = (data[k] for k in ("buttons","root","setups","matrix"))
    won = set(map(tuple,data["wins"]))
    measured = set(map(tuple,data["measured"]))
    rows = []
    for a,b in data["essential"]:
        selected = []
        for r,origin in enumerate(root):
            prepared, direct = setups[a][r], setups[b][r] if setups[b] else None
            if not (origin and prepared and direct):
                continue
            for d in range(len(buttons)):
                if d%2 == b%2 or not (setups[d] and setups[d][r] and cells[a][d] and cells[a][d][r]):
                    continue
                if delta(origin,setups[d][r]) != delta(prepared,cells[a][d][r]):
                    selected.append((r,d))
                    break
        if not selected:
            continue
        controls = [(other,alternative) for other in range(len(buttons)) for alternative in range(len(buttons))
                    if (other,b) in measured-won and (a,alternative) in measured-won and (other,alternative) in measured]
        # A cross is strongest: each B wins under its own A and loses under the other A.
        controls.sort(key=lambda c: (c not in won,c))
        roles = []
        for r,d in selected:
            q = cells[a][b][r]
            if not q:
                continue
            p, h, e = root[r], setups[a][r], setups[b][r]
            changed = delta(p,e) != delta(h,q)
            roles.append((not (changed and h!=q), not changed, q==e, r,d))
        roles.sort()
        row = {"code":data["code"],"level":data["level"],"program":[buttons[a],buttons[b],data["probe"]],
               "rectangle":bool(controls),"cross":bool(controls and controls[0] in won),
               "differentMotion":False,"differentDisplacement":False,"differentArrival":False}
        if roles:
            _,_,_,r,d = roles[0]
            p,h,e,q=root[r],setups[a][r],setups[b][r],cells[a][b][r]
            row.update({"differentMotion":h!=q and delta(p,e)!=delta(h,q),
                        "differentDisplacement":delta(p,e)!=delta(h,q), "differentArrival":q!=e,
                        "actor":data["roles"][r], "origin":p, "prepared":h, "direct":e,"arrival":q,
                        "calibration":buttons[d],"beforeD":setups[d][r],"afterD":cells[a][d][r]})
        if controls:
            a2,b2=controls[0]
            row.update({"alternativeA":buttons[a2],"alternativeB":buttons[b2]})
            if roles:
                row["otherPrepared"]=setups[a2][r]
                row["otherArrival"]=cells[a2][b][r]
        rows.append(row)
    return rows


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tables",type=Path)
    parser.add_argument("output",type=Path)
    args=parser.parse_args()
    results={}
    for file in sorted(args.tables.glob("*.json")):
        table=json.loads(file.read_text(encoding="utf8"))
        group="lower" if table["level"]==1 else "upper"
        results.setdefault(group,[]).extend(classify(table))
    report={}
    for group,cases in results.items():
        keys=("rectangle","cross","differentMotion","differentDisplacement","differentArrival")
        report[group]={"selectedWins":len(cases),**{k:sum(c[k] for c in cases) for k in keys},"cases":cases}
    args.output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")


if __name__=="__main__":
    main()
