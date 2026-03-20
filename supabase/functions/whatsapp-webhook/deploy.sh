#!/usr/bin/env bash
# Meta webhooks have no Supabase JWT — JWT must stay OFF or every POST is 401.
set -e
cd "$(dirname "$0")/../../.."
supabase functions deploy whatsapp-webhook --no-verify-jwt
