#!/usr/bin/env python3
"""Render every authored level into four compact, native-pixel gallery atlases.

Run from any directory with Python 3.12+, Pillow and the game runtime's native
dependencies installed, plus Node 22.18+ for the canonical TypeScript catalogue.
The source ZIPs, host adapters and seed match the browser playground. No actions
are played: each thumbnail is the initial public frame of its selected level.
The script performs no network requests and does not modify game mechanics.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

from PIL import Image, ImageColor


GROUPS = ("custom", "custom_2", "custom_3", "official")
TILE_SIZE = 64
BACKGROUND = "#0e0c0c"


def catalogue(site: Path) -> dict:
    """Use the same game IDs, groups and counts as the browser interface."""
    source = (
        "import { GAME_CATALOG, SOURCE_COMMIT } from './src/games/catalog.ts';"
        "process.stdout.write(JSON.stringify({games:GAME_CATALOG,sourceCommit:SOURCE_COMMIT}));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source],
        cwd=site, check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def frame_pixels(observation: dict, code: str, level: int) -> bytes:
    assert observation["code"] == code, (code, "wrong game")
    assert observation["level"] == level, (code, level, "wrong level")
    assert observation["state"] == "NOT_FINISHED", (code, level, "not playable")
    assert not observation["canUndo"], (code, level, "unexpected action history")
    frame = observation["frame"]
    assert len(frame) == TILE_SIZE and all(len(row) == TILE_SIZE for row in frame)
    values = bytes(pixel for row in frame for pixel in row)
    assert len(values) == TILE_SIZE * TILE_SIZE and max(values) < 16
    return values


def main() -> None:
    site = Path(__file__).resolve().parents[1]
    source = catalogue(site)
    games = source["games"]
    assert len(games) == 100 and len({game["code"] for game in games}) == 100
    assert {game["group"] for game in games} == set(GROUPS)
    assert all(isinstance(game["levels"], int) and game["levels"] > 0 for game in games)
    assets = site / "public" / "python"
    destination = site / "public" / "gallery"
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {"tileSize": TILE_SIZE, "sourceCommit": source["sourceCommit"], "groups": []}
    total_levels = 0
    total_bytes = 0

    with tempfile.TemporaryDirectory(prefix="sra-gallery-assets-") as directory:
        runtime = Path(directory)
        for bundle in ("custom-games.zip", "official-games.zip"):
            with zipfile.ZipFile(assets / bundle) as archive:
                archive.extractall(runtime)
        for adapter in ("game_bridge.py", "official_adapter.py", "custom_level_navigation.py"):
            shutil.copyfile(assets / adapter, runtime / adapter)
        sys.path.insert(0, str(runtime))
        from game_bridge import load_game, select_level

        for group in GROUPS:
            entries = sorted((game for game in games if game["group"] == group), key=lambda game: game["code"])
            assert len(entries) == 25, (group, len(entries))
            rows = len(entries)
            columns = max(game["levels"] for game in entries)
            width, height = columns * TILE_SIZE, rows * TILE_SIZE
            atlas = Image.new("RGB", (width, height), BACKGROUND)
            group_data = {
                "id": group, "rows": rows, "columns": columns,
                "image": f"/gallery/{group}.png", "width": width, "height": height,
                "sha256": "", "games": [],
            }

            for row, game in enumerate(entries):
                code = game["code"]
                initial = load_game(code)
                assert initial["gameId"] == game["id"], (code, "game ID differs from catalogue")
                assert initial["levelCount"] == game["levels"], (code, "level count differs from catalogue")
                assert initial["canSelectLevel"], (code, "manual selection unavailable")
                item = {"code": code, "row": row, "levelCount": game["levels"], "levels": []}

                for level in range(1, game["levels"] + 1):
                    observation = initial if level == 1 else select_level(level)
                    pixels = frame_pixels(observation, code, level)
                    palette = [ImageColor.getrgb(color) for color in observation["palette"]]
                    assert len(palette) == 16
                    tile = Image.new("RGB", (TILE_SIZE, TILE_SIZE))
                    tile.putdata([palette[index] for index in pixels])
                    column = level - 1
                    atlas.paste(tile, (column * TILE_SIZE, row * TILE_SIZE))
                    item["levels"].append({
                        "level": level, "column": column,
                        "frameSha256": hashlib.sha256(pixels).hexdigest(),
                    })
                    total_levels += 1
                group_data["games"].append(item)

            target = destination / f"{group}.png"
            temporary = runtime / f"{group}.png"
            atlas.save(temporary, format="PNG", optimize=True)
            encoded = temporary.read_bytes()
            group_data["sha256"] = hashlib.sha256(encoded).hexdigest()
            with Image.open(temporary) as saved:
                assert saved.size == (width, height)
                # Lossless output must reproduce every original native RGB pixel.
                assert saved.convert("RGB").tobytes() == atlas.tobytes()
            target.write_bytes(encoded)
            total_bytes += len(encoded)
            manifest["groups"].append(group_data)
            print(f"{group}: {len(entries)} games, {sum(game['levels'] for game in entries)} levels, "
                  f"{width}×{height}, {len(encoded)} bytes", flush=True)

    assert total_levels == sum(game["levels"] for game in games)
    output = site / "content" / "game-gallery-assets.json"
    output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"games": len(games), "levels": total_levels, "atlases": len(GROUPS),
                      "imageBytes": total_bytes, "manifest": str(output)}))


if __name__ == "__main__":
    main()
