# EPIC-07 — Polish and release

**Goal:** turn a working feature set into something that can be shipped to people
who are not the author.

The work here is the kind that is easy to defer forever and expensive to skip:
accessibility, the states that are not the happy path, documentation, and the
pre-existing debt that blocks a store submission regardless of how good the notes
feature is.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-050](T-050-native-side-panel.md) | Native `chrome.sidePanel` as a third host | T-017, T-020 |
| [T-051](T-051-panel-host-setting.md) | Setting: overlay / native / both | T-050 |
| [T-052](T-052-accessibility.md) | Accessibility pass | T-025, T-035 |
| [T-053](T-053-states.md) | Empty, loading and error states | T-025 |
| [T-054](T-054-documentation.md) | README, shortcuts and privacy note | — |
| [T-055](T-055-release-checklist.md) | Performance pass and release checklist | all |

## Definition of done

- [ ] The panel can run as Chrome's native side panel as well as the overlay
- [ ] Every interactive element is keyboard reachable and screen-reader labelled
- [ ] No state in the application is a blank screen or a silent failure
- [ ] The README explains the features, the shortcuts and the durability caveat
- [ ] The store-submission blockers in EPIC-08 are resolved or consciously
      deferred

## Note on T-050

`navigator.storage.persist()` was originally planned here. It is covered by
[T-003](../EPIC-00-foundations/T-003-database-and-schema.md) R6 instead —
persistence has to exist from the first write, not be added at release.
