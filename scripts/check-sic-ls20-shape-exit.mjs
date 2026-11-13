/** Offline verification on the same official archive shipped to the browser. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { loadPyodide } from '../public/vendor/pyodide/pyodide.mjs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const trace = JSON.parse(gunzipSync(await readFile(new URL('docs/migration/lot2c-cost-evidence/final/ls20-regression/ls20-public-trace.json.gz', root))));
const pyodide = await loadPyodide({ indexURL: fileURLToPath(new URL('public/vendor/pyodide/', root)) });
await pyodide.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
pyodide.unpackArchive(new Uint8Array(await readFile(new URL('public/python/official-games.zip', root))), 'zip', { extractDir: '/games' });
pyodide.FS.writeFile('/games/official_adapter.py', new Uint8Array(await readFile(new URL('public/python/official_adapter.py', root))));
pyodide.globals.set('route_json', JSON.stringify(trace.packets.slice(1).map(item => Number(item.command.action_ref.slice(6)))));
const json = await pyodide.runPythonAsync(`
import sys, json
sys.path.insert(0, "/games")
from official_adapter import OfficialAdapter

route = json.loads(route_json)
def replay(length):
    adapter = OfficialAdapter("LS20")
    for command in route[:length]:
        adapter.action(command)
    return adapter

def traits(game):
    return [game.fwckfzsyc, game.hiaauhahz, game.cklxociuu]

def box(sprite):
    return [sprite.x, sprite.y, sprite.width, sprite.height]

def crop(frame, bounds):
    x, y, width, height = bounds
    return [row[max(0,x):x+width] for row in frame[max(0,y):y+height]]

def reach_plate():
    # Walk actual public commands in isolated adapters until the first shape change.
    frontier, seen = [()], set()
    for path in frontier:
        adapter = OfficialAdapter("LS20")
        adapter.select_level(4)
        for command in path:
            adapter.action(command)
        g = adapter._game
        state = (g.gudziatsk.x, g.gudziatsk.y, *traits(g))
        if state in seen:
            continue
        seen.add(state)
        for direction in (1, 2, 3, 4):
            x, y = state[:2]
            width, height = g.gisrhqpee, g.tbwnoxqgc
            dx, dy = {1:(0,-height), 2:(0,height), 3:(-width,0), 4:(width,0)}[direction]
            target = g.mrznumynfe(x+dx, y+dy, width, height)
            if any("ttfwljgohq" in (sprite.tags or []) for sprite in target):
                return adapter, direction, len(path)+1
            if len(path) < 14 and 0 <= x+dx < 64 and 0 <= y+dy < 64:
                if not any("ihdgageizm" in (sprite.tags or []) for sprite in target):
                    frontier.append((*path, direction))
    raise AssertionError("No shape changer approached")

def measure():
    adapter, step, shape_action = reach_plate()
    game = adapter._game
    plate_box = box(game.current_level.get_sprites_by_tag("ttfwljgohq")[0])
    shape_box = box(game.htkmubhry)
    old, before = traits(game), adapter.public_state()["frame"]
    after = adapter.action(step)["frame"]
    new = traits(game)
    assert old[0] != new[0] and old[1:] == new[1:], (old, new, box(game.gudziatsk), plate_box)
    assert [game.gudziatsk.x, game.gudziatsk.y] == plate_box[:2], (box(game.gudziatsk), plate_box)
    control, counterfactual = replay(16), replay(16)
    g, bad = control._game, counterfactual._game
    assert traits(g) == traits(bad)
    assert control.public_state()["frame"] == counterfactual.public_state()["frame"]
    assert g.bejndxqqzf(0), (traits(g), g.ldxlnycps, g.yjdexjsoa, g.ehwheiwsk)
    # Change only the player's shape (and its displayed pixels). Both runs take the same input.
    bad.fwckfzsyc = old[0]
    bad.htkmubhry.pixels = bad.ijessuuig[bad.fwckfzsyc].pixels.copy()
    bad.htkmubhry.color_remap(sys.modules[type(bad).__module__].epeqflmtfc, bad.tnkekoeuk[bad.hiaauhahz])
    assert traits(bad)[1:] == traits(g)[1:] and not bad.bejndxqqzf(0)
    target_box, exit_box = box(g.srgbthxut[0]), box(g.plrpelhym[0])
    match_before = control.public_state()["frame"]
    matched = control.action(route[16])
    mismatched = counterfactual.action(route[16])
    assert matched["level"] == 2 and mismatched["level"] == 1
    assert box(bad.gudziatsk)[:2] != exit_box[:2]
    return {
        "summary": {"shapeBefore": old[0], "shapeAfter": new[0], "colorAndOrientationUnchanged": True,
                    "shapeLevel": 4, "shapeAction": shape_action, "exitLevel": 1, "exitAction": 17, "matchingShapeLevel": matched["level"],
                    "otherShapeLevel": mismatched["level"], "plate": plate_box, "indicator": shape_box,
                    "target": target_box, "exit": exit_box, "player": box(bad.gudziatsk)},
        "sprites": {"plate": crop(before, plate_box), "before": crop(before, shape_box), "after": crop(after, shape_box),
                    "target": crop(match_before, target_box), "exit": crop(match_before, exit_box), "mover": crop(after, plate_box)}
    }

json.dumps(measure())
`).catch(error => { console.error(error.message.slice(-1000)); process.exit(1); });
const evidence = JSON.parse(json);
const target = new URL('src/sic/ls20-review-evidence.json', root);
if (process.argv.includes('--write')) await writeFile(target, JSON.stringify(evidence) + '\n');
else assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), evidence);
console.log(JSON.stringify(evidence.summary));
