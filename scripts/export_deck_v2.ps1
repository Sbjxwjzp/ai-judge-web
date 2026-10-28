$ErrorActionPreference = 'Continue'
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url  = ([System.Uri]"D:\ai-judge-web\docs\deck_export.html").AbsoluteUri
$out  = "D:\ai-judge-web\docs\tech_doc_v2.pdf"
Start-Process -FilePath $edge -ArgumentList @(
  "--headless=new", "--disable-gpu", "--log-level=3", "--no-pdf-header-footer",
  "--virtual-time-budget=12000", "--print-to-pdf=$out", $url) -Wait -NoNewWindow
if (Test-Path $out) { Write-Host "OK size=" (Get-Item $out).Length } else { Write-Host "FAILED" }
