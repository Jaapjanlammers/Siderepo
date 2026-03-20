
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

console.info("WhatsApp webhook function started");

/** Shown in replies. Chat *header* name is set in Meta (WhatsApp Manager), not here. */
const BUSINESS_NAME = Deno.env.get("WHATSAPP_BUSINESS_DISPLAY_NAME") ?? "Vantage Content";
const BUSINESS_LINE = Deno.env.get("WHATSAPP_BUSINESS_TAGLINE") ?? "vantage.content";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SESSION_TABLE = "whatsapp_sessions";
const APPLICATION_TABLE = "whatsapp_applications";
const VACANCY_REMOTE = "remote_content_creator";
const VACANCY_GLOBAL = "global_live_stream_host";
type Stage =
  | "idle"
  | "choose_vacancy"
  | "choose_action"
  | "ask_first_name"
  | "ask_last_name"
  | "ask_email"
  | "ask_hours_per_week"
  | "ask_age"
  | "ask_country"
  | "ask_english_level"
  | "ask_internet_speed"
  | "ask_phone_hq_video"
  | "ask_comfortable_on_cam"
  | "ask_alone_place"
  | "ask_social_handle"
  | "ask_best_video_url"
  | "done";
type SessionRow = {
  wa_id: string;
  stage: Stage;
  answers: Record<string, string>;
};

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;
const memorySessions = new Map<string, SessionRow>();

function wantsBusinessIdentity(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 2) return false;
  return (
    /\bwho('?re| are) you\b/.test(t) ||
    /\bwho is this\b/.test(t) ||
    /\bwhat('?s| is) (this|your name|the company|the business)\b/.test(t) ||
    /\bwhat company\b/.test(t) ||
    /\b(tell me )?about (you|this|the company|the business)\b/.test(t) ||
    /\b(your|the) (business|company) name\b/.test(t) ||
    /\b(is this )?vantage\b/.test(t) ||
    /\bofficial (line|account|whatsapp)\b/.test(t)
  );
}

function identityReply(): string {
  return (
    `You’re messaging *${BUSINESS_NAME}*.\n\n` +
    "We’re the recruitment partner for digital live streaming hosts. " +
    "This is our official business WhatsApp—not a personal account.\n\n" +
    "Reply *1* or *2* to choose a vacancy."
  );
}

function vacancyPrompt(): string {
  return (
    "Welcome to Vantage Content. We are here to bridge the gap and pair your unique personality with major brands.\n\n" +
    "How can we help?\n\n" +
    "*1.* See our vacancies?\n" +
    "*2.* Send email?\n\n" +
    "Reply *restart* anytime to start over."
  );
}

function vacanciesListPrompt(): string {
  return (
    "We currently have two vacancies. Which are you interested in?\n" +
    "*1.* Remote Content Creator\n" +
    "*2.* Global Live Stream Host"
  );
}

function actionPrompt(vacancyLabel: string): string {
  return (
    `You have selected ${vacancyLabel}. Do you:\n` +
    "*1.* apply?\n" +
    "*2.* want more info?"
  );
}

async function getSession(waId: string): Promise<SessionRow> {
  const fromMemory = memorySessions.get(waId);
  if (fromMemory) return fromMemory;
  if (!supabase) return { wa_id: waId, stage: "idle", answers: {} };
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select("wa_id, stage, answers")
    .eq("wa_id", waId)
    .maybeSingle();
  if (error) {
    console.error("Error loading session:", error.message);
    return memorySessions.get(waId) ?? { wa_id: waId, stage: "idle", answers: {} };
  }
  if (!data) {
    return { wa_id: waId, stage: "idle", answers: {} };
  }
  return {
    wa_id: data.wa_id,
    stage: (data.stage as Stage) || "idle",
    answers: (data.answers as Record<string, string>) || {},
  };
}

async function saveSession(session: SessionRow): Promise<void> {
  memorySessions.set(session.wa_id, session);
  if (!supabase) return;
  const { error } = await supabase.from(SESSION_TABLE).upsert({
    wa_id: session.wa_id,
    stage: session.stage,
    answers: session.answers,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Error saving session:", error.message);
  }
}

async function saveApplication(session: SessionRow): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(APPLICATION_TABLE).insert({
    wa_id: session.wa_id,
    phone_number: session.wa_id,
    vacancy: session.answers.vacancy ?? null,
    vacancy_label: session.answers.vacancy_label ?? null,
    first_name: session.answers.first_name ?? null,
    last_name: session.answers.last_name ?? null,
    email: session.answers.email ?? null,
    hours_per_week: session.answers.hours_per_week ?? null,
    age: session.answers.age ? Number.parseInt(session.answers.age, 10) : null,
    country: session.answers.country ?? null,
    english_level: session.answers.english_level ?? null,
    internet_speed: session.answers.internet_speed ?? null,
    phone_hq_video: session.answers.phone_hq_video ?? null,
    comfortable_on_cam: session.answers.comfortable_on_cam ?? null,
    alone_place: session.answers.alone_place ?? null,
    social_handle: session.answers.social_handle ?? null,
    best_video_url: session.answers.best_video_url ?? null,
    source: "whatsapp",
    raw_answers: session.answers,
  });
  if (error) {
    console.error("Error saving application:", error.message);
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function persistAndSend(session: SessionRow, to: string, message: string): Promise<void> {
  await Promise.all([saveSession(session), sendWhatsAppText(to, message)]);
}

// Helper to send a simple text message back via WhatsApp Cloud API
async function sendWhatsAppText(to: string, messageText: string) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN")?.trim();
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim();

  if (!token || !phoneNumberId) {
    console.error("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: messageText },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error sending WhatsApp message:", res.status, text);
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  // 1) Verification from Meta (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // 2) Incoming webhook events (POST)
  if (req.method === "POST") {
    const webhookPayload = await req.json();
    console.log("Incoming WhatsApp webhook:", JSON.stringify(webhookPayload));

    try {
      const entry = webhookPayload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        // Status updates etc: nothing to reply to
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const message = messages[0];
      const from = message.from as string | undefined;
      const textBody: string = (message.text?.body ?? "").trim();

      if (!from) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const welcome =
        vacancyPrompt();

      if (!textBody) {
        await sendWhatsAppText(from, welcome);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (wantsBusinessIdentity(textBody)) {
        await sendWhatsAppText(from, identityReply());
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const lower = textBody.toLowerCase();
      let session = await getSession(from);

      if (lower === "restart" || lower === "reset") {
        session = { wa_id: from, stage: "idle", answers: {} };
      }

      if (session.stage === "idle") {
        session.stage = "choose_vacancy";
        session.answers = {};
        session.answers.menu = "top";
        await saveSession(session);
        await sendWhatsAppText(from, welcome);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "choose_vacancy") {
        if (session.answers.menu === "vacancies") {
          if (lower === "1" || lower.includes("remote")) {
            session.answers.vacancy = VACANCY_REMOTE;
            session.answers.vacancy_label = "1 Remote Content Creator";
            session.stage = "choose_action";
          await persistAndSend(session, from, actionPrompt("1 Remote Content Creator"));
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          if (lower === "2" || lower.includes("global") || lower.includes("live")) {
            session.answers.vacancy = VACANCY_GLOBAL;
            session.answers.vacancy_label = "2 Global Live Stream Host";
            session.stage = "choose_action";
          await persistAndSend(session, from, actionPrompt("2 Global Live Stream Host"));
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          await sendWhatsAppText(
            from,
            "Please select a vacancy by replying *1* or *2*."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (lower === "2" || lower.includes("email")) {
          await sendWhatsAppText(
            from,
            "You can email us at markammand@vantagecontent.com."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (lower === "1" || lower.includes("vacanc")) {
          session.answers.menu = "vacancies";
          await saveSession(session);
          await sendWhatsAppText(from, vacanciesListPrompt());
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        await sendWhatsAppText(
          from,
          "Please reply *1* (See our vacancies) or *2* (Send email)."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "choose_action") {
        const vacancy = session.answers.vacancy;
        const vacancyLabel = session.answers.vacancy_label ?? "selected role";
        const moreInfoUrl =
          vacancy === VACANCY_GLOBAL
            ? "https://vantage.content/careers/globallivestreamhost"
            : "https://vantage.content/careers/remotecontentstreamer";

        if (lower === "2" || lower.includes("info") || lower.includes("more")) {
          await sendWhatsAppText(
            from,
            `More info for *${vacancyLabel}*:\n${moreInfoUrl}\n\nReply *1* when you want to apply.`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (lower === "1" || lower.includes("apply")) {
          session.stage = "ask_first_name";
          await persistAndSend(
            session,
            from,
            `Great, let's apply for *${vacancyLabel}*.\n\nQuestion 1/13: what is your first name?`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        await sendWhatsAppText(
          from,
          "Reply *1* to apply or *2* for more info."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_first_name") {
        session.answers.first_name = textBody;
        session.stage = "ask_last_name";
        await persistAndSend(
          session,
          from,
          "Question 2/13: what is your last name?"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_last_name") {
        session.answers.last_name = textBody;
        session.stage = "ask_email";
        await persistAndSend(session, from, "Question 3/13: what is your email address?");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_email") {
        if (!isValidEmail(textBody)) {
          await sendWhatsAppText(
            from,
            "Please enter a valid email address (example: name@email.com)."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.email = textBody;
        session.stage = "ask_hours_per_week";
        await persistAndSend(
          session,
          from,
          "Question 4/13: how many hours per week do you want to work?\n1) 40\n2) 32\n3) 24\n4) 16\n5) 8"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_hours_per_week") {
        const normalized = lower;
        const map: Record<string, string> = {
          "1": "40",
          "2": "32",
          "3": "24",
          "4": "16",
          "5": "8",
          "40": "40",
          "32": "32",
          "24": "24",
          "16": "16",
          "8": "8",
        };
        const chosen = map[normalized];
        if (!chosen) {
          await sendWhatsAppText(
            from,
            "Please reply with 1, 2, 3, 4, or 5 (40, 32, 24, 16, 8)."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.hours_per_week = chosen;
        session.stage = "ask_age";
        await persistAndSend(
          session,
          from,
          "Question 5/13: how old are you? (numbers only, 18-99)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_age") {
        const age = Number.parseInt(textBody, 10);
        if (!Number.isFinite(age) || age < 18 || age > 99) {
          await sendWhatsAppText(
            from,
            "Please enter a valid age between 18 and 99."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.age = String(age);
        session.stage = "ask_country";
        await persistAndSend(session, from, "Question 6/13: what country are you based in?");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_country") {
        session.answers.country = textBody;
        session.stage = "ask_english_level";
        await persistAndSend(
          session,
          from,
          "Question 7/13: what is your English level? (Beginner / Intermediate / Advanced / Fluent)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_english_level") {
        session.answers.english_level = textBody;
        session.stage = "ask_internet_speed";
        await persistAndSend(
          session,
          from,
          "Question 8/13: what is your internet speed (download/upload Mbps)?"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_internet_speed") {
        session.answers.internet_speed = textBody;
        session.stage = "ask_phone_hq_video";
        await persistAndSend(
          session,
          from,
          "Question 9/13: do you have a phone that can shoot high-quality video? (Yes/No)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_phone_hq_video") {
        session.answers.phone_hq_video = textBody;
        session.stage = "ask_comfortable_on_cam";
        await persistAndSend(
          session,
          from,
          "Question 10/13: are you comfortable on camera? (Yes/No)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_comfortable_on_cam") {
        session.answers.comfortable_on_cam = textBody;
        session.stage = "ask_alone_place";
        await persistAndSend(
          session,
          from,
          "Question 11/13: do you have a quiet place where you can stream alone? (Yes/No)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_alone_place") {
        session.answers.alone_place = textBody;
        session.stage = "ask_social_handle";
        await persistAndSend(
          session,
          from,
          "Question 12/13: what is your main social handle?"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_social_handle") {
        session.answers.social_handle = textBody;
        session.stage = "ask_best_video_url";
        await persistAndSend(
          session,
          from,
          "Question 13/13: share a link to your best video (URL)."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_best_video_url") {
        session.answers.best_video_url = textBody;
        session.stage = "done";
        await saveSession(session);
        await saveApplication(session);
        await sendWhatsAppText(
          from,
          `Thanks ${session.answers.first_name ?? ""}. We captured:\n` +
            `- Vacancy: ${session.answers.vacancy_label ?? "-"}\n` +
            `- First name: ${session.answers.first_name ?? "-"}\n` +
            `- Last name: ${session.answers.last_name ?? "-"}\n` +
            `- Email: ${session.answers.email ?? "-"}\n` +
            `- Hours/week: ${session.answers.hours_per_week ?? "-"}\n` +
            `- Age: ${session.answers.age ?? "-"}\n` +
            `- Country: ${session.answers.country ?? "-"}\n` +
            `- English level: ${session.answers.english_level ?? "-"}\n` +
            `- Internet speed: ${session.answers.internet_speed ?? "-"}\n` +
            `- Phone HQ video: ${session.answers.phone_hq_video ?? "-"}\n` +
            `- Comfortable on cam: ${session.answers.comfortable_on_cam ?? "-"}\n` +
            `- Quiet alone place: ${session.answers.alone_place ?? "-"}\n` +
            `- Social handle: ${session.answers.social_handle ?? "-"}\n` +
            `- Best video URL: ${session.answers.best_video_url ?? "-"}\n\n` +
            "Application complete.\n\n" +
            "Our team will review this and follow up. Reply *restart* if you want to submit again."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      await sendWhatsAppText(
        from,
        "Your application is already submitted. Reply *restart* to start over."
      );
    } catch (e) {
      console.error("Error handling webhook:", e);
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});