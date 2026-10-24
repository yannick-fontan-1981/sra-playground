#!/usr/bin/env python3
"""Render the hero mosaic from genuine bundled games' initial public frames.

Requires Pillow plus the same native Python dependencies as the game bridge.
No gameplay, image generation, external assets, resampling or network requests.
"""
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile

from PIL import Image, ImageColor


GAMES = (
    "LS20", "PIPE", "FT09", "COLM", "RE86", "SKBN",
    "BP35", "HANO", "VC33", "DNOI", "TN36", "GORI",
    "LF52", "KATA", "SP80", "ONDE", "TU93", "ELAS",
)
COLUMNS = 6
TILE_SIZE = 64
GUTTER = 3
BACKGROUND = "#0e0c0c"


def main() -> None:
    site = Path(__file__).resolve().parents[1]
    assets = site / "public" / "python"
    rows = (len(GAMES) + COLUMNS - 1) // COLUMNS
    size = (COLUMNS * TILE_SIZE + (COLUMNS + 1) * GUTTER,
            rows * TILE_SIZE + (rows + 1) * GUTTER)
    mosaic = Image.new("RGB", size, BACKGROUND)

    with tempfile.TemporaryDirectory(prefix="sra-mosaic-") as directory:
        runtime = Path(directory)
        for bundle in ("custom-games.zip", "official-games.zip"):
            with zipfile.ZipFile(assets / bundle) as archive:
                archive.extractall(runtime)
        for adapter in ("game_bridge.py", "official_adapter.py"):
            shutil.copyfile(assets / adapter, runtime / adapter)
        sys.path.insert(0, str(runtime))
        from game_bridge import load_game

        for index, code in enumerate(GAMES):
            observation = load_game(code)
            palette = [ImageColor.getrgb(color) for color in observation["palette"]]
            tile = Image.new("RGB", (TILE_SIZE, TILE_SIZE))
            tile.putdata([palette[pixel] for row in observation["frame"] for pixel in row])
            position = (GUTTER + (index % COLUMNS) * (TILE_SIZE + GUTTER),
                        GUTTER + (index // COLUMNS) * (TILE_SIZE + GUTTER))
            mosaic.paste(tile, position)

    destination = site / "public" / "game-mosaic.png"
    mosaic.save(destination, format="PNG", optimize=True)
    print(f"{destination}: {size[0]}×{size[1]}, {len(GAMES)} initial game frames")


if __name__ == "__main__":
    main()
