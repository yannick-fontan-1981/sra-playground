#!/usr/bin/env python3
"""Render the hero patchwork from the latest custom wave's real level frames.

Requires Pillow plus the same native Python dependencies as the game bridge.
All 18 selections are custom_3 games, opened at their initial level with seed 0.
Their native 64×64 pixels and palettes are preserved without darkening.
No gameplay, invented imagery, external assets, resampling or network requests.
"""
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile

from PIL import Image, ImageColor


GAMES = (
    "GRIL", "CATL", "PIPE", "KLOT", "SPOR", "RSWP",
    "DICO", "EVAS", "GIGO", "TRCP", "ONDE", "CATR",
    "CAVA", "AMZE", "MOTO", "DAME", "CWSE", "RECR",
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
        for adapter in ("game_bridge.py", "official_adapter.py", "custom_level_navigation.py"):
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
    print(f"{destination}: {size[0]}×{size[1]}, {len(GAMES)} custom_3 initial level frames")


if __name__ == "__main__":
    main()
