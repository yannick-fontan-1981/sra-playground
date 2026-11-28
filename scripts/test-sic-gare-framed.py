"""Run the GARE catalogue witnesses with the original command line."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name("test-sic-catalogue-lines.py")), run_name="__main__")
