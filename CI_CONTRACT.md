# User CI contract

## Replacement rule

- Never add a replacement on top of the previous implementation.
- Replacing UI means deleting the previous UI implementation.
- Replacing copy/text means deleting the previous phrase.
- Replacing a route, API bridge, owner, adapter, or presentation layer means deleting the previous one.
- Do not keep compatibility wrappers, hidden fallbacks, parallel selectors, duplicate CSS, or dead copies unless they are an explicit current product requirement.
- When a marker is retired, add the exact old marker to `scripts/ci/retired-markers.txt`. CI then prevents it from returning.

## CI ownership

- `User / Shared UI` protects the shared UI contract used by User and, after Professional cleanup, by Professional.
- `User / Profile` protects only the approved User Profile contract.
- `User / Record` protects only the User Record flow.
- `User / Repository` protects repository-wide architecture, removed markers, syntax, production origin, PWA root, and read-only staging preview.
- A feature CI must not validate or redefine another feature's product rules.

## Shared UI

User does not own a private alternative UI. The current approved User UI is the canonical shared contract while Professional is being cleaned. Professional must converge on the same shared UI rather than introduce a second variant.

## User main — утверждённые 4 правила Shared UI, 2026-11-13

**Владелец подтвердил визуальные параметры.** После выпуска через PR эталон реализации — `co-va/user/main` (проверять фактический SHA). `staging` — только ветка разработки; он не становится эталоном автоматически. Текущий нормативный UI-реестр по-прежнему находится только в `co-va/core/staging/UI_ALPHABET.md`; в других репозиториях не заводить копий.

1. **Единый фон всех обычных внутренних модалов Z/Q/X/S:** тёплый светлый серо-бежевый `#F5F5F3` (`--v2-inner-surface`), включая Header и внутренние панели действий. **Единственное исключение по модальным поверхностям — технический модал: белый `#FFFFFF` стикер на графитовом H (`#2F3338`).** Поля ввода, селекторы и белая полосатая сетка Журнала остаются `#FFFFFF` на тёплой поверхности Z.
2. **Поля:** строго фиксированная высота однострочного редактируемого поля `46px` (ни больше, ни меньше), включая профиль, телефон, Email, формы аккаунта и ссылки. Многострочные `textarea` имеют собственную высоту. Не связывать поле с размером кнопок: кнопки по-прежнему используют `--ui-control-height:48px`.
3. **Селектор:** активный контрол, поиск внутри выбора, строки выбора, селекторы времени/длительности/цвета — `46px`. Двухстрочное значение укладывается в те же 46 px, без варианта 48 px.
4. **Header Z/Q:** один owner `ui/v2/z-layout.js`; пустой Header строго **12px верх + 12px середина + 12px низ = 36px**. Стрелка центрирована по средней зоне, но её невидимая область нажатия не увеличивает высоту Header. Если вставлен элемент, он заменяет средние 12px своей фактической высотой; между двумя или более отдельными элементами строго 12px. Например, одна вставка 46px даёт 70px Header, две вставки по 46px дают 128px Header. Вставленный текстовый заголовок — не input, строго `46px` (height = min-height = max-height), без рамки/заливки. Переключатели/поиск сохраняют собственные утверждённые размеры. Дополнительные 14/18/20/22px запрещены.

Старые утверждения, связывавшие высоту полей с кнопками, отменены **только** для формы и выбора. Запрещено обходить защиту отключением проверки; необходимо проверять сохранность обеих независимых геометрий.

## Release evidence — 24.11.2026

Для PR staging → main обязательный job `check` использует центральный скрипт `co-va/core/scripts/check-release-evidence.mjs` на SHA `cc60a79f516d771e5d8d02420fb1dbd9cd5b9f60`. SHA закреплён намеренно: обновлять на проверенную версию по согласованию, не выполнять плавающий Core/staging. Push в staging не требует этого gate. Все существующие UI, API, runtime и staging-smoke проверки сохранены.

После завершения работы фиксировать фактический результат в сообщении коммита или отдельном коммите с неизменённым деревом:

```text
Operational-Evidence: {"kind":"implemented","files":["core/record/platform-api.js"],"criteria":["records.user"],"result":"Фактическое изменение","remaining":"Что осталось проверить","checks":["Команда и фактический результат проверки"]}
```

Пример иллюстративный, не утверждение о проверке этого файла. Каждый изменённый файл должен иметь запись для итоговой версии; последующее изменение файла требует новой записи. ID брать из центрального DEVELOPMENT_CATALOG. Markdown не требует записи, для технических путей допускается platform. Для неизвестных User runtime-путей требуется существующий ID, но полный автоматический маппинг User ещё не реализован. Запись не равна принятию владельцем, не увеличивает готовность без принятия; отдельный реестр не заводить. Синхронизация Git с operationalProgress — Core #942. Не отключать gate, не ослаблять CI, не использовать фиктивный PASS.

## Owner approval of architectural changes — 24.11.2026

`.github/CODEOWNERS` lists protected architecture, shared UI, API bridges, application entry/shell, release guards and infrastructure; `@co-tools` is the designated reviewer. The existing main ruleset requires Code Owner review and dismisses stale approvals on new commits. Ordinary changes outside protected paths do not require a Code Owner review. The rule applies only after CODEOWNERS is present in main. The executor must use `3001vaf-maker` with Write, never the owner login; an owner-authored PR is not a valid test of separate owner approval. Do not approve on behalf of the owner, bypass or modify review rules. Verify actual blocking on an executor-authored PR before describing the protection as proven. Staging remains unrestricted by this main ruleset.
