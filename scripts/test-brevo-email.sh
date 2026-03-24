#!/usr/bin/env bash
# Sends a one-off test email via Brevo (same API as whatsapp-webhook inbox alerts).
# Usage:
#   export BREVO_API_KEY="xkeysib-..."
#   export BREVO_SENDER_EMAIL="markammand@vantagecontent.com"
#   export WHATSAPP_INBOX_ALERT_EMAIL="markammand@vantagecontent.com"
#   ./scripts/test-brevo-email.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -z "${BREVO_API_KEY:-}" ]] && [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${BREVO_API_KEY:-}" || -z "${BREVO_SENDER_EMAIL:-}" || -z "${WHATSAPP_INBOX_ALERT_EMAIL:-}" ]]; then
  echo "Missing BREVO_API_KEY, BREVO_SENDER_EMAIL, or WHATSAPP_INBOX_ALERT_EMAIL." >&2
  echo "Export them in this shell, or add them to $ROOT_DIR/.env and save the file (unsaved editor buffer is not read)." >&2
  exit 1
fi

payload=$(jq -n \
  --arg from "$BREVO_SENDER_EMAIL" \
  --arg to "$WHATSAPP_INBOX_ALERT_EMAIL" \
  --arg when "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  '{
    sender: { email: $from, name: "vantage content" },
    to: [ { email: $to } ],
    subject: "Brevo test — vantage content inbox alert",
    textContent: ("This is a manual test from scripts/test-brevo-email.sh\nTime: " + $when)
  }')

res=$(curl -sS -w "\n%{http_code}" -X POST "https://api.brevo.com/v3/smtp/email" \
  -H "api-key: ${BREVO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$payload")

http_code=$(echo "$res" | tail -n1)
body=$(echo "$res" | sed '$d')

echo "HTTP $http_code"
echo "$body"

if [[ "$http_code" != "201" ]]; then
  exit 1
fi

echo "OK — check the inbox for $WHATSAPP_INBOX_ALERT_EMAIL (and spam)."
