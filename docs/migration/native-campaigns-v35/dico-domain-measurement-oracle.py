"""Pure original observer/check oracle on supplied public packets; no agent loop."""
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

source = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(source))
from neutral_observer import measure
from common_mechanisms import _check, MAX_ENTITIES

data = json.load(sys.stdin)
before, _ = measure(SimpleNamespace(**data['before']), data['before']['step_index'] + 1, 'domain-witness')
after, _ = measure(SimpleNamespace(**data['after']), data['after']['step_index'] + 1, 'domain-witness')
try:
    _check(before, after, data['command'])
    check = {'accepted': True}
except Exception as error:
    check = {'accepted': False, 'type': type(error).__name__, 'message': str(error)}
print(json.dumps({'before': before, 'after': after, 'check': check, 'maxEntities': MAX_ENTITIES,
    'sourceSha256': {name: hashlib.sha256((source / name).read_bytes()).hexdigest()
                     for name in ['neutral_observer.py', 'geometric_observer.py', 'common_mechanisms.py']}}))
