"""Exercise the official engine on two constructed motif terrains and isolate the invocation citation."""

import argparse
import io
from pathlib import Path
import subprocess
from zipfile import ZipFile


PROOF = "4dcc659183c31502edcca85f29d661426660a426"
REFERENCE = "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/"
TEST = "tests/sic-sc25-access-transition.test.ts"
CONTRAST = """
test('citation removal leaves visible support and calibrated motion available', async t => {
  const original = MotifAccess.prototype.propose;
  let arm: 'normal' | 'without-invoke-ref' | 'without-motion' = 'normal';
  const mutated = new Set<string>();
  t.mock.method(MotifAccess.prototype, 'propose', async function (this: InstanceType<typeof MotifAccess>, ...args: Parameters<typeof original>) {
    if (args[0].revision !== 4 || arm === 'normal') return original.apply(this, args);
    const { refs, motion } = this;
    assert.ok(refs.invoke && motion.ACTION4);
    mutated.add(arm);
    try {
      if (arm === 'without-invoke-ref') {
        const { invoke, ...retained } = refs;
        this.refs = retained;
      } else this.motion = {};
      return await original.apply(this, args);
    } finally {
      this.refs = refs;
      this.motion = motion;
    }
  });
  for (const axis of ['horizontal', 'vertical'] as const) {
    const runs = [];
    for (const condition of ['normal', 'without-invoke-ref', 'without-motion'] as const) {
      arm = condition;
      const game = await start(axis, true);
      for (let i = 0; i < 3; i++) {
        await game.choose();
        await game.act();
      }
      runs.push({ packet: boardDigest(game.observation), choice: await game.choose(), return: await game.act() });
    }
    const [base, citation, motion] = runs;
    assert.equal(base.packet, citation.packet);
    assert.equal(base.packet, motion.packet);
    assert.deepEqual(citation.choice.command, base.choice.command);
    assert.deepEqual(citation.choice.step, base.choice.step);
    assert.ok(citation.choice.refs.length < base.choice.refs.length);
    assert.equal(citation.return.matched, true);
    assert.notEqual(motion.choice.step.mode, 'walk');
    console.log(JSON.stringify({ axis, base: base.choice.step.mode, noCitation: citation.choice.step.mode,
      noCalibration: motion.choice.step.mode, samePacket: true }));
  }
  assert.deepEqual([...mutated].sort(), ['without-invoke-ref', 'without-motion']);
});
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("revision")
    parser.add_argument("output", type=Path)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    bench = Path(__file__).resolve().parent.parent

    def git(*cmd):
        return subprocess.check_output(["git", *cmd], cwd=bench)

    revision = git("rev-parse", "--verify", args.revision + "^{commit}").decode().strip()
    engine = args.output.resolve() / revision[:8]
    engine.mkdir(parents=True)
    paths = [
        (revision, ["src", "package.json", REFERENCE + "laya_proto", REFERENCE + "morphology_policy"]),
        (PROOF, [TEST, "tests/fixtures/v6-motif-access-reference.json"]),
    ]
    for commit, entries in paths:
        with ZipFile(io.BytesIO(git("archive", "--format=zip", commit, *entries))) as archive:
            archive.extractall(engine)
    harness = engine / TEST
    harness.write_text(harness.read_text(encoding="utf8") + CONTRAST, encoding="utf8", newline="\n")
    log = engine.parent / (revision[:8] + ".log")
    with log.open("xb") as output:
        subprocess.run([args.node, "--test", TEST], cwd=engine, stdout=output, stderr=subprocess.STDOUT, check=True)


if __name__ == "__main__":
    main()
