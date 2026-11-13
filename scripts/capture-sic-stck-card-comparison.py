"""Run paired STCK Space trials locally; retain only small, labelled sprite crops."""
from copy import deepcopy
import gzip
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "docs/migration/native-campaigns-v42/stck-four-level-public-trace.json.gz"
OUTPUT = ROOT / "src/sic/stck-card-comparison.json"


def capture(engine):
    frames = []
    calls = []
    original = engine._apply_card_animated

    def apply(actor, card, snap):
        index = len(frames)
        before = (actor.row, actor.col)
        context = tuple((e.row, e.col, e.alive, tuple(e.cards)) for e in engine._level.enemies)
        start = engine._render_frame()

        # Use the actual emitted frame, including effects, by observing the renderer
        # within the ordinary snap. The clean crop is only used before the instruction.
        def record_render(*args, **kwargs):
            real_render = engine._render_frame

            def render():
                rows = real_render()
                frames.append(((actor.row, actor.col), rows))
                return rows

            engine._render_frame = render
            try:
                snap(*args, **kwargs)
            finally:
                del engine._render_frame

        original(actor, card, record_render)
        if actor.is_player:
            calls.append((before, start, frames[index:], context))

    engine._apply_card_animated = apply
    result = engine.action(5)
    del engine._apply_card_animated
    return result, calls


def crop(rows, x, y, left, above, right, below):
    return [row[max(0, x-left):x+right+1] for row in rows[max(0, y-above):y+below+1]]


def run_pair(engine, rank, replacement):
    first, second = deepcopy(engine), deepcopy(engine)
    a, b = list(first._level.player.cards), second._level.player.cards
    original = a[rank]
    b[rank] = replacement
    b = list(b)
    assert len(a) == len(b) and [i for i, pair in enumerate(zip(a, b)) if pair[0] != pair[1]] == [rank]
    left, right = capture(first), capture(second)
    for program, result in ((a, left), (b, right)):
        again = deepcopy(engine)
        again._level.player.cards[:] = program
        replay = again.action(5)
        assert replay["frames"] == result[0]["frames"]
    if len(left[1]) <= rank or len(right[1]) <= rank:
        return None
    for a_step, b_step in zip(left[1][:rank], right[1][:rank]):
        assert a_step[0] == b_step[0] and a_step[3] == b_step[3]
        assert [pos for pos, _ in a_step[2]] == [pos for pos, _ in b_step[2]]
    origin, _, phases_a, context = left[1][rank]
    origin_b, _, phases_b, context_b = right[1][rank]
    assert origin == origin_b and context == context_b and phases_a and phases_b
    if len(phases_a) != 3 or len(phases_b) != 3 or phases_a[-1][0] == phases_b[-1][0]:
        return None

    def case(program, result, phases, name):
        _, start, _, _ = result[1][rank]
        x, y = engine._cell_center(*origin)
        height, gap, bottom, _ = engine._stack_layout()
        card_bottom = bottom - rank * (height + gap)
        card_top = card_bottom - height + 1
        positions = [origin, *[point for point, _ in phases]]
        all_rows = [start, *[rows for _, rows in phases]]
        pos = phases[-1][0]
        return {
            "card": name, "program": list(program), "destination": list(pos),
            "displacement": [pos[0] - origin[0], pos[1] - origin[1]],
            "roundFrames": len(result[0]["frames"]), "resultLevel": result[0]["level"],
            "frames": [
                {"position": list(point), "board": crop(rows, x, y, 8, 7, 8, 4),
                 "focus": [row[1:9] for row in rows[card_top:card_bottom+1]],
                 "player": crop(rows, *engine._cell_center(*point), 1, len(program)+1, 1, 1)}
                for point, rows in zip(positions, all_rows)
            ],
        }
    return {"level": engine.levels_completed + 1, "rank": rank + 1, "origin": list(origin),
            "baseline": case(a, left, phases_a, original), "variant": case(b, right, phases_b, replacement)}


def collect(engine):
    from custom_games.engines.stack_iso import CARD_DELTA
    packets = json.loads(gzip.decompress(ARCHIVE.read_bytes()))["packets"]
    evidence = {}
    for item in packets[1:]:
        command = item["command"]
        action = int(command["action_ref"].removeprefix("ACTION"))
        level = engine.levels_completed + 1
        if level <= 3:
            for rank, original in enumerate(engine._level.player.cards):
                if original not in CARD_DELTA:
                    continue
                for replacement in CARD_DELTA:
                    if replacement == original:
                        continue
                    pair = run_pair(engine, rank, replacement)
                    if not pair:
                        continue
                    both = all(any(pair[side]["displacement"]) for side in ("baseline", "variant"))
                    label = "two-directions" if both else "blocked"
                    if label not in evidence or (both and pair["rank"] > evidence[label]["rank"]):
                        evidence[label] = pair
        result = engine.action(action, command.get("data") or {})
        assert result["frame"] == item["packet"]["frame_rows"]
        if level > 3:
            break
    assert set(evidence) == {"two-directions", "blocked"}
    return [{"id": key, **evidence[key]} for key in ("two-directions", "blocked")]


if __name__ == "__main__":
    with TemporaryDirectory(prefix="sic-stck-card-") as directory:
        with ZipFile(ROOT / "public/python/custom-games.zip") as bundle:
            bundle.extractall(directory)
        sys.path.insert(0, directory)
        from custom_games.engines.stack_iso import StackIsoEngine
        from custom_games.registry import CUSTOM_GAMES

        engine = StackIsoEngine(next(info for info in CUSTOM_GAMES if info.engine == "stack_iso"))
        engine.reset()
        evidence = collect(engine)
        compact = json.dumps(evidence, separators=(",", ":")) + "\n"
        if sys.argv[1:] == ["--write"]:
            OUTPUT.write_text(compact, encoding="utf8", newline="\n")
        else:
            assert json.loads(OUTPUT.read_text(encoding="utf8")) == evidence
        print(json.dumps([{k: v for k, v in pair.items() if k not in ("baseline", "variant")} | {
            side: {k: v for k, v in pair[side].items() if k != "frames"} for side in ("baseline", "variant")
        } for pair in evidence]))
