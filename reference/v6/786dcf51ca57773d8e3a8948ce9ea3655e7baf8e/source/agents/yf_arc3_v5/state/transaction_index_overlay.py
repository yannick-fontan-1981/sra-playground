"""Isolated, lazy projections of canonical in-memory indexes.

Index leaves are immutable records/references. Nested dictionaries stay lazy;
only an accessed list/set bucket is shallow-copied. Discarding this overlay
therefore discards every speculative write, including nested deletions.
"""
from collections.abc import MutableMapping


class TransactionIndexOverlay(MutableMapping):
    def __init__(self, base):
        self._base = base
        self._writes = {}
        self._deleted = set()

    def __getitem__(self, key):
        if key in self._deleted:
            raise KeyError(key)
        if key in self._writes:
            return self._writes[key]
        value = self._base[key]
        if isinstance(value, dict):
            value = TransactionIndexOverlay(value)
        elif isinstance(value, list):
            value = list(value)
        elif isinstance(value, set):
            value = set(value)
        else:
            return value
        self._writes[key] = value
        return value

    def __setitem__(self, key, value):
        self._deleted.discard(key)
        self._writes[key] = value

    def __delitem__(self, key):
        if key not in self:
            raise KeyError(key)
        self._writes.pop(key, None)
        self._deleted.add(key)

    def __contains__(self, key):
        return key not in self._deleted and (key in self._writes or key in self._base)

    def __iter__(self):
        for key in self._base:
            if key not in self._deleted:
                yield key
        for key in self._writes:
            if key not in self._base:
                yield key

    def __len__(self):
        return sum(1 for _ in self)


class TransactionArtifactView:
    """Read-only canonical lookup plus the already examined transaction prefix.

    The base store is never indexed here. Keeping this view independent from
    journal append also lets composition-context checks resolve same-batch
    checkpoints, execution records, intents and permits in their actual order.
    """
    def __init__(self, store, *, operational_consciousness=None):
        self._store = store
        self._operational_consciousness = operational_consciousness
        self._artifacts = {}
        self._workflows = {}

    @property
    def run_id(self):
        return self._store.run_id

    @property
    def operational_consciousness(self):
        """Use the same examined prefix as artifact(), without making it durable."""
        if self._operational_consciousness is not None:
            return self._operational_consciousness
        return self._store.operational_consciousness

    @property
    def committed_evidence_store(self):
        """Observation/DERIVE receipts must already have durable event sequences.

        This is intentionally separate from artifact(), which can see the
        examined prefix. Pending artifacts cannot certify completed acquisition.
        """
        return self._store

    def artifact(self, artifact_ref):
        if artifact_ref in self._artifacts:
            return self._artifacts[artifact_ref]
        return self._store.artifact(artifact_ref)

    def latest_workflow_instance(self, workflow_ref):
        if workflow_ref in self._workflows:
            return self._workflows[workflow_ref]
        return self._store.latest_workflow_instance(workflow_ref)

    def index_artifact(self, artifact):
        from agents.yf_arc3_v5.logos.operations import WorkflowInstanceRecord
        self._artifacts[artifact.id] = artifact
        if isinstance(artifact, WorkflowInstanceRecord):
            self._workflows[artifact.workflow_instance_id] = artifact
