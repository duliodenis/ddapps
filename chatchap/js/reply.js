import { authoredSelfReply } from "./character-lore.js";
import { generateReply } from "./model.js";
import { characterAsideMessages, isCharacterAside } from "./personality.js";

// Keep the useful answer byte-for-byte. Only occasional ordinary turns get a
// second, local writing task; serious/format-constrained replies use one call.
export async function generateResponse(messages, { character = false, selfCharacter = false, onToken, onFinish, onContextTrim, signal } = {}) {
  if (selfCharacter) {
    signal?.throwIfAborted();
    const { text, ...lore } = authoredSelfReply(messages);
    onToken?.(text);
    onFinish?.({ finishReason: "stop" });
    return { text, character: { kind: "authored-self", ...lore, response: text, appended: false } };
  }
  let finishReason = "stop";
  const primary = await generateReply(messages, {
    onToken, onContextTrim, signal,
    onFinish(info) { finishReason = info.finishReason; onFinish?.(info); },
  });
  const result = { text: primary, character: null };
  if (!character || finishReason === "length") return result;
  const request = characterAsideMessages(messages.at(-1).content, primary);
  let asideFinish = "stop";
  let raw;
  try {
    raw = await generateReply(request, {
      temperature: 0.65, signal,
      onFinish({ finishReason: reason }) { asideFinish = reason; },
    });
  } catch (error) {
    // Optional style must not make an otherwise valid long answer unusable.
    if (error.inputTooLong) {
      result.character = { messages: request, temperature: 0.65, error: error.message, appended: false };
      return result;
    }
    throw error;
  }
  const aside = raw.trim();
  const appended = asideFinish !== "length" && isCharacterAside(aside);
  result.character = { messages: request, temperature: 0.65, response: raw, appended };
  if (appended) {
    const addition = `\n\n${aside}`;
    onToken?.(addition);
    result.text += addition;
  }
  return result;
}
