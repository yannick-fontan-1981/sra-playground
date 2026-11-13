"""Local controlled click cases for the Node audit. Keep pixel data inside the pipe."""
from copy import deepcopy
import gzip
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "docs/migration/native-campaigns-v42/stck-four-level-public-trace.json.gz"


def cases(engine):
    packets = json.loads(gzip.decompress(ARCHIVE.read_bytes()))["packets"]
    known = set()
    controlled = []
    for item in packets[1:]:
        command = item["command"]
        data = command.get("data") or {}
        action = int(command["action_ref"].removeprefix("ACTION"))
        before = engine.public_state()
        stack = tuple(engine._level.player.cards)
        key = (before["level"], stack)
        if key not in known and stack:
            known.add(key)
            height, gap, bottom, _ = engine._stack_layout()
            for index in range(len(stack)):
                point = [4, bottom - (height + gap) * index - height // 2]
                test = deepcopy(engine)
                assert test._hit_stack_card(*point) == index
                after = test.action(6, dict(zip(("x", "y"), point)))
                controlled.append([before["level"], point, before["frame"], after["frame"], index + 1, len(stack)])
        observed = engine.action(action, data) if data else engine.action(action)
        assert observed["frame"] == item["packet"]["frame_rows"]
    return controlled


if __name__ == "__main__":
    with TemporaryDirectory(prefix="sic-stck-rank-") as directory:
        with ZipFile(ROOT / "public/python/custom-games.zip") as bundle:
            bundle.extractall(directory)
        sys.path.insert(0, directory)
        from custom_games.engines.stack_iso import StackIsoEngine
        from custom_games.registry import CUSTOM_GAMES

        engine = StackIsoEngine(next(info for info in CUSTOM_GAMES if info.engine == "stack_iso"))
        engine.reset()
        # Opt in only when called by the local consumer; default output is a count.
        result = cases(engine)
        print(json.dumps(result if sys.argv[1:] == ["--local-audit-pipe"] else {"controlled_cases": len(result)}))
