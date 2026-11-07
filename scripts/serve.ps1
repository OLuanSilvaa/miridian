param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Output "Miridian: http://127.0.0.1:$Port/"
Write-Output 'Pre-visualizacao estatica local. Ctrl+C para encerrar.'
$mimeTypes = @{ '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.svg' = 'image/svg+xml'; '.json' = 'application/json; charset=utf-8' }
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $client.ReceiveTimeout = 5000
        try {
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if (!$requestLine) { continue }
            while ($reader.ReadLine()) { }
            $parts = $requestLine.Split(' ')
            $relativePath = [Uri]::UnescapeDataString($parts[1].Split('?')[0]).TrimStart('/')
            if (!$relativePath) { $relativePath = 'index.html' }
            $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
            $status = '200 OK'
            $mime = 'text/plain; charset=utf-8'
            if ($parts[0] -notin @('GET', 'HEAD') -or !$target.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $target -PathType Leaf) -or $relativePath -match '(^|[\\/])\.') {
                $status = '404 Not Found'
                $bytes = [Text.Encoding]::UTF8.GetBytes('Arquivo nao encontrado.')
            } else {
                $ext = [IO.Path]::GetExtension($target)
                $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
                $bytes = [IO.File]::ReadAllBytes($target)
            }
            $headers = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($parts[0] -ne 'HEAD') { $stream.Write($bytes, 0, $bytes.Length) }
            $stream.Flush()
        } catch {
            Write-Verbose $_.Exception.Message
        } finally {
            $client.Dispose()
        }
    }
} finally {
    $listener.Stop()
}
