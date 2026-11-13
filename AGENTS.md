# AGENTS — вход в User

**До любого изменения кода или UI:**

1. Прочитай `PROJECT_STATE.md` в **текущем репозитории**.
2. Прочитай **единый UI-контракт**: [co-va/core/staging/UI_ALPHABET.md](https://github.com/co-va/core/blob/staging/UI_ALPHABET.md). Это **единственный** нормативный источник идентификаторов, владельцев и межрепозиторных правил UI. Не создавай локальную копию или вторую карту.
3. Для F/E/режимов/capabilities и владельцев данных прочитай [co-va/core/staging/BUSINESS_ARCHITECTURE.md](https://github.com/co-va/core/blob/staging/BUSINESS_ARCHITECTURE.md). Для тарифных прав отдельно читай [COMMERCIAL_TARIFF_CONTRACT.md](https://github.com/co-va/core/blob/staging/COMMERCIAL_TARIFF_CONTRACT.md); не путай статус готовности инструмента с приёмкой визуального UI.
4. Для технической приёмки Professional обязательно прочитай его [RELEASE_CLOSURE_MAP.md](https://github.com/co-va/professional/blob/staging/RELEASE_CLOSURE_MAP.md) и [RELEASE_CLOSURE_REGISTRY.json](https://github.com/co-va/professional/blob/staging/RELEASE_CLOSURE_REGISTRY.json). Не объявляй их статусы статусами User или Admin.
5. Перед изменением общего компонента установи его ID из UI_ALPHABET, **реального владельца исходника**, места использования в остальных приложениях и утверждённую форму. Если источники недоступны — явно укажи ограничение; ничего не угадывай.
6. **Scope:** User UI resides here; the four owner-approved Shared UI corrections dated 2026-11-13 are implemented in `user/staging` (see `PROJECT_STATE.md` and `CI_CONTRACT.md`) and supersede the old `user/main` rendering for those specific elements. The owner-designated current Shared UI reference is `user/staging`; `user/main` is a historical comparison point, not an alternate source for common controls. This design reference alone does not prove every User feature accepted on a device. Do not change Core or Professional. Изменяй только разрешённый репозиторий и `staging`. Не трогай `main`, чужой код, защитные тесты и утверждённый UI без явного разрешения. Не создавай новый план вместо продолжения существующего.

**Перед межрепозиторной синхронизацией:** для `shared.modal`, `shared.input`, `shared.selector`, `shared.shell` сначала прочитай секцию «User staging: эталон четырёх правил» в `PROJECT_STATE.md`; сравни точный SHA и результаты CI. Не переносить старые 14/18/20/22 px и 48/52 px полей. Нормативный `UI_ALPHABET.md` остаётся только в Core; этот файл его не заменяет.

**Завершение:** сообщи точно, что изменено, что проверено, что не проверено, SHA/PR и статус реальной приёмки. Нельзя называть компонент «утверждённым» по одному зелёному тесту.

`AGENTS.md` — точка входа для исполнителя, **не** автоматическая блокировка GitHub. Защиту обеспечивают отдельные реальные проверки и настройки репозиториев.
