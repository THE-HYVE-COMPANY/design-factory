import { streamOllama, ollamaOnce, fetchOllamaModels } from "@/lib/ollama-bridge";
import type { LLMProvider } from "./types";

// Ollama adapter — talks to a local Ollama server (default :11434) for fully
// local inference. No CLI spawn, no API key, no cloud. Tools/MCP/skills are
// all false: Ollama is plain chat completion. The /tweaks skill, slash menu,
// and other tool-calling features won't reach this provider.

export const ollamaProvider: LLMProvider = {
  meta: {
    id: "ollama",
    label: "Ollama",
    blurb: "Local weights — Llama, Qwen, Mistral, Hermes. Free, fully local, no accounts.",
    binary: "ollama",
  },
  capabilities: {
    tools: false,
    mcp: false,
    nativeSkills: false,
    nativeAgents: false,
    streamJson: false,
    // local Ollama is plain chat completion. Runtime parses
    // `<artifact>` and writes via the daemon.
    fileWrite: "artifact",
    // Ollama is plain chat completion — no native session resume. 
    // 3B always sends the canonical handoff preamble for this provider.
    supportsResume: false,
  },
  stream: streamOllama,
  once: ollamaOnce,
  async status() {
    // Ollama isn't a CLI we shell out to — it's a server. Probe by listing
    // models (the daemon endpoint catches connection errors).
    const models = await fetchOllamaModels();
    if (models.length === 0) {
      return { status: "not-installed", version: null, detail: "Ollama server unreachable on :11434 or no models pulled" };
    }
    return { status: "connected", version: `${models.length} model${models.length === 1 ? "" : "s"}` };
  },
};
