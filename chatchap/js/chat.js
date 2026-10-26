// Lightweight UTF-8 prefilter for bounded requests; the model adapter then
// counts the actual Liquid template tokens and trims whole older exchanges.
// Allows room for character/style guidance; actual template remains capped at
// 2,048 tokens by model.js. This byte bound is not a token estimate.
export const CONTEXT_BUDGET = 6000;
const encoder = new TextEncoder();
const cost = (message) => encoder.encode(message.content).length + 32;

export class Conversation {
  history = [];
  pending = null;

  begin(text, { systemPrompt = "" } = {}) {
    text = text.trim();
    if (!text) throw new Error("Enter a message first.");
    const systemCost = systemPrompt ? cost({ content: systemPrompt }) : 0;
    if (text.length > 1000 || cost({ content: text }) + systemCost > CONTEXT_BUDGET) {
      throw new Error("This message is too long for the local model. Shorten it; some languages need fewer than 1,000 characters to fit with the assistant's instructions.");
    }
    if (this.pending?.state === "streaming") throw new Error("A response is already being generated.");
    // Retrying replaces the failed exchange, including any edited prompt.
    this.pending = { text, partial: "", state: "streaming", timestamp: new Date().toISOString() };
    return this.context({ systemPrompt });
  }

  context({ systemPrompt = "" } = {}) {
    if (!this.pending) throw new Error("No pending message.");
    const current = { role: "user", content: this.pending.text };
    const system = systemPrompt ? [{ role: "system", content: systemPrompt }] : [];
    let used = cost(current) + system.reduce((total, message) => total + cost(message), 0);
    let start = this.history.length;
    for (let i = this.history.length - 2; i >= 0; i -= 2) {
      const pairCost = this.history.slice(i, i + 2).reduce((total, message) => total + cost(message), 0);
      if (used + pairCost > CONTEXT_BUDGET) break;
      used += pairCost;
      start = i;
    }
    return {
      messages: [...system, ...this.history.slice(start).map(({ role, content }) => ({ role, content })), current],
      trimmed: start > 0,
    };
  }

  append(token) {
    if (this.pending?.state === "streaming") this.pending.partial += token;
  }

  complete(reply, { truncated = false } = {}) {
    if (!this.pending || !reply.trim()) throw new Error("The model returned an empty response. Retry your message.");
    this.history.push(
      { role: "user", content: this.pending.text, timestamp: this.pending.timestamp },
      { role: "assistant", content: reply, timestamp: new Date().toISOString(), truncated },
    );
    this.pending = null;
  }

  fail() {
    if (this.pending) this.pending.state = "error";
  }

  snapshot() {
    return { history: this.history, pending: this.pending };
  }

  static restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.history) || snapshot.history.length % 2 !== 0) {
      throw new Error("The recovery copy is invalid.");
    }
    const history = snapshot.history.map((message, index) => {
      if (message?.role !== (index % 2 ? "assistant" : "user") || typeof message.content !== "string" || typeof message.timestamp !== "string") {
        throw new Error("The recovery copy contains an invalid message.");
      }
      return { role: message.role, content: message.content, timestamp: message.timestamp, ...(message.role === "assistant" ? { truncated: Boolean(message.truncated) } : {}) };
    });
    const pending = snapshot.pending;
    if (!pending || typeof pending.text !== "string" || typeof pending.partial !== "string" || typeof pending.timestamp !== "string") {
      throw new Error("The recovery copy has no valid retry message.");
    }
    const conversation = new Conversation();
    conversation.history = history;
    conversation.pending = { text: pending.text, partial: pending.partial, timestamp: pending.timestamp, state: "error" };
    return conversation;
  }
}
