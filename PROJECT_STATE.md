# PROJECT_STATE


## Обязательный вход для всех чатов — общий UI-контракт

- **Сначала прочитать:** этот `PROJECT_STATE.md`, затем единый [UI_ALPHABET.md](https://github.com/co-va/core/blob/staging/UI_ALPHABET.md) в `co-va/core/staging` (реальные UI-владельцы, стабильные ID, межрепозиторные зависимости, критерии приёмки), затем применимые существующие карты и тесты. При отсутствии доступа к любому источнику не выдавать предположения за проверенные факты.
- **Перед изменением UI:** назвать контрактный ID, найти его реальные реализации и потребителей в User / Professional / Admin, проверить расхождения и существующие утверждения; **не** создавать второй UI, вторую карту или новые ID для одного компонента.
- **Границы:** `co-va/core` — API/Администратор/центральный UI-контракт; `co-va/user` — User; `co-va/professional` — Professional. Нельзя редактировать чужой репозиторий и `main` без отдельного разрешения; рабочие правки только в `staging`.
- **Текущее исполнение:** Работать с frontend User. Считать текущий user/main заявленным дизайнерским ориентиром, но не автоматически технически проверенной версией; изменения согласовывать и фиксировать отдельно. Существующие проектные и релизные планы не заменять новыми. Любые статусы «утверждено»/«закрыто» — только по доказательствам, отдельно визуал и функциональность.
- `AGENTS.md` — короткая входная точка для нового исполнителя. Защита GitHub и реальное совпадение UI **не** считаются обеспеченными этим текстом.

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

### Этап 1 — User Gate и preview — DONE

- Технический Amvera preview запускает User: проверен экран входа в Chromium; зависание на «Загрузка…» при недействительной сессии исправлено PR #2.
- Browser runtime smoke включён в обязательный User / Check и проверяет загрузку UI и истёкшую сессию.
- Защита `main` требует `check` и `staging-smoke`; `check` проверяет Repository, Shared UI, Profile, Record, синтаксис и Chromium smoke.
- Не менять продуктовые контуры ради прохождения Gate.

### Этап 2 — защита `main` — DONE

- Активный GitHub ruleset `Protect main` проверен.
- `check` для PR блокирует ветки кроме `staging`; PR #2 и #3 слиты из `staging`.
- Ruleset требует PR, запрещает удаление и non-fast-forward `main`.
- Required checks: `check` (включает Chromium smoke) и `staging-smoke`.
- Требование допуска владельца и зелёных проверок сохраняется; PR #2/#3 прошли обязательные проверки до merge.

### Этап 3 — архитектурная граница User/Core — DONE

- Архитектурное разделение закреплено в документах User и Core.
- Guard `scripts/check-user-core-boundary.mjs` подключён в обязательный `npm run check` Core; PR #832 слит в `core/main` на `8ccdc9cc1bb02ebfbb0dc6987eeb81eceac0c960`, Check Book и staging-smoke — PASS.
- Core хранит API/DB для User; пока отдельно сохраняет Professional и Public Booking до завершения их выделения.

### Этап 4 — удалить приложение User из Core — DONE

- Проведена фактическая проверка User frontend/runtime в Core перед удалением.
- Удалены User HTML, Account Shell, клиентский runtime, CSS и User PWA assets; Core PR #831 слит.
- API, сервер, Prisma и PostgreSQL сохранены в Core; его обязательный CI прошёл.
- Professional и отдельный гостевой Public Booking сохранены в Core.

### Этап 5 — финальная проверка — PARTIAL

- В Chromium подтверждён экран входа `user.va-tools.ru`; рабочий `user/app.js` побайтно совпал с кодом `user/main` после PR #2.
- User browser smoke, production availability и Core API smoke прошли 2026-11-04.
- Проверена доступность `api.va-tools.ru` и отрицательный ответ `401/403` без авторизации. Полный авторизованный путь (вход → Журнал → запись) автоматикой пока не доказан.
- Подтверждено отсутствие удалённого User frontend/runtime в Core после PR #831.
- Активные GitHub rulesets User и Core запрещают удаление/force-push и требуют PR и CI.
- Статусы обновлены по фактам 2026-11-04. Этапы 1–4 — DONE. Остались проверки этапа 5: сквозной авторизованный путь User и стабильность HTTPS Amvera в реальной эксплуатации.

## Текущее состояние

- По состоянию 2026-11-04 `main` и `staging` User выровнены на `ab29dcc3700b41d9bfb21394b2e5034d563d5d70` (PR #2 и #3).
- Архитектурная очистка User от старых Booking/online-booking/bookingPrice/UEI/professional/client.va-tools.ru хвостов завершена.
- Постоянные CI: Repository / Shared UI / Profile / Record.
- Технический Amvera preview прошёл Chromium smoke на запуск экрана входа и сценарий истёкшей сессии. Сквозная авторизованная проверка остаётся отдельным незакрытым пунктом.


## Фактическая проверка User после инцидента 2026-11-04

- PR #2 в co-va/user исправил зависание на «Загрузка…»: если учётная запись отсутствует после проверки сохранённой сессии, открывается вход, а не остаётся loader.
- Обязательный User / Check включает Chromium smoke на Amvera preview, включая 401 account/me + успешный platform-state: ожидается возврат к входу.
- User / Production Availability на main проверяет боевой HTTPS/HTML/JS и доступность Core API каждые 15 минут, а запуск интерфейса в Chromium — после push в main и каждые 6 часов.
- Внешним браузером подтверждён экран входа на user.va-tools.ru и техническом preview. После PR #2 проверено побайтовое совпадение реального https://user.va-tools.ru/user/app.js с текущим файлом в user/main.
- **Открытый инфраструктурный риск:** в ходе диагностики зафиксированы периодические TLS-обрывы user.va-tools.ru (SSL_ERROR_SYSCALL); при последующей повторной проверке HTTPS/сертификат и UI были доступны. Нельзя считать поведение Amvera edge гарантированно исправленным; требуется отдельно подтвердить привязку и стабильность custom domain в Amvera. Это не повод возвращать User frontend в Core.
- Core продолжает быть единственным владельцем API/Prisma/PostgreSQL. Изменения этого этапа не переносили серверную логику или данные в User.

## Shared Color Picker: прямоугольный образец на всех экранах — 2026-11-08

- В `ui/colors/colors.css` общий свотч `colorPicker` переведён на **58×28 px, border-radius:4px**. Ранее только `.user-event-color-picker` и `.user-note-color-picker` использовали этот же прямоугольный размер, тогда как базовый Shared компонент рисовал круг; лишний частный CSS удалён. Палитра сохраняет общий Shared компонент; углы её цветовых плашек унифицированы до 4 px.
- В `ui/cards/entity-card-constructor.css` общие элементы выбора цвета в «Вид» теперь тоже прямоугольные: три градиентных цвета используют стандартную геометрию `colorPicker` без специального свотча, предустановки цвета текста больше не круглые. Обработка кликов, выбор и сохранение цвета, источник данных не изменены.
- Геометрия `ui/colors/colors.css` проверена на полное совпадение с `co-va/professional/staging`; JavaScript цвета совпадает без изменений. Никаких изменений в User auth/Record/API/данных. Статические и моделируемые проверки Shared UI — PASS, реальная визуальная проверка на устройстве не проводилась.
- Только `co-va/user/staging`; `main` не затронут. `co-va/core` не менялся.

## Единая геометрия кнопок User — 2026-11-11

- Сверено с `co-va/professional/staging`: полноразмерные кнопки и поля используют `--ui-control-height:48px`, обычные кнопки имеют фиксированную высоту.
- Контейнер `ui-action-surface` выравнивает ширину кнопок относительно нижнего действия в Z/Q/X. Для Z сохранён существующий правый viewport overscan 24 px; он теперь задан общим токеном.
- Селекторы, поля ввода, выбор времени и длительности приведены к одной высоте. Компактные кнопки, иконки, кнопки заголовка и парные кнопки редактора карточек сохраняют собственную геометрию.
- Исправление затрагивает только Shared UI `co-va/user/staging` и проверку геометрии. UI/Record/Profile-логика, API и другие репозитории не менялись. Внешняя проверка на устройстве требуется отдельно.

### Q-профиль: компактные кнопки добавления — 2026-11-11
- Исправлен регресс, занесённый в `ui/buttons/buttons.css` коммитом `213ba5f`: общий `@container ui-action-surface` центрировал кнопки «+» в заголовках телефона, email, Telegram и ссылок.
- Контракт: общие полноразмерные действия центрируются, но существующие `.array-row__add` и `.ui-links__add` остаются справа от заголовков. Визуальный формат и обработчики не изменяются.
- Зафиксирована геометрическая проверка всех четырёх кнопок «+» в реальном Q профиля и Shared UI guard.
- Исправление — только в `co-va/user/staging`; `main` не изменяется без разрешения.

### Карты Professional → User: каноническая сетка 9×3 — 2026-11-11
- User теперь отображает тот же 9-строчный/трёхколоночный формат карты, что утверждён в Professional. Сохранены цвет, размер, позиция, фото, значения, старые карты со строковым `field`.
- Старый read-only однострочный рендер заменён, не наложен поверх. Старая, неиспользуемая в User форма редактирования карты удалена из этого UI-файла и CSS; редактирование карты принадлежит Professional.
- Core/staging projection дополняет контур передачи, сохраняет только публичные поля каждой ячейки без выдумывания данных.
- Журнал, WLIST2, Z/Q/X, списки и кнопки не менялись. Браузерный Q-тест дополнен проверкой реального содержимого и геометрии 9×3.
- Только staging; main запрещён без подтверждения владельца.

### Компактный «+» как отдельный Shared control — 2026-11-11
- Кнопка добавления в форме Q не является полноразмерной `ui-button`. Создан один `compactAddControl()` в Shared Buttons; используется для телефона, Email, Telegram и ссылок, а также других repeated-fields.
- Общие базовые декларации кнопок не дублируются; центрирование полноразмерных действий применяется только к `.ui-button`. Конкретные размеры и существующий вид «+» в Q сохранены.
- CI проверяет классы и положение всех четырёх кнопок. Никакие WLIST2, Журнал или V2-системы при этом не изменены.

### Удаление действительно неиспользуемого Accordion — 2026-11-11
- Подтверждено отсутствие источников и вызовов `accordion` в действующих Core/User/Shared JS и CSS; единственная bootstrap-ссылка находилась в `index.html`.
- Удалён физический `ui/accordion/accordion.css` и подключение из `index.html`. Все действующие стили Журнала, Q/Z/X, V2, WLIST2, сегментов и списков оставлены без изменений.
- CI предотвращает возвращение старого Accordion. Это точечная очистка; другие предполагаемые устаревшие компоненты до отдельной проверки не удаляются.

### Очистка неиспользуемых Folder/Column UI — 2026-11-11
- `ui/cards/folder-card.css` и `ui/layout/layout.css` не имеют потребителей в Product JS/HTML или других CSS; удалены физически вместе с загрузкой из `index.html`.
- Активные общие Card, MiniCard, List Entry, Z/Q/X, WLIST2, переключатель День/Месяц/Список и размеры экранов не изменены. Никаких новых UI не введено.
- Shared UI guard запрещает возвращение старых классов и файлов.

### Браузерная защита утверждённых переключателей и WLIST2 — 2026-11-11
- `user-journal-record-smoke` проверяет computed CSS переключателя День/Месяц/Список и геометрию/тень WLIST2 в Chromium.
- Shared guard запрещает отключение этих двух активных CSS источников при дальнейшей очистке.

### Точечная декомпозиция устаревших Selection/States UI — 2026-11-11
- `viewNavigation()` остаётся действующим переключателем День/Месяц/Список; его оформление `ui/selection/segment-control.css` сохраняется в исходном порядке. Удалена только неиспользуемая JS-реализация `segmentControl()` и её реэкспорт.
- Старый `checkList` не имеет Product-потребителей: удалены JS/CSS и экспорты.
- Старый `stateView` не имеет Product-потребителей: удалены JS и неиспользуемый CSS. Используемый `emptyState()` сохранён, декларации `.empty-state` перенесены без изменения CSS в `ui/states/empty-state.css` на ту же позицию загрузки.
- Запрет на возвращение удалённых источников закреплён в Shared UI guard; браузерный визуальный тест переключателя и WLIST2 действует.

### Удаление неиспользуемых старых Cost/Payment/Workplace UI — 2026-11-11
- По графу вызовов User, Core и Shared UI эти CSS-модули не имеют действующих экранов; удалены вместе с `index.html` ссылками. Их старые бизнес-классы не должны возвращаться.
- Действующие Price/Record/Finance и типовые кнопки не перерабатывались. Сохранены все активные селекторы Журнала, WLIST2, Q/Z/X и карточек.
- Контракт отсутствия потребителей закреплён Shared UI guard. CSS других компонентов не переопределён.

**Корректировка:** старые `.work-time-row` правила обнаружены также в `ui/time/time.css`. Неиспользуемый блок удалён из Time CSS после проверки отсутствия генератора этих классов; действующие правила выбора времени сохранены.

### Устранение точных CSS-дубликатов — 2026-11-11
- В `ui/inputs/inputs.css` удалён второй полностью идентичный блок правил `password-field`.
- В `ui/buttons/buttons.css` два последовательных объявления `.sheet-icon-button` объединены в одно с тем же конечным `font-size:23px`. Отображаемые CSS-значения не изменились.
- CI запрещает повторное дублирование. Active UI и бизнес-логика не менялись.

### Пустые публичные карточки профиля и пространства (User) — 2026-11-11
- Источник дефекта: `professionalContactCard` считал пустой `card.fields: []` и 9 пустых строк Core готовой карточкой, прекращая чтение уже переданных полей профиля и пространства. Старая проверка конфигурации не распознавала новый формат `lines[].cells.left/center/right`.
- Используется одна существующая Shared 9×3 сетка. Сохранённый `cardAppearance` из профиля/пространства имеет приоритет, только если серверная проекция пустая. Публичные значения из уже полученного payload используются исключительно при полностью пустом `card.fields`. Корректная непустая проекция Core не меняется.
- User не создаёт новый вид карточки и не добавляет служебные поля. Если API не передал ни конфигурацию карты, ни сохранённый вид, восстановить её из фотографии нельзя — это проблема исходного контракта, не повод строить вторую карту в User.
- Изменения только в `co-va/user/staging`; `co-va/core`, `co-va/professional`, `main` не менялись.

### Фаза A: доказанное удаление неподключённых UI-источников — 2026-11-11
- Полный просмотр исполняемого JS выявил отсутствие потребителей `ui-list`, `ui-info`, старого `tag-manager` и `entity-card__details`; их отдельные CSS удалены вместе с четырьмя ссылками bootstrap.
- Из действующего `list-entry.css` удалено только неиспользуемое правило старой панели `ui-list-toolbar`; оформление WLIST2 `.list-entry` и `.list-entries` не менялось.
- Из `modal.css` удалено только зависимое правило для неиспользуемой `.ui-info`; X/Q/Z и активные модали не переписаны.
- Shared UI CI проверяет отсутствие этих классов в Product и однозначное 1:1 соответствие подключений реальным CSS-файлам, запрещает дубли ссылок.

### Фаза B: убрать параллельные Header/Page/Table/EntityCard owners — 2026-11-11
- Из `ui/header/index.js` удалены недостижимые `pageHeader`, `headerControl`, `headerToggle`, их группы и модальный wrapper. Активный `workspaceHeaderContext` и его CSS сохранены.
- Из `ui/page/page.js` удалены устаревшие `agreementBlock`, `dataTable`, `sortedTableRows`, `bindDataTable`; работающие `page`, `details`, `setSharedActionVisible`, `actionBlock` оставлены без изменений.
- Из `ui/cards/index.js` удалён отдельный неиспользуемый генератор `entityCard`; существующая карта Professional→User, `entityCardStack` и `entityCardRail` не переписывались.
- В CSS убраны только соответствующие старые правила заголовков, таблиц и `booking-account` из Page/Header/Calendar/V2/Settings/Forms. Стили `entity-details`, `profile-actions` и активный `.app-header` сохранены.
- Retired markers и Shared guard защищают единственных владельцев UI от возврата дубликатов; main, core и professional не изменялись.

**CI-привязка после фазы B:** старое условие для удалённой панели согласий заменено проверкой действующего `entity-details`. Историческая ссылка из комментария WLIST2 на удалённый генератор `entityCard()` заменена на канонический `entityVisualCard()`, код списка не менялся.


### User staging API routing and regression 2026-11-11
- The public Amvera preview domain `user-volokovykh.msk1.amvera.tech` runs a real authenticated User application; its old local `/api` proxy intentionally rejects non-GET requests with HTTP 405. The preview previously used this read-only route, breaking profile saves, events, notes and bookings.
- The User frontend now calls `https://api.va-tools.ru` directly from the Amvera preview. The Core application (read-only inspection, **not changed**) explicitly includes this exact preview origin in production CORS allowed origins. Login/session and all writes remain Core-owned. The old local fallback remains read-only.
- IMPORTANT: preview currently writes into the same Core backend as production; tests with real credentials persist real account changes. Do not claim isolation, invent a staging database, or relax Core auth. Keep a browser/CORS regression gate and never promote a mere static smoke PASS as proof of authenticated writes.
- User photo delete must use canonical pink `danger` action. Protect against regression.

## Единый источник юридических документов — 2026-11-11 (staging)
- Единственный владелец юридических документов и подписанных редакций — `co-va/core` / PostgreSQL (`PlatformDocument`, `PlatformDocumentVersion`, `AccountDocumentEvent`); `co-va/user` не хранит тексты документов, не создаёт локальные редакции или дубликаты.
- Удалён `core/account/platform-documents.js` с локальной копией `PLATFORM_PRIVACY_POLICY`. `getGlobalAccountPlatformState()` получает политику ПДН и условия аккаунта из `GET /account/platform-state`; первый API отдаёт `privacyPolicy` из core DB после миграции `20261111190000_platform_user_privacy_policy`. Исторический текст политики редакции 1 от 01.11.2026 перенесён в core без изменений.
- **Deployment dependency:** User staging preview currently calls production `https://api.va-tools.ru`. Until the core backend that includes the migration and `privacyPolicy` API field is deployed, User staging must NOT be declared end-to-end verified: the privacy document may be missing there. Do not restore the copied file or substitute Professional's different policy as a workaround. Coordinate release and verify both documents after Core API deployment; keep `main` unchanged without explicit approval.
- Professional's tenant consent templates and RKN are separate legal documents sourced from core DB. This change does not edit their contents or signing history.

## Shared Z/Q Header: единый шаг 12 px (User) — 2026-11-13

- Согласовано владельцем: один Header для Z и Q, ровно 12 px сверху и снизу; между 0…N элементами Header также 12 px. Середина расширяется только по высоте содержимого, стрелка центрирована по строке. Не добавлять отдельные Z 14 px, Q 18 px или Q верхние 20 px.
- Вставляемый текстовый заголовок не является текстовым полем: существующий `v2-q-title` занимает доступную ширину и имеет высоту минимум 46 px, без границ, заливки и отдельного позиционирования; существующая типографика сохранена. Длинный заголовок может вырасти по высоте, чтобы не обрезать текст.
- В `user/note-view.js` удалён локальный absolute-заголовок «Заметка»; используется тот же `v2-q-title`, что и в остальных Q.
- Только `co-va/user/staging`. Не менялись main, Core, Professional, API, бизнес-логика и защитные тесты. Технические проверки и внешнюю визуальную приёмку фиксировать отдельно — запись здесь не означает подтверждения на устройстве.
- Нормативное закрепление стандарта в единственном `co-va/core/staging/UI_ALPHABET.md` требует отдельного решения исполнителя Core и не выполнялось из User.

### User staging: эталон четырёх правил Z/Q, Input, Selector (13.11.2026)

**Решение владельца:** считать согласованным UI-ориентиром `co-va/user/staging` по четырём правилам ниже. Предыдущий `user/main` не является эталоном этих исправленных элементов. Ссылки на реальные исходники:
- `shared.modal`: `ui/modals/modal.css`, `ui/v2/v2.css` — фон Z/Q строго `#FFFFFF` (никакого `--app-bg:#F5F5F3` на поверхности). Фон H не менять.
- `shared.input`: `css/style.css` `--ui-field-height:46px`, `ui/inputs/inputs.css`, `ui/profile/profile.css`, `ui/auth/auth.css`: однострочный ввод, включая Email, телефон и ссылки, точно `46px`. `textarea` — отдельно; кнопки остаются `48px`.
- `shared.selector`: `ui/selectors/selectors.css`, `ui/time/time.css`, `ui/duration/duration.css`, `ui/colors/colors.css`: селектор, его поиск и строки, пикеры — `46px`, включая двухстрочный текст; отдельных вариантов 48 px нет.
- `shared.modal` / `shared.shell`: `ui/v2/z-layout.js`, `ui/v2/surface-header.css`, `ui/v2/v2.css`, `user/note-view.js`: общий Header Z/Q `12px` верх / `12px` между элементами / `12px` низ, без дублирующих отступов у Body. Текстовый заголовок — не инпут: прозрачная ячейка минимум `46px`, растягивает середину, занимает доступную ширину, стрелка центрирована.

**Проверяемая реализация:** `co-va/user` commit `c5e94ba366bdb052d1144b58e86de3cb6c93531e`; до него: commit `46cae99857d494fdaf3c2b4f7ce9b04cb10ae34d` (начало Header). Окончательный CI и визуальную приёмку фиксировать отдельно, не объявлять заранее. `scripts/ci/guard-shared-ui.mjs` теперь должен обнаруживать возврат старых 22 px корня Z, 18 px Body Q, 52 px аккаунта, 48 px полей/селекторов или серой Q-поверхности.

**Передача другим чатам:** читать `AGENTS.md`, `CI_CONTRACT.md` и **этот** раздел `PROJECT_STATE.md` из `co-va/user/staging`; затем сверять указанные файлы/commit и CI. Документ не создавать заново, в Professional не копировать отдельную карту. Центральный `co-va/core/staging/UI_ALPHABET.md` требует отдельной синхронизации владельцем Core: код Core/Professional и их документы этой задачей не изменялись. Общая нормативность **не считается технически внедрённой в Core** до такой синхронизации.
