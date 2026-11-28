"""Replay a catalogue witness with its sealed controls and the real game on a given revision."""
import argparse
import io
import os
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
bench, git, mount = (common[k] for k in ("BENCH", "git", "mount"))
cases = {
    "GARE": ("c3f24fb80a39604bf99686f7c0725b175c2628dd", "gare-framed-lines", "sic-observe-gare-framed",
             ["docs/migration/native-campaigns-v52/final/gare-public-trace.json.gz", "tests/fixtures/sic-gare-alternate-returns.json.gz"]),
    "LIFE": ("f005be662b0e4b556a0cea3d246381cd98eec7ae", "life-three-lines", "sic-observe-life-material",
             ["docs/migration/native-campaigns-v50/life-public-trace-final.json.gz", "tests/fixtures/sic-life-alternate-returns.json.gz"]),
    "GRIL": ("915e0601e3aad82653733ac602909bef2286343d", "gril-lines-40-54", "sic-observe-gril-catalogue",
             ["docs/migration/native-campaigns-v49/gril-public-trace.json.gz", "tests/fixtures/sic-gril-alternate-returns.json.gz"]),
    "TN36": ("0da75640d974e9fbe3b44b78b07649344169c470", "tn36-line-5", "sic-observe-tn36-code",
             ["tests/fixtures/sic-tn36-public-returns.json.gz"]),
    "WA30": ("14a185d909d3b3cb42fcc8584b841865b8ff6dd0", "wa30-contact-lines", "sic-observe-wa30-contacts",
             ["docs/migration/native-campaigns-v54/baseline-wa30/wa30-public-trace.json.gz", "tests/fixtures/sic-wa30-alternate-returns.json.gz"]),
    "TICT": ("e8df1757272cae3da1669b3e7ddb2e7bf65e8e02", "cell-placement-positive-41", "sic-observe-tict-placement",
             ["docs/migration/native-campaigns-v46/tict-public-trace.json.gz"]),
    "KATA": ("d22d706c8c148da1b6bde090d3c6c53d20c69d50", "kata-line-32", "sic-observe-kata-preview",
             ["docs/migration/lot6a-evidence/integrated-final-02/kata-public-trace.json.gz", "tests/fixtures/sic-kata-alternate-returns.json.gz"]),
    "LS20": ("a0af03d0f7c1ebe722b3b7b8bc4db4ba05364025", "ls20-line-20", "sic-observe-ls20-morphology",
             ["docs/migration/lot2c-evidence/final/ls20-method-continuation/ls20-public-trace.json.gz"]),
    "DC22": ("d713024aa7f9b45c8fbd114b86209d36c4efd6ba", "dc22-line-88", "sic-observe-dc22-support", []),
    "ELAS": ("280a54b5dd589d192d369b690781de057efaec8c", "elas-line-19", "sic-observe-elas-metric", []),
    "ZIPP": ("421dc6a58d051e8e418db80a98cf1e01755dab40", "zipp-lines-67-71", "sic-observe-zipp-trace-outline", []),
    "GIGO": ("b2eef22648f3a511bed0783d938013bae8673a8a", "gigo-line-53", "sic-observe-gigo-control", []),
    "REWI": ("9b41b8ba322fceb2737a99dfa264a4d809055bad", "rewi-line-49", "sic-observe-rewi-window", []),
    "ISOS": ("5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f", "isos-line-10", "sic-observe-isos-facet", []),
    "ISOS-PROVENANCE": ("640bd882150f8164b2e6a1a7de6b85b16c52711f", "isos-line-10", "sic-observe-isos-facet", []),
    "LP85": ("80d14be16d5f3d4fa1f84c0c92498902e96a5e3f", "lp85-line-24", "sic-observe-lp85-orbit", []),
    "CN04": ("bfba3acb8de4c3f13fc10651b2aa22490def5070", "cn04-line-30", "sic-observe-cn04-ports", []),
    "SKBN": ("fa126d653aa5e123f9de78c220e9e6129a6436a2", "skbn-line-38", "sic-observe-skbn-inventory", []),
    "KLOT": ("a0df8a9b13b51e63d08b5ca184c996ba20453e9c", "klot-line-82", "sic-observe-klot-selection", []),
    "CD82": ("a6f7b0de19f013b132ff133b1084be86988b2dc1", "cd82-line-89", "sic-observe-cd82-surface", []),
    "SERI": ("aa9c4cfe2c4ac65d5f1164c7748a8a2c1f677aec", "seri-line-93", "sic-observe-seri-completions", []),
    "TRIA": ("735b5e7d9fc3d3b426588e4d619187d925d269f0", "tria-line-79", "sic-observe-tria-relations", []),
    "LF52": ("a2bd031cff2fb2ce7c919b2213f0ba5a8b75a36a", "lf52-line-76", "sic-observe-lf52-support", []),
    "SC25": ("6172e2d3579f36af9c0912578f6d58333a298343", "sc25-line-21", "sic-observe-sc25-motif", []),
    "MIND": ("860835b1b77ae9cde489230be5c1f83c05237302", "mind-line-12", "sic-observe-mind-feedback",
             ["docs/migration/lot4a-evidence/integrated-051/mind-live-01/mind-public-trace.json.gz", "tests/fixtures/sic-mind-alternate-returns.json.gz"]),
    "RE86": ("8e820aa64f321153bb858040d462d7f766178947", "re86-line-7", "sic-observe-re86-ownership",
             ["docs/migration/native-campaigns-v54/baseline-re86/re86-public-trace.json.gz", "tests/fixtures/sic-re86-alternate-returns.json.gz"]),
    "HANO": ("f768bac6c4c9c34d230b63fe6cec39663164b6ae", "hano-line-25", "sic-observe-hano-support",
             ["tests/fixtures/sic-hano-public-returns.json.gz"]),
    "SMLP": ("1e11472a8acfe8d4287cf33e58fe3f629e532fb9", "smlp-line-6", "sic-observe-smlp-arrivals",
             ["docs/migration/native-campaigns-v57/baseline-smlp/smlp-public-trace.json.gz", "tests/fixtures/sic-smlp-alternate-returns.json.gz"]),
    "SEQN": ("b5dda8ecb17b1725816bae09b44973449869dbae", "seqn-lines-11-81", "sic-observe-seqn-rewrites",
             ["tests/fixtures/sic-seqn-public-returns.json.gz"]),
    "SP80": ("bb4a99b5ba41531eb70f1dccb6a97a919cefec56", "sp80-two-lines", "sic-observe-sp80-routing",
             ["tests/fixtures/sic-sp80-public-returns.json.gz"]),
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("revision")
parser.add_argument("--game", choices=cases, default="GARE")
parser.add_argument("output", type=Path)
parser.add_argument("--baseline-only", action="store_true", help="Run the LIFE cases shared with the historical engine")
parser.add_argument("--wrong-receiver", action="store_true", help="Run the KLOT receipt attribution control")
parser.add_argument("--corrected-receiver", action="store_true", help="Require KLOT's corrected receipt role")
parser.add_argument("--duplicate-completion", action="store_true", help="Run the SERI duplicate witness control")
parser.add_argument("--corrected-duplicates", action="store_true", help="Require distinct published SERI witnesses")
parser.add_argument("--game-root", required=True, type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()
proof, suite, observer, fixtures = cases[args.game]
test = "tests/sic-" + suite + ".test.ts"
name = "SIC_" + {"TICT": "SP80", "ZIPP": "ZIPP_67_71", "REWI": "REWI_49", "ISOS-PROVENANCE": "ISOS"}.get(args.game, args.game) + "_"
revision = git("rev-parse", "--verify", args.revision + "^{commit}").decode().strip()
git("-C", str(args.game_root.resolve()), "diff", "--exit-code", revision, "--", "public/python")
out = args.output.resolve()
engine = out / revision[:8]
engine.mkdir(parents=True)
for rev, paths in [(revision, ["src", "package.json", "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto",
                               "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy"]),
                   (proof, ["scripts/sic-study-source-games.mjs", test, *fixtures])]:
    with ZipFile(io.BytesIO(git("archive", "--format=zip", rev, *paths))) as archive:
        archive.extractall(engine)
if args.game == "WA30":
    # Replay the fallback against the game using the same expected return as the substituted site.
    source = engine / test
    text = source.read_text(encoding="utf8")
    fallback = "const game = await start(19), record = t.mock.method(EffectAccess.prototype, 'record');"
    assert text.count(fallback) == 1
    source.write_text(text.replace(fallback, fallback.replace("start(19)", "start(19, true)")), encoding="utf8", newline="\n")
mount(args.game_root.resolve() / "public", engine / "public")
env = {**os.environ, name + "GAME_ROOT": str(engine), name + "ENGINE_ROOT": str(engine),
       name + "RECEIPT": str(out / (revision[:8] + ".json"))}
options = []
if args.wrong_receiver:
    if args.game != "KLOT":
        parser.error("--wrong-receiver requires --game KLOT")
    source = engine / test
    text = source.read_text(encoding="utf8")
    entry = "    async advance() {\n"
    assert text.count(entry) == 1
    mutated = ("    async advance(extraSelect?: { x: number; y: number }) {\n"
               "      if (extraSelect) backend.dispatch({ type: 'action', actionId: 6, data: extraSelect });\n")
    control = (bench / "scripts/sic-klot-receiver-control.ts").read_text(encoding="utf8")
    decision = "    async decision() {\n"
    assert text.count(decision) == 1
    after = ("    async stateAfterAdvance() {\n"
             "      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });\n"
             "      return { kind: reply.kind, family: reply.snapshot.lastDecision,\n"
             "        next: reply.command, reason: (reply as Row).reason ?? (reply.snapshot as Row).stopReason };\n"
             "    },\n")
    source.write_text(text.replace(entry, mutated).replace(decision, after + decision) + "\n" + control,
                      encoding="utf8", newline="\n")
    env["SIC_KLOT_EXPECTED_WRONG_ROLE"] = ("blocked_or_unselected_remains_conditional" if args.corrected_receiver
                                            else "observed_exclusive_receiver")
    options = ["--test-name-pattern=^82 checks the receipt"]
elif args.corrected_receiver:
    parser.error("--corrected-receiver requires --wrong-receiver")
if args.duplicate_completion:
    if args.game != "SERI":
        parser.error("--duplicate-completion requires --game SERI")
    source = engine / test
    control = (bench / "scripts/sic-seri-duplicate-completion-control.ts").read_text(encoding="utf8")
    source.write_text(source.read_text(encoding="utf8") + "\n" + control, encoding="utf8", newline="\n")
    env["SIC_SERI_CORRECTED_DUPLICATES"] = "1" if args.corrected_duplicates else "0"
    options = ["--test-name-pattern=^93 counts distinct questions"]
elif args.corrected_duplicates:
    parser.error("--corrected-duplicates requires --duplicate-completion")
if args.game == "ISOS" and env.get("SIC_ISOS_STALE_BOUNDARY") == "1":
    options = ["--test-name-pattern=^10 distinguishes"]
if args.game == "LIFE" and (args.baseline_only or revision in {
    "8ce7ee3563fa1d5eca1639c6ad03975cfc962460", "d0e7527ca8033bd805a6d7a8bb021eff62e87021"
}):
    options = ["--test-name-pattern=^(LIFE|2 |68 |69 )"]
with (out / (revision[:8] + ".log")).open("wb") as log:
    subprocess.run([args.node, "--import", (bench / "scripts" / (observer + ".mjs")).as_uri(), "--test", *options, test],
                   cwd=engine, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
