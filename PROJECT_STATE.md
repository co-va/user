# PROJECT_STATE

## Обязательный контракт User

- Приложение конечного пользователя имеет единственного владельца: `co-va/user`.
- `co-va/core` НЕ является приложением конечного пользователя. Для User Core предоставляет только backend/API/server logic/Prisma/PostgreSQL и общие серверные контракты.
- Production User: `https://user.va-tools.ru` → `co-va/user/main`.
- User обращается к backend через `https://api.va-tools.ru`.
- Рабочая ветка исполнителя только `staging`. `main` меняется только после зелёных обязательных проверок и явного допуска владельца. Новые рабочие ветки без отдельной задачи запрещены.
- Любая замена выполняется вместо старой реализации, а не поверх неё. Старый UI, текст, route, owner, wrapper или compatibility-layer после замены должен быть удалён полностью и не возвращаться.
- Общий UI является единым контрактом для User и Professional. Пока Professional ещё очищается, утверждённый User UI является текущим эталоном общего контракта; Professional должен прийти к нему, а не создавать второй UI.
- Интеграции не входят в текущий этап и выполняются последними.

## CI-контуры

- `Repository` — репозиторная и архитектурная чистота.
- `Shared UI` — общий UI-контракт и геометрия.
- `Profile` — только Profile и его зависимости.
- `Record` — только Record и его зависимости.
- Profile и Record не должны блокировать друг друга из-за изменений вне своего контура.
- Перед `main` обязателен единый User Gate: применимые contour-checks + Repository + runtime smoke.

## План разделения User / Core

Следующий исполнитель НЕ создаёт новый план и НЕ начинает анализ заново. Он читает этот файл и продолжает с первого незавершённого этапа.

### Этап 1 — User Gate и preview — ACTIVE

- Починить технический `*.amvera.tech` preview: сейчас страница открывается, но зависает на `Загрузка…`.
- Добавить обязательный runtime smoke User.
- Собрать единый `User Gate`, который учитывает только применимые контурные CI и всегда требует Repository + smoke перед `main`.
- Не менять продуктовые контуры ради прохождения Gate.

### Этап 2 — защита `main` — TODO

- GitHub branch protection/ruleset для `main`.
- Только PR из `staging`.
- Запрет direct push, force push и удаления `main`.
- Required checks: User Gate.
- Merge только после зелёного Gate и допуска владельца.

### Этап 3 — архитектурная граница User/Core — TODO

- Зафиксировать guard-правила: End User App существует только в `co-va/user`.
- Запретить CI возврат User frontend/runtime/routes/UI в `co-va/core`.
- Core может содержать только API/server/DB части, которыми пользуется User.

### Этап 4 — удалить приложение User из Core — TODO

- Сначала составить фактическую карту User frontend/runtime в `co-va/core`.
- Удалить приложение конечного пользователя из Core полностью, без второго UI и без compatibility-слоя.
- Не удалять backend/API/Prisma/DB, необходимые `co-va/user`.
- Professional и другие продуктовые контуры этим этапом не переписывать.

### Этап 5 — финальная проверка — TODO

- `user.va-tools.ru` работает из `co-va/user/main`.
- User runtime smoke проходит.
- User API работает через Core.
- В Core отсутствует User frontend/runtime.
- `main` обоих репозиториев защищён по их правилам.
- После проверки обновить статусы этапов в этом файле; не создавать параллельный план.

## Текущее состояние

- `main` и `staging` User были выровнены на `f457cc1e2d73537d105989a1e54bb4782803fda9` перед созданием этого файла.
- Архитектурная очистка User от старых Booking/online-booking/bookingPrice/UEI/professional/client.va-tools.ru хвостов завершена.
- Постоянные CI: Repository / Shared UI / Profile / Record.
- Технический Amvera preview ещё не считается рабочим: зависает на `Загрузка…`.
