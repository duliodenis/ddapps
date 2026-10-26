// User-selected main model. The smaller Liquid model remains evaluation-only.
export const DEFAULT_VARIANT = "liquid";
export const MODELS = Object.freeze({
  liquid: Object.freeze({
    name: "ChatChap", parameters: "1.2B", provider: "Liquid AI",
    modelId: "LiquidAI/LFM2.5-1.2B-Instruct-ONNX",
    revision: "10f72e70abf67ac0fd7ebf15bc5854726891d864", dtype: "q4f16",
    weightBytes: 760_461_835,
    description: "LFM2.5-1.2B-Instruct by Liquid AI. Useful for supplied-text tasks; factual answers can still be wrong.",
  }),
});
export function getModel(variant) {
  if (!Object.hasOwn(MODELS, variant)) throw new Error("This chat uses the supported Liquid 1.2B model. Reload to start a new session.");
  return MODELS[variant];
}
