"""Render-only STCK intervention on the shipped engine, outside the agent."""
from copy import deepcopy
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]

def bbox_at(rows, x, y):
    color = rows[y][x]
    points = {(x, y)}
    pending = [(x, y)]
    for px, py in pending:
        for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
            if 0 <= ny < len(rows) and 0 <= nx < len(rows[ny]) and (nx, ny) not in points and rows[ny][nx] == color:
                points.add((nx, ny))
                pending.append((nx, ny))
    return (min(x for x, _ in points), min(y for _, y in points),
            max(x for x, _ in points), max(y for _, y in points)), points

def trial(engine, point, variant):
    control, altered = deepcopy(engine), deepcopy(engine)
    x, y = point
    initial = control.public_state()["frame"]
    box, support = bbox_at(initial, x, y)
    left, top, right, _ = box
    assert top >= 2
    original = altered._render_frame

    def render_variant():
        frame = original()
        for py in range(top - 2, top):
            for px in range(left, right + 1):
                frame[py][px] = variant[px % len(variant)]
        return frame

    altered._render_frame = render_variant
    shown = altered.public_state()["frame"]
    changed = [(px, py) for py, row in enumerate(initial) for px, value in enumerate(row) if value != shown[py][px]]
    assert changed and all(left <= px <= right and top - 2 <= py < top for px, py in changed)
    del altered._render_frame  # Compare both returns using the ordinary renderer.
    data = {"x": x, "y": y}
    cards_before = len(control._level.player.cards)
    hit_card = control._hit_stack_card(x, y)
    hit_button = control._hit_shop_button(x, y)
    actual = control.action(6, data)
    counterfactual = altered.action(6, data)
    keys = ("frame", "frames", "level", "levels_completed", "state", "available_actions")
    assert all(actual[key] == counterfactual[key] for key in keys)
    _, returned_support = bbox_at(actual["frame"], x, y)
    return {
        "level": actual["level"], "click": point,
        "control_above": sorted({initial[py][px] for py in range(top - 2, top) for px in range(left, right + 1)}),
        "variant_above": sorted({shown[py][px] for py in range(top - 2, top) for px in range(left, right + 1)}),
        "changed_before_pixels": len(changed), "identical_returns": True,
        "target_pixels": len(support), "color_before": initial[y][x], "color_after": actual["frame"][y][x],
        "same_support": support == returned_support,
        "engine_diagnostic": {
            "hit_stack_card_index": hit_card, "hit_shop_button": hit_button,
            "cards_before": cards_before, "cards_after": len(control._level.player.cards),
        },
    }

def main():
    with TemporaryDirectory(prefix="sic-stck-") as directory:
        with ZipFile(ROOT / "public/python/custom-games.zip") as bundle:
            bundle.extractall(directory)
        sys.path.insert(0, directory)
        from custom_games.engines.stack_iso import StackIsoEngine
        from custom_games.registry import CUSTOM_GAMES
        engine = StackIsoEngine(next(info for info in CUSTOM_GAMES if info.engine == "stack_iso"))
        engine.reset()
        level1 = trial(engine, (4, 50), (4,))
        # Public commands from the recorded three-level STCK run through action 17.
        prefix = [(4, 50), (46, 56), None, (16, 56), (16, 56), (26, 56), (46, 56), (46, 56),
                  None, None, (16, 56), (36, 56), None, (16, 56), (46, 56), (6, 56), (46, 56)]
        for point in prefix:
            engine.action(5) if point is None else engine.action(6, {"x": point[0], "y": point[1]})
        assert engine.levels_completed == 2
        level3 = trial(engine, (4, 26), (0, 9))
        print(json.dumps([level1, level3]))

if __name__ == "__main__":
    main()
