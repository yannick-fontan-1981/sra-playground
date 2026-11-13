#!/usr/bin/env python3
"""Explicit source-checkpoint push; no credential creation, staging, commit or Site publication.

Prepared for ARC-3-AGENT lot9A. Invoke only after the caller has committed and
validated the exact checkpoint. Ordinary Git source backup takes no global lock;
short exclusivity applies only to official performance and Site publication. A single credential JSON object arrives on
hidden stdin; its token is used solely in the child Git environment.
The default requires a clean worktree. --allow-uncommitted-work explicitly
permits a dirty worktree while pushing only the exact committed HEAD supplied
by --expected. Nothing is staged, committed or included implicitly. Receipts
report actual cleanliness observations; uncommitted work is never claimed saved.
"""
import argparse
import json
import os
from pathlib import Path
import re
import signal
import select
import time
import hashlib
import subprocess
import sys
import termios
from datetime import datetime, timezone
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[4]
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
BRANCH = 'lot9a-chart-navigation-checkpoint-20261112'
REF = 'refs/heads/' + BRANCH
SHA = re.compile(r'[0-9a-f]{40}\Z')
SIGNAL_STATE = {'launching': False, 'pending': None}


class CheckpointError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise CheckpointError(message)


def hidden_credential():
    settings = termios.tcgetattr(0) if os.isatty(0) else None
    if settings is not None:
        hidden = termios.tcgetattr(0)
        hidden[3] &= ~(termios.ECHO | termios.ECHONL)
        termios.tcsetattr(0, termios.TCSANOW, hidden)
    try:
        print('Ready for one repository credential JSON object on hidden stdin.', flush=True)
        raw = b''
        deadline = time.monotonic() + 45
        while b'\n' not in raw:
            remaining = deadline - time.monotonic()
            require(remaining > 0 and bool(select.select([0], [], [], remaining)[0]), 'credential_input_timeout')
            chunk = os.read(0, 65537 - len(raw))
            require(bool(chunk), 'credential_input_ended')
            raw += chunk
            require(len(raw) <= 65536, 'credential_input_too_large')
        line = raw.decode('utf8')
        require(line.endswith('\n') and len(line) <= 65536, 'credential_input_not_one_bounded_line')
        value = json.loads(line)
    finally:
        if settings is not None:
            termios.tcsetattr(0, termios.TCSANOW, settings)
    require(isinstance(value, dict), 'invalid_credential')
    require(value.get('auth_mode') in ('http_extra_header', 'work_proxy'), 'unsupported_authentication')
    remote = value.get('remote_url')
    require(isinstance(remote, str), 'missing_repository_destination')
    url = urlsplit(remote)
    require(url.scheme == 'https' and url.hostname == 'git.chatgpt-team.site'
            and url.port in (None, 443) and not url.username and not url.password
            and not url.query and not url.fragment
            and url.path.endswith('/' + PROJECT + '.git'), 'repository_destination_mismatch')
    require(isinstance(value.get('branch'), str) and value['branch'] and not value['branch'].startswith('-'),
            'invalid_returned_source_branch')
    if value['auth_mode'] == 'http_extra_header':
        token = value.get('token')
        require(isinstance(token, str) and token and not any(c in token for c in '\r\n\0'),
                'invalid_bearer_credential')
    if value.get('token_expires_at'):
        expiry = datetime.fromisoformat(value['token_expires_at'].replace('Z', '+00:00'))
        require(expiry.tzinfo is not None and expiry > datetime.now(timezone.utc), 'expired_repository_credential')
    return value


def interrupt(signum, _frame):
    SIGNAL_STATE['pending'] = signum
    if not SIGNAL_STATE['launching']:
        raise CheckpointError('interrupted')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected', required=True, help='Exact already committed checkpoint SHA.')
    parser.add_argument('--expected-remote', default='absent', help='Prior exact branch SHA, or absent for a new checkpoint branch.')
    parser.add_argument('--allow-uncommitted-work', action='store_true',
                        help='Explicitly allow a dirty worktree; push only the exact already committed HEAD, never uncommitted files.')
    parser.add_argument('--fetch-source-branch', action='store_true',
                        help='Explicit ordinary fetch of the returned source branch into FETCH_HEAD, with no merge or checkout.')
    parser.add_argument('--output', required=True, type=Path, help='New absolute sanitized receipt path outside the checkout.')
    parser.add_argument('--known-remote-ancestor', action='append', default=[], help='Exact refs/heads/name=commit to verify on the same remote before excluding already present objects.')
    args = parser.parse_args()
    require(bool(SHA.fullmatch(args.expected)), 'invalid_expected_commit')
    require(args.expected_remote == 'absent' or bool(SHA.fullmatch(args.expected_remote)), 'invalid_expected_remote')
    require(args.output.is_absolute() and not args.output.exists()
            and not args.output.resolve().is_relative_to(ROOT.resolve()), 'invalid_receipt_destination')
    require(not any(os.environ.get(key) for key in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR')),
            'git_directory_override_rejected')
    record = {
        'schema': 'logos-engine.lot9a-source-checkpoint-transport.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'projectId': PROJECT, 'ref': REF, 'expectedCommit': args.expected,
        'expectedRemoteBefore': None if args.expected_remote == 'absent' else args.expected_remote,
        'status': 'preparing', 'pushCommandStarted': False, 'pushSucceeded': False,
        'ordinaryPush': True, 'forceUsed': False, 'fetchPerformed': False, 'fetchSucceeded': False,
        'fetchSourceBranchRequested': args.fetch_source_branch,
        'allowUncommittedWork': args.allow_uncommitted_work,
        'worktreeCleanBefore': None, 'worktreeCleanAfter': None,
        'committedCheckpointOnly': True, 'uncommittedWorkIncluded': False,
        'worktreeContentsCompared': False, 'checkpointObservations': [],
        'commitCreated': False, 'sitePublicationPerformed': False,
        'credentialPersisted': False,
        'inputDeadlineSeconds': 45, 'inputWaitHoldsPerformanceLock': False,
        'globalLockRequired': False, 'globalLockAcquired': False,
        'coordinationPolicy': 'Explicit user instruction: ordinary source pushes require no global lock or predecessor publication.',
        'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'qualification': 'Only expectedCommit, the exact already committed HEAD, is backed up. Uncommitted or untracked work is not included or claimed saved, even when explicitly allowed. Native version, functional gates, cost and Site publication require their own evidence.',
    }
    stage = 'credential_input'
    try:
        stage = 'credential_input'
        credential = hidden_credential()
        environment = dict(os.environ, GIT_TERMINAL_PROMPT='0', GIT_OPTIONAL_LOCKS='0')
        for key in list(environment):
            if key.startswith('GIT_TRACE') or key == 'GIT_CURL_VERBOSE':
                environment.pop(key)
        auth = []
        proxy = []
        network_environment = None

        def git(arguments, network=False, expected_codes=(0,), input_text=None):
            command = ['git', *(auth + proxy if network else []), *arguments]
            child = None
            try:
                SIGNAL_STATE['launching'] = True
                try:
                    child = subprocess.Popen(command, cwd=ROOT,
                                             env=network_environment if network else environment,
                                             stdin=subprocess.PIPE if input_text is not None else subprocess.DEVNULL,
                                             stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                             text=True, start_new_session=True)
                finally:
                    SIGNAL_STATE['launching'] = False
                if network and arguments[0] == 'push':
                    record['pushCommandStarted'] = True
                if network and arguments[0] == 'fetch':
                    record['fetchPerformed'] = True
                if SIGNAL_STATE['pending'] is not None:
                    raise CheckpointError('interrupted_after_launch')
                stdout, _stderr = child.communicate(input=input_text, timeout=60)
            except BaseException:
                prior_handlers = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
                for sig in prior_handlers:
                    signal.signal(sig, signal.SIG_IGN)
                try:
                    if child is not None:
                        try:
                            os.killpg(child.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        child.communicate()
                finally:
                    for sig, handler in prior_handlers.items():
                        signal.signal(sig, handler)
                raise CheckpointError('git_interrupted_or_timed_out')
            if child.returncode not in expected_codes:
                record['gitExitCode'] = child.returncode
                raise CheckpointError('git_command_failed')
            return child.returncode, stdout

        def head():
            return git(['rev-parse', '--verify', 'HEAD^{commit}'])[1].strip()

        def clean():
            return not git(['status', '--porcelain', '--untracked-files=normal'])[1].strip()

        def stable_checkpoint(reason, final=False):
            observed_head = head()
            observed_clean = clean()
            observation = {'stage': stage, 'observedAt': datetime.now(timezone.utc).isoformat(),
                           'commit': observed_head, 'worktreeClean': observed_clean}
            record['checkpointObservations'].append(observation)
            if record['worktreeCleanBefore'] is None:
                record['localCommitBefore'] = observed_head
                record['worktreeCleanBefore'] = observed_clean
            if final:
                record['localCommitAfter'] = observed_head
                record['localCleanAfter'] = observed_clean
                record['worktreeCleanAfter'] = observed_clean
            require(observed_head == args.expected and
                    (observed_clean or args.allow_uncommitted_work), reason)
            return observation

        stage = 'local_preflight'
        require(Path(git(['rev-parse', '--show-toplevel'])[1].strip()).resolve() == ROOT.resolve(), 'checkout_mismatch')
        git_directory = Path(git(['rev-parse', '--absolute-git-dir'])[1].strip())
        require(not any((git_directory / name).exists() for name in
                        ('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply')),
                'unfinished_git_operation')
        manifest = json.loads((ROOT / '.openai/hosting.json').read_text())
        require(manifest.get('project_id') == PROJECT, 'hosting_project_mismatch')
        stable_checkpoint('checkpoint_changed_or_not_clean')
        git(['check-ref-format', REF])
        stage = 'credential_received'
        remote = credential['remote_url']
        git(['check-ref-format', 'refs/heads/' + credential['branch']])
        # The returned default branch is left unchanged. The independently
        # authorized checkpoint destination is the fixed REF above.
        record['returnedSourceBranch'] = credential['branch']
        record['authenticationMode'] = credential['auth_mode']
        record['authenticationTransport'] = 'hidden_stdin_then_process_environment_only'
        stage = 'destination_preflight'
        require(git(['ls-remote', '--get-url', remote])[1].strip() == remote, 'git_url_rewrite_rejected')
        _, rewrites = git(['config', '--get-regexp', r'^url\..*\.pushinsteadof$'], expected_codes=(0, 1))
        require(not any(len(parts := line.split(None, 1)) == 2 and remote.startswith(parts[1])
                        for line in rewrites.splitlines()), 'git_push_url_rewrite_rejected')
        if environment.get('CODEX_NETWORK_PROXY_ACTIVE') == '1' and environment.get('HTTPS_PROXY'):
            code, configured_proxy = git(['config', '--null', '--get-urlmatch', 'http.proxy', remote], expected_codes=(0, 1))
            if code == 0 and configured_proxy == '\0':
                proxy = ['--config-env=http.' + remote + '.proxy=HTTPS_PROXY']
        auth = ['-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false']
        network_environment = dict(environment)
        if credential['auth_mode'] == 'http_extra_header':
            network_environment['SRA_LOT9A_GIT_AUTHORIZATION'] = 'Authorization: Bearer ' + credential['token']
            auth += ['--config-env=http.' + remote + '.extraHeader=SRA_LOT9A_GIT_AUTHORIZATION']

        if args.fetch_source_branch:
            stage = 'source_branch_fetch'
            stable_checkpoint('checkpoint_changed_before_source_fetch')
            git(['fetch', '--no-tags', remote, 'refs/heads/' + credential['branch']], network=True)
            record['fetchSucceeded'] = True
            fetched = git(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'])[1].strip()
            require(bool(SHA.fullmatch(fetched)), 'invalid_fetched_source_commit')
            record['sourceRemoteCommitFetched'] = fetched
            after_fetch = stable_checkpoint('checkpoint_changed_during_source_fetch')
            record['headUnchangedAfterFetch'] = True
            record['worktreeCleanAfterFetch'] = after_fetch['worktreeClean']
            stage = 'missing_object_inventory'
            confirmed = []
            requested_ancestors = list(args.known_remote_ancestor)
            if args.expected_remote != 'absent':
                requested_ancestors.insert(0, REF + '=' + args.expected_remote)
            for specification in requested_ancestors:
                parts = specification.split('=')
                require(len(parts) == 2 and parts[0].startswith('refs/heads/') and bool(SHA.fullmatch(parts[1])),
                        'invalid_declared_remote_ancestor')
                remote_ref, ancestor = parts
                git(['check-ref-format', remote_ref])
                rows = git(['ls-remote', '--heads', remote, remote_ref], network=True)[1].strip().splitlines()
                require(len(rows) == 1, 'missing_or_ambiguous_remote_ancestor_ref')
                row = rows[0].split()
                require(len(row) == 2 and bool(SHA.fullmatch(row[0])) and row[1] == remote_ref,
                        'invalid_remote_ancestor_ref_response')
                tip = row[0]
                fetched_ancestor_ref = False
                if tip != ancestor:
                    git(['fetch', '--no-tags', remote, remote_ref], network=True)
                    actual_tip = git(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'])[1].strip()
                    require(actual_tip == tip, 'remote_ancestor_ref_changed_during_fetch')
                    fetched_ancestor_ref = True
                git(['cat-file', '-e', ancestor + '^{commit}'])
                code, _ = git(['merge-base', '--is-ancestor', ancestor, tip], expected_codes=(0, 1))
                require(code == 0, 'declared_ancestor_not_present_in_verified_remote_history')
                confirmed.append({'ref': remote_ref, 'remoteCommit': tip, 'verifiedExistingAncestor': ancestor,
                                  'additionalFetch': fetched_ancestor_ref})
            exclusions = sorted(set([fetched, *(item['verifiedExistingAncestor'] for item in confirmed)]))
            record['verifiedExistingRemoteAncestors'] = confirmed
            record['objectInventoryExclusions'] = exclusions
            identities = git(['rev-list', '--objects', '--no-object-names', args.expected,
                              *('^' + value for value in exclusions)])[1]
            metadata = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
                           input_text=identities)[1]
            objects = []
            for line in metadata.splitlines():
                fields = line.split()
                require(len(fields) == 3 and bool(SHA.fullmatch(fields[0]))
                        and fields[1] in ('blob', 'tree', 'commit', 'tag') and fields[2].isdigit(),
                        'invalid_missing_object_metadata')
                objects.append({'object': fields[0], 'type': fields[1], 'bytes': int(fields[2])})
            total = sum(item['bytes'] for item in objects)
            record['sourceMissingObjectCount'] = len(objects)
            record['sourceMissingRawBytes'] = total
            record['sourceMissingLargestObjectBytes'] = max((item['bytes'] for item in objects), default=0)
            record['sourceMissingObjectsAtLeast32MiB'] = [item for item in objects if item['bytes'] >= 32 * 1024 * 1024]
            record['sourceMissingRawLimitBytes'] = 40 * 1024 * 1024
            record['objectInventoryQualification'] = 'Raw object headers only, excluding only the freshly fetched main and ancestors independently verified on this same remote; not a measured pack size. All proof objects remain retained in remote history.'
            require(total < record['sourceMissingRawLimitBytes'], 'missing_object_delta_reaches_40_mib')
            stable_checkpoint('checkpoint_changed_during_object_inventory')

        def remote_head():
            text = git(['ls-remote', '--heads', remote, REF], network=True)[1].strip()
            if not text:
                return None
            rows = text.splitlines()
            require(len(rows) == 1, 'ambiguous_remote_checkpoint')
            parts = rows[0].split()
            require(len(parts) == 2 and bool(SHA.fullmatch(parts[0])) and parts[1] == REF, 'invalid_remote_checkpoint_response')
            return parts[0]

        stage = 'remote_before'
        before = remote_head()
        record['remoteCommitBefore'] = before
        require(before == record['expectedRemoteBefore'] or before == args.expected, 'remote_branch_changed_before_push')
        stable_checkpoint('checkpoint_changed_before_push')
        if before != args.expected:
            stage = 'ordinary_push'
            git(['push', '--porcelain', remote, args.expected + ':' + REF], network=True)
            record['pushSucceeded'] = True
        stage = 'remote_exact_verification'
        actual = remote_head()
        record['remoteCommitAfter'] = actual
        stable_checkpoint('checkpoint_verification_failed', final=True)
        require(actual == args.expected, 'checkpoint_verification_failed')
        record['status'] = 'pushed_and_verified' if record['pushSucceeded'] else 'already_present_and_verified'
        stage = 'complete'
    except BaseException as error:
        record['status'] = 'failed'
        record['failureStage'] = stage
        record['reason'] = str(error) if isinstance(error, CheckpointError) else 'unexpected_failure_details_suppressed'
    record['finishedAt'] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as output:
        json.dump(record, output, indent=2)
        output.write('\n')
    print(json.dumps(record), flush=True)
    return 0 if stage == 'complete' else 1


if __name__ == '__main__':
    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, interrupt)
    try:
        raise SystemExit(main())
    except CheckpointError as error:
        # This class only carries fixed internal reason strings, never Git or
        # credential input text. No raw stderr or exception repr is printed.
        print(json.dumps({'status': 'failed_before_receipt', 'reason': str(error)}), flush=True)
        raise SystemExit(1)
