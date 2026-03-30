# User Profile API Notes

This document tracks the user-related upstream endpoints that are actually wired into this project today.

## Scope

These endpoints are relayed by the Electron main process and exposed to the renderer through `window.api`.

Relevant implementation points:

- [`src/main/index.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/main/index.ts)
- [`src/preload/index.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/preload/index.ts)
- [`src/renderer/src/data/TouchGalClient.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/data/TouchGalClient.ts)

## Authentication

User-facing profile and activity endpoints may depend on the current TouchGal session cookie.

Cookie used by upstream:

- `kun-galgame-patch-moe-token=<JWT_TOKEN>`

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
- If new user endpoints are added to `window.api`, update this document in the same change.
