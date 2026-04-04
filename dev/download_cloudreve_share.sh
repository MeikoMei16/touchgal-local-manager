#!/usr/bin/env bash
set -Eeuo pipefail

trap 'printf "Error: %s failed at line %s\n" "${BASH_SOURCE[0]}" "${LINENO}" >&2' ERR

usage() {
  cat <<'EOF'
Usage: download_cloudreve_share.sh <share-url> [target-dir]

Examples:
  ./dev/download_cloudreve_share.sh 'https://pan.touchgal.net/s/V2dId'
  ./dev/download_cloudreve_share.sh 'https://pan.touchgal.net/s/DnYBUx?path=%2F' .
EOF
}

require_cmd() {
  local -r cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    printf "Missing required command: %s\n" "$cmd" >&2
    exit 1
  }
}

urldecode() {
  local value="${1//+/ }"
  printf '%b' "${value//%/\\x}"
}

rawurlencode() {
  jq -nr --arg value "$1" '$value|@uri'
}

extract_share_key() {
  local -r url="$1"
  local key
  key="$(printf '%s' "$url" | sed -E 's#^[a-zA-Z]+://[^/]+/s/([^/?#]+).*#\1#')"
  if [[ -z "$key" || "$key" == "$url" ]]; then
    printf 'Could not parse share key from URL: %s\n' "$url" >&2
    exit 1
  fi
  printf '%s' "$key"
}

extract_query_param() {
  local -r url="$1"
  local -r name="$2"
  local query
  query="${url#*\?}"
  if [[ "$query" == "$url" ]]; then
    return 1
  fi
  printf '%s\n' "$query" | tr '&' '\n' | awk -F= -v key="$name" '$1 == key { print substr($0, index($0, "=") + 1); exit }'
}

fetch_json() {
  local -r method="$1"
  local -r url="$2"
  local response

  if [[ "$method" == "GET" ]]; then
    response="$(curl -fsSL "$url")"
  else
    response="$(curl -fsSL -X "$method" "$url")"
  fi

  local code
  code="$(printf '%s' "$response" | jq -r '.code')"
  if [[ "$code" != "0" ]]; then
    printf 'API request failed for %s: %s\n' "$url" "$(printf '%s' "$response" | jq -r '.msg // "unknown error"')" >&2
    exit 1
  fi

  printf '%s' "$response"
}

download_presigned_url() {
  local -r presigned_url="$1"
  local -r output_path="$2"
  printf 'Downloading %s\n' "$output_path"
  curl -fL --progress-bar --output "$output_path" "$presigned_url"
}

download_share_file() {
  local -r base_url="$1"
  local -r share_key="$2"
  local -r remote_path="${3:-}"
  local -r output_dir="$4"
  local api_url presigned_url filename output_path response

  if [[ -n "$remote_path" ]]; then
    api_url="${base_url}/api/v3/share/download/${share_key}?path=$(rawurlencode "$remote_path")"
    filename="$(basename "$remote_path")"
  else
    api_url="${base_url}/api/v3/share/download/${share_key}"
    response="$(fetch_json GET "${base_url}/api/v3/share/info/${share_key}")"
    filename="$(printf '%s' "$response" | jq -r '.data.source.name')"
  fi

  response="$(fetch_json PUT "$api_url")"
  presigned_url="$(printf '%s' "$response" | jq -r '.data')"
  output_path="${output_dir}/${filename}"
  download_presigned_url "$presigned_url" "$output_path"
}

download_share_dir_recursive() {
  local -r base_url="$1"
  local -r share_key="$2"
  local -r remote_path="$3"
  local -r output_dir="$4"

  mkdir -p "$output_dir"

  local list_url response entry_type entry_name entry_path child_output_dir
  list_url="${base_url}/api/v3/share/list/${share_key}/?path=$(rawurlencode "$remote_path")"
  response="$(fetch_json GET "$list_url")"

  while IFS=$'\t' read -r entry_type entry_name entry_path; do
    [[ -n "$entry_type" ]] || continue

    if [[ "$entry_type" == "dir" ]]; then
      child_output_dir="${output_dir}/${entry_name}"
      download_share_dir_recursive "$base_url" "$share_key" "${entry_path%/}/${entry_name}" "$child_output_dir"
    elif [[ "$entry_type" == "file" ]]; then
      download_share_file "$base_url" "$share_key" "${entry_path%/}/${entry_name}" "$output_dir"
    fi
  done < <(
    printf '%s' "$response" | jq -r '.data.objects[] | [.type, .name, .path] | @tsv'
  )
}

main() {
  require_cmd curl
  require_cmd jq

  if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage >&2
    exit 1
  fi

  local -r share_url="$1"
  local -r target_dir="${2:-.}"
  local -r absolute_target_dir="$(cd "$target_dir" && pwd -P)"
  local -r base_url="$(printf '%s' "$share_url" | sed -E 's#^(https?://[^/]+).*#\1#')"
  local -r share_key="$(extract_share_key "$share_url")"

  mkdir -p "$absolute_target_dir"

  local response is_dir initial_path
  response="$(fetch_json GET "${base_url}/api/v3/share/info/${share_key}")"
  is_dir="$(printf '%s' "$response" | jq -r '.data.is_dir')"
  initial_path="$(extract_query_param "$share_url" "path" || true)"
  initial_path="$(urldecode "${initial_path:-/}")"
  [[ -n "$initial_path" ]] || initial_path="/"

  if [[ "$is_dir" == "true" ]]; then
    printf 'Share %s is a directory. Starting recursive download from path %s\n' "$share_key" "$initial_path"
    download_share_dir_recursive "$base_url" "$share_key" "$initial_path" "$absolute_target_dir"
  else
    printf 'Share %s is a single file. Starting direct download.\n' "$share_key"
    download_share_file "$base_url" "$share_key" "" "$absolute_target_dir"
  fi
}

main "$@"
