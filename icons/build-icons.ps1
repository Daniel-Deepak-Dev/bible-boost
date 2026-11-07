# Builds BibleBoost's PNG icons (16/32/48/128) from one picture on a flat background colour.
#   powershell -ExecutionPolicy Bypass -File icons/build-icons.ps1 -Source <artwork> [-OutDir icons]
#
# 1. Headless Chrome decodes the source (System.Drawing can't read WebP).
# 2. The flat background is keyed out; glow keeps real partial transparency.
# 3. The artwork is scaled into each size and written to -OutDir (default: beside this script).

# -Source is mandatory on purpose. It used to default to the file now held in
# other-resource/icons-archive/, which was derived from the YouVersion app icon and must never
# be rendered into a shipped icon again. See that folder NOTE.txt.
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$OutDir = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

# Artwork width (px) at each icon size. 128 follows Chrome Web Store guidance: 96px art plus 16px
# transparent padding. The toolbar sizes use every pixel, because there the art is already tiny.
$artSize = @(
    @{ Size = 128; Art = 96 },
    @{ Size = 48;  Art = 44 },
    @{ Size = 32;  Art = 32 },
    @{ Size = 16;  Art = 16 }
)

$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Google Chrome not found.' }

$Source = (Resolve-Path $Source).Path
$work = Join-Path $env:TEMP 'bibleboost-icon-build'
New-Item -ItemType Directory -Force $work | Out-Null

# --- 1. Decode ----------------------------------------------------------------------------------
# Headless Chrome won't size a window below ~500px wide, so the image is pinned top-left in a big
# transparent page (fit inside 2048px) and everything outside it stays alpha 0.
$decoded = Join-Path $work 'decoded.png'
$page = Join-Path $work 'decode.html'
Set-Content -Path $page -Encoding UTF8 -Value (
    '<!doctype html><html><body style="margin:0;background:transparent">' +
    ('<img src="{0}" style="position:fixed;left:0;top:0;max-width:2048px;max-height:2048px">' -f ([System.Uri]$Source).AbsoluteUri) +
    '</body></html>')
if (Test-Path $decoded) { Remove-Item $decoded }
Start-Process -FilePath $chrome -Wait -NoNewWindow -RedirectStandardError (Join-Path $work 'chrome.log') -ArgumentList @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--force-color-profile=srgb', '--default-background-color=00000000',
    "--user-data-dir=`"$(Join-Path $work 'profile')`"",  # own profile: an open Chrome can't take the job
    '--window-size=2048,2048', "--screenshot=`"$decoded`"", ([System.Uri]$page).AbsoluteUri)
if (-not (Test-Path $decoded)) { throw "Chrome could not decode $Source" }

# --- 2 + 3. Key and scale -------------------------------------------------------------------------
if (-not ('BibleBoostIcon' -as [type])) {
    Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BibleBoostIcon
{
    static double Smooth(double e0, double e1, double x)
    {
        double t = Math.Max(0, Math.Min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
    }

    // Keys out the background colour (sampled at the top-left corner) and returns the keyed image
    // plus the bounding box of the artwork.
    //  - Glow and soft edges: "colour to alpha", i.e. the least foreground that lifts bg up to the pixel.
    //  - Solid art (book, arrow core): a distance mask forces alpha to 1 so nothing goes see-through.
    public static Bitmap Key(string path, out Rectangle box)
    {
        using (var src = new Bitmap(path))
        {
            int w = src.Width, h = src.Height;
            var px = new int[w * h];
            var sd = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            Marshal.Copy(sd.Scan0, px, 0, px.Length);
            src.UnlockBits(sd);

            int corner = px[2 * w + 2];
            if (((corner >> 24) & 255) < 255) throw new Exception("Source corner is transparent: expected a flat background colour.");
            double[] bg = { (corner >> 16) & 255, (corner >> 8) & 255, corner & 255 };

            var outPx = new int[px.Length];
            int x0 = w, y0 = h, x1 = -1, y1 = -1;
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                int i = y * w + x, p = px[i];
                if (((p >> 24) & 255) == 0) continue;            // outside the decoded image
                double[] c = { (p >> 16) & 255, (p >> 8) & 255, p & 255 };
                double a = 0, d = 0;
                for (int k = 0; k < 3; k++)
                {
                    double diff = c[k] - bg[k];
                    d = Math.Max(d, Math.Abs(diff));
                    double room = diff > 0 ? 255 - bg[k] : bg[k];
                    if (room > 0) a = Math.Max(a, Math.Abs(diff) / room);
                }
                a = Math.Max(a, Smooth(40, 90, d));
                if (a < 0.03) continue;                           // WebP noise in the background
                if (d > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                int argb = (int)Math.Round(a * 255) << 24;
                for (int k = 0; k < 3; k++)
                {
                    double f = bg[k] + (c[k] - bg[k]) / a;
                    argb |= (int)Math.Max(0, Math.Min(255, Math.Round(f))) << (16 - 8 * k);
                }
                outPx[i] = argb;
            }
            if (x1 < 0) throw new Exception("No artwork found: the image looks like a single flat colour.");
            box = Rectangle.FromLTRB(x0, y0, x1 + 1, y1 + 1);

            var dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            var dd = dst.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            Marshal.Copy(outPx, 0, dd.Scan0, outPx.Length);
            dst.UnlockBits(dd);
            return dst;
        }
    }

    // Scales the artwork box so its longer side is artPx, centred in a size x size PNG.
    public static void Render(Bitmap keyed, Rectangle box, int size, double artPx, string outPath)
    {
        double s = artPx / Math.Max(box.Width, box.Height);
        double dx = size / 2.0 - (box.X + box.Width / 2.0) * s;
        double dy = size / 2.0 - (box.Y + box.Height / 2.0) * s;
        using (var dst = new Bitmap(size, size, PixelFormat.Format32bppPArgb))   // premultiplied: no dark fringes
        using (var g = Graphics.FromImage(dst))
        {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.DrawImage(keyed, new RectangleF((float)dx, (float)dy, (float)(keyed.Width * s), (float)(keyed.Height * s)));
            dst.Save(outPath, ImageFormat.Png);
        }
    }
}
'@
}

$box = [System.Drawing.Rectangle]::Empty
$keyed = [BibleBoostIcon]::Key($decoded, [ref]$box)
try {
    Write-Host ('artwork: {0}x{1} at ({2},{3})' -f $box.Width, $box.Height, $box.X, $box.Y)
    foreach ($s in $artSize) {
        $out = Join-Path $OutDir ('icon{0}.png' -f $s.Size)
        [BibleBoostIcon]::Render($keyed, $box, $s.Size, $s.Art, $out)
        Write-Host ('icon{0}.png  (art {1}px)' -f $s.Size, $s.Art)
    }
} finally { $keyed.Dispose() }
