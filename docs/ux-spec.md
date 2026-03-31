# UX Specification

## Navigation map
- `Dashboard`
- `Scan Setup`
- `Duplicate Results`
- `Duplicate Compare`
- `Rules & Profiles`
- `Metadata Editor`
- `Artwork Search`
- `Quarantine`
- `History`
- `Settings`

## Primary flows
1. Onboarding: Empty State -> Scan Setup -> Scan Progress -> Dashboard.
2. Dedupe: Duplicate Results -> Duplicate Compare -> Keep/Quarantine/Defer -> Dashboard refresh.
3. Recovery: Quarantine -> Restore -> History entry.
4. Metadata: Metadata Editor -> Preview changes -> Apply -> History.
5. Artwork: Artwork Search -> Select candidate -> Apply -> Preview -> Confirm.

## Wireframe notes

### Scan Setup
- Left: folder list with add/remove.
- Middle: supported extension summary.
- Right: sensitivity mode and quick profile toggles.
- Footer: `Start Scan`, `Save Profile`.

### Duplicate Results
- Table with columns: confidence, title, artist, count, status.
- Quick filters: exact/likely/conflict/unresolved.
- Bulk action toolbar: keep-best, keep-first, skip, quarantine.

### Duplicate Compare
- Two-to-many candidate cards.
- Highlighted diffs: duration, bitrate, tags, artwork presence.
- Actions per candidate: `Keep`, `Preview`, `Open location`.
- Group actions: `Quarantine non-kept`, `Defer`, `Skip`.

### Quarantine Restore
- List: original path, reason, date.
- Detail panel: related duplicate group and restore target.
- Actions: `Restore`, `Delete Permanently`.

## Interaction specs
- Ask-on-conflict: auto-actions cannot finalize conflict groups.
- Duration threshold: default 2 seconds, configurable.
- Bulk action confirmation: shows count impacted and recovery path.
- Keyboard controls: up/down navigate, enter open compare, space preview, `k` keep, `d` defer.
- Destructive buttons use high-contrast warning styling and confirmation modal.

## Accessibility baseline
- Keyboard reachable controls in all major views.
- Focus ring always visible.
- Color is never the only indicator for state differences.
- Announce long-running operation states using aria-live regions in renderer.
