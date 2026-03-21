import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BREVO_LIST_ID = 19; // Content Creator - From WhatsApp

Deno.serve(async (req: Request) => {
  try {
    const webhookSecret = Deno.env.get("BREVO_WEBHOOK_SECRET");
    const incomingSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && incomingSecret !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const row = body?.record ?? body;

    const email = row?.email?.trim();
    if (!email) {
      return new Response(JSON.stringify({ ok: true, skipped: "no email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) {
      console.error("Missing BREVO_API_KEY");
      return new Response("Missing BREVO_API_KEY", { status: 500 });
    }

    // 1) Add/update contact in Brevo list
    const englishRaw = String(row.english_level ?? "").trim().toLowerCase();
    const englishMapped =
      englishRaw === "fluent"
        ? "Native"
        : englishRaw === "advanced"
          ? "Good"
          : String(row.english_level ?? "").trim();

    const contactPayload = {
      email,
      listIds: [BREVO_LIST_ID],
      updateEnabled: true,
      attributes: {
        FIRSTNAME: String(row.first_name ?? "").trim(),
        LASTNAME: String(row.last_name ?? "").trim(),
        PHONE: String(row.phone_number ?? "").trim(),
        VACANCY: String(row.vacancy_label ?? row.vacancy ?? "").trim(),
        COUNTRY: String(row.country ?? "").trim(),
        GENDER: String(row.gender ?? "").trim(),
        BIRTHDAY: String(row.birthday ?? "").trim(),
        OVER18: row.over18 === true,
        HOURS_PER_WEEK: row.hours_per_week ?? null,
        ENGLISH_LEVEL: englishMapped,
        INTERNET_SPEED: String(row.internet_speed ?? "").trim(),
        PHONE_HQ_VIDEO: String(row.phone_hq_video ?? "").trim(),
        COMFORTABLE_ON_CAM: String(row.comfortable_on_cam ?? "").trim(),
        ALONE_PLACE: String(row.alone_place ?? "").trim(),
        SOCIAL_HANDLE: String(row.social_handle ?? "").trim(),
        BEST_VIDEO_URL: String(row.best_video_url ?? "").trim(),
        SOURCE: String(row.source ?? "whatsapp").trim(),
      },
    };

    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(contactPayload),
    });

    if (!contactRes.ok) {
      const err = await contactRes.text();
      console.error("Brevo contact sync failed:", contactRes.status, err);
      return new Response(`Brevo contact sync failed: ${err}`, { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("brevo-sync error:", e);
    return new Response(`error: ${String(e)}`, { status: 500 });
  }
});
