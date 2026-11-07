"""Shared exact augmenting-path matcher extracted from typed socket assignment."""


def maximum_injective_matching(domains, visit=None):
    """One maximum witness; supplied domain order, no priority or route search.

    Optional visit charges each attempted edge to the caller's actual bound.
    Unfilled indices are this matching's witness, not uniquely impossible items.
    """
    owner = {}

    def augment(index, visited):
        for ref in domains[index]:
            if visit is not None:
                visit(index, ref)
            if ref in visited:
                continue
            visited.add(ref)
            previous = owner.get(ref)
            if previous is None or augment(previous, visited):
                owner[ref] = index
                return True
        return False

    for index in range(len(domains)):
        augment(index, set())
    assigned = tuple(sorted((index, ref) for ref, index in sorted(owner.items())))
    filled = frozenset(index for index, _ in assigned)
    return assigned, tuple(index for index in range(len(domains)) if index not in filled)
