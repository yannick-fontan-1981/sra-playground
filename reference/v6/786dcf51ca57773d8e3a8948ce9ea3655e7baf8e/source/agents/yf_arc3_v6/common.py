"""Public entry point for the code-only common solver.

Run: python -m agents.yf_arc3_v6.common --help
No model server is started by this entry point.
"""
from pathlib import Path
import sys


def main():
    proto = str(Path(__file__).with_name("laya_proto"))
    if proto not in sys.path:
        sys.path.insert(0, proto)
    from common_frontier_runtime import main as run
    return run()


if __name__ == "__main__":
    main()
