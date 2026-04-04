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
- `patchId` (optional)

Important behavior:

- when `patchId` is present, upstream returns folder rows decorated with current-game membership state such as `isAdd`
- the detail-header favorite menu now relies on this variant so cloud folder rows can behave as add/remove toggles for the active game
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

### `POST /user/profile/favorite/folder`

Purpose:

- create a new cloud favorite folder for the current logged-in user

Current main-process relay:

- `tg-create-favorite-folder`

Payload:

- `name`
- `description`
- `isPublic`

Current renderer usage:

- Favorites page cloud-header create flow

### `DELETE /user/profile/favorite/folder`

Purpose:

- delete an existing cloud favorite folder owned by the current logged-in user

Current main-process relay:

- `tg-delete-favorite-folder`

Parameters:

- `folderId`

Current renderer usage:

- Favorites page cloud folder-card delete flow

Important behavior:

- deleting a cloud folder removes that folder and its folder-item relations on the upstream side
- renderer currently wraps this in a confirmation dialog before calling the relay

### `GET /user/profile/favorite/folder/patch`

Purpose:

- fetch paginated game cards inside a specific favorite folder

Current main-process relay:

- `tg-get-favorite-folder-patches`

Parameters:

- `folderId`
- `page`
- `limit`

Current renderer usage:

- Favorites page cloud overlay
- Profile page cloud overlay

Implementation note:

- this flow mirrors the current `kun-touchgal-next` pattern: list folders first, then fetch folder contents lazily when a folder is opened

### `PUT /patch/favorite`

Purpose:

- toggle membership of a patch inside a specific cloud favorite folder

Current main-process relay:

- `tg-toggle-patch-favorite`

Payload:

- `patchId`
- `folderId`

Current renderer usage:

- remove a game from the currently opened cloud folder
- move a game into another cloud folder by ensuring add-to-target first, then removing from the current folder
- batch move and batch remove from the cloud overlay

Important behavior:

- upstream treats this endpoint as a toggle, not as separate add/remove endpoints
- move logic in this app therefore uses defensive sequencing instead of assuming one call always means “add”

## Renderer Surface

The renderer currently consumes these methods:

- `getUserStatus(id)`
- `getUserStatusSelf()`
- `getUserComments(uid, page, limit)`
- `getUserRatings(uid, page, limit)`
- `getUserResources(uid, page, limit)`
- `getFavoriteFolders(uid)`
- `getFavoriteFolders(uid, patchId?)`
- `createFavoriteFolder({ name, description, isPublic })`
- `deleteFavoriteFolder(folderId)`
- `getFavoriteFolderPatches(folderId, page, limit)`
- `togglePatchFavorite(patchId, folderId)`

## Notes

- This file is intentionally implementation-focused, not a full upstream API reference.
- profile summary counts in the renderer prefer `_count.patch_favorite` for favorite-folder totals, with fallback handling for older payload shapes
- cloud folder counts should be refreshed after mutation so overlay contents and parent folder cards stay aligned
- Favorites-page cloud folder cards now own their own delete action; the page no longer uses a separate shared header-level delete selector
- the detail overlay now fetches folder rows with `patchId` so the cloud favorite menu can show and toggle exact per-folder membership for the current game
- If new user endpoints are added to `window.api`, update this document in the same change.
