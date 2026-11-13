"""Lightweight package boundary; application discovery is deferred.

Symbolic submodules may be imported without loading agents, optional models,
environment configuration or recordings. Existing public agent exports remain
available through the lazily imported application catalogue.
"""

DEFAULT_AGENT = "yf-arc3-v5"

__all__ = [
    "Swarm", "Random", "LangGraphFunc", "LangGraphTextOnly",
    "LangGraphThinking", "LangGraphRandom", "LLM", "FastLLM",
    "ReasoningLLM", "GuidedLLM", "ReasoningAgent", "SmolCodingAgent",
    "SmolVisionAgent", "Recorder", "AVAILABLE_AGENTS", "DEFAULT_AGENT",
    "YFArc3V5Agent",
]

_CATALOG_EXPORTS = (frozenset(__all__) - {"DEFAULT_AGENT"}) | {"Agent", "Playback"}


def __getattr__(name):
    if name not in _CATALOG_EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from importlib import import_module

    value = getattr(import_module("._catalog", __name__), name)
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | _CATALOG_EXPORTS)
