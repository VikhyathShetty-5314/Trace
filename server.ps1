param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".ico"  = "image/x-icon"
  ".md"   = "text/markdown; charset=utf-8"
}

$Listener = $null
$BoundPort = $null

for ($p = $Port; $p -lt ($Port + 10); $p++) {
  $candidate = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
  try {
    $candidate.Start()
    $Listener = $candidate
    $BoundPort = $p
    break
  } catch {
    try { $candidate.Stop() } catch {}
  }
}

if (-not $Listener) {
  Write-Error "Could not bind any localhost port between $Port and $($Port + 9)."
  exit 1
}

function Send-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$BodyBytes,
    [bool]$SendBody = $true
  )

  $header = "HTTP/1.1 $StatusCode $StatusText`r`n" +
            "Content-Type: $ContentType`r`n" +
            "Content-Length: $($BodyBytes.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "Connection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($SendBody -and $BodyBytes.Length -gt 0) {
    $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
  }
  $Stream.Flush()
}

$BaseUrl = "http://localhost:$BoundPort/"
Write-Output "Trace by MITE server running at $BaseUrl"
Write-Output "Serving files from: $Root"

try {
  while ($true) {
    $client = $Listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $client.SendTimeout = 5000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)

      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $hdr = $reader.ReadLine()
        if ($null -eq $hdr -or $hdr -eq "") { break }
      }

      $parts = $requestLine.Split(' ')
      $method = if ($parts.Length -ge 1) { $parts[0].ToUpperInvariant() } else { "GET" }
      $rawTarget = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
      $pathOnly = ($rawTarget -split '\?')[0]
      $decodedPath = [System.Uri]::UnescapeDataString($pathOnly)

      if ($decodedPath -eq "/" -or [string]::IsNullOrWhiteSpace($decodedPath)) {
        $decodedPath = "/index.html"
      }

      $relativePath = $decodedPath.TrimStart('/') -replace '/', '\'
      $targetPath = [System.IO.Path]::GetFullPath((Join-Path $Root $relativePath))

      if (-not $targetPath.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        Send-HttpResponse -Stream $stream -StatusCode 403 -StatusText "Forbidden" -ContentType "text/plain; charset=utf-8" -BodyBytes $errBytes -SendBody ($method -ne "HEAD")
        continue
      }

      if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Send-HttpResponse -Stream $stream -StatusCode 404 -StatusText "Not Found" -ContentType "text/plain; charset=utf-8" -BodyBytes $errBytes -SendBody ($method -ne "HEAD")
        continue
      }

      $ext = [System.IO.Path]::GetExtension($targetPath).ToLowerInvariant()
      $contentType = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }
      $fileBytes = [System.IO.File]::ReadAllBytes($targetPath)

      Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -ContentType $contentType -BodyBytes $fileBytes -SendBody ($method -ne "HEAD")
    } catch {
      # Ignore transient aborted client connections
    } finally {
      $client.Close()
    }
  }
} finally {
  if ($Listener) {
    $Listener.Stop()
  }
}
