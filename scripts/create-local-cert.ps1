param(
  [string]$OutputDir,
  [string[]]$Hosts = @()
)

$ErrorActionPreference = "Stop"

if (-not $OutputDir) {
  $OutputDir = Join-Path $PSScriptRoot "..\apps\web\certificates"
}

$expandedHosts = @()
foreach ($entry in $Hosts) {
  if ($entry) {
    $expandedHosts += $entry -split ","
  }
}

if ($expandedHosts.Count -eq 0) {
  $expandedHosts = @("localhost", "127.0.0.1", "::1")
}

$expandedHosts = $expandedHosts |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ } |
  Sort-Object -Unique

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$keyPath = Join-Path $OutputDir "dev-server.key.pem"
$certPath = Join-Path $OutputDir "dev-server.cert.pem"
$hostsPath = Join-Path $OutputDir "dev-server.hosts.txt"
$hostStamp = "v2`n" + ($expandedHosts -join "`n")

if ((Test-Path $keyPath) -and (Test-Path $certPath) -and (Test-Path $hostsPath)) {
  $currentStamp = Get-Content -Raw -Path $hostsPath
  if ($currentStamp.Trim() -eq $hostStamp.Trim()) {
    Write-Output "Using existing local HTTPS certificate: $certPath"
    exit 0
  }
}

function ConvertTo-Pem {
  param(
    [string]$Label,
    [byte[]]$Bytes
  )

  $base64 = [Convert]::ToBase64String($Bytes)
  $builder = [System.Text.StringBuilder]::new()
  [void]$builder.AppendLine("-----BEGIN $Label-----")

  for ($index = 0; $index -lt $base64.Length; $index += 64) {
    $length = [Math]::Min(64, $base64.Length - $index)
    [void]$builder.AppendLine($base64.Substring($index, $length))
  }

  [void]$builder.AppendLine("-----END $Label-----")
  $builder.ToString()
}

function Join-Bytes {
  param([object[]]$Parts)

  $list = [System.Collections.Generic.List[byte]]::new()

  function Add-Part {
    param([object]$Part)

    if ($null -eq $Part) {
      return
    }

    if ($Part -is [byte]) {
      $list.Add($Part)
      return
    }

    if ($Part -is [System.Array]) {
      foreach ($child in $Part) {
        Add-Part $child
      }
      return
    }

    $list.Add([byte]$Part)
  }

  foreach ($part in $Parts) {
    if ($null -eq $part) {
      continue
    }
    Add-Part $part
  }

  $list.ToArray()
}

function Encode-DerLength {
  param([int]$Length)

  if ($Length -lt 128) {
    return [byte[]]@($Length)
  }

  $bytes = [System.BitConverter]::GetBytes($Length)
  if ([System.BitConverter]::IsLittleEndian) {
    [System.Array]::Reverse($bytes)
  }

  $firstNonZero = 0
  while ($firstNonZero -lt $bytes.Length -and $bytes[$firstNonZero] -eq 0) {
    $firstNonZero++
  }

  $lengthBytes = [byte[]]$bytes[$firstNonZero..($bytes.Length - 1)]
  Join-Bytes -Parts @(,[byte[]]@((0x80 -bor $lengthBytes.Length)), ,$lengthBytes)
}

function Encode-DerInteger {
  param([byte[]]$Value)

  if (-not $Value -or $Value.Length -eq 0) {
    $Value = [byte[]]@(0)
  }

  $firstNonZero = 0
  while ($firstNonZero -lt ($Value.Length - 1) -and $Value[$firstNonZero] -eq 0) {
    $firstNonZero++
  }
  $integerBytes = $Value[$firstNonZero..($Value.Length - 1)]

  if (($integerBytes[0] -band 0x80) -ne 0) {
    $integerBytes = [byte[]]@(0) + [byte[]]$integerBytes
  }

  Join-Bytes -Parts @(,[byte[]]@(0x02), ,(Encode-DerLength $integerBytes.Length), ,[byte[]]$integerBytes)
}

function Encode-DerSequence {
  param([object[]]$Items)

  $body = Join-Bytes -Parts $Items
  Join-Bytes -Parts @(,[byte[]]@(0x30), ,(Encode-DerLength $body.Length), ,$body)
}

function Export-RsaPrivateKey {
  param([System.Security.Cryptography.RSA]$Rsa)

  $parameters = $Rsa.ExportParameters($true)
  Encode-DerSequence -Items @(
    ,(Encode-DerInteger ([byte[]]@(0))),
    ,(Encode-DerInteger $parameters.Modulus),
    ,(Encode-DerInteger $parameters.Exponent),
    ,(Encode-DerInteger $parameters.D),
    ,(Encode-DerInteger $parameters.P),
    ,(Encode-DerInteger $parameters.Q),
    ,(Encode-DerInteger $parameters.DP),
    ,(Encode-DerInteger $parameters.DQ),
    ,(Encode-DerInteger $parameters.InverseQ)
  )
}

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$subject = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new("CN=StokTakip Local Dev")
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  $subject,
  $rsa,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)

$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $false)
)

$keyUsage =
  [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor
  [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($keyUsage, $true)
)

$serverAuth = [System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1")
$enhancedUsages = [System.Security.Cryptography.OidCollection]::new()
[void]$enhancedUsages.Add($serverAuth)
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($enhancedUsages, $false)
)

$sanBuilder = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
foreach ($hostName in $expandedHosts) {
  [System.Net.IPAddress]$ipAddress = $null
  if ([System.Net.IPAddress]::TryParse($hostName, [ref]$ipAddress)) {
    $sanBuilder.AddIpAddress($ipAddress)
  } else {
    $sanBuilder.AddDnsName($hostName)
  }
}
$request.CertificateExtensions.Add($sanBuilder.Build())

$certificate = $request.CreateSelfSigned(
  [System.DateTimeOffset]::UtcNow.AddDays(-1),
  [System.DateTimeOffset]::UtcNow.AddYears(2)
)

$keyPem = ConvertTo-Pem -Label "RSA PRIVATE KEY" -Bytes (Export-RsaPrivateKey $rsa)
$certPem = ConvertTo-Pem -Label "CERTIFICATE" -Bytes $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)

Set-Content -Path $keyPath -Value $keyPem -Encoding ascii
Set-Content -Path $certPath -Value $certPem -Encoding ascii
Set-Content -Path $hostsPath -Value $hostStamp -Encoding utf8

Write-Output "Created local HTTPS certificate: $certPath"
