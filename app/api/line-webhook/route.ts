import { validateSignature, webhook } from "@line/bot-sdk";
import { getFaq } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";
import { replyText } from "@/lib/line";
import { DEFAULT_REPLY } from "@/lib/prompt";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (
    !validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed: webhook.CallbackRequest = JSON.parse(body);
  const textEvents = parsed.events.filter(
    (e): e is webhook.MessageEvent & { message: webhook.TextMessageContent } =>
      e.type === "message" && (e as webhook.MessageEvent).message.type === "text"
  );

  for (const event of textEvents) {
    let reply = DEFAULT_REPLY;

    try {
      const faq = await getFaq();
      const result = await askGemini(faq, event.message.text);
      reply = result.reply;
    } catch (err) {
      console.error(
        JSON.stringify({ tag: "error", error: String(err) })
      );
    }

    try {
      if (!event.replyToken) continue;
      await replyText(event.replyToken, reply);
    } catch (err) {
      console.error(
        JSON.stringify({ tag: "line-reply-error", error: String(err) })
      );
    }
  }

  return new Response("OK", { status: 200 });
}
