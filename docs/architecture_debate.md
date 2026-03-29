# Architecture Debate: Incremental Cache vs. Full Catalog Mirroring

This document summarizes the ongoing architectural discussion for the **TouchGal Local Manager** data layer, specifically addressing a conflict identified during the transition to a "Local-First" architecture.

---

## 1. Context
The application aims to provide a premium, fast experience for browsing the TouchGal game catalog. Currently, it uses a **Hybrid Model**:
- **Fetching**: Data is retrieved from the remote API in pages of 24 items.
- **Caching**: Every retrieved page is "upserted" into a local SQLite database (`touchgal.db`).
- **Filtering**: The user selects filters (NSFW, Year, etc.) which are sent as parameters to the API.

---

## 2. The Core Conflict
The user raised a critical point: **Filtering in a partial cache is inherently incomplete.**

### Hypothesis A: Incremental Sync (Current)
*   **Mechanism**: Only retrieve and store what the user "sees" during browsing.
*   **Challenge**: When the user switches a hard constraint (e.g., `Safe Mode` -> `NSFW`), the local database likely contains zero NSFW items. 
*   **Result**: To see *any* results, the app **must** perform a new Network I/O to the API.
*   **User's Logic**: "We cannot filter based on the local database because our data is incrementally acquired... switching NSFW strictly requires different network I/O."

### Hypothesis B: Full Catalog Mirroring (The "Real" Local-First)
*   **Mechanism**: Run a background process to mirror the *entire* TouchGal metadata catalog (~13,000 items, ~560 pages) locally.
*   **Challenge**: Requires a one-time "heavy" sync and a strategy for handling delta updates from the cloud.
*   **Result**: All filtering (NSFW, complex queries, year ranges) becomes a **local SQL query**.
*   **Benefit**: Instant UI response, offline search, and no loading spinners when switching filtering modes.

---

## 3. Comparative Analysis

| Feature | Incremental Cache (Hybrid) | Full Mirroring (Local-First) |
| :--- | :--- | :--- |
| **Initial Experience** | Instant (fetch only page 1). | Delay (requires initial sync). |
| **Filtering Logic** | **Network-Driven**: Filter = New API Call. | **DB-Driven**: Filter = SQL Query. |
| **Data Integrity** | High (always up-to-date with server). | Medium (requires periodic sync). |
| **Search Speed** | Dependent on Network Latency. | Instant (SQLite FTS5). |
| **Offline Capability**| Only "Previously Seen" items. | Entire Catalog available offline. |

---

## 4. Specific Issues Identified
1.  **NSFW Status**: The current SQLite schema (`games` table) **does not store** the NSFW/Content-Limit status. This makes local filtering impossible even for cached items.
2.  **State Consistency**: If the remote total count changes while browsing, the local pagination might become inconsistent without a full local replica.

---

---

## 6. Conclusion (Final Resolution)
After a deep-dive into the backend source code (`KUN1007/kun-touchgal-next`), the following was determined:

1.  **Strict API Schema**: The `/api/galgame` endpoint uses a strict Zod schema that **rejects unknown parameters**. Sending `selectedContentLimit` in the URL was the primary cause of the "Blank Page" issue.
2.  **Cookie-Based NSFW**: NSFW filtering is exclusively handled via the `kun-patch-setting-store|state|data|kunNsfwEnable` cookie.
3.  **Value Mapping**: The backend expects specific internal values: `sfw`, `nsfw`, or `all`.

**Final Decision**: We have implemented the **Hybrid Model** with corrected API protocols. The app now communicates with the backend using the exact cookie and parameter structure expected by the server, while maintaining local metadata caching for details.

---
*Document Last Updated: 2026-03-29*
