import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { buildPrompt, DEFAULT_REPLY, SYSTEM_PROMPT } from "./prompt";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type GeminiUsage = {
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
};

type GeminiResult = {
  reply: string;
  finishReason: string;
  usage: GeminiUsage;
};

export async function askGemini(
  faq: string,
  question: string
): Promise<GeminiResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);

  const bangkokNow = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  });

  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: buildPrompt(faq, question),
      config: {
        systemInstruction:
          SYSTEM_PROMPT +
          `\n\n<current_time>\n${bangkokNow}\n</current_time>`,
        temperature: 0.3,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: controller.signal,
      },
    });

    const finishReason =
      (res.candidates?.[0]?.finishReason as string) ?? "UNKNOWN";
    const usage: GeminiUsage = {
      thoughtsTokenCount: res.usageMetadata?.thoughtsTokenCount,
      candidatesTokenCount: res.usageMetadata?.candidatesTokenCount,
    };

    console.log(
      JSON.stringify({ tag: "gemini", finishReason, ...usage })
    );

    if (finishReason === "MAX_TOKENS") {
      return { reply: DEFAULT_REPLY, finishReason, usage };
    }

    return { reply: res.text ?? DEFAULT_REPLY, finishReason, usage };
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.name === "AbortError";
    console.error(
      JSON.stringify({
        tag: "gemini-error",
        error: String(err),
        timeout: isTimeout,
      })
    );
    return {
      reply: DEFAULT_REPLY,
      finishReason: isTimeout ? "TIMEOUT" : "ERROR",
      usage: {},
    };
  } finally {
    clearTimeout(t);
  }
}
