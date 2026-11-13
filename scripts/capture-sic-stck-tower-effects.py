"""Controlled STCK attack/push comparisons using the shipped engine."""
from copy import deepcopy
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/sic/stck-tower-effects.json"

PLAYER = (3, 3)
SPECS = (
    ("open", (3, 4), ["red", "blue"], "Adjacent · free destination"),
    ("void", (2, 3), ["yellow"], "Adjacent · no floor at destination"),
    ("hole", (4, 4), ["green", "red"], "Diagonal neighbour · hole at destination"),
    ("occupied", (3, 2), ["pink"], "Adjacent · occupied destination"),
    ("distant", (3, 1), ["blue", "cyan"], "Two cells away"),
)

def crop(rows, x, y, horizontal, above, below):
    return [row[max(0, x-horizontal):x+horizontal+1] for row in rows[max(0, y-above):y+below+1]]


def run(engine, card, specs, open_cells=()):
    from custom_games.engines.stack_iso import StackActor
    trial = deepcopy(engine)
    level = trial._level
    level.width = level.height = 7
    level.floors = {(r, c) for r in range(7) for c in range(7)} - {(1, 3), (5, 5)}
    level.holes = {(5, 5)}
    level.floors.update(open_cells)
    level.holes.difference_update(open_cells)
    level.shops = set()
    level.hint_outline_stack_card = level.hint_outline_shop_card = None
    level.player = StackActor("player", *PLAYER, [card], is_player=True)
    level.enemies = [StackActor(name, *pos, list(stack)) for name, pos, stack, _ in specs]
    trial._iso_cache.clear()
    replay = deepcopy(trial).action(5)
    seen = []
    original = trial._apply_card_animated

    def snap_state(rows):
        return (rows, {actor.actor_id: ((actor.row, actor.col), tuple(actor.cards), actor.alive)
                       for actor in level.enemies})

    def apply(actor, name, snap):
        if not actor.is_player:
            return original(actor, name, snap)
        seen.append(snap_state(trial._render_frame()))

        def record(*args, **kwargs):
            ordinary = trial._render_frame

            def render():
                rows = ordinary()
                seen.append(snap_state(rows))
                return rows

            trial._render_frame = render
            try:
                snap(*args, **kwargs)
            finally:
                del trial._render_frame

        return original(actor, name, record)

    trial._apply_card_animated = apply
    returned = trial.action(5)
    assert returned["frames"] == replay["frames"]
    assert [rows for rows, _ in seen[1:]] == returned["frames"][1:len(seen)]
    return trial, seen


def tower_frames(trial, seen, name, height):
    out = []
    for rows, states in (seen[0], seen[-2], seen[-1]):
        pos, cards, alive = states[name]
        out.append({"cell": list(pos), "cards": len(cards), "alive": alive,
                    "sprite": crop(rows, *trial._cell_center(*pos), 2, height + 1, 1)})
    return out


def collect(engine):
    _, control = run(engine, "cyan", SPECS)
    assert control[0][1] == control[-1][1]
    _, unoccupied = run(engine, "pink", SPECS[:-1])
    _, floor_added = run(engine, "pink", SPECS, open_cells=((1, 3),))
    _, hole_filled = run(engine, "pink", SPECS, open_cells=((5, 5),))
    assert unoccupied[-1][1]["occupied"] == ((3, 1), ("pink",), True)
    assert floor_added[-1][1]["void"] == ((1, 3), ("yellow",), True)
    assert hole_filled[-1][1]["hole"] == ((5, 5), ("green", "red"), True)
    results = []
    expected = {
        "red": {"open": ((3, 4), ("red",), True), "void": ((2, 3), (), False),
                "hole": ((4, 4), ("green",), True), "occupied": ((3, 2), (), False), "distant": ((3, 1), ("blue", "cyan"), True)},
        "pink": {"open": ((3, 5), ("red", "blue"), True), "void": ((2, 3), ("yellow",), True),
                 "hole": ((5, 5), (), False), "occupied": ((3, 2), ("pink",), True), "distant": ((3, 1), ("blue", "cyan"), True)},
    }
    for card in ("red", "pink"):
        trial, seen = run(engine, card, SPECS)
        assert seen[0][1] == control[0][1]
        assert seen[-1][1] == expected[card]
        phases = (seen[0], seen[-2], seen[-1])
        x, y = trial._cell_center(*PLAYER)
        results.append({"card": card, "frames": [
            {"focus": [row[1:9] for row in rows[48:53]],
             "board": crop(rows, x, y, 12, 10, 10)} for rows, _ in phases
        ], "towers": [
            {"id": name, "condition": condition,
             "frames": tower_frames(trial, seen, name, len(stack))}
            for name, _, stack, condition in SPECS
        ]})
    return results


if __name__ == "__main__":
    with TemporaryDirectory(prefix="sic-stck-towers-") as directory:
        with ZipFile(ROOT / "public/python/custom-games.zip") as bundle:
            bundle.extractall(directory)
        sys.path.insert(0, directory)
        from custom_games.engines.stack_iso import StackIsoEngine
        from custom_games.registry import CUSTOM_GAMES

        game = StackIsoEngine(next(info for info in CUSTOM_GAMES if info.engine == "stack_iso"))
        game.reset()
        results = collect(game)
        if sys.argv[1:] == ["--write"]:
            OUTPUT.write_text(json.dumps(results, separators=(",", ":")) + "\n", encoding="utf8", newline="\n")
        else:
            assert json.loads(OUTPUT.read_text(encoding="utf8")) == results
        print(json.dumps({trial["card"]: {tower["id"]: {
            key: value for key, value in tower["frames"][-1].items() if key != "sprite"
        } for tower in trial["towers"]} for trial in results}))
