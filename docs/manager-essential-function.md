# Manager Essential Function

This document defines the essential job of the local manager layer in TouchGal Local Manager.

It is based on the current codebase direction and the target library-first desktop experience implied by the reference image at `C:\Users\Meko\Pictures\potatovn.png`.

## Core Purpose

The manager exists to turn TouchGal resources plus local game files into a usable desktop library.

Its essential function is:

- collect games from TouchGal browsing, search, favorites, and downloads
- convert downloaded archives into stable local library entries
- present those entries as a fast visual game library
- let the user find, sort, filter, reveal, and launch local games
- keep upstream metadata and local ownership clearly separated

In short:

> TouchGal is the upstream content source.  
> The manager is the local operating layer.

## Product Role

The manager is not just a downloader.

It should behave like a local game hub with these responsibilities:

- library organization
- install tracking
- launch management
- download and extraction orchestration
- local favorites and collection management
- quick discovery through search, filters, and sorting
- recovery surfaces for broken, unresolved, or orphaned installs

## Essential User Flows

### 1. Build a Local Library

The user should be able to:

- download an official TouchGal resource
- let the app extract it automatically
- have the extracted folder linked into the local library
- see the game appear as a normal library entry without manual setup

### 2. Import Existing Local Games

The user should be able to:

- add one or more watch roots
- scan folders recursively
- detect launchable candidates and `.tg_id`-linked installs
- classify results into linked, unresolved, orphaned, and broken

### 3. Browse Like a Library App

The main manager surface should let the user:

- scan a dense cover grid quickly
- search by title or alias
- filter by local state and metadata
- sort by useful browse keys
- move between library, downloads, favorites, and settings without losing context

### 4. Operate Local Games

For each linked game, the manager should support:

- reveal install folder
- choose or reuse executable
- launch game
- inspect metadata without losing the local-library context

### 5. Manage Download Lifecycle

The manager should own the full local file lifecycle:

- queue downloads
- pause, resume, retry, and delete tasks
- keep per-file progress after restart
- extract supported archives
- write `.tg_id`
- register extracted paths in the library

## Non-Goals

The manager should not become:

- a full offline clone of TouchGal browse/detail data
- a generic cloud drive client
- a broad metadata sync engine for every upstream payload

The current repo direction is narrower:

- upstream browse/detail stays network-first
- local persistence is reserved for user-owned state
- the manager focuses on local ownership, not mirroring everything

## Functional Pillars

### Library First

The manager should prioritize the local library as the primary surface, not treat it as a side panel under browsing.

Key outcome:

- users open the app to manage and use installed games

### Local Ownership

The manager should own:

- local paths
- launch metadata
- download queue state
- extraction state
- local collections
- browse history
- user preferences

### Visual Scannability

The library should feel like a cover-driven gallery:

- strong thumbnails
- dense cards
- minimal noise
- fast recognition of title and state

### Safe File Operations

All file-destructive behavior must stay bounded to known roots.

Key rule:

- downloads are cleaned only inside the active download root
- extracted library installs are managed separately

### Recoverability

The manager should make failures visible and repairable:

- broken path
- missing executable
- unresolved folder
- orphaned `.tg_id`
- extractor unavailable

## Minimum Feature Set For The Next Todo

If we are defining the next implementation target, the essential manager feature set should be:

1. a true library-first home surface
2. dense cover-grid browsing for local games
3. local search, filter, and sort controls
4. stable install-state badges and classifications
5. one-click reveal and launch actions
6. clear separation of downloads versus installed library entries
7. lightweight management flows for unresolved and broken items

## Success Criteria

The manager is doing its job if a user can:

- discover a game on TouchGal
- download it
- have it appear in the local library automatically
- find it later from a visual grid
- launch it or open its folder immediately
- understand what is broken and what needs attention

## Working Definition

For this project, the essential function of the manager is:

> maintain a clean, launchable, browsable local galgame library on top of TouchGal-sourced content.
