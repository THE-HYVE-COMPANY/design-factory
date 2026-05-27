import { streamClaude, claudeOnce, type StreamCallbacks } from "@/lib/claude-bridge";

export interface ProjectContext {
  projectPath: string;
  primaryFile: string;
  mode: "wireframe" | "hifi";
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  hasDesignSystem: boolean;
}

// ─── PP-01: generate_base ───────────────────────────────────────────────────
// Trigger: chat message → send
// Streams HTML/CSS/JS rendered into the canvas iframe

const GENERATE_BASE_SYSTEM = (ctx: ProjectContext) => `
Você está no Design Factory — canvas de design local.
Seu output é código HTML/CSS/JS renderizado num iframe ao vivo.
Responda SOMENTE com código. Sem explicações, sem markdown fences.

Projeto: ${ctx.projectPath}
Arquivo primário: ${ctx.primaryFile}
Modo: ${ctx.mode === "wireframe" ? "Wireframe (esqueleto cinza, sem cores refinadas)" : "High fidelity (componentes polidos, tipografia e cores aplicadas)"}
${ctx.hasDesignSystem ? "Design system disponível no projeto. Use tokens var(--lab-*) quando aplicável." : ""}

Regras:
- Entregue código completo e funcional — não resumos nem skeletons
- HTML semântico, CSS moderno (custom properties, flexbox/grid)
- Sem frameworks externos — vanilla HTML/CSS/JS apenas
- Responsive — funciona em qualquer largura de iframe
`.trim();

export async function generateBase(
  userPrompt: string,
  ctx: ProjectContext,
  callbacks: StreamCallbacks
) {
  const history = ctx.conversationHistory
    .map((m) => `${m.role === "user" ? "Usuário" : "Claude"}: ${m.content}`)
    .join("\n");

  const prompt = history ? `${history}\nUsuário: ${userPrompt}` : userPrompt;

  return streamClaude(prompt, {
    systemPrompt: GENERATE_BASE_SYSTEM(ctx),
    model: "opus",
  }, callbacks);
}

// ─── PP-02: apply_style ─────────────────────────────────────────────────────
// Trigger: "estilizar" button or style description in chat

const APPLY_STYLE_SYSTEM = `
Você recebe HTML existente e uma descrição de mudança de estilo.
Aplique a mudança e retorne o HTML completo modificado.
Somente o código. Sem explicações.
`.trim();

export async function applyStyle(
  styleDescription: string,
  currentHtml: string,
  callbacks: StreamCallbacks
) {
  const prompt = `HTML atual:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nMudança de estilo: ${styleDescription}`;
  return streamClaude(prompt, { systemPrompt: APPLY_STYLE_SYSTEM }, callbacks);
}

// ─── PP-03: edit_element ────────────────────────────────────────────────────
// Trigger: element selected → edit instruction

const EDIT_ELEMENT_SYSTEM = `
Você recebe HTML existente, um seletor CSS e uma instrução de edição.
Aplique a mudança SOMENTE no elemento selecionado.
Retorne o HTML completo modificado. Somente o código.
`.trim();

export async function editElement(
  selector: string,
  instruction: string,
  currentHtml: string,
  callbacks: StreamCallbacks
) {
  const prompt = `HTML atual:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nElemento: ${selector}\nInstrução: ${instruction}`;
  return streamClaude(prompt, { systemPrompt: EDIT_ELEMENT_SYSTEM }, callbacks);
}

// ─── PP-04: add_component ───────────────────────────────────────────────────
// Trigger: "adicionar componente" or component palette drag

const ADD_COMPONENT_SYSTEM = `
Você recebe HTML existente e uma descrição de componente a adicionar.
Insira o componente na posição mais lógica do layout.
Retorne o HTML completo modificado. Somente o código.
`.trim();

export async function addComponent(
  componentDescription: string,
  currentHtml: string,
  callbacks: StreamCallbacks
) {
  const prompt = `HTML atual:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nAdicionar: ${componentDescription}`;
  return streamClaude(prompt, { systemPrompt: ADD_COMPONENT_SYSTEM }, callbacks);
}

// ─── PP-05: export_prep ─────────────────────────────────────────────────────
// Trigger: Export button → format selection

type ExportFormat = "html" | "react" | "vue" | "tailwind";

const EXPORT_PREP_SYSTEM = (format: ExportFormat) =>
  ({
    html: "Retorne HTML limpo, minificado, self-contained (CSS e JS inline). Sem comentários.",
    react: "Converta o HTML para um componente React funcional com TypeScript. Props para os valores configuráveis. Tailwind classes para estilização.",
    vue: "Converta para um Single File Component Vue 3 com <script setup> + TypeScript.",
    tailwind: "Reescreva o CSS usando classes Tailwind v3. Mantenha o HTML semântico.",
  })[format];

export async function exportPrep(
  currentHtml: string,
  format: ExportFormat
): Promise<string> {
  return claudeOnce(
    `HTML:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nConverta para o formato solicitado.`,
    { systemPrompt: EXPORT_PREP_SYSTEM(format) }
  );
}
