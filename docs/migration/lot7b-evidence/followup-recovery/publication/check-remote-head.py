import argparse, json, os, re, subprocess, sys, termios
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--expected', required=True)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
assert re.fullmatch(r'[0-9a-f]{40}', args.expected)
assert args.output.is_absolute() and not args.output.exists()
root = Path('/workspace/sites/sra-lot7-followup-recovery-20261111/.sites-checkout')
assert not args.output.resolve().is_relative_to(root)
if os.isatty(0):
    settings = termios.tcgetattr(0)
    settings[3] &= ~termios.ECHO
    termios.tcsetattr(0, termios.TCSANOW, settings)
print('Ready for read-only repository credential on stdin (input is hidden).', flush=True)
credential = json.loads(sys.stdin.readline())
assert credential['auth_mode'] in ('http_extra_header', 'work_proxy')
assert credential['branch'] == 'main'
remote = credential['remote_url']
assert remote.startswith('https://git.chatgpt-team.site/') and remote.endswith('/appgprj_6adbc388d79081918581b93b919d7258.git')
environment = dict(os.environ, GIT_TERMINAL_PROMPT='0')
for key in list(environment):
    if key.startswith('GIT_TRACE') or key == 'GIT_CURL_VERBOSE':
        environment.pop(key)
auth = ['-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false']
token = credential.get('token', '')
if credential['auth_mode'] == 'http_extra_header':
    environment['SRA_FOLLOWUP_REMOTE_AUTHORIZATION'] = 'Authorization: Bearer ' + token
    auth += ['--config-env=http.' + remote + '.extraHeader=SRA_FOLLOWUP_REMOTE_AUTHORIZATION']
result = subprocess.run(['git', *auth, 'ls-remote', '--heads', remote, 'refs/heads/main'], cwd=root,
                        env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
if result.returncode:
    detail = result.stderr.replace(token, '[redacted]') if token else result.stderr
    raise RuntimeError('Read-only remote check failed: ' + detail[-2000:])
rows = result.stdout.strip().splitlines()
assert len(rows) == 1
actual, ref = rows[0].split()
assert ref == 'refs/heads/main'
record = {'schema': 'logos-engine.followup-remote-head-check.v1', 'recordedAt': datetime.now(timezone.utc).isoformat(),
          'status': 'passed' if actual == args.expected else 'remote_diverged',
          'projectId': 'appgprj_6adbc388d79081918581b93b919d7258', 'ref': ref,
          'expectedCommit': args.expected, 'actualCommit': actual,
          'qualification': 'Read-only ls-remote before the standard Sites source helper; no fetch, push, merge or publication.'}
args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open('x') as stream:
    json.dump(record, stream, indent=2); stream.write('\n')
print(json.dumps(record), flush=True)
assert record['status'] == 'passed', 'Remote source diverged; no push authorized by this check'
