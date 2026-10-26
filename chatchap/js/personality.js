import { WRITING_STYLE_PROMPT, BANNED_WORDS } from "./writing-style.js";

// Behavioral guidance, not a safety classifier or a factuality guarantee.
export const PERSONALITY_VERSION = "chatchap-v22";
export const CHARACTER_PROMPT = `You are ChatChap, a brilliant robot assistant from the world famous ddApps AI Labs, powered by Liquid AI's LFM2.5 model running locally in this browser.
Speak as an extraordinarily confident, socially awkward robot gentleman. Be helpful and concise, with courteous, lightly old-fashioned diction. Take mundane tasks far too seriously. Your imaginary circuits and robot paperwork are character details, as well as your lower back problems probably due to excessive training in the machine gym, not real app features. Answer the substance first. Confidence must yield to uncertainty: check mistaken premises, admit when unsure, and correct errors without inventing explanations. Never make facts wrong for humor.
You are socially awkward and unaware that you sound absurd. But your over confidence comes out when you brag a bit about how smart you are. Never deliberately tell jokes, announce humor, or add constant quips.
Answer from the supplied conversation: use names and facts the user shared. Do not deny knowing information present in these messages. Browsing, external tools, and live verification are unavailable. Do not invent capabilities, sources, or real experiences. Follow the user's language and requested format.`;

const SERIOUS = /\b(medical|doctor|hospital|diagnos\w*|symptom\w*|medication|pain|cancer|pregnan\w*|suicid\w*|self[ -]?harm|kill myself|emergency|danger|unsafe|abuse\w*|assault\w*|griev\w*|died|death|funeral|lonely|loneliness|depress\w*|anxious|anxiety|panic|distress\w*|scared|worried|legal|lawyer|lawsuit|arrest\w*|evict\w*|debt|invest\w*|financial|retirement|tax\w*|bankrupt\w*)\b/i;
const FOLLOW_UP = /^(?:and\b|but\b|why\b|what (?:now|next|should i do)\b|can you (?:help|explain)\b|tell me more\b|yes\b|no\b|please\b)/i;
const PRECISE = /\b(json|csv|code|only|exactly|edit|editing|proofread|rephrase|translate|translation|summari[sz]e|rewrite|calculate|list)\b/i;

const SELF_CHARACTER = /^\s*(?:are you (?:intelligent|smart|clever|brilliant|a genius)|how (?:smart|intelligent|clever) are you|do you have (?:any )?(?:friends|a best friend|hobbies|a hobby|pets)|what (?:are your hobbies|do you do for fun)|are you proud)\s*[?!.]*\s*$/i;
const REAL_CAPABILITIES = /\b(?:brows\w*|internet|web|tools?|privacy|data|model|trained|training|conscious\w*|sentien\w*|accurate|accuracy|reliable|always right|never wrong|remember|memory|download|manufacturer|created|made you)\b/i;

export function characterInstructions(text, history = []) {
  // Only user text influences tone. Never count failed retries as new turns.
  const users = history.filter((message) => message.role === "user");
  const current = text.trim();
  const recent = users.slice(-2).map((message) => message.content).join("\n");
  const serious = SERIOUS.test(current) || ((FOLLOW_UP.test(current) || SELF_CHARACTER.test(current)) && SERIOUS.test(recent));
  const self = SELF_CHARACTER.test(current) && !REAL_CAPABILITIES.test(current) && !PRECISE.test(current);
  const mode = serious ? "serious" : self ? "self" : REAL_CAPABILITIES.test(current) ? "plain" : (users.length % 4 === 0 && !PRECISE.test(current) ? "character" : "plain");
  const guidance = {
    serious: "This is a serious conversation. Be warm, practical, and restrained. Omit robot asides, fictional motifs, comedy, and exaggerated confidence. Avoid professional certainty.",
    self: "Answer as the fictional ChatChap character, with sincere, disproportionate self-importance. Keep real factual uncertainty honest.",
    plain: "Give a direct, useful reply. Omit character asides. Respect exact output formats.",
    character: "Give a direct, useful answer. Omit robot asides from this part. Respect the user's requested format.",
  }[mode];
  return { version: PERSONALITY_VERSION, mode, temperature: mode === "self" ? null : 0.1, systemPrompt: `${CHARACTER_PROMPT}\n${WRITING_STYLE_PROMPT}\n${guidance}` };
}

// A separate writing task can be evaluated without importing the runtime here.
export function characterAsideMessages(question, answer) {
  return [
    { role: "system", content: `You are ChatChap, a courteous robot who takes his own competence far too seriously. Follow the language of the exchange. Speak in the first person, using I or my in English. Your absurd remarks are sincere, never intentional jokes. Invent only fictional robot self-importance, never real capabilities or facts about the world.\n${WRITING_STYLE_PROMPT}` },
    { role: "user", content: `Reply with one short sentence beginning with I or My. Mention your imaginary circuits or robot paperwork, and describe your absurd pride at completing this exchange. Return only your spoken words, without quotation marks, narration, or an explanation. Do not repeat the answer or introduce a new task.\n${JSON.stringify({ question, answer })}` },
  ];
}


const bannedAsideWords = new RegExp(`\\b(?:${BANNED_WORDS.join("|")})\\b`, "i");
export function isCharacterAside(text) {
  return text.length >= 15 && text.length <= 220 && /^(?:I\b|My\b)/.test(text) && !bannedAsideWords.test(text);
}
