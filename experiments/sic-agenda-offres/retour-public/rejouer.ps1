param([string]$FormatPublic)
$ErrorActionPreference = 'Stop'
$depot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if (-not $FormatPublic) { $FormatPublic = Join-Path $depot '../symbolic-public-format/experiments/symbolic-situations/public-format' }
$node = (Get-Command node.exe -All | Where-Object {
    [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0'
} | Select-Object -First 1).Source
if (-not $node) { throw 'Node 24 requis' }
$base = 'f296ac1c2e18f9d02b8e3045c3a225c61553c0e6'
$candidat = 'ba2d1e7f3140f1f33d2cf7d47694de395d585bf0'
$programme = 'experiments/sic-agenda-offres/public-v1'
& $node (Join-Path $PSScriptRoot 'verifier.mjs') (Join-Path $FormatPublic 'reductions')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

function Reduire([string]$cas, [string]$sha) {
    $options = @()
    if ($sha -eq $candidat -and $cas -ne 'A') { $options += '--exiger-passage' }
    $json = & $node (Join-Path $FormatPublic 'reductions/rejouer.mjs') $cas $sha $depot @options | Out-String
    if ($LASTEXITCODE -ne 0) { throw "Réduction $cas en échec" }
    return $json | ConvertFrom-Json
}
foreach ($cas in @('A','B','C')) {
    $ancien = Reduire $cas $base
    $nouveau = Reduire $cas $candidat
    if ($cas -eq 'B') {
        if ($ancien.departs[0].tours.Count -ne 1 -or $nouveau.departs[0].tours.Count -ne 2 -or
            $nouveau.departs[0].tours[1].action -cne 'valider') { throw 'Écart B inattendu' }
    } elseif ((ConvertTo-Json $ancien.departs -Depth 15 -Compress) -cne (ConvertTo-Json $nouveau.departs -Depth 15 -Compress)) {
        throw "Divergence sur le témoin $cas"
    }
    Write-Output "$cas · succès $($ancien.bilan.issues.succes) → $($nouveau.bilan.issues.succes) sur $($nouveau.bilan.departs)"
}

function Developpement([string]$sha) {
    $rapport = Join-Path ([IO.Path]::GetTempPath()) ('sic-b-dev-' + (New-Guid).Guid + '.json')
    & $node (Join-Path $FormatPublic 'operator/run.mjs') --partition developpement --depot $depot --sha $sha `
        --entree "$programme/solveur.mjs" --dep "$programme/admission.mjs" --dep "$programme/planifier.mjs" `
        --dep "$programme/schema.json" --dep experiments/sic-agenda-offres/agenda.mjs --dep src/sic/reasoning-mode.ts --rapport $rapport | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Échec opérateur' }
    return (Get-Content -Raw -Encoding utf8 -LiteralPath $rapport | ConvertFrom-Json)
}
$ancien = Developpement $base
$nouveau = Developpement $candidat
if ($nouveau.partition -ne 'developpement' -or $ancien.operateur -ne $nouveau.operateur -or
    $nouveau.bilan.issues.succes -ne 18 -or $nouveau.bilan.actions.executees -ne 74 -or
    (ConvertTo-Json $ancien.departs -Depth 15 -Compress) -cne (ConvertTo-Json $nouveau.departs -Depth 15 -Compress)) {
    throw 'Les reçus historiques de développement diffèrent'
}
Write-Output "Développement · opérateur $($nouveau.operateur) · 18/18 succès · 74 gestes · 12 lectures · reçus identiques."
