# User Profile API Documentation

This document describes the API endpoints used to retrieve user profile data, including statistics, comments, ratings, and published resources.

## Base URL
`https://www.touchgal.top/api`

## Authentication
Most endpoints require a valid JWT token passed in a cookie:
`kun-galgame-patch-moe-token=<JWT_TOKEN>`

---

## 1. User Status and Statistics
Retrieve basic profile information and activity counts.

- **Endpoint**: `/user/status/info`
- **Method**: `GET`
- **Parameters**:
  - `id` (integer, required): The user's UID.
- **Example Request**:
  `GET /api/user/status/info?id=372067`

- **Response Structure**:
```json
{
  "id": 372067,
  "name": "meko262",
  "avatar": "https://...",
  "bio": "",
  "moemoepoint": 183,
  "follower": 0,
  "following": 1,
  "_count": {
    "patch_comment": 9,
    "patch_rating": 41,
    "patch_resource": 2,
    "patch_favorite": 0
  }
}
```

---

## 2. Activity Lists
Activity endpoints follow a consistent pagination pattern.

- **Query Parameters**:
  - `uid` (integer, required): The target user's UID.
  - `page` (integer, default: 1): The page number.
  - `limit` (integer, default: 20): Items per page.

### 2.1 User Comments
Retrieve a list of patches commented on by the user.
- **Endpoint**: `/user/profile/comment`
- **Response**: `{ "comments": [...], "total": number }`

### 2.2 User Ratings
Retrieve a list of patches rated by the user.
- **Endpoint**: `/user/profile/rating`
- **Response**: `{ "ratings": [...], "total": number }`

### 2.3 Published Resources (Patches)
Retrieve a list of patches/resources published by the user.
- **Endpoint**: `/user/profile/resource`
- **Response**: `{ "resources": [...], "total": number }`

### 2.4 Favorites
Retrieve the user's favorite patches.
- **Endpoint**: `/user/profile/favorite`
- **Response**: `{ "favorites": [...], "total": number }`

---

## 3. Data Models

### UserComment
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Unique ID of the comment |
| `content` | `string` | The text content of the comment |
| `patchName` | `string` | The name of the patch/game |
| `created` | `string` | ISO8601 or formatted date string |

### UserRating
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Unique ID of the rating |
| `overall` | `number` | Numeric rating (1-10) |
| `recommend` | `string` | Recommendation status (e.g., `yes`, `neutral`) |
| `shortSummary` | `string` | User's feedback text |
| `patchName` | `string` | The name of the rated patch |
