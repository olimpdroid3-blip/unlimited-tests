# PowerShell 7+, curl.exe. Secrets remain in this process; never put them in URLs.
# This is a manual compatibility demonstration, not a background activation.
$base = 'https://unlimited-tests.lovable.app'
function To-Base64Url([byte[]] $value) {
    return [Convert]::ToBase64String($value).TrimEnd('=').Replace('+','-').Replace('/','_')
}
$pollSecret = To-Base64Url ([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$pollHash = To-Base64Url ([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($pollSecret)))
$startBody = @{machine_code='AAAA-BBBB-CCCC-DDDD'; app_version='1.0.0'; poll_hash=$pollHash} | ConvertTo-Json -Compress
$start = $startBody | curl.exe --silent --show-error --fail-with-body "$base/api/wor/start" -H 'Content-Type: application/json' --data-binary '@-' | ConvertFrom-Json
if ($start.status -ne 'ok') { throw 'Start failed' }
Write-Host "Команда из ответа сервера: $($start.command)"
Write-Host "Вставьте её в тему клана: $($start.chat_url)"
Write-Host 'Затем нажмите кнопку подтверждения в этой же теме.'
Read-Host 'Нажмите Enter после подтверждения' | Out-Null
$pollBody = @{request_id=$start.request_id; poll_secret=$pollSecret} | ConvertTo-Json -Compress
$poll = $pollBody | curl.exe --silent --show-error --fail-with-body "$base/api/wor/poll" -H 'Content-Type: application/json' --data-binary '@-' | ConvertFrom-Json
if ($poll.status -ne 'ok') { throw 'Нет выдачи: проверьте статус запроса. Опрос не чаще раза в 3 секунды.' }
$refreshSecret = $poll.refresh_secret
Write-Host 'Лицензия получена. Секрет устройства сохранён только в памяти этого процесса.'
$renewBody = @{machine_code='AAAA-BBBB-CCCC-DDDD'; app_version='1.0.0'; refresh_secret=$refreshSecret} | ConvertTo-Json -Compress
$renew = $renewBody | curl.exe --silent --show-error --fail-with-body "$base/api/wor/renew" -H 'Content-Type: application/json' --data-binary '@-' | ConvertFrom-Json
Write-Host "Статус продления: $($renew.status)"
# Request headers are supplied via stdin, keeping refresh_secret out of process
# arguments. Do not enable verbose curl tracing or shell transcript capture.
$headers = "Authorization: Bearer $refreshSecret`nX-Machine-Code: AAAA-BBBB-CCCC-DDDD`nX-App-Version: 1.0.0"
$headers | curl.exe --silent --show-error --fail-with-body "$base/api/wor/update" --header '@-' --output manifest.json
$headers | curl.exe --silent --show-error --fail-with-body "$base/api/wor/tables" --header '@-' --output tables.json
# Verify both downloaded files with the separate owner update public key.
# The server returns 503 if the owner has not uploaded a corresponding file yet.
