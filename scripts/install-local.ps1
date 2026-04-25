param(
  [ValidateSet("edge", "chrome")]
  [string]$Browser = "edge",

  [switch]$Build,
  [switch]$NoOpen,

  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "DMSCompanion")
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [string[]]$Arguments = @()
  )

  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Command exited with status $LASTEXITCODE"
  }
}

function Get-NormalizedPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  return [System.IO.Path]::GetFullPath($Path)
}

$RepoRoot = Get-NormalizedPath (Join-Path $PSScriptRoot "..")
$DistPath = Join-Path $RepoRoot "dist"
$ManifestPath = Join-Path $DistPath "manifest.json"
$InstallRootPath = Get-NormalizedPath $InstallRoot
$TargetPath = Get-NormalizedPath (Join-Path $InstallRootPath "extension")
$InstallRootWithSeparator = $InstallRootPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $TargetPath.StartsWith($InstallRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to update an extension folder outside the install root: $TargetPath"
}

if ($Build) {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm.cmd was not found. Install Node.js first, then rerun this script."
  }

  Push-Location $RepoRoot
  try {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "node_modules"))) {
      Invoke-Checked -Command "npm.cmd" -Arguments @("install")
    }

    Invoke-Checked -Command "npm.cmd" -Arguments @("run", "build")
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "No built extension found at $DistPath. Run this script with -Build or run npm.cmd run build first."
}

New-Item -ItemType Directory -Path $InstallRootPath -Force | Out-Null

if (Test-Path -LiteralPath $TargetPath) {
  Remove-Item -LiteralPath $TargetPath -Recurse -Force
}

New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
Copy-Item -Path (Join-Path $DistPath "*") -Destination $TargetPath -Recurse -Force

Write-Host ""
Write-Host "DMS Companion local extension folder is ready:"
Write-Host "  $TargetPath"
Write-Host ""
Write-Host "To install or update:"
Write-Host "  1. Turn on Developer mode."
Write-Host "  2. Click Load unpacked."
Write-Host "  3. Select the folder above."
Write-Host "  4. For updates, click Reload on the DMS Companion card."
Write-Host ""

if (-not $NoOpen) {
  if ($Browser -eq "chrome") {
    $BrowserCommand = "chrome.exe"
    $ExtensionsUrl = "chrome://extensions"
  } else {
    $BrowserCommand = "msedge.exe"
    $ExtensionsUrl = "edge://extensions"
  }

  try {
    Start-Process -FilePath $BrowserCommand -ArgumentList $ExtensionsUrl
  } catch {
    Write-Host "Could not open $BrowserCommand automatically. Open this page manually:"
    Write-Host "  $ExtensionsUrl"
  }
}
