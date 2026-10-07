#!/usr/bin/env bash
# Stamp a test-v2 domain ID into one installation-detection scenario page.
#
#   ./set-id.sh direct   6a4629c94d0e27db78eafc95
#   ./set-id.sh dynamic  6a4629c94d0e27db78eafc95
#   ./set-id.sh gtm      6a4629c94d0e27db78eafc95 GTM-XXXXXXX
#
# scenario 04 (none) takes no ID at all.
#
# dynamic/ and delayed/ assemble the ID from two halves at runtime on purpose: the whole point of
# those fixtures is that the ID must NOT be greppable in the raw HTML, otherwise the plain-HTTP pass
# short-circuits and the browserless pass is never exercised.
set -euo pipefail

usage() { echo "usage: set-id.sh <direct|gtm|dynamic|delayed|bare-id> <domainId> [gtmContainerId]" >&2; exit 1; }

scenario=${1:-}; domain_id=${2:-}; gtm_id=${3:-}
[[ -n $scenario && -n $domain_id ]] || usage

page="$(dirname "$0")/test/installation/$scenario/index.html"
[[ -f $page ]] || { echo "no such scenario page: $page" >&2; exit 1; }

half=$(( ${#domain_id} / 2 ))
p1=${domain_id:0:$half}
p2=${domain_id:$half}

perl -pi -e "s/__SP_DOMAIN_ID__/$domain_id/g; s/__SP_ID_P1__/$p1/g; s/__SP_ID_P2__/$p2/g" "$page"
[[ -n $gtm_id ]] && perl -pi -e "s/__GTM_CONTAINER_ID__/$gtm_id/g" "$page"

echo "stamped $scenario:"
grep -nE 'script/|gtm\.js\?id=|__SP_ID_P' "$page" || true
