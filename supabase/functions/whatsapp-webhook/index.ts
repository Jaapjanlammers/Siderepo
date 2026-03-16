
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.info("WhatsApp webhook function started");

// Helper to send a simple text message back via WhatsApp Cloud API
async function sendWhatsAppText(to: string, body: string) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!token || !phoneNumberId) {
    console.error("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
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
    const body = await req.json();
    console.log("Incoming WhatsApp webhook:", JSON.stringify(body));

    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        // Status updates etc: nothing to reply to
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const message = messages[0];
      const from = message.from as string | undefined;
      const textBody: string | undefined = message.text?.body;

      if (!from) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // For now, first step: always send the same welcome + simple menu.
      // We only start asking vacancy questions after they explicitly choose to apply.
      const welcome =
        "Welcome to vantage.content.\n\nWe can help you apply via WhatsApp.\n\nReply *1* if you want to apply for the *Remote Content Creator* position.\nIf not, you can also reply with any question.";

      // We ignore textBody for now and only send this menu.
      await sendWhatsAppText(from, welcome);
    } catch (e) {
      console.error("Error handling webhook:", e);
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});