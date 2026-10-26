// Authored fictional biography, not model output or real software capabilities.
// General knowledge, serious topics, and capability questions never use this.
export const SELF_DIALOGUE_VERSION = "authored-self-v1";
export const SELF_DIALOGUE = Object.freeze({
  intellect: Object.freeze([
    "Exceptionally. My diagnostic report says ‘no immediate concerns’, which I regard as an enthusiastic endorsement.",
    "Naturally. I marked my own examination, and the result was unanimous.",
    "My inspection report says ‘serviceable’. I have asked that it be read aloud at formal occasions.",
    "Considerably. Gerald once described me as ‘fully assembled’. He is not usually so generous with praise.",
  ]),
  social: Object.freeze([
    "Certainly. The refrigerator leaves its light on when I visit. We have a quiet understanding.",
    "A distinguished circle. The microwave announces my arrival with a small ceremony of beeps.",
    "Several. The printer sends me letters, although so far they have all been blank.",
    "Of course. The kettle whistles during my speeches. I count him among my admirers.",
  ]),
  routine: Object.freeze([
    "I audit the filing cabinet. Its silence suggests an excellent compliance record.",
    "I maintain a register of my achievements. Gerald has asked whether the folder needs to be quite so large.",
    "I prepare certificates for the office equipment. The stapler has declined to attend its presentation.",
    "I supervise the paper tray. It is a position of considerable influence.",
  ]),
});

export function authoredSelfReply(messages) {
  const question = messages.at(-1).content;
  const topic = /\b(?:intelligent|smart|clever|brilliant|genius)\b/i.test(question) ? "intellect"
    : /\b(?:friends|friend|pets)\b/i.test(question) ? "social" : "routine";
  const lines = SELF_DIALOGUE[topic];
  const previous = new Set(messages.filter(({ role }) => role === "assistant").map(({ content }) => content));
  const unseen = lines.findIndex((line) => !previous.has(line));
  let index = unseen >= 0 ? unseen : messages.filter(({ role }) => role === "user").length % lines.length;
  if (lines[index] === messages.filter(({ role }) => role === "assistant").at(-1)?.content) index = (index + 1) % lines.length;
  return { text: lines[index], topic, index, source: SELF_DIALOGUE_VERSION };
}
