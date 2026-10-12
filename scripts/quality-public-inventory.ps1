param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$sitemap = Invoke-WebRequest 'https://nhunnhun.tistory.com/sitemap.xml' -TimeoutSec 25
$urls = @([regex]::Matches($sitemap.Content,'<loc>\s*(https://nhunnhun\.tistory\.com/\d+)\s*</loc>') | ForEach-Object {$_.Groups[1].Value} | Sort-Object -Unique)
$checkpoint=Join-Path $OutputDirectory 'public-inventory.json'
$rows=@()
if(Test-Path -LiteralPath $checkpoint){$rows=@(Get-Content -Raw -LiteralPath $checkpoint | ConvertFrom-Json)}
$completed=@($rows | Where-Object {$_.status -eq 200} | ForEach-Object {$_.url})
$pending=@($urls | Where-Object {$_ -notin $completed})
for($offset=0;$offset -lt $pending.Count;$offset+=20){
  $batch=@($pending[$offset..([Math]::Min($offset+19,$pending.Count-1))] | ForEach-Object -ThrottleLimit 4 -Parallel {
    $url=$_
    try {
      $r=Invoke-WebRequest -Uri $url -TimeoutSec 25
      $html=$r.Content
      $title=[Net.WebUtility]::HtmlDecode([regex]::Match($html,'(?is)<title[^>]*>(.*?)</title>').Groups[1].Value)
      $candidateCount=[regex]::Matches($html,'>A\.</span>\s*A\.').Count
      $canonical=@([regex]::Matches($html,'(?is)<link[^>]*rel=["'']canonical["''][^>]*href=["'']([^"'']+)') | ForEach-Object {$_.Groups[1].Value})
      $plain=[Net.WebUtility]::HtmlDecode([regex]::Replace([regex]::Replace($html,'(?is)<(?:script|style)\b.*?</(?:script|style)>',' '),'<[^>]+>',' '))
      $markers=@('육포을','A.A.','육포(Beef,') | Where-Object {$plain.Contains($_)}
      [pscustomobject]@{url=$url;checkedAt=[DateTime]::UtcNow.ToString('o');status=[int]$r.StatusCode;title=$title;canonical=$canonical;rawDuplicateAnswerLabels=$candidateCount;editorialMarkers=@($markers);rawNoindex=[bool]($html -match '(?is)<meta[^>]*(?:name=["'']robots["''][^>]*content=["''][^"'']*noindex|content=["''][^"'']*noindex[^>]*name=["'']robots)');contentReview='NOT_PERFORMED'}
    } catch {[pscustomobject]@{url=$url;checkedAt=[DateTime]::UtcNow.ToString('o');status=$null;errorType=$_.Exception.GetType().Name;contentReview='NOT_PERFORMED'}}
  })
  $batchUrls=@($batch | ForEach-Object {$_.url})
  $rows=@($rows | Where-Object {$_.url -notin $batchUrls})+$batch
  ConvertTo-Json -InputObject $rows -Depth 6 | Set-Content -LiteralPath $checkpoint -Encoding utf8
  Write-Output "Observed $($rows.Count)/$($urls.Count) numeric sitemap URLs"
}
$summary=[pscustomobject]@{checkedAt=[DateTime]::UtcNow.ToString('o');numericSitemapUrls=$urls.Count;observed=$rows.Count;http200=@($rows|Where-Object {$_.status -eq 200}).Count;accessUnconfirmed=@($rows|Where-Object {$_.status -ne 200}).Count;duplicateAnswerCandidateUrls=@($rows|Where-Object {$_.rawDuplicateAnswerLabels -gt 0}|ForEach-Object {$_.url});editorialMarkerUrls=@($rows|Where-Object {$_.editorialMarkers.Count -gt 0}|ForEach-Object {$_.url});limits=@('Sitemap inventory, not independent full published inventory','Raw HTML counts may include duplicated platform representations','Medical meaning and rendered UX not assessed')}
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'public-summary.json') -Encoding utf8
$summary | Select-Object numericSitemapUrls,observed,http200,accessUnconfirmed
