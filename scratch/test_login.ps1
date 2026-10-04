[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
$body = @{
    usernameOrEmail = "superadmin@eseller.com"
    password = "SuperAdmin@123"
    latitude = 31.5204
    longitude = 74.3587
    deviceType = "Desktop"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "https://localhost:7127/api/v1/Auth/login" -Method Post -Body $body -ContentType "application/json"
    Write-Host "LOGIN SUCCESS! AccessToken length: $($res.accessToken.Length)"
    Write-Host "User: $($res.username), Role: $($res.roleType)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "RESPONSE BODY:"
        Write-Host $reader.ReadToEnd()
    }
}
