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
