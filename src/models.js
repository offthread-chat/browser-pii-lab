export const MODELS = [
  {
    key: "gravitee",
    name: "BERT small · PII",
    id: "gravitee-io/bert-small-pii-detection",
    revision: "f8c27a85c51c0168f07b9dcf00265bf0a4097939",
    sizeMB: 27,
    scope: "PII-specific; Offthread model",
    dtype: "fp32",
    subfolder: "",
    file: "model.quant",
  },
  {
    key: "bert",
    name: "BERT base · NER",
    id: "Xenova/bert-base-NER",
    revision: "8e892123e8b7c2c0c2bd1dcb598b7d244c4e53aa",
    sizeMB: 109,
    scope: "General NER: person, organization, location; MISC excluded",
    dtype: "q8",
    subfolder: "onnx",
    file: "model",
  },
  {
    key: "distilbert",
    name: "DistilBERT multilingual · NER",
    id: "Xenova/distilbert-base-multilingual-cased-ner-hrl",
    revision: "c2a4dbf593c57f47004c5bc2d3770d311aee9c43",
    sizeMB: 135,
    scope:
      "Multilingual NER: person, organization, location; Chinese is an exploratory slice",
    dtype: "q8",
    subfolder: "onnx",
    file: "model",
  },
];
export function modelFor(key) {
  const m = MODELS.find((m) => m.key === key);
  if (!m) throw new Error("Unknown model");
  return m;
}
export const CONFIG = {
  version: "0.1.0",
  backend: "wasm",
  threads: 1,
  minScore: 0.45,
  chunkTokenBudget: 320,
  maxChars: 20000,
  alignment: "Offthread WordPiece heuristics; shared across models",
  hybrid:
    "deduplicate exact span+type, regex provenance wins ties; retain differing types; union intervals for masking",
  commonTypes: ["PERSON_NAME", "ORGANIZATION", "LOCATION"],
};
