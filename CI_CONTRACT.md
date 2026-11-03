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
