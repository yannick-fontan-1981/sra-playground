#!/usr/bin/env python3
"""Plan bounded, ordinary fast-forward source pushes after the official window.

Run only once the final delivery is committed and the checkout is clean:

  python -B docs/migration/lot10a-evidence/plan-bounded-source-transport.py \
    --base FULL_ACTUALLY_PUBLISHED_PREDECESSOR_COMMIT --target HEAD \
    --output /ABSOLUTE/PATH/OUTSIDE/CHECKOUT/lot10a-source-push-plan.json

This creates Git tree/commit objects with a temporary index. It never changes
HEAD, a branch, the real index, a worktree file, credentials, or a remote. It
does not build, package, push, or deploy. The exclusive JSON output is outside
the checkout. A failed plan is retained there and must not be executed.

Every step counts ALL objects newly reachable from ALL of its parents, against
the previous planned remote commit, using rev-list and cat-file object sizes.
40 MiB of raw object contents is a bound with headroom below the observed
64 MiB server limit; it is not a measurement or guarantee of wire pack size.
Large proof blobs are deferred, while all other target paths are complete in
the first step. The final tree is exactly the original HEAD tree, and the
original HEAD is a direct parent of the final transport commit.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = b'docs/migration/lot10a-evidence/'
DEFAULT_WINDOW = ROOT / 'docs/migration/lot10a-evidence/performance-integrated/window.json'
RAW_LIMIT = 40 * 1024 * 1024
SERVER_LIMIT = 64 * 1024 * 1024
SCHEMA = 'logos-engine.bounded-source-push-plan.v2'
REDIRECT_ENV = ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
                'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
                'GIT_SHALLOW_FILE')
DATA_SUFFIX = re.compile(rb'\.(?:json|jsonl|ndjson|log|txt|csv|gz|zip|tar|bin|'
                         rb'png|jpe?g|webp|pdf|webm|mp4)(?:\.part[0-9]+)?$')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True,
                      separators=(',', ':')).encode('utf-8')


def fingerprint(path):
    path = Path(path).resolve()
    digest = hashlib.sha256()
    size = 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
            size += len(block)
    label = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
    return {'path': label, 'bytes': size, 'sha256': digest.hexdigest()}


def path_label(path):
    return path.decode('utf-8', 'surrogateescape')


def passed_window(path):
    path = path.resolve(strict=True)
    require(path.is_relative_to(ROOT), 'The completed window receipt must be inside this checkout')
    data = json.loads(path.read_bytes())
    require(data.get('schema') == 'logos-engine.native-cost-window.v1'
            and data.get('status') == 'passed' and data.get('finalIntegrity') == 'passed',
            'Refusing planning before a passed, integrity-checked official window')
    order = ['A1', 'B1', 'B2', 'A2']
    runs = data.get('executions', [])
    require(data.get('plannedOrder') == order and [row.get('label') for row in runs] == order
            and all(row.get('status') == 'passed' and row.get('exitCode') == 0
                    and row.get('finishedAt') for row in runs),
            'The official ABBA window is incomplete')
    finished = datetime.fromisoformat(data['finishedAt'].replace('Z', '+00:00'))
    require(finished.tzinfo is not None and finished <= datetime.now(timezone.utc),
            'The window has no completed past timestamp')
    return fingerprint(path)


@dataclass(frozen=True)
class Entry:
    mode: bytes
    kind: str
    oid: str


class Planner:
    def __init__(self, args, plan):
        self.args, self.plan = args, plan
        self.env = os.environ.copy()
        self.env.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0',
                        GIT_NO_LAZY_FETCH='1', GIT_NO_REPLACE_OBJECTS='1')
        self.objects = {}
        self.uploaded = set()
        self.steps = plan['steps']
        self.created = plan['createdCommitObjects']
        self.identity = []
        self.before = None
        self.current = None

    def git(self, *args, data=None, index=None, check=True, identity=False):
        env = self.env.copy()
        if index is not None:
            env['GIT_INDEX_FILE'] = str(index)
        command = ['git', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0',
                   '-c', 'maintenance.auto=false', '-c', 'commit.gpgsign=false']
        if identity:
            command += self.identity
        result = subprocess.run(command + list(args), cwd=ROOT, env=env,
                                input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if check and result.returncode:
            detail = result.stderr.decode('utf-8', 'replace').strip()[:5000]
            raise ValueError(f'git {args[0]} failed ({result.returncode}): {detail}')
        return result

    def text(self, *args, **kwargs):
        return self.git(*args, **kwargs).stdout.decode('utf-8', 'strict').strip()

    def resolve_commit(self, value):
        require(value == 'HEAD' or re.fullmatch(r'[0-9a-fA-F]{40}', value),
                'Commit arguments must be HEAD or a full SHA-1 commit ID')
        return self.text('rev-parse', '--verify', '--end-of-options', value + '^{commit}')

    def ancestor(self, older, newer):
        result = self.git('merge-base', '--is-ancestor', older, newer, check=False)
        require(result.returncode in (0, 1), 'Unable to check commit ancestry')
        return result.returncode == 0

    def snapshot(self):
        status = self.git('status', '--porcelain=v1', '-z', '--untracked-files=all').stdout
        index = (ROOT / self.text('rev-parse', '--git-path', 'index')).resolve()
        require(index.is_file(), 'The real Git index is missing')
        refs = self.git('for-each-ref', '--format=%(refname) %(objectname)').stdout
        symbolic = self.git('symbolic-ref', '-q', 'HEAD', check=False)
        require(symbolic.returncode in (0, 1), 'Unable to read symbolic HEAD')
        return {'head': self.text('rev-parse', '--verify', 'HEAD'),
                'symbolicHead': symbolic.stdout.decode().strip() or None,
                'index': fingerprint(index),
                'refsSha256': hashlib.sha256(refs).hexdigest(),
                'statusBytes': len(status), 'statusSha256': hashlib.sha256(status).hexdigest()}

    def tree_entries(self, tree):
        result = {}
        for record in self.git('ls-tree', '-r', '-z', '--full-tree', tree).stdout.split(b'\0'):
            if not record:
                continue
            header, path = record.split(b'\t', 1)
            mode, kind, oid = header.split(b' ')
            require(path not in result, 'Duplicate Git tree path')
            result[path] = Entry(mode, kind.decode('ascii'), oid.decode('ascii'))
        return result

    def object_info(self, ids):
        needed = sorted(set(ids) - self.objects.keys())
        if needed:
            raw = self.git('cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)',
                           data=('\n'.join(needed) + '\n').encode('ascii')).stdout
            lines = raw.splitlines()
            require(len(lines) == len(needed), 'Incomplete Git object inventory')
            for expected, line in zip(needed, lines):
                fields = line.decode('ascii').split()
                require(len(fields) == 3 and fields[0] == expected and fields[2].isdigit()
                        and fields[1] in ('commit', 'tree', 'blob', 'tag'),
                        f'Missing or invalid local Git object: {expected}')
                self.objects[expected] = {'oid': expected, 'type': fields[1], 'bytes': int(fields[2])}
        return [self.objects[oid] for oid in sorted(set(ids))]

    def missing(self, commit, previous):
        ids = self.text('rev-list', '--objects', '--no-object-names', commit, '--not', previous).splitlines()
        require(len(ids) == len(set(ids)), 'Duplicate IDs in Git missing-object traversal')
        objects = self.object_info(ids)
        by_type = {}
        for item in objects:
            row = by_type.setdefault(item['type'], {'count': 0, 'bytes': 0})
            row['count'] += 1
            row['bytes'] += item['bytes']
        return {'count': len(objects), 'rawBytes': sum(row['bytes'] for row in objects),
                'byType': by_type, 'inventorySha256': hashlib.sha256(canonical(objects)).hexdigest(),
                'objects': objects}

    def commit(self, tree, parents, message):
        require(len(parents) == len(set(parents)), 'Duplicate transport parents')
        args = ['commit-tree', tree]
        for parent in parents:
            args += ['-p', parent]
        oid = self.text(*args, data=(message + '\n').encode('utf-8'), identity=True)
        require(re.fullmatch(r'[0-9a-f]{40}', oid), 'Invalid commit-tree result')
        if oid not in self.created:
            self.created.append(oid)
        return oid

    def differing_paths(self, tree, target_tree):
        raw = self.git('diff-tree', '-r', '--no-commit-id', '--name-only', '-z',
                       '--no-renames', '--no-ext-diff', tree, target_tree).stdout
        return set(filter(None, raw.split(b'\0')))

    def accept(self, kind, commit, tree, parents, stats, paths=()):
        require(parents[0] == self.current and self.ancestor(self.current, commit),
                'A planned step is not a fast-forward from its predecessor')
        require(stats['rawBytes'] <= self.args.max_missing_raw_bytes,
                f'{kind} exceeds the per-step raw missing-object limit')
        delta = self.differing_paths(tree, self.target_tree)
        require(delta <= self.deferred, 'A step leaves a non-deferred target source path incomplete')
        require(not (self.uploaded & {row['oid'] for row in stats['objects']}),
                'A missing object was incorrectly counted in more than one transport step')
        self.steps.append({'step': len(self.steps) + 1, 'kind': kind,
                           'previousCommit': self.current, 'commit': commit, 'tree': tree,
                           'parents': parents, 'rawMissingObjectBytes': stats['rawBytes'],
                           'missingObjects': stats, 'changedPaths': sorted(map(path_label, paths)),
                           'nonDeferredPathsExactlyMatchTarget': True,
                           'remainingDeferredPaths': sorted(map(path_label, delta))})
        self.uploaded.update(row['oid'] for row in stats['objects'])
        self.current = commit

    def write_step_tree(self, index, paths):
        self.git('read-tree', self.current, index=index)
        records = []
        for path in sorted(paths):
            if path not in self.target_entries:
                records.append(b'0 ' + b'0' * 40 + b'\t' + path + b'\0')
        for path in sorted(paths):
            entry = self.target_entries.get(path)
            if entry is not None:
                records.append(entry.mode + b' ' + entry.oid.encode('ascii') + b'\t' + path + b'\0')
        if records:
            self.git('update-index', '-z', '--index-info', index=index, data=b''.join(records))
        return self.text('write-tree', index=index)

    def proof_batch(self, index, paths):
        tree = self.write_step_tree(index, paths)
        parents = [self.current]
        commit = self.commit(tree, parents, f'Transport lot 10A evidence batch {len(self.steps) + 1}')
        stats = self.missing(commit, self.current)
        if stats['rawBytes'] > self.args.max_missing_raw_bytes:
            require(len(paths) > 1,
                    f'Proof {path_label(paths[0])} needs {stats["rawBytes"]} raw object bytes including trees/commit')
            middle = len(paths) // 2
            self.proof_batch(index, paths[:middle])
            self.proof_batch(index, paths[middle:])
            return
        self.accept('evidence', commit, tree, parents, stats, paths)

    def final_candidate(self):
        parents = [self.current, self.target]
        commit = self.commit(self.target_tree, parents,
                             'Preserve original lot 10A delivery history after bounded source transport')
        return commit, parents, self.missing(commit, self.current)

    def preserve_history(self):
        while True:
            commit, parents, stats = self.final_candidate()
            if stats['rawBytes'] <= self.args.max_missing_raw_bytes:
                self.accept('final_history_merge', commit, self.target_tree, parents, stats)
                return
            # Original history can contain old blobs absent from its final tree.
            # Import bounded ancestry groups without changing any final file.
            candidates = self.text('rev-list', '--reverse', '--topo-order',
                                   self.target, '--not', self.current).splitlines()
            frontier, best, blocked = [], None, []
            for historical in candidates:
                if historical == self.target:
                    continue
                proposed = [parent for parent in frontier if not self.ancestor(parent, historical)]
                proposed.append(historical)
                if len(proposed) > 64:
                    break
                bridge_parents = [self.current, *proposed]
                bridge = self.commit(self.target_tree, bridge_parents,
                                     f'Transport retained lot 10A ancestry batch {len(self.steps) + 1}')
                bridge_stats = self.missing(bridge, self.current)
                if bridge_stats['rawBytes'] <= self.args.max_missing_raw_bytes:
                    frontier = proposed
                    best = (bridge, bridge_parents, bridge_stats)
                elif best is not None:
                    break
                else:
                    blocked.append({'commit': historical, 'rawMissingObjectBytes': bridge_stats['rawBytes']})
            if best is None:
                self.plan['untransportedHistory'] = stats
                self.plan['blockingHistoricalCommits'] = blocked
                raise ValueError('Original ancestry cannot be imported within the raw limit after final-tree proofs. '
                                 'No history or bytes were removed; this requires a separate transport design.')
            self.accept('retained_history', best[0], self.target_tree, best[1], best[2])

    def ignored_proofs(self):
        paths = self.git('ls-files', '--others', '--ignored', '--exclude-standard', '-z',
                         '--', path_label(EVIDENCE)).stdout.split(b'\0')
        result = []
        for path in sorted(filter(None, paths)):
            file_path = ROOT / path_label(path)
            stat = file_path.lstat()
            result.append({'path': path_label(path), 'bytes': stat.st_size,
                           'symlink': file_path.is_symlink(), 'includedInTarget': False})
        return result

    def prepare(self):
        require(self.text('rev-parse', '--show-object-format') == 'sha1', 'This planner requires SHA-1 Git objects')
        require(Path(self.text('rev-parse', '--show-toplevel')).resolve() == ROOT, 'Unexpected Git checkout root')
        require(self.text('rev-parse', '--is-shallow-repository') == 'false', 'A shallow checkout cannot prove full ancestry')
        partial = self.git('config', '--get', 'extensions.partialClone', check=False)
        promisor = self.git('config', '--get-regexp', r'^remote\..*\.promisor$', check=False)
        require(partial.returncode == 1 and promisor.returncode in (0, 1)
                and not any(line.split()[-1].lower() in (b'true', b'yes', b'on', b'1')
                            for line in promisor.stdout.splitlines()),
                'Partial/promisor repositories are not accepted; the planner never fetches objects')
        git_dir = Path(self.text('rev-parse', '--absolute-git-dir'))
        for name in ('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'index.lock'):
            require(not (git_dir / name).exists(), f'Finish the active Git operation first: {name}')
        grafts = (ROOT / self.text('rev-parse', '--git-path', 'info/grafts')).resolve()
        require(not grafts.exists() or grafts.stat().st_size == 0, 'Git ancestry grafts are not accepted')
        self.before = self.snapshot()
        self.plan['checkoutBefore'] = self.before
        require(self.before['statusBytes'] == 0, 'Commit the final tracked and untracked delivery changes before planning')
        self.base = self.resolve_commit(self.args.base)
        self.target = self.resolve_commit(self.args.target)
        require(self.target == self.before['head'], 'Target must be the actual clean original HEAD')
        require(self.target != self.base, 'Target already equals the published base; no source transport is needed')
        self.current = self.base
        self.target_tree = self.text('rev-parse', self.target + '^{tree}')
        base_project = json.loads(self.git('show', self.base + ':.openai/hosting.json').stdout)
        target_project = json.loads(self.git('show', self.target + ':.openai/hosting.json').stdout)
        require(base_project.get('project_id') and base_project.get('project_id') == target_project.get('project_id'),
                'Published base and target must belong to the same Sites project')
        if any(self.git('var', ident, check=False).returncode for ident in ('GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT')):
            self.identity = ['-c', 'user.name=Sites', '-c', 'user.email=sites@users.noreply.openai.com']
        self.plan.update(projectId=target_project['project_id'], publishedBaseCommit=self.base,
                         retainedTargetCommit=self.target, originalHead=self.target,
                         targetTree=self.target_tree, publishedBaseIsAncestorOfOriginalHead=self.ancestor(self.base, self.target),
                         ignoredUntrackedEvidence=self.ignored_proofs())
        self.base_entries = self.tree_entries(self.base)
        self.target_entries = self.tree_entries(self.target_tree)
        changed = {path for path in self.base_entries.keys() | self.target_entries.keys()
                   if self.base_entries.get(path) != self.target_entries.get(path)}
        blob_ids = [self.target_entries[path].oid for path in changed
                    if path in self.target_entries and self.target_entries[path].kind == 'blob']
        self.object_info(blob_ids)
        self.deferred = {path for path in changed if path in self.target_entries
                         and path.startswith(EVIDENCE) and DATA_SUFFIX.search(path)
                         and self.target_entries[path].mode == b'100644'
                         and self.objects[self.target_entries[path].oid]['bytes'] >= self.args.bulk_min_bytes}
        self.critical = changed - self.deferred
        self.plan.update(criticalPaths=sorted(map(path_label, self.critical)),
                         deferredProofPaths=sorted(map(path_label, self.deferred)),
                         deletedTargetPaths=sorted(path_label(path) for path in changed if path not in self.target_entries))
        required = self.missing(self.target, self.base)
        self.required_ids = {row['oid'] for row in required['objects']}
        self.plan['originalTargetMissingObjects'] = required
        oversized = [row for row in required['objects'] if row['bytes'] > self.args.max_missing_raw_bytes]
        self.plan['oversizedIndividualObjects'] = oversized
        require(not oversized, 'An individual missing Git object exceeds the raw limit; target/history cannot be silently split')

    def build(self, index):
        # A one-push plan is sufficient if the complete tree AND original history fit.
        commit, parents, stats = self.final_candidate()
        if stats['rawBytes'] <= self.args.max_missing_raw_bytes:
            self.accept('complete_source_and_history', commit, self.target_tree, parents, stats,
                        self.critical | self.deferred)
        else:
            tree = self.write_step_tree(index, self.critical)
            parents = [self.current]
            commit = self.commit(tree, parents, 'Transport complete lot 10A source, tests and build inputs')
            stats = self.missing(commit, self.current)
            require(stats['rawBytes'] <= self.args.max_missing_raw_bytes,
                    f'All non-deferred source paths require {stats["rawBytes"]} raw object bytes in the first step')
            self.accept('complete_source', commit, tree, parents, stats, self.critical)
            # Blob sizes are used only for grouping. Every actual commit is then
            # bounded exactly, including tree/commit overhead and all ancestry.
            reserve = min(1024 * 1024, max(1, self.args.max_missing_raw_bytes // 20))
            group_limit = self.args.max_missing_raw_bytes - reserve
            batch, batch_ids, batch_bytes = [], set(), 0
            for path in sorted(self.deferred):
                oid = self.target_entries[path].oid
                size = self.objects[oid]['bytes'] if oid in self.required_ids - self.uploaded - batch_ids else 0
                if batch and batch_bytes + size > group_limit:
                    self.proof_batch(index, batch)
                    batch, batch_ids, batch_bytes = [], set(), 0
                    size = self.objects[oid]['bytes'] if oid in self.required_ids - self.uploaded else 0
                batch.append(path)
                batch_ids.add(oid)
                batch_bytes += size
            if batch:
                self.proof_batch(index, batch)
            require(self.text('rev-parse', self.current + '^{tree}') == self.target_tree,
                    'Proof batches did not reproduce the exact target tree')
            self.preserve_history()
        final_tree = self.text('rev-parse', self.current + '^{tree}')
        actual_parents = self.text('rev-list', '--parents', '-n', '1', self.current).split()[1:]
        require(final_tree == self.target_tree and self.target in actual_parents,
                'Final commit does not retain the original HEAD directly with its exact tree')
        require(self.ancestor(self.base, self.current), 'Final source is not a fast-forward from the published base')
        final_missing = self.missing(self.current, self.base)
        require({row['oid'] for row in final_missing['objects']} == self.uploaded
                and self.required_ids <= self.uploaded
                and final_missing['rawBytes'] == sum(step['rawMissingObjectBytes'] for step in self.steps),
                'Per-step object inventories do not cover the full final ancestry exactly')
        self.plan.update(finalCommit=self.current, finalTree=final_tree, finalParents=actual_parents,
                         finalTreeExactlyEqualToRetainedTarget=True, originalHeadIsFinalDirectParent=True,
                         allOriginalTargetObjectsRetained=True, allPublishedBaseObjectsRetained=True,
                         allMissingAncestryAccountedFor=True, allStepsWithinRawObjectLimit=True,
                         nativeTestBuildInputsEqualToTargetFromFirstStep=True,
                         totalNewReachableRawObjectBytes=final_missing['rawBytes'],
                         totalNewReachableObjects=final_missing['count'],
                         maximumStepRawObjectBytes=max(step['rawMissingObjectBytes'] for step in self.steps))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--base', required=True, help='Full commit ID of the actually published predecessor source')
    parser.add_argument('--target', default='HEAD', help='Final clean original HEAD, or its full commit ID')
    parser.add_argument('--output', type=Path, required=True, help='Exclusive plan JSON outside this checkout')
    parser.add_argument('--window-receipt', type=Path, default=DEFAULT_WINDOW)
    parser.add_argument('--max-missing-raw-bytes', type=int, default=RAW_LIMIT,
                        help='Per-push sum of all missing raw object contents; at most 41943040')
    parser.add_argument('--bulk-min-bytes', type=int, default=256 * 1024,
                        help='Minimum size for deferring a regular proof data file under lot10a-evidence')
    args = parser.parse_args()
    require(not any(os.environ.get(name) for name in REDIRECT_ENV), 'Git location/index overrides are not accepted')
    require(re.fullmatch(r'[0-9a-fA-F]{40}', args.base), '--base must be a full published commit ID')
    require(0 < args.max_missing_raw_bytes <= RAW_LIMIT and args.bulk_min_bytes > 0, 'Invalid raw limit or proof threshold')
    output = args.output.absolute()
    require(not os.path.lexists(output), 'The output already exists; refusing to overwrite a retained plan')
    output = output.resolve()
    require(not output.is_relative_to(ROOT) and output.parent.is_dir(),
            'The plan must be outside the checkout in an existing directory')
    window_path = (ROOT / args.window_receipt).resolve()
    window_fp = passed_window(window_path)  # This gate precedes all Git work.
    plan = {'schema': SCHEMA, 'status': 'planning', 'recordedAt': utc_now(),
            'generator': fingerprint(__file__), 'window': window_fp, 'checkout': str(ROOT),
            'output': str(output), 'requestedBase': args.base, 'requestedTarget': args.target,
            'perPushServerLimitBytes': SERVER_LIMIT, 'perStepRawObjectLimitBytes': args.max_missing_raw_bytes,
            'bulkProofMinimumBytes': args.bulk_min_bytes, 'steps': [], 'createdCommitObjects': [],
            'pushesPerformed': 0, 'siteDeploymentsPerformed': 0, 'forcePush': False,
            'intermediateSiteDeployment': False, 'branchUpdatesPerformed': 0,
            'qualification': 'Raw bounds include all newly reachable commits, trees and blobs from every parent. '
                             'They are not observed network pack sizes. The published base is supplied by the operator; '
                             'no remote lookup, credential access, push, package or deployment is performed.',
            'executionNotes': [
                'Execute only a plan with status planned_not_pushed and checkoutUnchanged true.',
                'Keep this plan and every helper archive outside the checkout.',
                'Starting at the clean original HEAD, use a complete detached checkout of each step.commit, in order. '
                'Do not use an index-only reset/read-tree: future proof files left untracked would be staged by the standard helper.',
                'A complete checkout removes tracked future proof files absent from that step. All non-deferred paths, '
                'including the final .gitignore and source/test/build inputs, are already final from step 1.',
                'Before each standard Sites helper call, verify actual HEAD and tree equal that step and the tracked/untracked '
                'status is clean. Never force-add the separately listed ignored raw evidence.',
                'The standard helper pushes current HEAD normally to remote main and verifies the remote result. '
                'Advance only after success; stop if the remote no longer matches the planned predecessor. Never force-push.',
                'Run the Sites deployment only after the final helper source push. Intermediate helper source/archive calls '
                'must not be followed by an intermediate Site deployment.',
                'The planner leaves the original branch untouched. Planned commit objects have no new refs; keep this plan '
                'and execute before pruning unreachable objects. The final commit directly retains the original HEAD.'
            ]}
    planner = Planner(args, plan)
    # Reserve the output exclusively, then retain failures as well as successes.
    with output.open('x', encoding='utf-8') as stream:
        try:
            planner.prepare()
            with tempfile.TemporaryDirectory(prefix='lot10a-transport-index-', dir=output.parent) as temporary:
                planner.build(Path(temporary) / 'index')
            plan['status'] = 'planned_not_pushed'
        except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
            plan['status'] = 'planning_failed'
            plan['error'] = str(error)
        finally:
            if planner.before is not None:
                try:
                    after = planner.snapshot()
                    plan['checkoutAfter'] = after
                    plan['checkoutUnchanged'] = after == planner.before
                    require(plan['checkoutUnchanged'], 'HEAD, refs, real index or checkout status changed during planning')
                    require(fingerprint(__file__) == plan['generator'] and fingerprint(window_path) == window_fp,
                            'The planner or completed window receipt changed during planning')
                except (ValueError, OSError) as error:
                    plan['status'] = 'planning_failed'
                    plan['verificationError'] = str(error)
            plan['finishedAt'] = utc_now()
            json.dump(plan, stream, indent=2, ensure_ascii=True)
            stream.write('\n')
    print(json.dumps({'status': plan['status'], 'output': str(output), 'steps': len(plan['steps']),
                      'finalCommit': plan.get('finalCommit'), 'error': plan.get('error'),
                      'verificationError': plan.get('verificationError')}))
    return 0 if plan['status'] == 'planned_not_pushed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        print(f'Refusing bounded source planning: {error}', file=sys.stderr)
        sys.exit(1)
