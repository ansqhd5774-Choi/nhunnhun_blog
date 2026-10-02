param([string]$EvidenceName = (Get-Date -Format 'yyyyMMdd-HHmmss'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$evidenceRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'evidence/public'))
$destination = [IO.Path]::GetFullPath((Join-Path $evidenceRoot $EvidenceName))
if (-not $destination.StartsWith($evidenceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '증거 경로 범위 오류' }
if (Test-Path -LiteralPath $destination) { throw '기존 증거 폴더를 덮어쓸 수 없습니다.' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$targets = @(
    @{name='home';url='https://nhunnhun.tistory.com/'},
    @{name='article-354';url='https://nhunnhun.tistory.com/354'},
    @{name='robots';url='https://nhunnhun.tistory.com/robots.txt'},
    @{name='sitemap';url='https://nhunnhun.tistory.com/sitemap.xml'},
    @{name='rss';url='https://nhunnhun.tistory.com/rss'}
)
$results = @()
foreach ($target in $targets) {
    try {
        $response = Invoke-WebRequest -Uri $target.url -UseBasicParsing -TimeoutSec 25
        $path = Join-Path $destination ($target.name + '.txt')
        [IO.File]::WriteAllText($path, $response.Content, [Text.UTF8Encoding]::new($false))
        $results += [pscustomobject]@{name=$target.name;url=$target.url;status=[int]$response.StatusCode;contentType=[string]$response.Headers['Content-Type'];bytes=(Get-Item -LiteralPath $path).Length;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash;capturedAt=[DateTimeOffset]::Now.ToString('o')}
    } catch {
        $results += [pscustomobject]@{name=$target.name;url=$target.url;status='UNVERIFIED';errorType=$_.Exception.GetType().Name;capturedAt=[DateTimeOffset]::Now.ToString('o')}
    }
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
$results | Select-Object name,status,bytes | Format-Table -AutoSize
# HTTP 성공은 렌더링, 검색 색인, 광고 승인 또는 전체 게시글 백업 성공을 뜻하지 않습니다.
