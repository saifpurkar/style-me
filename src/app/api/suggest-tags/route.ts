import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { TAGGING_SYSTEM_PROMPT, TagSuggestionSchema, cleanSuggestion } from "@/lib/tagging";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

// The browser shrinks photos to about 1024px before sending, so real requests are a few
// hundred KB. This cap only stops oversized or abusive uploads.
const MAX_BASE64_CHARS = 3_000_000;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  // 1. Only signed-in users may use this (it spends the owner's API credits).
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Please sign in first.", 401);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return fail("Please sign in first.", 401);

  // 2. The API key lives only on the server. Until it's set, suggestions are simply unavailable.
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("AI suggestions aren't set up yet.", 503);
  }

  // 3. Check the upload.
  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("That request wasn't understood.", 400);
  }
  const { image, mediaType } = body;
  if (typeof image !== "string" || image.length === 0 || image.length > MAX_BASE64_CHARS) {
    return fail("That photo is missing or too large.", 400);
  }
  if (typeof mediaType !== "string" || !(ALLOWED_TYPES as readonly string[]).includes(mediaType)) {
    return fail("That photo type isn't supported.", 400);
  }

  // 4. Ask Claude.
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: TAGGING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as AllowedType, data: image } },
            { type: "text", text: "Tag this item." },
          ],
        },
      ],
      output_config: {
        effort: "low",
        format: zodOutputFormat(TagSuggestionSchema),
      },
    });

    if (response.stop_reason === "refusal") {
      return fail("I couldn't analyze that photo.", 422);
    }
    if (!response.parsed_output) {
      return fail("I couldn't read a suggestion for that photo.", 502);
    }
    return NextResponse.json({ suggestion: cleanSuggestion(response.parsed_output) });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("suggest-tags: the Anthropic API key was rejected");
      return fail("AI suggestions aren't set up correctly yet.", 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return fail("AI suggestions are busy right now. Try again in a minute.", 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      // Also what an empty credit balance looks like.
      console.error("suggest-tags: bad request:", error.message);
      return fail("AI suggestions aren't available right now.", 503);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`suggest-tags: API error ${error.status}:`, error.message);
      return fail("AI suggestions failed. Please try again.", 502);
    }
    console.error("suggest-tags: unexpected error:", error);
    return fail("AI suggestions failed. Please try again.", 500);
  }
}
