"""Choose an environment adapter and bind physical inputs before admission."""
import re
from pathlib import Path
from catalog import sha


def resolve_transport(identifier):
    if not re.fullmatch(r'[a-z0-9]+-[a-z0-9]+',identifier):
        raise ValueError('An exact versioned transport identifier is required')
    from custom_games.registry import get_custom_game
    from tools import yf_v5_env_bridge as official
    from custom_bridge import CustomSession
    from neutral_probe_runtime import creator_environment_binding
    custom = get_custom_game(identifier)
    source = official._source_path(official.resolve_sidecar_root()/'environment_files',identifier)
    if (custom is None) == (source is None):
        raise ValueError('Transport provenance absent or ambiguous')
    if custom is not None:
        return CustomSession,creator_environment_binding(identifier)
    from tools import official_instance_determinism
    from custom_games import registry
    from agents.yf_arc3_v6 import __main__ as slot_owner
    files=[source,source.parent/'metadata.json',Path(official.__file__),Path(official_instance_determinism.__file__),
           Path(registry.__file__),Path(slot_owner.__file__)]
    return official.OfficialEnvSession,{str(path.resolve()):sha(path) for path in files}
