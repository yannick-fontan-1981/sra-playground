/** Offline verification on the same official archive shipped to the browser. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { loadPyodide } from '../public/vendor/pyodide/pyodide.mjs';
import assert from 'node:assert/strict';
import { proposePublicRoles } from '../src/sic/public-role-candidates.ts';

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

def measure():
    # Recorded lab path, replayed through ordinary public commands. The solver does not consume it.
    path = (3,3,3,2,2,2,3,2,2,3,3,1,2,1,2,1,2,1,4,2,3,2,3,3,3,2,3,2,3,2,2,1,2,2,4,1,1,1,1,4,1,4,1,1,3,3,3)
    public = OfficialAdapter("LS20")
    frames = [public.select_level(4)]
    pg = public._game
    same_target, same_exit = box(pg.srgbthxut[0]), box(pg.plrpelhym[0])
    plate_box = box(pg.current_level.get_sprites_by_tag("ttfwljgohq")[0])
    shape_box = box(pg.htkmubhry)
    changes = []
    color_changes = []
    for number, command in enumerate(path, 1):
        prior = traits(pg)
        frames.append(public.action(command))
        if frames[-1]["level"] == 4 and traits(pg)[0] != prior[0]:
            changes.append((number, prior[0], traits(pg)[0]))
            assert prior[1:] == traits(pg)[1:] and box(pg.gudziatsk)[:2] == plate_box[:2]
        if frames[-1]["level"] == 4 and traits(pg)[1] != prior[1]:
            color_changes.append(number)
    assert frames[-1]["level"] == 5 and changes
    shape_action, same_old, same_new = changes[-1]
    assert changes == [(32, 4, 5)]
    previous = frames[-1]
    last_before = frames[-2]
    control, counterfactual = replay(16), replay(16)
    g, bad = control._game, counterfactual._game
    assert traits(g) == traits(bad)
    assert control.public_state()["frame"] == counterfactual.public_state()["frame"]
    assert g.bejndxqqzf(0), (traits(g), g.ldxlnycps, g.yjdexjsoa, g.ehwheiwsk)
    # Change only the player's shape (and its displayed pixels). Both runs take the same input.
    bad.fwckfzsyc = same_old
    bad.htkmubhry.pixels = bad.ijessuuig[bad.fwckfzsyc].pixels.copy()
    bad.htkmubhry.color_remap(sys.modules[type(bad).__module__].epeqflmtfc, bad.tnkekoeuk[bad.hiaauhahz])
    assert traits(bad)[1:] == traits(g)[1:] and not bad.bejndxqqzf(0)
    target_box, exit_box = box(g.srgbthxut[0]), box(g.plrpelhym[0])
    match_before = control.public_state()["frame"]
    matched = control.action(route[16])
    mismatched = counterfactual.action(route[16])
    assert matched["level"] == 2 and mismatched["level"] == 1
    assert box(bad.gudziatsk)[:2] != exit_box[:2]
    rotations = []
    for level, number in ((1, 10), (2, 56)):
        sample = replay(number - 1)
        local = sample._game
        assert local.level_index + 1 == level
        assert not local.current_level.get_sprites_by_tag("ttfwljgohq")
        old_traits = traits(local)
        old_frame = sample.public_state()["frame"]
        new_frame = sample.action(route[number-1])["frame"]
        rotated = traits(local)
        assert old_traits[:2] == rotated[:2] and old_traits[2] != rotated[2]
        tile_box = box(local.gudziatsk)
        assert any("rhsxkxzdjz" in (s.tags or []) for s in local.mrznumynfe(*tile_box))
        display = box(local.htkmubhry)
        rotations.append({"level": level, "action": number, "tile": crop(old_frame, tile_box),
                          "before": crop(old_frame, display), "after": crop(new_frame, display)})
    return {
        "summary": {"shapeBefore": same_old, "shapeAfter": same_new, "colorAndOrientationUnchanged": True,
                    "shapeLevel": 4, "shapeAction": shape_action, "exitLevel": 1, "exitAction": 17, "matchingShapeLevel": matched["level"],
                    "otherShapeLevel": mismatched["level"], "plate": plate_box, "indicator": shape_box,
                    "target": target_box, "exit": exit_box, "player": box(bad.gudziatsk)},
        "sameRun": {"level": 4, "shapeAction": shape_action, "exitAction": len(path), "resultLevel": previous["level"],
                    "shapeBefore": same_old, "shapeAfter": same_new, "unchangedAfterChange": len(path)-shape_action-1,
                    "colorActions": color_changes, "exitBox": same_exit},
        "sprites": {"plate": crop(frames[shape_action-1]["frame"], plate_box), "before": crop(frames[shape_action-1]["frame"], shape_box),
                    "after": crop(frames[shape_action]["frame"], shape_box),
                    "target": crop(last_before["frame"], same_target), "exit": crop(last_before["frame"], same_exit),
                    "mover": crop(frames[shape_action]["frame"], plate_box)},
        "rotations": rotations,
        "public": {"commands": path, "frames": [{"rows": f["frame"], "level": f["level"]} for f in frames]}
    }

json.dumps(measure())
`).catch(error => { console.error(error.message.slice(-1000)); process.exit(1); });
const evidence = JSON.parse(json);
const publicRun = evidence.public;
delete evidence.public;
const inferred = proposePublicRoles(publicRun.frames, publicRun.commands);
const changer = inferred.find(item => item.action === evidence.sameRun.shapeAction && item.kind === 'appearance changer');
const exit = inferred.find(item => item.action === evidence.sameRun.exitAction && item.kind === 'exit');
const asBox = ([x, y, width, height]) => [x, y, x + width - 1, y + height - 1];
assert.deepEqual(changer?.box, asBox(evidence.summary.plate), 'Public candidate must localize the tested changer');
assert.deepEqual(exit?.box, asBox(evidence.sameRun.exitBox), 'Public candidate must localize the tested exit');
evidence.publicReview = { changer: changer ? { action: changer.action, box: changer.box, change: changer.change, sprite: changer.sprite } : null,
  exit: exit ? { action: exit.action, box: exit.box, sprite: exit.sprite } : null,
  otherAppearanceCandidates: inferred.filter(item => item.kind === 'appearance changer' && item.action !== evidence.sameRun.shapeAction).length };
const target = new URL('src/sic/ls20-review-evidence.json', root);
if (process.argv.includes('--write')) await writeFile(target, JSON.stringify(evidence) + '\n');
else assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), evidence);
console.log(JSON.stringify({ summary: evidence.summary, sameRun: evidence.sameRun,
  publicReview: {
  changer: changer?.box ?? null, exit: exit?.box ?? null, otherAppearanceCandidates: evidence.publicReview.otherAppearanceCandidates } }));
