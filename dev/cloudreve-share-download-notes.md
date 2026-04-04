# Cloudreve Share Download Notes

## Goal

Document the current findings about how `pan.touchgal.net` share links resolve into direct file downloads, including:

- single-file share behavior
- directory share behavior
- how to enumerate files
- how to turn a share item into a direct object-storage download URL
- whether nested directories are supported
- whether ranged download / `断点续传` is supported

## High-Level Model

`pan.touchgal.net` is a Cloudreve deployment.

Observed facts:

- the public share page is a frontend SPA shell, not a plain bucket listing
- the frontend bundle identifies itself as `cloudreve-frontend`
- the share URL key such as `V2dId` or `DnYBUx` is a Cloudreve share key
- the actual downloadable file is ultimately served from a presigned object-storage URL

This means the path is:

1. open Cloudreve share key
2. query Cloudreve share API
3. receive a presigned object URL
4. download file directly from the object-storage endpoint

## Share Types

### 1. Single-file share

Example:

- `https://pan.touchgal.net/s/V2dId`

Metadata request:

```bash
curl -fsSL 'https://pan.touchgal.net/api/v3/share/info/V2dId'
```

Observed response shape:

```json
{
  "code": 0,
  "data": {
    "key": "V2dId",
    "locked": false,
    "is_dir": false,
    "source": {
      "name": "乱雪月华～虚幻飘散的细雪～.zip",
      "size": 2712724300
    }
  }
}
```

Direct download resolution:

```bash
curl -fsSL -X PUT 'https://pan.touchgal.net/api/v3/share/download/V2dId'
```

Observed behavior:

- returns JSON with `code: 0`
- `data` is a presigned object-storage URL
- that URL can be downloaded directly with `curl -L`

### 2. Directory share

Example:

- `https://pan.touchgal.net/s/DnYBUx`

Metadata request:

```bash
curl -fsSL 'https://pan.touchgal.net/api/v3/share/info/DnYBUx'
```

Observed response shape:

```json
{
  "code": 0,
  "data": {
    "key": "DnYBUx",
    "locked": false,
    "is_dir": true,
    "source": {
      "name": "恋愛、はじめましてSV",
      "size": 0
    }
  }
}
```

Directory listing request:

```bash
curl -fsSL 'https://pan.touchgal.net/api/v3/share/list/DnYBUx/?path=%2F'
```

Observed behavior:

- the trailing-slash form on `/share/list/<key>/` matters
- `path=/` means the root of the shared directory
- response contains `data.objects`

Observed example:

```json
{
  "code": 0,
  "data": {
    "objects": [
      {
        "id": "oWQPAur",
        "name": "恋愛、はじめましてSV.part2.rar",
        "path": "/",
        "type": "file"
      },
      {
        "id": "0EeaYfO",
        "name": "恋愛、はじめましてSV.part1.rar",
        "path": "/",
        "type": "file"
      }
    ]
  }
}
```

Per-file resolution inside a directory share:

```bash
curl -fsSL -X PUT \
  'https://pan.touchgal.net/api/v3/share/download/DnYBUx?path=%2F%E6%81%8B%E6%84%9B%E3%80%81%E3%81%AF%E3%81%98%E3%82%81%E3%81%BE%E3%81%97%E3%81%A6SV.part2.rar'
```

Observed behavior:

- returns JSON with `code: 0`
- `data` is again a presigned object-storage URL

Important detail:

- for directory shares, the download endpoint needs the full remote file path via `?path=...`
- requesting `PUT /share/download/<key>?path=/` for the directory root itself returns `Object not exist`
- so the correct flow is list first, then resolve each file individually

## Redirect vs `?path=/`

Observed behavior:

- opening `https://pan.touchgal.net/s/DnYBUx` returns the SPA HTML shell
- it does not behave like a simple HTTP 301/302 redirect to `?path=/`
- the `?path=/` state is effectively frontend/router state for directory navigation

Interpretation:

- `DnYBUx` is the share key
- `path=/` is the current directory inside that share
- deeper folders would keep the same share key and change only `path`

Examples:

- `/s/DnYBUx?path=%2F`
- `/s/DnYBUx?path=%2Fsubdir`
- `/s/DnYBUx?path=%2Fsubdir%2Fnested`

## Nested Directory Support

The local downloader script was written to support nested directories recursively.

Implementation path:

- call `share/list/<key>/?path=<remotePath>`
- inspect each entry in `data.objects`
- if `type == file`, resolve with `share/download`
- if `type == dir`, recurse into `path/name`

Current status:

- verified live on a directory share whose root contains multiple files
- recursive nested-directory logic is implemented
- nested subdirectories were not live-tested yet on a real share containing folders

So:

- intended support: yes
- root-level multi-file share: verified
- deep nested share: not yet live-verified

## Resume / `断点续传`

This backend supports HTTP ranged downloads.

Verification:

1. obtain presigned URL from Cloudreve
2. inspect headers
3. perform a byte-range request

Header check:

```bash
URL="$(curl -fsSL -X PUT 'https://pan.touchgal.net/api/v3/share/download/V2dId' | jq -r '.data')"
curl -I "$URL"
```

Observed header:

```text
accept-ranges: bytes
```

Range test:

```bash
curl -r 0-15 -I "$URL"
```

Observed response:

```text
HTTP/2 206
accept-ranges: bytes
content-range: bytes 0-15/2712724300
```

Meaning:

- the storage endpoint supports byte-range requests
- resume is possible at the HTTP layer
- this is what enables `断点续传`

Important caveat:

- the direct storage URL is presigned and expires
- resume works only while that specific URL is still valid
- after expiry, a fresh presigned URL must be requested from Cloudreve

## TouchGal Resource Relation

TouchGal game `uniqueId` and Cloudreve share key are different identifiers.

Observed example:

- TouchGal game unique id: `2fjanp0i`
- TouchGal numeric patch id: `2776`
- Cloudreve share key: `V2dId`

Relationship:

1. TouchGal game detail resolves `uniqueId -> patchId`
2. TouchGal resource API returns resource rows for that patch
3. one resource row contains content like `https://pan.touchgal.net/s/V2dId`

So:

- share key is associated with the game through the resource row
- share key is not directly derivable from game `uniqueId`

## Local Test Script

Created script:

- [download_cloudreve_share.sh](/home/may/Documents/term3/project/touchgal-local-manager/dev/download_cloudreve_share.sh)

Purpose:

- accept a Cloudreve share URL
- detect single-file vs directory share
- resolve presigned URLs
- download one file or all files under a share
- recurse through subdirectories

Usage:

```bash
./dev/download_cloudreve_share.sh 'https://pan.touchgal.net/s/V2dId' .
./dev/download_cloudreve_share.sh 'https://pan.touchgal.net/s/DnYBUx' .
```

Current behavior:

- single-file share: works
- root-level multi-file directory share: works
- recursive directory traversal: implemented
- automatic resume: not yet implemented

## Live Test Results

### Single-file share

Verified:

- `V2dId` resolves to one presigned object URL
- target file: `乱雪月华～虚幻飘散的细雪～.zip`

### Directory share

Verified:

- `DnYBUx` is a directory share
- root listing returned:
  - `恋愛、はじめましてSV.part1.rar`
  - `恋愛、はじめましてSV.part2.rar`
- downloader script started pulling both files into the repo root

## Practical Download Pipeline

### Single file

```text
share URL
-> /api/v3/share/info/<key>
-> confirm is_dir=false
-> PUT /api/v3/share/download/<key>
-> presigned object URL
-> curl -L download
```

### Directory

```text
share URL
-> /api/v3/share/info/<key>
-> confirm is_dir=true
-> GET /api/v3/share/list/<key>/?path=/
-> iterate entries
-> for each file: PUT /api/v3/share/download/<key>?path=/remote/file
-> presigned object URL
-> curl -L download
```

## Open Follow-Ups

1. Add automatic resume to the downloader with `curl -C -`
2. Live-test the recursion against a real share containing nested subdirectories
3. Integrate the same share-resolution flow into the app so TouchGal resource links can download directly without opening the Cloudreve page
