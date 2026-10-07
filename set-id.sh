#!/usr/bin/env bash
# Stamp a test-v2 domain ID into one installation-detection scenario page.
#   ./set-id.sh dynamic 6a4629c94d0e27db78eafc95
# Scenario 02 also needs a GTM container:
#   ./set-id.sh gtm <domainId> GTM-XXXXXXX
set -euo pipefail

scenario=${1:?usage: set-id.sh <direct|gtm|dynamic|delayed> <domainId> [gtmContainerId]}
domain_id=${2:?usage: set-id.sh <direct|gtm|dynamic|delayed> <domainId> [gtmContainerId]}
gtm_id=${3:-}

page="$(dirname "$0")/test/installation/$scenario/index.html"
[[ -f $page ]] || { echo "no such scenario page: $page" >&2; exit 1; }

perl -pi -e "s/__SP_DOMAIN_ID__/$domain_id/g" "$page"
[[ -n $gtm_id ]] && perl -pi -e "s/__GTM_CONTAINER_ID__/$gtm_id/g" "$page"

echo "stamped $scenario:"
grep -nE 'secureprivacy\.ai/script/|gtm\.js\?id=' "$page" || true
