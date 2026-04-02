# User Profile API Notes

This document tracks the user-related upstream endpoints that are actually wired into this project today.

## Scope

These endpoints are relayed by the Electron main process and exposed to the renderer through `window.api`.

Relevant implementation points:

- [`src/main/index.ts`](../../src/main/index.ts)
- [`src/preload/index.ts`](../../src/preload/index.ts)
- [`src/renderer/src/data/TouchGalClient.ts`](../../src/renderer/src/data/TouchGalClient.ts)

## Authentication

User-facing profile and activity endpoints may depend on the current TouchGal session cookie.

Cookie used by upstream:

- `kun-galgame-patch-moe-token=<JWT_TOKEN>`

Session note:

- renderer logout now clears the persisted TouchGal token through the main-process `tg-logout` relay

## Currently Used Endpoints

### `GET /user/status/info`

Purpose:

- fetch profile information for a specific user id

Current main-process relay:

- `tg-get-user-status`

Parameters:

- `id`

### `GET /user/status`

Purpose:

- fetch currently logged-in user identity / self status

Current main-process relay:

- `tg-get-user-status-self`

Renderer behavior:

- the renderer uses this endpoint to resolve the current user id before requesting the full profile payload
- if the response does not contain a usable `uid` or `id`, profile loading must settle instead of staying in a loading state

### `GET /user/profile/comment`

Purpose:

- fetch paginated comment activity for a user

Current main-process relay:

- `tg-get-user-comments`

Parameters:

- `uid`
- `page`
- `limit`

### `GET /user/profile/rating`

Purpose:

- fetch paginated rating activity for a user

Current main-process relay:

- `tg-get-user-ratings`

Parameters:

- `uid`
- `page`
- `limit`

### `GET /user/profile/resource`

Purpose:

- fetch paginated published resources for a user

Current main-process relay:

- `tg-get-user-resources`

Parameters:

- `uid`
- `page`
- `limit`

### `GET /user/profile/favorite/folder`

Purpose:

- fetch favorite folders for a user

Current main-process relay:

- `tg-get-favorite-folders`

Parameters:

- `uid`

## Renderer Surface

The renderer currently consumes these methods:

- `getUserStatus(id)`
- `getUserStatusSelf()`
- `getUserComments(uid, page, limit)`
- `getUserRatings(uid, page, limit)`
- `getUserResources(uid, page, limit)`
- `getFavoriteFolders(uid)`

## Notes

- This file is intentionally implementation-focused, not a full upstream API reference.
- profile summary counts in the renderer prefer `_count.patch_favorite` for favorite-folder totals, with fallback handling for older payload shapes
- If new user endpoints are added to `window.api`, update this document in the same change.
