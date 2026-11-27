# Le dépôt demande Node 22.18 ou plus récent. Plusieurs versions peuvent être dans PATH.
$ErrorActionPreference = 'Stop'
$scriptName = 'experiences.mjs'
$replayArgs = $args
if ($args.Count -gt 0 -and $args[0] -eq 'transfert') {
    $scriptName = 'transfert/operateur.mjs'
    $replayArgs = @($args | Select-Object -Skip 1)
} elseif ($args.Count -gt 0 -and $args[0] -eq 'sonde-locale') {
    $scriptName = 'instrumentation-locale/rejouer.mjs'
    $replayArgs = @($args | Select-Object -Skip 1)
} elseif ($args.Count -gt 0 -and $args[0] -in @('observation','anti-fuite')) {
    $scriptName = if ($args[0] -eq 'observation') { 'observation-native/rejouer.mjs' } else { 'observation-native/verifier.mjs' }
    $replayArgs = @($args | Select-Object -Skip 1)
}
foreach ($runtime in (Get-Command node.exe -All)) {
    $version = [version]((& $runtime.Source --version).TrimStart('v'))
    if ($version -ge [version]'22.18.0') {
        & $runtime.Source (Join-Path $PSScriptRoot $scriptName) @replayArgs
        exit $LASTEXITCODE
    }
}
throw 'Le rejeu nécessite Node.js 22.18 ou plus récent.'
