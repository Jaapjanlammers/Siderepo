# WhatsApp webhook (Edge Function)

## Secrets (Supabase Dashboard → Edge Functions → Secrets, or CLI)

| Secret | Purpose |
|--------|---------|
| `WHATSAPP_VERIFY_TOKEN` | Must **exactly match** Meta → WhatsApp → Configuration → Webhook → **Verify token** |
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Numeric** ID from Meta → WhatsApp → API Setup (e.g. `1063338796858224`). Never leave the literal string `YOUR_PHONE_NUMBER_ID`. |
| `WHATSAPP_BUSINESS_DISPLAY_NAME` | Optional. Default `Vantage Content`. Used in bot replies only. |
| `WHATSAPP_BUSINESS_TAGLINE` | Optional. Default `vantage.content`. Used in bot replies only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for persistent WhatsApp state in table `public.whatsapp_sessions`. |

## Session state (minimal)

State is intentionally lightweight:
- `wa_id` (phone number)
- `stage` (`idle` → `ask_name` → `ask_age` → `ask_country` → `done`)
- `answers` JSON (name, age, country only)

Create table once (recommended):

```bash
supabase db push
```

## Chat shows a person’s name (e.g. yours) instead of “Vantage Content”

That **name at the top of the chat** comes from **Meta / WhatsApp Business**, not from this code.

1. **Meta Business Suite** → **Settings** → **Business info** — ensure the public business name is **Vantage Content** (or your registered trade name).
2. **WhatsApp Manager** (business.facebook.com → WhatsApp accounts) → select your number → **Profile** — set **About** / description; the **display name** for the number is chosen when the number is registered and must follow [Meta’s display name rules](https://developers.facebook.com/docs/whatsapp/display-names).
3. If the number was tied to a **personal** Meta identity first, create or link a **Business Portfolio** and WhatsApp Business Account so the customer-facing name is the **business**, not an individual.
4. **Verified business** names show more reliably; until then WhatsApp may show a generic or account-holder label.

After Meta shows the right name, customers still get consistent wording from the bot (welcome + “who are you” replies use *Vantage Content* / *vantage.content*).

## Rotate the verify token

1. Choose a new random string (or generate one, e.g. `openssl rand -hex 24`).
2. Set it in Supabase:
   ```bash
   supabase secrets set WHATSAPP_VERIFY_TOKEN="your_new_token"
   ```
3. Paste the **same** value into Meta’s webhook **Verify token** field and save / re-verify the webhook.

Local `.env` can include `WHATSAPP_VERIFY_TOKEN` for reference; it is **not** read automatically when the function runs in production—only Supabase secrets apply there.

---

## If logs show `401` on `POST` (WhatsApp never gets a reply)

Supabase blocks requests **without** a valid user JWT by default. Meta does not send one.

1. **Dashboard (fastest check)**  
   [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions** → **whatsapp-webhook** → open the function → if you see **Enforce JWT verification** / similar, **turn it OFF** and save.

2. **Redeploy with JWT disabled** (from repo root):
   ```bash
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   ```
   Or run: `bash supabase/functions/whatsapp-webhook/deploy.sh`

3. **Confirm** (should print `200`, not `401`):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     "https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook" \
     -H "Content-Type: application/json" -d '{}'
   ```

`supabase/config.toml` has `[functions.whatsapp-webhook] verify_jwt = false` so normal deploys should keep JWT off—if 401 returns after a deploy, use **`--no-verify-jwt`** once or fix the dashboard toggle.
