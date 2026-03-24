
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

console.info("WhatsApp webhook function started");

/** Shown in replies. Chat *header* name is set in Meta (WhatsApp Manager), not here. */
const BUSINESS_NAME = Deno.env.get("WHATSAPP_BUSINESS_DISPLAY_NAME") ?? "Vantage Content";
const BUSINESS_LINE = Deno.env.get("WHATSAPP_BUSINESS_TAGLINE") ?? "vantage content";
/** Bot persona name in messages (optional secret `WHATSAPP_BOT_NAME`). */
const BOT_NAME = Deno.env.get("WHATSAPP_BOT_NAME")?.trim() || "Alex";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SESSION_TABLE = "whatsapp_sessions";
const APPLICATION_TABLE = "whatsapp_applications";
const INBOX_TABLE = "whatsapp_inbox";
const VACANCY_REMOTE = "remote_content_creator";
const VACANCY_GLOBAL = "global_live_stream_host";
/** Minimum age to apply (enforced from birthday + final confirmation). */
const MIN_APPLICANT_AGE = 18;
const REMOTE_VACANCY_IMAGE_URL = "https://vantagecontent.com/images/2.jpg";
const GLOBAL_VACANCY_IMAGE_URL = "https://vantagecontent.com/images/streamning2.png";
type Stage =
  | "idle"
  | "choose_vacancy"
  | "choose_action"
  | "ask_first_name"
  | "ask_last_name"
  | "ask_email"
  | "ask_hours_per_week"
  | "ask_age"
  | "ask_birthday"
  | "ask_gender"
  | "ask_country"
  | "ask_english_level"
  | "ask_internet_speed"
  | "ask_phone_hq_video"
  | "ask_comfortable_on_cam"
  | "ask_alone_place"
  | "ask_social_handle"
  | "ask_best_video_url"
  | "ask_over18"
  | "done";
type SessionRow = {
  wa_id: string;
  stage: Stage;
  answers: Record<string, string>;
};

function previousQuestionStage(stage: Stage): Stage | null {
  const prev: Partial<Record<Stage, Stage>> = {
    ask_last_name: "ask_first_name",
    ask_email: "ask_last_name",
    ask_hours_per_week: "ask_email",
    ask_age: "ask_hours_per_week",
    ask_birthday: "ask_hours_per_week",
    ask_gender: "ask_age",
    ask_country: "ask_gender",
    ask_english_level: "ask_country",
    ask_internet_speed: "ask_english_level",
    ask_phone_hq_video: "ask_internet_speed",
    ask_comfortable_on_cam: "ask_phone_hq_video",
    ask_alone_place: "ask_comfortable_on_cam",
    ask_social_handle: "ask_alone_place",
    ask_best_video_url: "ask_social_handle",
    ask_over18: "ask_best_video_url",
  };
  return prev[stage] ?? null;
}

function questionPromptFor(stage: Stage, answers: Record<string, string>): string | null {
  const vacancyLabel = answers.vacancy_label ?? "selected role";
  const prompts: Partial<Record<Stage, string>> = {
    ask_first_name: `Great, let's apply for *${vacancyLabel}*.\n\nQuestion 1/14: What is your first name?`,
    ask_last_name: "Question 2/14: What is your last name?",
    ask_email: "Question 3/14: What is your email address?",
    ask_hours_per_week:
      "Question 4/14: How many hours per week would you like to work?\n*1.* 40\n*2.* 32\n*3.* 24\n*4.* 16\n*5.* 8\n\nYou can reply with *1-5* or type *40/32/24/16/8*.",
    ask_age:
      "Question 5/15: What is your birthday? (*DD/MM/YYYY*)\n\nYou must be *18 or older* to apply.",
    ask_birthday:
      "Question 5/15: What is your birthday? (*DD/MM/YYYY*)\n\nYou must be *18 or older* to apply.",
    ask_gender: "Question 6/15: How do you identify?\n*1.* Male\n*2.* Female\n*3.* I'd rather not say",
    ask_country: "Question 7/15: What country are you based in?",
    ask_english_level:
      "Question 8/15: What is your English level?\n*1.* Beginner\n*2.* Intermediate\n*3.* Advanced\n*4.* Fluent",
    ask_internet_speed:
      "Question 9/15: What is your internet speed?\n*1.* Fast (more than 100 Mbps)\n*2.* Medium (50-100 Mbps)\n*3.* Slow (less than 50 Mbps)",
    ask_phone_hq_video:
      "Question 10/15: Do you have a phone that can shoot high-quality video? (Y/N)\n\n" +
      "Typical examples: *iPhone 11+*, or *Android 2023 or later*.",
    ask_comfortable_on_cam: "Question 11/15: Are you comfortable on camera? (Y/N)",
    ask_alone_place: "Question 12/15: Do you have a quiet place where you can stream alone? (Y/N)",
    ask_social_handle: "Question 13/15: What is your primary social handle? (e.g. @username)",
    ask_best_video_url:
      "Question 14/15: Please share a link to your best video (any platform: TikTok, Instagram, YouTube, Drive, etc.).",
    ask_over18: "Question 15/15: I confirm that I am *18 or older*. (Y/N)",
  };
  return prompts[stage] ?? null;
}

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
    `I’m *${BOT_NAME}*, the assistant here to help with applications and questions. ` +
    "We’re the recruitment partner for digital live streaming hosts, and this is our official business WhatsApp—not a personal account.\n\n" +
    "Reply *1* or *2* to choose a vacancy."
  );
}

function vacancyPrompt(): string {
  return (
    `Hi! I’m *${BOT_NAME}*, *${BUSINESS_NAME}*’s application assistant.\n\n` +
    "We’re here to bridge the gap and pair your unique personality with major brands.\n\n" +
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
    "*2.* Global Live Stream Host\n\n" +
    "You can earn *upwards of €1,500 per month* (depending on role, hours, and performance).\n\n" +
    "If you choose the wrong vacancy, reply *back* to change it."
  );
}

function actionPrompt(vacancyLabel: string): string {
  return (
    `You have selected ${vacancyLabel}. Do you:\n` +
    "*1.* apply?\n" +
    "*2.* want more info?\n\n" +
    "Reply *back* to pick a different vacancy."
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
    return { wa_id: waId, stage: "idle", answers: {} };
  }
  if (!data) return { wa_id: waId, stage: "idle", answers: {} };
  return {
    wa_id: data.wa_id,
    stage: (data.stage as Stage) || "idle",
    answers: (data.answers as Record<string, string>) || {},
  };
}

async function saveSession(session: SessionRow): Promise<void> {
  memorySessions.set(session.wa_id, session);
  if (!supabase) return;
  const { error } = await supabase.from(SESSION_TABLE).upsert(
    {
      wa_id: session.wa_id,
      stage: session.stage,
      answers: session.answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_id" }
  );
  if (error) {
    console.error("Error saving session:", error.message);
  }
}

async function saveApplication(session: SessionRow): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(APPLICATION_TABLE).insert({
    phone_number: session.wa_id,
    vacancy: session.answers.vacancy ?? "",
    vacancy_label: session.answers.vacancy_label ?? null,
    first_name: session.answers.first_name ?? null,
    last_name: session.answers.last_name ?? null,
    email: session.answers.email ?? null,
    hours_per_week: session.answers.hours_per_week ?? null,
    birthday: session.answers.birthday ?? null,
    over18: session.answers.over18 === "Yes",
    country: session.answers.country ?? null,
    gender: session.answers.gender ?? null,
    english_level: session.answers.english_level ?? null,
    internet_speed: session.answers.internet_speed ?? null,
    phone_hq_video: session.answers.phone_hq_video ?? null,
    comfortable_on_cam: session.answers.comfortable_on_cam ?? null,
    alone_place: session.answers.alone_place ?? null,
    social_handle: session.answers.social_handle ?? null,
    best_video_url: session.answers.best_video_url ?? null,
    wa_id: session.wa_id,
    source: "whatsapp",
    raw_answers: session.answers,
  });
  if (error) {
    console.error("Error saving application:", error.message);
  }
}

async function saveInboxMessage(waId: string, messageText: string, stage: Stage): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(INBOX_TABLE).insert({
    wa_id: waId,
    message_text: messageText,
    stage,
    resolved: false,
  });
  if (error) {
    console.error("Error saving inbox message:", error.message);
  }
}

async function notifyInboxEmail(waId: string, messageText: string, stage: Stage): Promise<void> {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const alertEmail = Deno.env.get("WHATSAPP_INBOX_ALERT_EMAIL");
  if (!brevoKey || !senderEmail || !alertEmail) return;

  const payload = {
    sender: { email: senderEmail, name: "vantage content" },
    to: [{ email: alertEmail }],
    subject: "New WhatsApp inbox message",
    textContent:
      `Incoming WhatsApp message\\n\\n` +
      `From: ${waId}\\n` +
      `Stage: ${stage}\\n` +
      `Message: ${messageText}\\n` +
      `Received at: ${new Date().toISOString()}`,
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Inbox alert email failed:", res.status, body);
  }
}

function looksLikeGeneralInquiry(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  // Treat free-form text as inquiry; short numeric replies should stay in flow.
  return /[a-zA-Z]/.test(t);
}

async function logAndNotifyInquiry(waId: string, messageText: string, stage: Stage): Promise<void> {
  await Promise.all([
    saveInboxMessage(waId, messageText, stage),
    notifyInboxEmail(waId, messageText, stage),
  ]);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseYesNo(text: string): "yes" | "no" | null {
  const t = text.toLowerCase().trim().replace(/[.!?,;:]+$/g, "");
  if (/^(yes|y|1|true|ja|oui|si)$/.test(t)) return "yes";
  if (/^(no|n|0|false|nee|non)$/.test(t)) return "no";
  return null;
}

function looksLikeHandle(text: string): boolean {
  const t = text.trim();
  return t.length >= 2 && (t.startsWith("@") || /^[a-zA-Z0-9_.]+$/.test(t));
}

function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  return /^https?:\/\/.+\..+/.test(t) || /^www\.\S+/.test(t) || /^\S+\.(com|io|co|net|org)\S*$/i.test(t);
}

function parseBirthdayDDMMYYYY(value: string): Date | null {
  const t = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) return null;
  return d;
}

/** True if `birthUtc` is at least `minAge` years old on `refUtc` (calendar day, UTC). */
function isAtLeastAgeYears(birthUtc: Date, minAge: number, refUtc: Date = new Date()): boolean {
  const cutoff = new Date(
    Date.UTC(
      refUtc.getUTCFullYear() - minAge,
      refUtc.getUTCMonth(),
      refUtc.getUTCDate(),
    ),
  );
  return birthUtc.getTime() <= cutoff.getTime();
}

async function persistAndSend(session: SessionRow, to: string, message: string): Promise<void> {
  await Promise.all([saveSession(session), sendWhatsAppText(to, message)]);
}

async function sendVacancyPreviewAndAction(
  session: SessionRow,
  to: string,
  vacancyLabel: string,
  imageUrl?: string
): Promise<void> {
  await saveSession(session);
  const prompt = actionPrompt(vacancyLabel);
  if (imageUrl) {
    await sendWhatsAppImage(to, imageUrl, prompt);
    return;
  }
  await sendWhatsAppText(to, prompt);
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

async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
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
    type: "image",
    image: {
      link: imageUrl,
      ...(caption ? { caption } : {}),
    },
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
    console.error("Error sending WhatsApp image:", res.status, text);
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

      if (lower === "back") {
        if (session.stage === "choose_action") {
          session.stage = "choose_vacancy";
          session.answers.menu = "vacancies";
          delete session.answers.vacancy;
          delete session.answers.vacancy_label;
          await persistAndSend(
            session,
            from,
            `No problem - let's pick the right vacancy.\n\n${vacanciesListPrompt()}`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (session.stage === "choose_vacancy" && session.answers.menu === "vacancies") {
          session.answers.menu = "top";
          await persistAndSend(
            session,
            from,
            "Moved back to the main menu.\n\n" + vacancyPrompt()
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const prevStage = previousQuestionStage(session.stage);
        if (!prevStage) {
          await sendWhatsAppText(
            from,
            "You're at the beginning. Reply *1* or *2* to continue, or *restart* to start over."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.stage = prevStage;
        const prompt = questionPromptFor(prevStage, session.answers) ??
          "Moved back one step. Please continue.";
        await persistAndSend(session, from, `${prompt}\n\nYou can reply *back* again if needed.`);
        return new Response("EVENT_RECEIVED", { status: 200 });
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
            await sendVacancyPreviewAndAction(
              session,
              from,
              "1 Remote Content Creator",
              REMOTE_VACANCY_IMAGE_URL
            );
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          if (lower === "2" || lower.includes("global") || lower.includes("live")) {
            session.answers.vacancy = VACANCY_GLOBAL;
            session.answers.vacancy_label = "2 Global Live Stream Host";
            session.stage = "choose_action";
            await sendVacancyPreviewAndAction(
              session,
              from,
              "2 Global Live Stream Host"
            );
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          await sendWhatsAppText(
            from,
            "Please select a vacancy by replying *1* or *2*.\n\nIf you made a mistake, reply *back* or *restart*."
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

        if (looksLikeGeneralInquiry(textBody)) {
          await logAndNotifyInquiry(from, textBody, session.stage);
          await sendWhatsAppText(
            from,
            "Thanks for your message. A team member will reply shortly.\n\nIf you want to apply now, reply *1*."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        await sendWhatsAppText(
          from,
          "Please reply *1* (See our vacancies) or *2* (Send email).\n\nIf you want to apply, start with *1*."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "choose_action") {
        const vacancy = session.answers.vacancy;
        const vacancyLabel = session.answers.vacancy_label ?? "selected role";
        const moreInfoUrl =
          vacancy === VACANCY_GLOBAL
            ? "https://vantagecontent.com/careers/globallivestreamhost"
            : "https://vantagecontent.com/careers/remotecontentstreamer";

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
            `Great, let's apply for *${vacancyLabel}*.\n\nQuestion 1/14: What is your first name?`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (looksLikeGeneralInquiry(textBody)) {
          await logAndNotifyInquiry(from, textBody, session.stage);
          await sendWhatsAppText(
            from,
            "Thanks for your message. A team member will reply shortly.\n\nReply *1* to apply or *2* for more info."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        await sendWhatsAppText(
          from,
          "Reply *1* to apply or *2* for more info.\n\nIf you selected the wrong vacancy, reply *back* to choose again."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_first_name") {
        session.answers.first_name = textBody;
        session.stage = "ask_last_name";
        await persistAndSend(
          session,
          from,
          "Question 2/14: What is your last name?"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_last_name") {
        session.answers.last_name = textBody;
        session.stage = "ask_email";
        await persistAndSend(
          session,
          from,
          "Question 3/14: What is your email address?\n\nIf needed, reply *back* to change your previous answer."
        );
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
          "Question 4/14: How many hours per week would you like to work?\n*1.* 40\n*2.* 32\n*3.* 24\n*4.* 16\n*5.* 8\n\nYou can reply with *1-5* or type *40/32/24/16/8*."
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
            "Please reply with *1*, *2*, *3*, *4*, or *5* (40, 32, 24, 16, 8)."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.hours_per_week = chosen;
        // Keep stage backward-compatible with older DB constraints.
        session.stage = "ask_age";
        await persistAndSend(
          session,
          from,
          "Question 5/15: What is your birthday? (*DD/MM/YYYY*)\n\nYou must be *18 or older* to apply."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_age" || session.stage === "ask_birthday") {
        const parsed = parseBirthdayDDMMYYYY(textBody);
        if (!parsed) {
          await sendWhatsAppText(
            from,
            "Please enter your birthday in strict format *DD/MM/YYYY* (example: 07/11/1998).\n\nYou must be *18 or older* to apply."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        if (!isAtLeastAgeYears(parsed, MIN_APPLICANT_AGE)) {
          await sendWhatsAppText(
            from,
            `You must be *${MIN_APPLICANT_AGE} or older* to apply. Please enter your correct birthday (*DD/MM/YYYY*) or reply *restart*.`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.birthday = textBody.trim();
        session.stage = "ask_gender";
        await persistAndSend(
          session,
          from,
          "Question 6/15: How do you identify?\n*1.* Male\n*2.* Female\n*3.* I'd rather not say"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_gender") {
        const genderMap: Record<string, string> = {
          "1": "Male",
          "2": "Female",
          "3": "I'd rather not say",
          male: "Male",
          female: "Female",
          "rather not say": "I'd rather not say",
          "prefer not to say": "I'd rather not say",
        };
        const gender = genderMap[lower];
        if (!gender) {
          await sendWhatsAppText(
            from,
            "Please reply *1* (Male), *2* (Female), or *3* (I'd rather not say)."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.gender = gender;
        session.stage = "ask_country";
        await persistAndSend(
          session,
          from,
          "Question 7/15: What country are you based in?"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_country") {
        session.answers.country = textBody;
        session.stage = "ask_english_level";
        await persistAndSend(
          session,
          from,
          "Question 8/15: What is your English level?\n*1.* Beginner\n*2.* Intermediate\n*3.* Advanced\n*4.* Fluent"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_english_level") {
        const engMap: Record<string, string> = {
          beginner: "Beginner",
          intermediate: "Intermediate",
          advanced: "Advanced",
          fluent: "Fluent",
          "1": "Beginner",
          "2": "Intermediate",
          "3": "Advanced",
          "4": "Fluent",
        };
        const eng = engMap[lower] ?? (lower.length >= 3 ? textBody : null);
        if (!eng) {
          await sendWhatsAppText(
            from,
            "Please choose: *Beginner*, *Intermediate*, *Advanced*, or *Fluent*."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.english_level = eng;
        session.stage = "ask_internet_speed";
        await persistAndSend(
          session,
          from,
          "Question 9/15: What is your internet speed?\n*1.* Fast (more than 100 Mbps)\n*2.* Medium (50–100 Mbps)\n*3.* Slow (less than 50 Mbps)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_internet_speed") {
        const speedMap: Record<string, string> = {
          "1": "Fast (more than 100 Mbps)",
          "2": "Medium (50–100 Mbps)",
          "3": "Slow (less than 50 Mbps)",
          fast: "Fast (more than 100 Mbps)",
          medium: "Medium (50–100 Mbps)",
          slow: "Slow (less than 50 Mbps)",
        };
        const speed = speedMap[lower];
        if (!speed) {
          await sendWhatsAppText(
            from,
            "Please reply *1* (Fast), *2* (Medium), or *3* (Slow)."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.internet_speed = speed;
        session.stage = "ask_phone_hq_video";
        await persistAndSend(
          session,
          from,
          "Question 10/15: Do you have a phone that can shoot high-quality video? (Y/N)\n\n" +
            "Typical examples: *iPhone 11+*, or *Android 2023 or later*."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_phone_hq_video") {
        const yn = parseYesNo(textBody);
        if (!yn) {
          await sendWhatsAppText(from, "Please reply *Y* or *N*.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.phone_hq_video = yn === "yes" ? "Yes" : "No";
        session.stage = "ask_comfortable_on_cam";
        await persistAndSend(
          session,
          from,
          "Question 11/15: Are you comfortable on camera? (Y/N)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_comfortable_on_cam") {
        const yn = parseYesNo(textBody);
        if (!yn) {
          await sendWhatsAppText(from, "Please reply *Y* or *N*.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.comfortable_on_cam = yn === "yes" ? "Yes" : "No";
        session.stage = "ask_alone_place";
        await persistAndSend(
          session,
          from,
          "Question 12/15: Do you have a quiet place where you can stream alone? (Y/N)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_alone_place") {
        const yn = parseYesNo(textBody);
        if (!yn) {
          await sendWhatsAppText(from, "Please reply *Y* or *N*.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.alone_place = yn === "yes" ? "Yes" : "No";
        session.stage = "ask_social_handle";
        await persistAndSend(
          session,
          from,
          "Question 13/15: What is your primary social handle? (e.g. @username)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_social_handle") {
        if (!looksLikeHandle(textBody)) {
          await sendWhatsAppText(
            from,
            "Please enter your handle (e.g. @username). Use letters, numbers, or underscore."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.social_handle = textBody.startsWith("@") ? textBody : `@${textBody.trim()}`;
        session.stage = "ask_best_video_url";
        await persistAndSend(
          session,
          from,
          "Question 14/15: Please share a link to your best video (any platform: TikTok, Instagram, YouTube, Drive, etc.)."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_best_video_url") {
        const cleaned = textBody.trim();
        if (!cleaned) {
          await sendWhatsAppText(
            from,
            "Please share a video link, handle, or short description of your best video."
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        // Accept non-URL inputs too so candidates are not blocked.
        session.answers.best_video_url = looksLikeUrl(cleaned) ? cleaned : `Provided without URL: ${cleaned}`;
        session.stage = "ask_over18";
        await persistAndSend(
          session,
          from,
          "Question 15/15: I confirm that I am *18 or older*. (Y/N)"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (session.stage === "ask_over18") {
        const yn = parseYesNo(textBody);
        if (!yn) {
          await sendWhatsAppText(from, "Please reply *Y* or *N*.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        if (yn === "no") {
          await sendWhatsAppText(
            from,
            `This opportunity is only for applicants who are *${MIN_APPLICANT_AGE} or older*. Reply *restart* to leave the application, or *back* to change a previous answer.`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        const birthParsed = session.answers.birthday
          ? parseBirthdayDDMMYYYY(session.answers.birthday)
          : null;
        if (!birthParsed || !isAtLeastAgeYears(birthParsed, MIN_APPLICANT_AGE)) {
          session.stage = "ask_age";
          await persistAndSend(
            session,
            from,
            `We need a birthday that shows you are *${MIN_APPLICANT_AGE} or older*.\n\nQuestion 5/15: What is your birthday? (*DD/MM/YYYY*)`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        session.answers.over18 = "Yes";
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
            `- Birthday: ${session.answers.birthday ?? "-"}\n` +
            `- Gender: ${session.answers.gender ?? "-"}\n` +
            `- Country: ${session.answers.country ?? "-"}\n` +
            `- English level: ${session.answers.english_level ?? "-"}\n` +
            `- Internet speed: ${session.answers.internet_speed ?? "-"}\n` +
            `- Phone HQ video: ${session.answers.phone_hq_video ?? "-"}\n` +
            `- Comfortable on cam: ${session.answers.comfortable_on_cam ?? "-"}\n` +
            `- Quiet alone place: ${session.answers.alone_place ?? "-"}\n` +
            `- Social handle: ${session.answers.social_handle ?? "-"}\n` +
            `- Best video URL: ${session.answers.best_video_url ?? "-"}\n` +
            `- 18+ confirmed: ${session.answers.over18 ?? "-"}\n\n` +
            "Application complete.\n\n" +
            "You should receive an email shortly.\n" +
            "Our team will review this and follow up. Reply *restart* if you want to submit again."
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (looksLikeGeneralInquiry(textBody)) {
        await logAndNotifyInquiry(from, textBody, session.stage);
        await sendWhatsAppText(
          from,
          "Thanks for your message. A team member will reply shortly.\n\nReply *restart* to start a new application."
        );
      } else {
        await sendWhatsAppText(
          from,
          "Your application is already submitted. Reply *restart* to start over."
        );
      }
    } catch (e) {
      console.error("Error handling webhook:", e);
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});