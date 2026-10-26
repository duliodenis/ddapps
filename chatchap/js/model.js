import { DEFAULT_VARIANT, getModel } from "./models.js";

export const RUNTIME_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
export const GENERATION_SETTINGS = Object.freeze({ do_sample: true, temperature: 0.1, top_k: 50, top_p: 1, repetition_penalty: 1.05, max_new_tokens: 256 });
const INPUT_LIMIT = 2048;
let runtime, tokenizer, model, loading = false, generating = false, reloadRequired = false;

function restartError(message) {
  const error = new Error(`${message} Restart the model to retry; your conversation remains on this page.`);
  error.reloadRequired = true;
  return error;
}
export function isModelReady() { return Boolean(model) && !reloadRequired; }

export async function checkSupport() {
  if (!globalThis.isSecureContext) throw new Error("Open this app through http://localhost or HTTPS. WebGPU requires a secure context.");
  if (!navigator.gpu) throw new Error("WebGPU is unavailable. Try a supported Chrome or Edge browser with hardware acceleration enabled.");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No compatible WebGPU adapter was found on this device.");
  if (!adapter.features.has("shader-f16")) throw new Error("This model requires the GPU feature shader-f16, which this browser/device does not expose.");
}

export async function loadModel({ variant = DEFAULT_VARIANT, onProgress } = {}) {
  const config = getModel(variant);
  if (reloadRequired) throw restartError("Reload the page to restart the GPU runtime.");
  if (loading || generating) throw new Error("The model is busy. Wait for the current operation.");
  if (model) return;
  loading = true;
  let timer;
  let active = true;
  try {
    await checkSupport();
    onProgress?.({ text: "Downloading inference runtime…" });
    await Promise.race([
      (async () => {
        runtime = await import(RUNTIME_URL);
        if (!active) return;
        runtime.env.allowLocalModels = false;
        const options = { revision: config.revision, progress_callback(event) {
          if (!active) return;
          const fraction = event.status === "progress" && event.total > 0 ? event.loaded / event.total : undefined;
          onProgress?.({ progress: fraction, text: `${event.status ?? "Loading"}: ${event.file ?? event.name ?? "model"}${fraction === undefined ? "" : ` — ${(event.loaded / 1e6).toFixed(1)} / ${(event.total / 1e6).toFixed(1)} MB (current file)`}` });
        } };
        tokenizer = await runtime.AutoTokenizer.from_pretrained(config.modelId, options);
        if (!active) return;
        const candidate = await runtime.AutoModelForCausalLM.from_pretrained(config.modelId, { ...options, device: "webgpu", dtype: config.dtype });
        if (!active) { await candidate.dispose(); return; }
        model = candidate;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Initialization exceeded ten minutes.")), 600000); }),
    ]);
  } catch (error) {
    reloadRequired = true;
    throw restartError(error.message || String(error));
  } finally { active = false; clearTimeout(timer); loading = false; }
}

// Tokenize the entire template, including any system message. Trim whole older
// exchanges, never the current question or instructions; visible history stays.
function prepareContext(messages) {
  const context = messages.map((message) => ({ ...message }));
  let trimmed = false;
  while (true) {
    const input = tokenizer.apply_chat_template(context, { add_generation_prompt: true, return_dict: true });
    if (input.input_ids.dims[1] <= INPUT_LIMIT) return { input, trimmed };
    const start = context[0]?.role === "system" ? 1 : 0;
    if (context.length - start < 3 || context[start]?.role !== "user" || context[start + 1]?.role !== "assistant") {
      const error = new Error("Your message and instructions exceed the model's 2,048-token input limit. Shorten your message and retry.");
      error.inputTooLong = true;
      throw error;
    }
    context.splice(start, 2);
    trimmed = true;
  }
}

export async function generateReply(messages, { onToken, onFinish, onContextTrim, signal, temperature = GENERATION_SETTINGS.temperature } = {}) {
  if (!isModelReady()) throw new Error("Load the model before generating a response.");
  if (generating) throw new Error("A response is already being generated.");
  if (!Number.isFinite(temperature) || temperature <= 0 || temperature > 1) throw new Error("Temperature must be greater than zero and at most one.");
  signal?.throwIfAborted();
  generating = true;
  let active = true, timer, abort, stopping;
  try {
    const { input, trimmed } = prepareContext(messages);
    if (trimmed) onContextTrim?.();
    stopping = new runtime.InterruptableStoppingCriteria();
    const criteria = new runtime.StoppingCriteriaList();
    criteria.push(stopping);
    const streamer = new runtime.TextStreamer(tokenizer, { skip_prompt: true, skip_special_tokens: true, callback_function(text) {
      if (active && text) onToken?.(text);
    } });
    const interruption = new Promise((_, reject) => {
      const interrupt = (message) => { active = false; reloadRequired = true; stopping.interrupt(); reject(restartError(message)); };
      timer = setTimeout(() => interrupt("Generation exceeded the two-minute limit."), 120000);
      abort = () => interrupt("Generation was cancelled.");
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
    const output = await Promise.race([
      model.generate({ ...input, ...GENERATION_SETTINGS, temperature, streamer, stopping_criteria: criteria }),
      interruption,
    ]);
    if (!active) throw restartError("Generation was interrupted.");
    const ids = output.tolist()[0].slice(input.input_ids.dims[1]).map(Number);
    const reply = tokenizer.decode(ids, { skip_special_tokens: true });
    if (!reply.trim()) throw new Error("The model returned an empty response.");
    const eos = model.generation_config.eos_token_id ?? tokenizer.eos_token_id;
    const ended = (Array.isArray(eos) ? eos : [eos]).includes(ids.at(-1));
    onFinish?.({ finishReason: ended ? "stop" : ids.length >= GENERATION_SETTINGS.max_new_tokens ? "length" : "stop" });
    return reply;
  } catch (error) {
    if (!error.inputTooLong) { reloadRequired = true; error.reloadRequired = true; }
    throw error;
  } finally { active = false; clearTimeout(timer); signal?.removeEventListener("abort", abort); generating = false; }
}
