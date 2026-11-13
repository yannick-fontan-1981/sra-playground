"""Load intact upstream sources in a private namespace; no global inference/taaf."""
from __future__ import annotations

import importlib
import importlib.abc
import importlib.util
from pathlib import Path
import re
import sys

PREFIX = "_yf_arc3_v6_harness"
ROOT = Path(__file__).parent / "upstream" / "harness" / "inference"


class _Loader(importlib.abc.SourceLoader):
    def __init__(self, path):
        self.path = path

    def get_filename(self, fullname):
        return str(self.path)

    def get_data(self, path):
        return Path(path).read_bytes()

    def source_to_code(self, data, path, *, _optimize=-1):
        source = data.decode("utf-8")
        source = re.sub(r"\bfrom inference(?=[.\s])", f"from {PREFIX}", source)
        source = re.sub(r"\bimport inference(?=[.\s])", f"import {PREFIX}", source)
        source = re.sub(r"\binference\.", f"{PREFIX}.", source)
        # Windows lacks killpg. The sandbox's isolated child cannot spawn children.
        source = source.replace("os.killpg(process.pid, signal.SIGKILL)",
                                "process.kill() if os.name == 'nt' else os.killpg(process.pid, signal.SIGKILL)")
        if self.path.name == "python_tool_sandbox.py":
            source = source.replace("import inspect", f"import inspect\nfrom {__package__}.windows_transport import sandbox_command", 1)
            source, count = re.subn(
                r'\[sys\.executable, "-I", "-S", "-c",\s*(_SANDBOX_BOOTSTRAP if tracker is None else _SANDBOX_BOOTSTRAP_DELTA)\]',
                r'sandbox_command(sandbox_dir, \1)', source)
            if count != 1:
                raise ImportError("Upstream sandbox transport changed; review adapter")
        return compile(source, path, "exec", dont_inherit=True, optimize=_optimize)


class _Finder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname != PREFIX and not fullname.startswith(PREFIX + "."):
            return None
        relative = fullname[len(PREFIX):].lstrip(".").replace(".", "/")
        location = ROOT / relative
        package = location.is_dir()
        source = location / "__init__.py" if package else location.with_suffix(".py")
        if not source.exists():
            return None
        return importlib.util.spec_from_file_location(fullname, source, loader=_Loader(source),
            submodule_search_locations=[str(location)] if package else None)


def load(name):
    if not any(isinstance(finder, _Finder) for finder in sys.meta_path):
        sys.meta_path.insert(0, _Finder())
    return importlib.import_module(PREFIX + "." + name)
