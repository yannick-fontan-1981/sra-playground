param([ValidateSet('operateur','verifier')][string]$Mode)
$ErrorActionPreference = 'Stop'
if (-not $Mode) { throw 'Choisir operateur ou verifier.' }
foreach ($runtime in (Get-Command node.exe -All)) {
    if ([version]((& $runtime.Source --version).TrimStart('v')) -ge [version]'24.0.0') {
        $scriptPath = Join-Path $PSScriptRoot ($Mode + '.mjs')
        if ($MyInvocation.ExpectingInput) {
            $input | & $runtime.Source $scriptPath @args
        } else {
            & $runtime.Source $scriptPath @args
        }
        exit $LASTEXITCODE
    }
}
throw 'Ce parcours utilise Node.js 24 ou plus récent.'
