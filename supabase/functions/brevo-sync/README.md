# brevo-sync

Called by Database Webhook when a row is inserted into `whatsapp_applications`. Syncs the contact to Brevo list #19.

## Secrets (Supabase Edge Functions → Secrets)

| Secret | Required | Description |
|-------|----------|-------------|
| `BREVO_API_KEY` | Yes | Brevo API key (v3) |
| `BREVO_WEBHOOK_SECRET` | Yes | Must match `x-webhook-secret` header in Database Webhook |

## Deploy

```bash
supabase functions deploy brevo-sync --no-verify-jwt
```

## Brevo custom attributes

Ensure these exist in Brevo → Settings → Contact attributes (or create them):

- `FIRSTNAME`, `LASTNAME`, `PHONE`, `VACANCY`, `COUNTRY`, `GENDER`, `BIRTHDAY`, `OVER18`, `HOURS_PER_WEEK`, `ENGLISH_LEVEL`, `INTERNET_SPEED`, `PHONE_HQ_VIDEO`, `COMFORTABLE_ON_CAM`, `ALONE_PLACE`, `SOCIAL_HANDLE`, `BEST_VIDEO_URL`, `SOURCE`

## Database Webhook

- Table: `public.whatsapp_applications`
- Event: `INSERT`
- Target: Supabase Edge Function → `brevo-sync`
- Headers: `x-webhook-secret` = same value as `BREVO_WEBHOOK_SECRET`
