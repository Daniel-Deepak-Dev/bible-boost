# Renders BibleBoost's PNG icons from the SVG sources with headless Google Chrome.
#   powershell -ExecutionPolicy Bypass -File icons\render-icons.ps1
# 16/32 come from bibleboost-small.svg (toolbar), 48/128 from bibleboost.svg (extensions page, store).

$ErrorActionPreference = 'Stop'

$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Google Chrome not found.' }

# A throwaway profile, so a Chrome window you already have open can't take over the job.
$profileDir = Join-Path $env:TEMP 'bibleboost-icon-render'

$jobs = @(
    @{ Size = 16;  Src = 'bibleboost-small.svg' },
    @{ Size = 32;  Src = 'bibleboost-small.svg' },
    @{ Size = 48;  Src = 'bibleboost.svg' },
    @{ Size = 128; Src = 'bibleboost.svg' }
)

Add-Type -AssemblyName System.Drawing

foreach ($job in $jobs) {
    $svg = ([System.Uri](Join-Path $PSScriptRoot $job.Src)).AbsoluteUri
    $out = Join-Path $PSScriptRoot ('icon{0}.png' -f $job.Size)
    if (Test-Path $out) { Remove-Item $out }

    # Headless Chrome won't make a window narrower than ~500px, and a bare SVG would be centred in it
    # while the screenshot keeps only the left N px. Pin the image to the top-left corner at N x N instead.
    $page = Join-Path $env:TEMP ('bibleboost-icon{0}.html' -f $job.Size)
    Set-Content -Path $page -Encoding UTF8 -Value (
        '<!doctype html><html><body style="margin:0;background:transparent">' +
        ('<img src="{0}" style="position:fixed;left:0;top:0;width:{1}px;height:{1}px">' -f $svg, $job.Size) +
        '</body></html>')
    $src = ([System.Uri]$page).AbsoluteUri

    $chromeArgs = @(
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--force-device-scale-factor=1', '--default-background-color=00000000',
        "--user-data-dir=`"$profileDir`"",
        "--window-size=$($job.Size),$($job.Size)",
        "--screenshot=`"$out`"",
        $src
    )
    Start-Process -FilePath $chrome -ArgumentList $chromeArgs -Wait -NoNewWindow -RedirectStandardError (Join-Path $env:TEMP 'bibleboost-render.log')

    if (-not (Test-Path $out)) { throw "Chrome did not write $out" }
    $img = [System.Drawing.Image]::FromFile($out)
    try {
        if ($img.Width -ne $job.Size -or $img.Height -ne $job.Size) {
            throw "$out is $($img.Width)x$($img.Height), expected $($job.Size)x$($job.Size)"
        }
    } finally { $img.Dispose() }
    Write-Host ('icon{0}.png  <-  {1}' -f $job.Size, $job.Src)
}
