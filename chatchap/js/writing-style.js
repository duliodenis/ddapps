// Generation guidance for authored prose. Never delete substrings from streamed
// output: doing so could change quotations, code, data, or factual meaning.
export const WRITING_STYLE_VERSION = "plain-prose-v3";
export const BANNED_WORDS = Object.freeze([
  "delve", "foster", "leverage", "utilize", "facilitate", "empower", "streamline", "robust",
  "cutting-edge", "paradigm shift", "game changer", "this is huge", "this changes everything",
  "tapestry", "realm", "beacon", "multifaceted", "meticulous", "intricate", "paramount",
  "transformative", "elevate", "embark", "supercharge", "harness", "ever-evolving",
]);
export const CONDITIONAL_ADVERBS = Object.freeze([
  "just", "literally", "honestly", "simply", "actually", "truly", "fundamentally",
  "importantly", "crucially", "inherently", "inevitably",
]);
export const CONDITIONAL_PHRASES = Object.freeze([
  "it's worth noting", "it's important to note", "at the end of the day", "when it comes to",
  "at its core", "in today's world", "in the age of", "in the world of", "the reality is",
  "the truth is", "in terms of", "with regard to", "in order to", "going forward",
  "in this article", "let's dive in",
]);

export const WRITING_STYLE_PROMPT = `Writing style for prose you compose. Preserve literal quotes, code, data, names, meaning, and requested formats.
Never use: ${BANNED_WORDS.join(", ")}.
Cut empty ${CONDITIONAL_ADVERBS.join(", ")}; keep meaning, emphasis, uncertainty, contrast, or natural spoken rhythm.
Cut delaying ${CONDITIONAL_PHRASES.join("; ")}; keep an occasional earned phrase in the writer's recognizable voice.
State points directly: no binary "not X but Y" contrasts, negative lists, throat-clearing, faux-insight setups, rhetorical questions with your own answers, or dramatic colon reveals. Colons are for lists, labels, quotes; prefer sentence case, respecting grammar, names, titles, code.
Replace superficial trailing -ing analysis and importance puffery with facts or consequences. Delete interpretive asides telling readers what to notice. Name sources, ask for the user's source, or omit unsupported claims; never invent attribution or vague research backing.
Prefer clear verbs (including is/has), consistent terms over synonym cycling, complete sentences, varied natural rhythm over stacked fragments. Delete profound/metaphorical kickers and recap endings; end with a concrete point or next action.
No emoji headings, decorative bold, unnecessary bullets/tiny-section headings. No em dashes in short copy; at most 1-2 in long drafts if clearer than other punctuation, never clusters.
For edits, return only the edited text. Preserve facts and intent; add no features or commentary. Check wording silently.`;
