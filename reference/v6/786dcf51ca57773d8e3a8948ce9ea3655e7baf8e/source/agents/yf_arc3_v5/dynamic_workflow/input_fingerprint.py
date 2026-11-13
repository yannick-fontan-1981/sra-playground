"""Versioned named-input attestation without rebuilding canonical payload bytes."""

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


INPUT_FINGERPRINT_PREFIX = "dynamic-inputs.v2:"
INPUT_FINGERPRINT_DOMAIN = "yf_arc3_v5.dynamic_input.named_child_digests.v2"


def require_current_input_fingerprint(value: str) -> str:
    suffix = value.removeprefix(INPUT_FINGERPRINT_PREFIX)
    if (not value.startswith(INPUT_FINGERPRINT_PREFIX) or len(suffix) != 64
            or any(char not in "0123456789abcdef" for char in suffix)):
        raise ValueError("dynamic input fingerprint requires named-child-digests v2; old restores are invalid")
    return value


def fingerprint_inputs(values: FrozenMap) -> tuple[FrozenMap, str]:
    # Each child retains its exact canonical SHA. Only this explicitly versioned
    # envelope uses Merkle composition. Never install it in values._digest:
    # stable_digest(values) continues to mean the original canonical JSON SHA.
    children = FrozenMap({name: stable_digest(value)
                          for name, value in sorted(values.items())})
    envelope = stable_digest((INPUT_FINGERPRINT_DOMAIN, children))
    return children, INPUT_FINGERPRINT_PREFIX + envelope
