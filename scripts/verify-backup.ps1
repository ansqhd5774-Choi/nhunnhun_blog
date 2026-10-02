param([string]$BackupName = '20261002-initial')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$backupRoot = [IO.Path]::GetFullPath((Join-Path $root 'backup'))
$target = [IO.Path]::GetFullPath((Join-Path $backupRoot $BackupName))
if (-not $target.StartsWith($backupRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '백업 경로 범위 오류' }
$manifest = Get-Content -LiteralPath (Join-Path $target 'manifest.json') -Raw | ConvertFrom-Json
foreach ($record in $manifest) {
    $filePath = [IO.Path]::GetFullPath((Join-Path $target $record.path))
    if (-not $filePath.StartsWith($target + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'manifest 경로 범위 오류' }
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { throw '백업 파일 누락' }
    if ((Get-Item -LiteralPath $filePath).Length -ne $record.bytes) { throw '백업 크기 불일치' }
    if ((Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash -ne $record.sha256) { throw '백업 해시 불일치' }
}
foreach ($required in @('skin-original.zip','extracted/skin.html','extracted/style.css','extracted/index.xml')) {
    if (-not (Test-Path -LiteralPath (Join-Path $target $required) -PathType Leaf)) { throw '필수 백업 파일 누락' }
}
Write-Output "PASS: $($manifest.Count)개 백업 파일의 크기·SHA256 및 필수 파일 확인. 운영 복구 적용 미검증."
