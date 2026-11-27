param([ValidateSet('verifier','operateur')][string]$Tache = 'verifier')
$ErrorActionPreference = 'Stop'
$script = if ($Tache -eq 'operateur') { 'qualification-operateur/operateur.mjs' } else { 'verifier.mjs' }
foreach ($runtime in (Get-Command node.exe -All)) {
    if ([version]((& $runtime.Source --version).TrimStart('v')) -ge [version]'24.0.0') {
        & $runtime.Source (Join-Path $PSScriptRoot $script) @args
        exit $LASTEXITCODE
    }
}
throw 'Le rejeu requiert Node.js 24 ou ultérieur.'
