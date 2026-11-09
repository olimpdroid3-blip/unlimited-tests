# WoR Collector — файлы для программы

База: https://unlimited-tests.lovable.app. Нужны только Bearer refresh_secret и
X-Machine-Code. X-App-Version и непросроченная лицензия для скачиваний не нужны.
Регистрация устройства должна быть активна, доступ участника — не отозван.

```powershell
$base = 'https://unlimited-tests.lovable.app'
$headers = @{
  Authorization = 'Bearer <REFRESH_SECRET>'
  'X-Machine-Code' = '<MACHINE_CODE>'
}
Invoke-WebRequest "$base/api/wor/tables" -Headers $headers -OutFile tables.json
Invoke-WebRequest "$base/api/wor/update" -Headers $headers -OutFile manifest.json
Invoke-WebRequest "$base/downloads/WoR-Collector-X.Y.Z.exe" -Headers $headers -OutFile WoR-Collector-X.Y.Z.exe
```

В последнем запросе используйте имя из текущего manifest.json.

```bash
BASE='https://unlimited-tests.lovable.app'
SECRET='<REFRESH_SECRET>'
MACHINE='<MACHINE_CODE>'
curl --fail-with-body "$BASE/api/wor/tables" -H "Authorization: Bearer $SECRET" -H "X-Machine-Code: $MACHINE" -o tables.json
curl --fail-with-body "$BASE/api/wor/update" -H "Authorization: Bearer $SECRET" -H "X-Machine-Code: $MACHINE" -o manifest.json
curl --fail-with-body "$BASE/downloads/WoR-Collector-X.Y.Z.exe" -H "Authorization: Bearer $SECRET" -H "X-Machine-Code: $MACHINE" -o WoR-Collector-X.Y.Z.exe
```

`-L` не нужен: сервер не перенаправляет скачивания. JSON скачивается как файл,
без ConvertFrom-Json/ConvertTo-Json и без изменения подписанных байтов. Подпись
проверяет программа офлайн-ключом владельца; на сервере этого секретного ключа нет.
Серверный Ed25519-ключ лицензий — другой ключ, он не подписывает обновления/таблицы.

Ошибки трёх файловых endpoints: только `{ "code": "...", "message": "..." }`.
Если файл отсутствует или релиз отозван — 404 not_found. Неверный/отозванный
секрет устройства — 403 revoked. У остальных endpoints старый формат не менялся.

## Управление

https://unlimited-tests.lovable.app/wor/admin → «Таблицы» / «Релиз».
Там есть загрузка, версия, дата и отзыв текущего релиза. При загрузке релиза
имя EXE и его SHA-256 проверяются до публикации. Дополнительные JSON-поля
сохраняются, подпись сервером не проверяется. «Отозвать релиз» прекращает выдачу
манифеста и EXE; таблицы при этом продолжают работать.

## Уже загружено

- Источник: только C:\Users\777\Desktop\antiwatcher\claude-tools\license-admin\to-upload\tables.json.
- Версия: 1; размер: 1408 байт.
- SHA-256: `2a9e903dbfd9bff9af1cfc6df56d2976f38eae9fd9dd249acc06abeff4ba8ca2`.
- Структура проверена; чтение из хранилища побайтно совпало с исходником.
- Manifest/EXE не читались и не загружались; ожидается отдельное указание владельца.
