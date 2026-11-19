$ErrorActionPreference = "Stop"
$siteRoot = Split-Path -Parent $PSScriptRoot
$script:siteProblems = [System.Collections.Generic.List[string]]::new()

function Add-SiteProblem([string]$Message) {
  $script:siteProblems.Add($Message)
}

function Resolve-SiteFile([string]$Url) {
  $path = [Uri]::UnescapeDataString($Url).Split("?")[0].Split("#")[0].TrimStart("/")
  return Join-Path $siteRoot ($path.Replace("/", [IO.Path]::DirectorySeparatorChar))
}

$stylesPath = Join-Path $siteRoot "styles.css"
$resourceDataPath = Join-Path $siteRoot "data/resources.js"
$translationsPath = Join-Path $siteRoot "data/translations.js"
$appPath = Join-Path $siteRoot "scripts/main.js"
$styles = Get-Content -Raw -Encoding UTF8 $stylesPath
$resourceData = Get-Content -Raw -Encoding UTF8 $resourceDataPath
$translations = Get-Content -Raw -Encoding UTF8 $translationsPath

if ($styles -notmatch ':focus-visible') { Add-SiteProblem "styles.css is missing visible keyboard focus styles." }
if ($styles -notmatch 'prefers-reduced-motion') { Add-SiteProblem "styles.css is missing reduced-motion support." }

$localReferences = 0
$pages = Get-ChildItem $siteRoot -Filter *.html -File | Sort-Object Name
foreach ($page in $pages) {
  $name = $page.Name
  $html = Get-Content -Raw -Encoding UTF8 $page.FullName

  if ($html -notmatch '<html\s+lang="en"') { Add-SiteProblem "$name must declare its default document language." }
  if ($html -notmatch '<main\b') { Add-SiteProblem "$name is missing its main landmark." }
  if ($html -notmatch 'class="skip-link"') { Add-SiteProblem "$name is missing the skip link." }
  if ($html -match '<script\b[^>]*src="https?://|<link\b[^>]*rel="stylesheet"[^>]*href="https?://|<link\b[^>]*href="https?://fonts\.') {
    Add-SiteProblem "$name should not require remote scripts, stylesheets, or fonts to render."
  }

  $ids = [regex]::Matches($html, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  $duplicateIds = $ids | Group-Object | Where-Object Count -gt 1
  foreach ($duplicate in $duplicateIds) { Add-SiteProblem "Duplicate HTML id in ${name}: $($duplicate.Name)" }
  foreach ($fragment in [regex]::Matches($html, 'href="#([^"]+)"')) {
    $target = $fragment.Groups[1].Value
    if ($target -notin $ids) { Add-SiteProblem "Broken in-page link in ${name}: #$target" }
  }

  $fragments = @{}
  foreach ($fragment in [regex]::Matches($html, 'href="([^"#]+)#([^"]+)"')) {
    $fragments[$fragment.Groups[1].Value] = $true
  }
  foreach ($target in $fragments.Keys) {
    $targetPath = Resolve-SiteFile $target
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) { continue }
    $targetHtml = Get-Content -Raw -Encoding UTF8 $targetPath
    $targetIds = [regex]::Matches($targetHtml, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
    foreach ($fragment in [regex]::Matches($html, [regex]::Escape("href=`"$target#") + '([^"]+)"')) {
      if ($fragment.Groups[1].Value -notin $targetIds) {
        Add-SiteProblem "Broken cross-page link in ${name}: $target#$($fragment.Groups[1].Value)"
      }
    }
  }

  foreach ($match in [regex]::Matches($html, '(?:src|href)="([^"]+)"')) {
    $url = $match.Groups[1].Value
    if ($url -match '^(?:https?:|mailto:|tel:|#|data:|javascript:)') { continue }
    $localReferences++
    $path = Resolve-SiteFile $url
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Add-SiteProblem "Missing local asset in ${name}: $url" }
  }

  # 404.html is intentionally self-contained; GitHub Pages serves it from any missing path.
  if ($name -ne '404.html') {
    $scriptOrder = @('data/resources.js', 'data/translations.js', 'scripts/main.js')
    $lastIndex = -1
    foreach ($script in $scriptOrder) {
      $index = $html.IndexOf("<script src=`"$script`"", [StringComparison]::Ordinal)
      if ($index -lt 0 -or $index -le $lastIndex) { Add-SiteProblem "Missing or out-of-order app script in ${name}: $script" }
      $lastIndex = $index
    }
  }
}

$resourceMatch = [regex]::Match($resourceData, '(?s)window\.BOBBER_RESOURCES\s*=\s*(\[.*?\]);')
$titleMatch = [regex]::Match($resourceData, '(?s)window\.BOBBER_RESOURCE_TITLES_ES\s*=\s*(\{.*?\});')
if (-not $resourceMatch.Success -or -not $titleMatch.Success) {
  Add-SiteProblem "The shared resource data could not be read."
} else {
  $resourceJson = $resourceMatch.Groups[1].Value -replace '(?m)^\s*//.*$', ''
  $resourceJson = $resourceJson -replace '([{,])\s*(title|category|file|image)\s*:', '$1"$2":'
  try {
    $resources = ConvertFrom-Json -InputObject $resourceJson
    $spanishTitles = ConvertFrom-Json -InputObject $titleMatch.Groups[1].Value
  } catch {
    Add-SiteProblem "Resource metadata is not valid JSON-like data: $($_.Exception.Message)"
    $resources = @()
    $spanishTitles = $null
  }

  $seenTitles = @{}
  foreach ($resource in $resources) {
    if ($seenTitles.ContainsKey($resource.title)) { Add-SiteProblem "Duplicate resource title: $($resource.title)" }
    $seenTitles[$resource.title] = $true
    if ($resource.category -notin @("activity", "poster", "storybook")) { Add-SiteProblem "Unknown resource category for $($resource.title)" }
    foreach ($relativeFile in @($resource.file, "graphics/$($resource.image)")) {
      $path = Join-Path $siteRoot (Join-Path "assets" ($relativeFile.Replace("/", [IO.Path]::DirectorySeparatorChar)))
      if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Add-SiteProblem "Missing resource asset for $($resource.title): $relativeFile" }
    }
    if ($null -ne $spanishTitles -and $resource.title -notin $spanishTitles.PSObject.Properties.Name) {
      Add-SiteProblem "Missing Spanish display title for $($resource.title)"
    }
  }
}

$pdfCount = (Get-ChildItem (Join-Path $siteRoot "assets/pdfs") -File -Filter *.pdf | Measure-Object).Count
if ($pdfCount -lt 1) { Add-SiteProblem "No local PDFs were found in assets/pdfs/." }
if (-not (Test-Path -LiteralPath (Join-Path $siteRoot "CONTENT_REVIEW.md") -PathType Leaf)) { Add-SiteProblem "CONTENT_REVIEW.md is missing." }

if ($script:siteProblems.Count -gt 0) {
  $script:siteProblems | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Output "Site checks passed: $($resources.Count) catalog records, $localReferences local HTML references, and $pdfCount local PDFs."
