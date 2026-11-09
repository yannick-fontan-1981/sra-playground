#!/usr/bin/env python3
"""Validate and retain the actually observed desktop browser campaign."""
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v52/attempt9'
BASE = '9fb19f769f4920808ddaabf8ba73c07e5a125d0f'


def evidence(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}


def main():
    raw = OUT / 'gare-browser-layout-measures.json'
    screenshot = OUT / 'gare-browser-three-levels.jpg'
    accessibility = OUT / 'gare-browser-three-levels-ax.txt'
    output = OUT / 'gare-browser-verification.json'
    assert not output.exists()
    measurements = json.loads(raw.read_text())
    assert len(measurements) == 7
    assert all(not value['inspectionOpen'] for value in measurements)
    counts = [[value['actions'], value['levels'], value['prefixes']] for value in measurements]
    assert counts[0] == [0, 0, 0]
    assert [counts[i][1] for i in [2, 4, 6]] == [1, 2, 3]
    assert all(a[0] <= b[0] and a[1] <= b[1] and a[2] <= b[2] for a, b in zip(counts, counts[1:]))
    first = measurements[0]
    selectors = ['.board-column', '#canvas-stage', '#game-canvas', '#agent-message', '#agent-run']
    dimensions = max(abs(value['rects'][selector][key] - first['rects'][selector][key])
                     for value in measurements for selector in selectors for key in ['width', 'height'])
    positions = max(abs(value['rects'][selector][key] - first['rects'][selector][key])
                    for value in measurements for selector in selectors for key in ['x', 'y'])
    assert dimensions == positions == 0
    assert all(value['viewport'] == first['viewport'] for value in measurements)
    campaign = json.loads((OUT / 'gare-three-levels.json').read_text())
    assert campaign['status'] == 'passed'
    assert [campaign['final'][key] for key in ['actions', 'levelsCompleted', 'prefixes']] == counts[-1]
    text = accessibility.read_text()
    assert str(counts[-1][0]) in text and str(counts[-1][2]) in text and 'levels solved' in text and 'Level completed.' in text
    image = Image.open(screenshot)
    assert image.format == 'JPEG'
    ui_files = ['src/main.ts', 'src/sra-agent.css', 'src/styles.css']
    ui_hashes = {}
    for name in ui_files:
        data = (ROOT / name).read_bytes()
        assert data == subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=ROOT)
        ui_hashes[name] = hashlib.sha256(data).hexdigest()
    value = {
        'schema': 'logos-engine.v52.browser-verification.v1', 'status': 'passed', 'game': 'GARE',
        'nativeSourceManifestDigest': json.loads((OUT / 'source-manifest.json').read_text())['digest'],
        'uiFilesSha256': ui_hashes, 'uiUnchangedFromCommit': BASE,
        'rawMeasurements': evidence(raw), 'measurements': measurements, 'measurementCount': len(measurements),
        'layout': {'viewport': first['viewport'], 'boardColumnHeight': first['rects']['.board-column']['height'],
                   'canvasHeight': first['rects']['#game-canvas']['height'], 'canvasWidth': first['rects']['#game-canvas']['width'],
                   'statusHeight': first['rects']['#agent-message']['height'], 'maxDocumentPositionDeltaPx': positions,
                   'maxDimensionDeltaPx': dimensions, 'selectors': selectors, 'inspectionClosedThroughout': True},
        'observedResult': {'url': measurements[-1]['url'], 'completedLevels': counts[-1][1],
                           'actions': counts[-1][0], 'prefixes': counts[-1][2], 'entryLevel': 4, 'normalStatus': measurements[-1]['status'],
                           'evidence': 'Unmodified final accessibility tree and screenshot. Every raw rectangle sample also retains the displayed counters.'},
        'browserCampaign': {'sessions': 1, 'manualGameActions': 0, 'resets': 0, 'levelJumps': 0, 'runToNextLevelClicks': 3,
                            'uiActions': ['reload GARE at level 1', 'select SRA Agent Native TS tab', 'Run to next level', 'Run to next level', 'Run to next level']},
        'fullscreen': {'status': 'not_retested'}, 'mobile': {'status': 'not_measured'},
        'screenshot': evidence(screenshot), 'screenshotProperties': {'format': image.format, 'width': image.width, 'height': image.height},
        'accessibility': evidence(accessibility), 'generator': evidence(Path(__file__)),
        'qualification': 'Local Sites preview, normal desktop viewport, seven sampled idle/active/completed states. Rectangles are document coordinates. This is not a per-frame, full-screen or mobile-size measurement. All raw DOM samples retain displayed counters; the final screenshot and accessibility capture confirm the retained action/prefix counters, three completed levels and entry to level 4. Source UI files are byte-identical to published v51. No screenshot editing.',
    }
    output.write_text(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': value['status'], 'measurements': len(measurements), 'maximumDimensionDelta': dimensions, 'result': value['observedResult']}))


if __name__ == '__main__':
    main()
