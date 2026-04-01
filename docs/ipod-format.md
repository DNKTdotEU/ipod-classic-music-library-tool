# iPod Device Format Reference

This document describes the on-device data structures used by the Devices tab to interact with iPod devices connected via USB mass storage.

## Device Filesystem Layout

When an iPod is connected in disk mode it mounts as a standard USB volume:

```text
<mount>/
├── iPod_Control/
│   ├── iTunes/
│   │   ├── iTunesDB        ← primary binary database
│   │   ├── ArtworkDB       ← artwork database
│   │   ├── iTunesSD        ← shuffle database
│   │   └── Play Counts     ← playback statistics
│   ├── Music/
│   │   ├── F00/            ← obfuscated music storage
│   │   ├── F01/
│   │   └── ...F49/
│   └── Device/
│       └── SysInfo          ← device identification
├── Notes/                   ← text files viewable on iPod
├── Calendars/               ← vCal files
└── Contacts/                ← vCard files
```

## SysInfo File

Located at `iPod_Control/Device/SysInfo`. Plain-text key-value pairs:

```text
ModelNumStr: MA446LL
pszSerialNumber: 4H5123456XYZ
FirewireGuid: 0x0001234567890ABC
visibleBuildID: 0x03020100
boardHwSwInterfaceRev: 0x000B0011
```

We use `ModelNumStr` (with leading M/P stripped) to look up the human-readable model name from a database of known iPod models.

## iTunesDB Binary Format

The iTunesDB is a little-endian binary file with a hierarchical structure of "mh"-prefixed chunks.

### Chunk Encoding

Every chunk starts with:

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | Chunk type identifier (ASCII, e.g. `mhbd`) |
| 4 | 4 | Header size (uint32 LE) |
| 8 | 4 | Total size or child count (uint32 LE) |

### Hierarchy

```text
mhbd (database)
└── mhsd (dataset, type=1 for tracks, type=2 for playlists)
    └── mhlt (track list, field at offset 8 = track count)
        └── mhit (track item, field at offset 12 = mhod count)
            └── mhod (data object — strings, artwork refs, etc.)
```

### mhit (Track Item) Key Fields

| Offset | Size | Field |
|--------|------|-------|
| 16 | 4 | Track ID |
| 28 | 4 | Media type flag (1=audio, 2=video, 4=podcast, 8=audiobook) |
| 32 | 4 | Rating (0-100) |
| 36 | 4 | File size in bytes |
| 40 | 4 | Duration in milliseconds |
| 44 | 4 | Track number |
| 48 | 4 | Year |
| 52 | 4 | Bitrate (kbps) |
| 60 | 4 | Sample rate (upper 16 bits) |
| 80 | 4 | Play count |

### mhod (Data Object) String Types

| Type | Meaning |
|------|---------|
| 1 | Title |
| 2 | File location (colon-separated path) |
| 3 | Album |
| 4 | Artist |
| 5 | Genre |
| 7 | Comment |
| 12 | Composer |
| 14 | Grouping |

String mhods have a sub-header at offset 24 with string length (offset 28) and encoding (offset 36, where 2 = UTF-16LE).

### Path Format

File locations use colons as separators: `:iPod_Control:Music:F00:ABCD.mp3`. Our parser converts these to OS-native paths relative to the mount point.

## Supported iPod Models

The model database covers:

- **iPod Classic** — 3rd through 7th generation
- **iPod Video** — 5th and 5.5th generation
- **iPod Mini** — 1st and 2nd generation
- **iPod Nano** — 1st through 5th generation
- **iPod Shuffle** — 1st through 4th generation

Devices not in the lookup table are shown as "Unknown iPod (model: X)".

## Current Limitations (V1)

- **Read-only**: The parser reads the iTunesDB but does not write to it. Adding music that plays on the iPod requires iTunesDB writing, which involves cryptographic hash generation on newer models (6G+).
- **No playlist support**: Playlist datasets (mhsd type 2) are skipped.
- **No artwork**: ArtworkDB parsing is not implemented.
- **Detection**: Relies on scanning mount points rather than USB hotplug events.

## References

- [iPodLinux iTunesDB documentation](http://www.ipodlinux.org/ITunesDB/)
- [iPodLinux SysInfo documentation](http://www.ipodlinux.org/SysInfo.html)
- [Apple Support: Identify your iPod model](https://support.apple.com/HT204217)
