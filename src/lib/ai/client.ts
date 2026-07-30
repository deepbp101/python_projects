import Anthropic from "@anthropic-ai/sdk";

/**
 * The Claude client, for the writing assistant and the style summary.
 *
 * Runs on Haiku 4.5 — the cheapest and fastest current model, which is the right
 * tier for short, well-specified generation like a thank-you note or a paragraph
 * of style description. Nothing here needs deep reasoning, and these features are
 * used in bursts while a couple iterates, so latency matters more than ceiling.
 *
 * Haiku 4.5 does not accept the `effort` parameter, and omitting `thinking`
 * leaves thinking off on that generation — both correct for this workload.
 */

export const AI_MODEL = "claude-haiku-4-5";

/** Thrown when the feature is asked for but no credentials are configured. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Whether the assistant can run at all.
 *
 * Checks the environment variable rather than probing the API, so the UI can
 * decide what to *offer* without spending a request. This is a hint, not the
 * enforcement point: the SDK also resolves credentials from an `ant auth login`
 * profile, so an unset variable does not strictly prove there are none — which is
 * exactly why `generateText` still handles an authentication failure at runtime
 * rather than trusting this.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: Anthropic | undefined;

function client(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

export type GenerateOptions = {
  system: string;
  prompt: string;
  /**
   * Deliberately modest. Everything this app generates is short by design — vows,
   * a toast, a thank-you note — so a low ceiling costs nothing and keeps a
   * runaway response from becoming a runaway bill. Well under the streaming
   * threshold, so these stay simple non-streaming calls.
   */
  maxTokens?: number;
};

/**
 * One-shot generation. Returns the text, or throws `AiUnavailableError` with a
 * message worth showing a person.
 *
 * Every failure mode a couple can actually hit — no key, rate limited, network
 * down — becomes an explanation rather than a stack trace, because the honest
 * answer to "the AI is off" is a sentence saying so, not a 500.
 */
export async function generateText({
  system,
  prompt,
  maxTokens = 2048,
}: GenerateOptions): Promise<string> {
  if (!isAiConfigured()) {
    throw new AiUnavailableError(
      "The writing assistant needs an Anthropic API key. Set ANTHROPIC_API_KEY and restart.",
    );
  }

  try {
    const response = await client().messages.create({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    // `content` is a discriminated union — narrow before reading text, and join
    // in case the response arrives as more than one block.
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new AiUnavailableError(
        "The assistant came back empty. Try rephrasing what you want.",
      );
    }

    return text;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;

    // Most specific first. APIConnectionError is a subclass of APIError in this
    // SDK, so it has to be checked before it.
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailableError(
        "That Anthropic API key was rejected. Check ANTHROPIC_API_KEY.",
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiUnavailableError(
        "The assistant is rate limited right now. Give it a minute and try again.",
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AiUnavailableError(
        "Could not reach Anthropic. Check the server's network access.",
      );
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiUnavailableError(
        `The assistant could not finish that request (${error.status ?? "error"}).`,
      );
    }

    throw error;
  }
}
