"""Compose DICO navigation with the partition and opening already present on a pinned engine."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("parent")
parser.add_argument("navigation")
parser.add_argument("output", type=Path)
args = parser.parse_args()

FROZEN = "d0e7527ca8033bd805a6d7a8bb021eff62e87021"
SOLVER = "src/logos-engine/v6-subset-diagnosis.ts"
PARTITION = "src/sic/subset-query.ts"
OPENING = "src/sic/opening-curiosity.ts"

def git(*parts):
    return subprocess.check_output(["git", *parts])

def resolve(revision):
    return git("rev-parse", "--verify", revision + "^{commit}").decode().strip()

def blob(revision, path):
    return git("show", revision + ":" + path)

def between(source, start, end):
    first = source.index(start)
    return source[first:source.index(end, first)]

def insert(source, anchor, value):
    if source.count(anchor) != 1:
        raise ValueError("Expected a unique production anchor: " + anchor)
    return source.replace(anchor, value + anchor)

parent, candidate = map(resolve, (args.parent, args.navigation))
assert git("diff", "--name-only", FROZEN, candidate, "--", "src").decode().splitlines() == [SOLVER]
base, partitioned, navigation = (blob(sha, SOLVER).decode() for sha in (FROZEN, parent, candidate))
assert blob(parent, PARTITION) == blob("c0b9f402", PARTITION)
assert blob(parent, OPENING) == blob("e2178163", OPENING)
assert "selectSubsetQuery(offers)" in partitioned

type_start, type_end = "type SubsetNavigationOffer", "const clone="
method_start, method_end = " selectNavigationOffer(", " async propose("
nav_start, nav_end = "  const nav:", "  else{\n   if(candidates.length){"
new_type = between(navigation, type_start, type_end)
new_method = between(navigation, method_start, method_end)
old_nav, parent_nav, new_nav = (between(text, nav_start, nav_end) for text in (base, partitioned, navigation))
assert old_nav == parent_nav
assert navigation.replace(new_type, "").replace(new_method, "").replace(new_nav, old_nav) == base
assert partitioned.count(parent_nav) == 1 and "selectSubsetQuery(offers)" not in new_nav

combined = insert(partitioned, type_end, new_type)
combined = insert(combined, method_end, new_method).replace(parent_nav, new_nav)
assert combined.replace(new_type, "").replace(new_method, "").replace(new_nav, old_nav) == partitioned
encoded = combined.encode()
with args.output.open("xb") as stream:
    stream.write(encoded)
print(json.dumps({"parent": parent, "navigation": candidate, "path": SOLVER,
    "combinedGitBlob": git("hash-object", str(args.output)).decode().strip(),
    "combinedSHA256": hashlib.sha256(encoded).hexdigest(),
    "parentPartitionGitBlob": git("rev-parse", parent + ":" + PARTITION).decode().strip(),
    "parentOpeningGitBlob": git("rev-parse", parent + ":" + OPENING).decode().strip()}, indent=2))
