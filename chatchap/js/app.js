import { checkSupport, loadModel, generateReply } from "./model.js";
import { Conversation } from "./chat.js";
import { DEFAULT_VARIANT, getModel } from "./models.js";
import { CHAT_SYSTEM_PROMPT } from "./instructions.js";

const $ = (id) => document.getElementById(id);
const loadButton = $("load");
const sendButton = $("send");
const prompt = $("prompt");
const form = $("prompt-form");
const scrollArea = $("scroll-area");
const messages = $("messages");
const variantSelect = $("variant");
let variant = DEFAULT_VARIANT;
variantSelect.value = variant;
const RECOVERY_KEY = "chatchap.recovery.liquid.v1";
let conversation = new Conversation();
let state = "checking";
let mustRestart = false;
let followLatest = true;
let scrollFrame;

function describeModel() {
  const model = getModel(variant);
  $("model-resources").textContent = `${model.description} Approximately ${Math.ceil(model.weightBytes / 1_000_000)} MB for the model graph and weights, plus tokenizer/runtime downloads and CPU/GPU working memory. Actual memory requirements vary by device.`;
  loadButton.textContent = `Load ${model.name}`;
}

variantSelect.addEventListener("change", () => {
  if (variantSelect.disabled) return;
  try {
    getModel(variantSelect.value);
    variant = variantSelect.value;
    describeModel();
  } catch (error) {
    variantSelect.value = variant;
    showError(error);
  }
});

function setState(next, text) {
  state = next;
  document.body.dataset.state = next;
  $("status").textContent = text;
  prompt.disabled = !["ready", "generating", "error"].includes(next) || mustRestart;
  prompt.readOnly = next === "generating";
  sendButton.disabled = next !== "ready" && next !== "error" || mustRestart || !prompt.value.trim();
  sendButton.textContent = conversation.pending ? "Retry response" : "Send ↑";
  if (next === "generating") sendButton.textContent = "Thinking…";
  prompt.placeholder = prompt.disabled ? "Load ChatChap to start a conversation…" : "Message ChatChap…";
}

function showError(error, advice = "") {
  $("error").textContent = `${advice} ${error.message || String(error)}`.trim();
  $("error-panel").hidden = false;
}

function nearBottom() {
  return scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 80;
}

function updateScroll() {
  if (followLatest && !scrollFrame) {
    scrollFrame = requestAnimationFrame(() => {
      // Recheck the user's choice: they may have scrolled before this frame.
      if (followLatest) scrollArea.scrollTop = scrollArea.scrollHeight;
      scrollFrame = null;
    });
  }
  $("latest").hidden = followLatest || !messages.children.length;
}

scrollArea.addEventListener("scroll", () => {
  followLatest = nearBottom();
  $("latest").hidden = followLatest || !messages.children.length;
}, { passive: true });
$("latest").addEventListener("click", () => { followLatest = true; updateScroll(); });

function renderMessage(role, content, timestamp) {
  const item = document.createElement("li");
  item.className = `message message--${role}`;
  const article = document.createElement("article");
  const heading = document.createElement("div");
  heading.className = "message-heading";
  const name = document.createElement("h3");
  name.textContent = role === "user" ? "You" : getModel(variant).name;
  const time = document.createElement("time");
  time.dateTime = timestamp;
  const date = new Date(timestamp);
  time.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  heading.append(name, time);
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = content;
  const note = document.createElement("p");
  note.className = "message-state";
  article.append(heading, body, note);
  item.append(article);
  messages.append(item);
  return { item, body, note };
}

function renderConversation() {
  messages.replaceChildren();
  for (const message of conversation.history) {
    const rendered = renderMessage(message.role, message.content, message.timestamp);
    if (message.truncated) rendered.note.textContent = "Reply reached the length limit. Ask a follow-up to continue.";
  }
  const pending = conversation.pending;
  $("welcome").hidden = conversation.history.length > 0 || Boolean(pending);
  if (!pending) return null;
  renderMessage("user", pending.text, pending.timestamp);
  const reply = renderMessage("assistant", pending.partial, pending.timestamp);
  const failed = pending.state === "error";
  reply.item.classList.toggle("message--error", failed);
  reply.body.setAttribute("aria-busy", String(!failed));
  reply.note.textContent = failed ? "Incomplete reply. Edit your message or retry below." : "Generating on your device…";
  return reply;
}

async function initializeModel() {
  loadButton.disabled = true;
  variantSelect.disabled = true;
  $("error-panel").hidden = true;
  $("loading-progress").hidden = false;
  $("progress").removeAttribute("value");
  $("progress-detail").textContent = "Downloading inference runtime…";
  setState("loading", `Loading ${getModel(variant).name}…`);
  const started = performance.now();
  try {
    await loadModel({ variant, onProgress(report) {
      if (Number.isFinite(report.progress)) $("progress").value = Math.min(1, Math.max(0, report.progress));
      else $("progress").removeAttribute("value");
      // Keep frequent progress updates out of the live status region.
      $("progress-detail").textContent = report.text;
    } });
    $("model-panel").hidden = true;
    $("metrics").textContent = `Model ready in ${((performance.now() - started) / 1000).toFixed(1)}s.`;
    setState("ready", `${getModel(variant).name} · Ready · on-device`);
    prompt.focus();
  } catch (error) {
    // Initialization errors don't enable the composer, even though the visible
    // status is an error. The only available action is loading again.
    setState("load-error", "Model could not load");
    mustRestart = Boolean(error.reloadRequired);
    $("restart").hidden = !mustRestart;
    showError(error, "Check your connection, GPU support, and available memory.");
    loadButton.textContent = `Retry loading ${getModel(variant).name}`;
    loadButton.disabled = mustRestart;
    variantSelect.disabled = Boolean(conversation.pending || conversation.history.length);
  } finally {
    $("loading-progress").hidden = true;
  }
}

loadButton.addEventListener("click", initializeModel);
prompt.addEventListener("input", () => {
  sendButton.disabled = !["ready", "error"].includes(state) || mustRestart || !prompt.value.trim();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!["ready", "error"].includes(state) || mustRestart || !prompt.value.trim()) return;
  let request;
  try {
    request = conversation.begin(prompt.value, { systemPrompt: CHAT_SYSTEM_PROMPT });
  } catch (error) {
    showError(error);
    return;
  }
  $("error-panel").hidden = true;
  $("announcement").textContent = "";
  $("metrics").textContent = "";
  $("context-notice").hidden = !request.trimmed;
  followLatest = true;
  const reply = renderConversation();
  updateScroll();
  setState("generating", "Generating locally…");
  const started = performance.now();
  let firstToken;
  let truncated = false;
  try {
    const answer = await generateReply(request.messages, { onToken(token) {
      firstToken ??= performance.now();
      conversation.append(token);
      reply.body.textContent = conversation.pending.partial;
      updateScroll();
    }, onContextTrim() { $("context-notice").hidden = false; }, onFinish({ finishReason }) { truncated = finishReason === "length"; } });
    conversation.complete(answer, { truncated });
    reply.body.textContent = answer;
    reply.note.textContent = truncated ? "Reply reached the length limit. Ask a follow-up to continue." : "";
    prompt.value = "";
    setState("ready", `${getModel(variant).name} · Ready · on-device`);
    $("announcement").textContent = `${getModel(variant).name}: ${answer}`;
    const elapsed = ((performance.now() - started) / 1000).toFixed(1);
    $("metrics").textContent = firstToken === undefined ? `Response in ${elapsed}s.` : `First text ${((firstToken - started) / 1000).toFixed(1)}s · Response ${elapsed}s · Up to 256 tokens per reply`;
  } catch (error) {
    conversation.fail();
    mustRestart = Boolean(error.reloadRequired);
    reply.item.classList.add("message--error");
    reply.note.textContent = "Incomplete reply. This text will not be used as conversation context.";
    setState("error", "Response interrupted");
    showError(error, mustRestart ? "Your conversation and message are still here." : "Edit your message or select Retry response.");
    $("restart").hidden = !mustRestart;
  } finally {
    reply.body.setAttribute("aria-busy", "false");
    updateScroll();
    // Avoid moving focus away from someone reading earlier replies.
    if (document.activeElement === sendButton) prompt.focus();
  }
});

prompt.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

$("restart").addEventListener("click", () => {
  try {
    // Only an explicit runtime restart writes a one-use recovery copy. Routine
    // chat persistence is deferred; ordinary refresh still clears the chat.
    if (conversation.pending) sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ variant, conversation: conversation.snapshot() }));
    location.reload();
  } catch {
    showError(new Error("Browser storage is unavailable or full. Copy your conversation and prompt before manually reloading. The page has not been restarted."));
  }
});

try {
  const saved = sessionStorage.getItem(RECOVERY_KEY);
  if (saved) {
    const snapshot = JSON.parse(saved);
    // Liquid recovery uses its own key; older-model snapshots are not relabeled.
    const recoveredVariant = snapshot.variant ?? DEFAULT_VARIANT;
    getModel(recoveredVariant);
    conversation = Conversation.restore(snapshot.conversation ?? snapshot);
    variant = recoveredVariant;
    variantSelect.value = variant;
    sessionStorage.removeItem(RECOVERY_KEY);
    prompt.value = conversation.pending.text;
    renderConversation();
    followLatest = true;
    updateScroll();
    $("announcement").textContent = "Conversation recovered. Load ChatChap, then retry your message.";
  }
} catch {
  showError(new Error("A recovery copy could not be read. Routine conversation history is not saved yet."));
}

describeModel();

try {
  await checkSupport();
  setState("not-loaded", conversation.pending ? "Recovered · load model to retry" : "Model not loaded");
  loadButton.disabled = false;
  variantSelect.disabled = Boolean(conversation.pending || conversation.history.length);
} catch (error) {
  setState("unsupported", "Local AI unavailable");
  showError(error);
}
