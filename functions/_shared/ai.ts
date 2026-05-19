import type { Env } from "./env";
import { ApiError } from "./http";
import { getCurrentUser } from "./auth";
import { queryFirst } from "./d1";

export type AiTask = "summary" | "format" | "polish" | "tags" | "translate";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface AiTextInput {
  title?: string;
  summary?: string;
  contentText?: string;
  contentJson?: unknown;
  articleId?: string;
}

export interface AiTranslateInput extends AiTextInput {
  title: string;
}

export interface AiTranslateResult {
  title: string;
  summary: string;
  contentText: string;
  contentJson: TiptapDoc;
  model: string;
}

export interface TiptapTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapTextNode {
  type: "text";
  text: string;
  marks?: TiptapTextMark[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<TiptapNode | TiptapTextNode>;
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MAX_INPUT_CHARS = 16_000;
const FORMAT_MAX_TOKENS = 6_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEV_AI_USER_ID = "dev_local_ai";
const DEV_AI_GITHUB_ID = "dev-local-ai";
const DEV_AI_GITHUB_LOGIN = "local-ai-dev";
const MAX_ERROR_MESSAGE_CHARS = 2_000;
const ALLOWED_NODE_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
]);
const ALLOWED_TEXT_MARKS = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "link",
  "underline",
  "subscript",
  "superscript",
  "highlight",
  "textStyle",
]);
const SAFE_MEDIA_PATH_PATTERN = /^\/api\/cms\/media(?:\/|$|\?)/;
const SAFE_COLOR_PATTERN =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\)|hsla?\(\s*-?(?:\d+(?:\.\d+)?)(?:deg|grad|rad|turn)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\))$/i;

interface AiAuditActor {
  userId: string;
}

interface ExecuteAiTaskWithAuditOptions<Input extends AiTextInput, Result> {
  request: Request;
  env: Env;
  db: D1Database;
  task: AiTask;
  readInput?: (value: unknown) => Input;
  run: (input: Input) => Promise<Result>;
  mapSuccess: (result: Result) => {
    model: string;
    outputJson?: unknown;
    outputText?: string;
  };
}

export async function requireAiAccess(request: Request, env: Env, db: D1Database): Promise<AiAuditActor> {
  const user = await getCurrentUser(request, env, db);

  if (user?.isAdmin) {
    return { userId: user.id };
  }

  const enabled = env.AI_ALLOW_UNAUTHENTICATED_DEV === "true";
  const host = new URL(request.url).hostname;

  if (enabled && LOCAL_HOSTS.has(host)) {
    return ensureLocalDevAiUser(db);
  }

  throw new ApiError(
    403,
    "FORBIDDEN",
    "Admin permission is required. For local testing only, set AI_ALLOW_UNAUTHENTICATED_DEV=true.",
  );
}

export function readAiTextInput(value: unknown): AiTextInput {
  if (!value || typeof value !== "object") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const title = normalizeText(body.title, 200);
  const contentText = normalizeText(body.contentText ?? body.content, MAX_INPUT_CHARS);
  const articleId = normalizeOptionalId(body.articleId ?? body.article_id);

  if (!contentText) {
    throw new ApiError(400, "VALIDATION_ERROR", "contentText is required.");
  }

  return {
    title,
    contentText,
    articleId,
  };
}

export function readAiTranslateInput(value: unknown): AiTranslateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const title = normalizeText(body.title, 200);
  const summary = normalizeText(body.summary, 500);
  const contentText = normalizeText(body.contentText ?? body.content, MAX_INPUT_CHARS);
  const articleId = normalizeOptionalId(body.articleId ?? body.article_id);
  const contentJson = body.contentJson;

  if (!title) {
    throw new ApiError(400, "VALIDATION_ERROR", "title is required.");
  }

  if (!summary && !contentText && contentJson === undefined) {
    throw new ApiError(400, "VALIDATION_ERROR", "summary, contentText or contentJson is required.");
  }

  return {
    title,
    summary,
    contentText,
    contentJson,
    articleId,
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export async function executeAiTaskWithAudit<Input extends AiTextInput, Result>({
  request,
  env,
  db,
  task,
  readInput,
  run,
  mapSuccess,
}: ExecuteAiTaskWithAuditOptions<Input, Result>): Promise<Result> {
  const actor = await requireAiAccess(request, env, db);
  const rawBody = await request.text();
  const inputHash = await sha256Hex(rawBody);
  let articleId: string | null = null;

  try {
    const input = (readInput ?? readAiTextInput)(parseJsonText(rawBody)) as Input;
    articleId = await resolveArticleIdForAudit(db, input.articleId);

    const result = await run(input);
    const success = mapSuccess(result);

    await insertAiOutput(db, {
      articleId,
      userId: actor.userId,
      task,
      model: success.model,
      inputHash,
      outputJson: success.outputJson === undefined ? null : JSON.stringify(success.outputJson),
      outputText: success.outputText ?? null,
      status: "success",
      errorMessage: null,
    });

    return result;
  } catch (error) {
    await tryInsertAiFailure(db, {
      articleId,
      userId: actor.userId,
      task,
      model: resolveModel(env, task),
      inputHash,
      errorMessage: truncateText(getErrorMessage(error), MAX_ERROR_MESSAGE_CHARS) || "Unknown AI error.",
    });

    throw error;
  }
}

export async function generateSummary(env: Env, input: AiTextInput): Promise<{ summary: string; model: string }> {
  const content = await runChat(env, "summary", [
    {
      role: "system",
      content:
        "你是个人技术博客的中文编辑。请保持克制、准确、自然，不要营销腔。只输出摘要文本。",
    },
    {
      role: "user",
      content: `标题：${input.title || "未命名文章"}\n\n正文：\n${input.contentText}\n\n请生成 80 到 160 字中文摘要。`,
    },
  ]);

  return {
    summary: compactText(content).slice(0, 240),
    model: resolveModel(env, "summary"),
  };
}

export async function generateTags(env: Env, input: AiTextInput): Promise<{ tags: string[]; model: string }> {
  const content = await runChat(env, "tags", [
    {
      role: "system",
      content: "你是博客内容分类助手。只输出 JSON 字符串数组，不要 Markdown，不要解释。",
    },
    {
      role: "user",
      content: `标题：${input.title || "未命名文章"}\n\n正文：\n${input.contentText}\n\n请生成 3 到 6 个中文或技术英文标签。`,
    },
  ]);

  const parsed = parseJsonFromText(content);
  const tags = Array.isArray(parsed)
    ? parsed
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6)
    : [];

  if (tags.length === 0) {
    throw new ApiError(502, "AI_FAILED", "AI did not return valid tags.");
  }

  return {
    tags: [...new Set(tags)],
    model: resolveModel(env, "tags"),
  };
}

export async function polishText(env: Env, input: AiTextInput): Promise<{ text: string; model: string }> {
  const content = await runChat(env, "polish", [
    {
      role: "system",
      content:
        "你是个人博客的中文编辑。保持作者原意和克制语气，修顺表达，不扩写事实。只输出润色后的正文。",
    },
    {
      role: "user",
      content: `标题：${input.title || "未命名文章"}\n\n请润色下面这段文字：\n${input.contentText}`,
    },
  ]);

  return {
    text: content.trim(),
    model: resolveModel(env, "polish"),
  };
}

export async function formatContent(env: Env, input: AiTextInput): Promise<{ contentJson: TiptapDoc; model: string }> {
  try {
    const content = await runChat(env, "format", [
      {
        role: "system",
        content:
          "你是一个 Tiptap JSON 转换器。只输出一个 JSON 对象，不要 Markdown、代码围栏、解释、HTML、CSS、自定义字段或思考过程。输出必须可被 JSON.parse 解析，根节点必须是 {\"type\":\"doc\",\"content\":[...]}。",
      },
      {
        role: "user",
        content: createFormatPrompt(input),
      },
    ]);

    const parsed = parseJsonFromText(content);
    const contentJson = normalizeTiptapDoc(parsed);

    if (!contentJson) {
      throw new ApiError(502, "AI_FAILED", "AI did not return a supported Tiptap document.");
    }

    return {
      contentJson,
      model: resolveModel(env, "format"),
    };
  } catch (error) {
    console.warn(`[AI WARN][format] falling back to local Tiptap formatter: ${getErrorMessage(error)}`);
  }

  return {
    contentJson: formatPlainTextToTiptapDoc(input.contentText || ""),
    model: `${resolveModel(env, "format")}+local-fallback`,
  };
}

export async function translateContent(env: Env, input: AiTranslateInput): Promise<AiTranslateResult> {
  const sourceDoc = normalizeTiptapDoc(input.contentJson) ?? formatPlainTextToTiptapDoc(input.contentText || "");
  const sourceText = compactText(input.contentText || extractPlainTextFromDoc(sourceDoc));
  const content = await runChat(env, "translate", [
    {
      role: "system",
      content:
        "你是一个技术博客中译英助手。只输出 JSON 对象，不要 Markdown、代码围栏、HTML 或解释。输出字段必须为 title、summary、contentText、contentJson。contentJson 必须是安全的 Tiptap doc JSON，保持原有结构和事实，不翻译 tags，不补充不存在的信息。",
    },
    {
      role: "user",
      content: createTranslatePrompt({
        title: input.title,
        summary: input.summary || "",
        contentText: sourceText,
        contentJson: sourceDoc,
      }),
    },
  ]);

  const parsed = parseJsonFromText(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(502, "AI_FAILED", "AI provider did not return a translation object.");
  }

  const body = parsed as Record<string, unknown>;
  const title = compactText(normalizeText(body.title, 200));
  const summary = compactText(normalizeText(body.summary, 500));
  const contentText = normalizeText(body.contentText ?? body.content, MAX_INPUT_CHARS);
  const contentJson = normalizeTiptapDoc(body.contentJson);

  if (!title) {
    throw new ApiError(502, "AI_FAILED", "AI translation title is empty.");
  }

  if (!contentJson) {
    throw new ApiError(502, "AI_FAILED", "AI translation contentJson is invalid.");
  }

  return {
    title,
    summary,
    contentText: contentText || extractPlainTextFromDoc(contentJson),
    contentJson,
    model: resolveModel(env, "translate"),
  };
}

async function runChat(env: Env, task: AiTask, messages: ChatMessage[]): Promise<string> {
  const apiKey = env.AI_API_KEY;

  if (!apiKey) {
    throw new ApiError(503, "AI_NOT_CONFIGURED", "AI_API_KEY is not configured.");
  }

  const baseUrl = (env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const requestPayload = {
    model: resolveModel(env, task),
    messages,
    temperature: task === "format" ? 0 : 0.5,
    max_tokens: task === "format" ? FORMAT_MAX_TOKENS : 700,
    ...(task === "format" ? { response_format: { type: "json_object" } } : {}),
  };
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  const rawResponseText = await response.text();
  const providerPayload = parseProviderJson(rawResponseText);

  if (!response.ok) {
    console.error(
      `[AI ERROR][${task}] provider status ${response.status}; raw response preview:\n${previewText(rawResponseText)}`,
    );
    throw new ApiError(
      response.status,
      "AI_FAILED",
      providerPayload?.error?.message || "AI provider request failed.",
    );
  }

  const choice = providerPayload?.choices?.[0];
  const content = choice?.message?.content?.trim();

  if (!content) {
    const reasoningPreview = choice?.message?.reasoning_content
      ? `\nreasoning preview:\n${previewText(choice.message.reasoning_content)}`
      : "";
    console.error(
      `[AI ERROR][${task}] provider returned empty content; status ${response.status}; finish_reason ${choice?.finish_reason || "unknown"}; raw response preview:\n${previewText(rawResponseText)}${reasoningPreview}`,
    );
    throw new ApiError(
      502,
      "AI_FAILED",
      "AI provider returned no final content. Please use a non-reasoning chat model for AI formatting, or increase the provider output budget.",
    );
  }

  debugLogAiResponse(env, task, content);
  return content;
}

function resolveModel(env: Env, task: AiTask): string {
  if (task === "summary") {
    return env.AI_MODEL_SUMMARY || DEFAULT_MODEL;
  }
  if (task === "format") {
    return env.AI_MODEL_FORMAT || DEFAULT_MODEL;
  }
  if (task === "polish") {
    return env.AI_MODEL_POLISH || DEFAULT_MODEL;
  }
  if (task === "tags") {
    return env.AI_MODEL_TAGS || DEFAULT_MODEL;
  }
  if (task === "translate") {
    return env.AI_MODEL_TRANSLATE || env.AI_MODEL_FORMAT || DEFAULT_MODEL;
  }

  return DEFAULT_MODEL;
}

function normalizeOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 120) : undefined;
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return stripLineLeadingWhitespace(value).trim().slice(0, maxLength);
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseJsonText(value: string): unknown {
  if (!value.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function parseJsonFromText(value: string): unknown {
  const trimmed = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fencedMatch?.[1]?.trim() ?? extractFirstJsonObject(trimmed) ?? trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new ApiError(502, "AI_FAILED", "AI provider did not return valid JSON.");
  }
}

function createFormatPrompt(input: AiTextInput): string {
  const source = JSON.stringify(
    {
      title: input.title || "未命名文章",
      text: input.contentText,
    },
    null,
    2,
  );

  return [
    "把输入 JSON 的 text 字段整理为 Tiptap doc JSON。",
    "总原则：只做排版结构化，保留原文事实、语气、顺序和代码内容；不要扩写、总结、删减、重写、补充不存在的内容。",
    "只允许这些节点：doc、paragraph、heading、bulletList、orderedList、listItem、blockquote、codeBlock、horizontalRule、table、tableRow、tableHeader、tableCell、image、text。",
    "只允许这些 marks：bold、italic、strike、code、link、underline、subscript、superscript、highlight、textStyle。",
    "heading 允许 attrs.level 1 到 6，但默认克制使用：只有明确是标题层级时才用 heading，普通段落不要硬转标题。",
    "paragraph、heading、blockquote 只允许 attrs.textAlign，值只能是 left、center、right。",
    "paragraph 和 heading 的 content 只能包含 text 节点。",
    "blockquote 的 content 必须包含 paragraph、heading、bulletList、orderedList、codeBlock、table、image 等块节点，优先简单 paragraph。",
    "bulletList 和 orderedList 的 content 必须包含 listItem；listItem 的 content 必须包含 paragraph 等块节点。",
    "codeBlock 的 content 只能包含 text 节点。",
    "table 的 content 只能包含 tableRow；tableRow 只能包含 tableHeader 或 tableCell；单元格 content 只能包含 paragraph、heading、bulletList、orderedList、blockquote、codeBlock、image 等块节点，优先简单 paragraph。",
    "image 只允许 attrs.src、attrs.alt、attrs.title；src 只能是 http/https URL 或以 /api/cms/media 开头的站内路径。",
    "link mark 的 href 只能是 http/https URL 或以 /api/cms/media 开头的站内路径。",
    "textStyle 只允许 attrs.color；highlight 只允许 attrs.color。颜色尽量使用简洁十六进制值，例如 #2563eb 或 #fde68a。",
    "不要输出任何 style、class、id、script、on*、dataset、html、markdown、自定义节点或自定义 attrs。",
    "",
    "标题规则：",
    "1. 独立成段、较短、像章节名的小段才使用 heading，不要把普通长句变成 heading。",
    "2. `#` 到 `######` 这类 Markdown 标题，分别映射到对应 level 1 到 6。",
    "3. `一、二、三、四、五、六、七、八、九、十、` 这类中文大章标题通常使用 heading level 2。",
    "4. `1.1 xxx`、`1.2 xxx`、`2. 常用方法`、`### xxx` 这类小节标题通常使用 heading level 3。",
    "5. level 4 到 6 只在原文已经明显存在更深层级时使用，不要为了样式好看主动下钻。",
    "6. `实现原理：`、`典型场景：`、`优缺点：`、`特点：`、`使用样例：` 这类短标签如果后面紧接解释或列表，通常用 paragraph，并可对标签文字加 bold mark；不要滥用 heading。",
    "7. 以句号、问号、感叹号结尾的完整叙述句通常是 paragraph，不是 heading。",
    "",
    "代码块规则：",
    "1. 明确代码围栏 ``` 内的内容必须使用 codeBlock，去掉围栏本身。",
    "2. 连续出现的代码行应合并到同一个 codeBlock，不要一行一个 codeBlock。",
    "3. 以下内容应使用 codeBlock：import/export/const/let/var/type/interface/class/function/return/if/for/while/switch/catch 开头的行；以 //、/*、*/、#、<!-- 开头的注释；HTML/Vue 模板标签；JSON/YAML/TOML/SQL 片段；shell 命令；终端输出；报错堆栈；包含 `{}`、`=>`、`;` 且明显是程序代码的片段。",
    "4. codeBlock 内只保留纯文本 text 节点，不要添加 bold、italic、code、link 等 marks。",
    "5. 不要因为普通中文段落里出现英文技术词就整体变成 codeBlock。",
    "",
    "列表规则：",
    "1. 连续多行以 `-`、`*`、`+`、`•`、`✓`、`✗` 开头时使用 bulletList。",
    "2. 连续多行以 `1.`、`2.`、`1)`、`2)`、`1、`、`2、` 开头，且它们是步骤或并列事项时使用 orderedList。",
    "3. `✓ 轻量`、`✗ 全局污染风险` 这类优缺点条目应使用 bulletList，每个符号后的文字放入 listItem paragraph。",
    "4. 如果编号行是独立小节标题，例如 `1.1 事件总线（Mitt）`，使用 heading level 3，不要放进 orderedList。",
    "5. listItem 内可以包含 paragraph、codeBlock、blockquote、子列表；但简单条目只放一个 paragraph。",
    "",
    "引用和提示规则：",
    "1. 以 `>` 开头的段落使用 blockquote。",
    "2. `注：`、`注意：`、`提示：`、`警告：`、`重要：` 开头且像旁注的短段落可以使用 blockquote。",
    "3. 普通正文中的解释性句子不要使用 blockquote。",
    "",
    "文本 marks 规则：",
    "1. bold 只用于明确标签或关键短语，例如 `优点：`、`缺点：`、`注意：`、`实现原理：`；不要整段加粗。",
    "2. code mark 用于行内代码、函数名、变量名、文件名、路径、命令、包名、API 名称，例如 `ref`、`computed`、`event-bus.ts`、`pnpm build`。",
    "3. link mark 只在原文明确给出可点击地址时使用，href 使用原始安全 URL；不要编造链接。",
    "4. italic 只在原文有明确强调语气或 Markdown 斜体标记时使用；不主动制造斜体。",
    "5. strike 只在原文有删除线语义或 `~~text~~` 标记时使用。",
    "6. underline、highlight、textStyle/color 只在原文已经明确强调、标色或需要保留特殊含义时使用；不要为了装饰批量添加。",
    "7. superscript 和 subscript 只用于数学、化学式、脚注编号等确有上下标语义的内容。",
    "8. 不要为了视觉好看大量添加 marks，结构清晰优先。",
    "",
    "表格和图片规则：",
    "1. 只有原文明显是表格、对比矩阵或规则整齐的二维数据时才使用 table；普通列表不要硬转表格。",
    "2. 不要编造图片；只有原文已经包含明确、安全的图片 URL 或站内媒体路径时才输出 image。",
    "3. image 的 alt 和 title 保持简短自然，不要夹带说明文字或额外元数据。",
    "",
    "段落规则：",
    "1. 普通说明、背景、原因、结论、问题描述都使用 paragraph。",
    "2. 空行只表示块分隔，不要生成空 paragraph。",
    "3. 不要输出不在允许 schema 内的 attrs、id、class、style、language、html、markdown 字段。",
    "不要把输入外的说明文字放进结果。",
    `输入 JSON：\n${source}`,
  ].join("\n");
}

function createTranslatePrompt(input: {
  title: string;
  summary: string;
  contentText: string;
  contentJson: TiptapDoc;
}): string {
  const source = JSON.stringify(input, null, 2);

  return [
    "把输入中的中文文章翻译成自然、克制、准确的英文技术博客文本。",
    "要求：",
    "1. 只输出一个 JSON 对象，字段必须为 title、summary、contentText、contentJson。",
    "2. title、summary、contentText 都翻译成英文。",
    "3. contentJson 必须保留为安全的 Tiptap doc，根节点为 doc。",
    "4. 保持原有结构、段落、列表、标题、引用、代码块、链接与图片，不要输出 HTML。",
    "5. 代码块内容、命令、路径、标识符、URL 通常保持原样，只翻译自然语言部分。",
    "6. 不要添加 tags、notes、comments、metadata 等额外字段。",
    "7. 不要补充原文没有的事实。",
    `输入 JSON：\n${source}`,
  ].join("\n");
}

function stripLineLeadingWhitespace(value: string): string {
  return value.replace(/^[\t ]+/gm, "");
}

function formatPlainTextToTiptapDoc(contentText: string): TiptapDoc {
  const blocks = contentText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const content: TiptapNode[] = [];
  const codeLines: string[] = [];
  const bulletItems: string[] = [];
  const orderedItems: string[] = [];
  let insideFencedCode = false;

  const flushCode = () => {
    if (codeLines.length === 0) {
      return;
    }

    content.push({
      type: "codeBlock",
      content: [{ type: "text", text: codeLines.join("\n") }],
    });
    codeLines.length = 0;
  };

  const flushBullets = () => {
    if (bulletItems.length === 0) {
      return;
    }

    content.push({
      type: "bulletList",
      content: bulletItems.map((item) => ({
        type: "listItem",
        content: [createTextBlock("paragraph", item)],
      })),
    });
    bulletItems.length = 0;
  };

  const flushOrdered = () => {
    if (orderedItems.length === 0) {
      return;
    }

    content.push({
      type: "orderedList",
      content: orderedItems.map((item) => ({
        type: "listItem",
        content: [createTextBlock("paragraph", item)],
      })),
    });
    orderedItems.length = 0;
  };

  for (const block of blocks) {
    if (block.startsWith("```")) {
      flushBullets();
      flushOrdered();
      insideFencedCode = !insideFencedCode;
      const codeFenceContent = block.replace(/^```[A-Za-z0-9_-]*\s*/, "").replace(/\s*```$/, "").trim();
      if (codeFenceContent) {
        codeLines.push(codeFenceContent);
      }

      if (!insideFencedCode) {
        flushCode();
      }
      continue;
    }

    if (insideFencedCode) {
      codeLines.push(block);
      continue;
    }

    const headingLevel = detectHeadingLevel(block);

    if (headingLevel) {
      flushCode();
      flushBullets();
      flushOrdered();
      content.push(createTextBlock("heading", block, { level: headingLevel }));
      continue;
    }

    const bulletText = parseBulletText(block);

    if (bulletText) {
      flushCode();
      flushOrdered();
      bulletItems.push(bulletText);
      continue;
    }

    const orderedText = parseOrderedListText(block);

    if (orderedText) {
      flushCode();
      flushBullets();
      orderedItems.push(orderedText);
      continue;
    }

    if (shouldTreatAsCode(block, codeLines.length > 0)) {
      flushBullets();
      flushOrdered();
      codeLines.push(block);
      continue;
    }

    flushCode();
    flushBullets();
    flushOrdered();

    if (block === "---" || block === "***") {
      content.push({ type: "horizontalRule" });
      continue;
    }

    if (block.startsWith(">")) {
      content.push({
        type: "blockquote",
        content: [createTextBlock("paragraph", block.replace(/^>\s?/, ""))],
      });
      continue;
    }

    if (/^(注|注意|提示|警告|重要)[:：]/.test(block) && block.length <= 120) {
      content.push({
        type: "blockquote",
        content: [createTextBlock("paragraph", block)],
      });
      continue;
    }

    content.push(createTextBlock("paragraph", block));
  }

  flushCode();
  flushBullets();
  flushOrdered();

  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

function createTextBlock(type: "paragraph" | "heading", text: string, attrs?: Record<string, unknown>): TiptapNode {
  const node: TiptapNode = {
    type,
    content: createInlineContent(text),
  };

  if (attrs) {
    node.attrs = attrs;
  }

  return node;
}

function createInlineContent(text: string): TiptapTextNode[] {
  const nodes: TiptapTextNode[] = [];
  const tokenPattern =
    /(https?:\/\/[^\s，。！？；）)]+)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*\n]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      nodes.push({
        type: "text",
        text: match[1],
        marks: [{ type: "link", attrs: { href: match[1] } }],
      });
    } else if (match[2]) {
      nodes.push({ type: "text", text: match[2], marks: [{ type: "code" }] });
    } else if (match[3]) {
      nodes.push({ type: "text", text: match[3], marks: [{ type: "bold" }] });
    } else if (match[4]) {
      nodes.push({ type: "text", text: match[4], marks: [{ type: "strike" }] });
    } else if (match[5]) {
      nodes.push({ type: "text", text: match[5], marks: [{ type: "italic" }] });
    }

    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length ? nodes : [{ type: "text", text }];
}

function detectHeadingLevel(block: string): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (block.length > 80 || block.includes("\n")) {
    return null;
  }

  const markdownHeading = block.match(/^(#{1,6})\s+\S+/);
  if (markdownHeading) {
    const marker = markdownHeading[1];
    if (marker) {
      return marker.length as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }

  if (/^[一二三四五六七八九十]+、\S+/.test(block)) {
    return 2;
  }

  if (/^[一二三四五六七八九十]+[.．]\s*\S+/.test(block)) {
    return 3;
  }

  if (/^\d+(?:\.\d+)+\s*\S+/.test(block)) {
    return 3;
  }

  const numberedHeading = block.match(/^\d+[.．]\s*(.+)$/);
  const numberedHeadingText = numberedHeading?.[1] ?? "";
  if (
    numberedHeadingText &&
    block.length <= 36 &&
    !/[。？！.!?]$/.test(block) &&
    /[方法场景要点步骤问题实现示例用法功能处理组件路由弹窗数组对象通信]/.test(numberedHeadingText)
  ) {
    return 3;
  }

  return null;
}

function parseBulletText(block: string): string | null {
  const match = block.match(/^[-*+•✓✗]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

function parseOrderedListText(block: string): string | null {
  if (detectHeadingLevel(block)) {
    return null;
  }

  const match = block.match(/^\d+[.)、]\s+(.+)$/);
  return match?.[1]?.trim() || null;
}

function shouldTreatAsCode(block: string, insideCodeBlock: boolean): boolean {
  if (block.includes("\n")) {
    return block.split("\n").some((line) => shouldTreatAsCode(line.trim(), insideCodeBlock));
  }

  if (!block) {
    return false;
  }

  if (/^(\/\/|\/\*|\*\/|#!|import\s|export\s|const\s|let\s|var\s|type\s|interface\s|class\s|function\s|return\b)/.test(block)) {
    return true;
  }

  if (/^(if|for|while|switch|catch)\s*\(|^(console|window|document|emitter|router|app|pinia)\./.test(block)) {
    return true;
  }

  if (/^<\/?[A-Za-z][^>]*>$/.test(block) || /<\/?[A-Za-z][^>]*>/.test(block)) {
    return true;
  }

  if (/^(pnpm|npm|yarn|npx|git|wrangler)\s+/.test(block)) {
    return true;
  }

  if (/=>|;\s*$|[{}]$/.test(block)) {
    return true;
  }

  if (insideCodeBlock && /^[$\w\u4e00-\u9fa5()[\]{}'",.:+\-*/ <>=@]+,?$/.test(block) && !/[。？！，；：]/.test(block)) {
    return true;
  }

  return false;
}

function debugLogAiResponse(env: Env, task: AiTask, payload: unknown): void {
  if (env.AI_DEBUG_LOG_RESPONSE !== "true") {
    return;
  }

  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  console.log(`[AI DEBUG][${task}] response preview:\n${previewText(text)}`);
}

function parseProviderJson(rawText: string): ChatCompletionResponse | null {
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as ChatCompletionResponse;
  } catch {
    console.error(`[AI ERROR] provider returned non-JSON HTTP response:\n${previewText(rawText)}`);
    return null;
  }
}

function previewText(value: string): string {
  return value.slice(0, 6000) || "<empty body>";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractPlainTextFromDoc(doc: TiptapDoc): string {
  const parts: string[] = [];

  const walk = (node: TiptapNode | TiptapTextNode): void => {
    if (isTiptapTextNode(node)) {
      parts.push(node.text);
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }

    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "listItem" ||
      node.type === "codeBlock" ||
      node.type === "tableRow"
    ) {
      parts.push("\n");
    }
  };

  for (const node of doc.content) {
    walk(node);
  }

  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function isTiptapTextNode(node: TiptapNode | TiptapTextNode): node is TiptapTextNode {
  return node.type === "text";
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureLocalDevAiUser(db: D1Database): Promise<AiAuditActor> {
  const now = new Date().toISOString();

  await runStatement(
    db
      .prepare(
        `
          INSERT OR IGNORE INTO users (
            id,
            github_id,
            github_login,
            github_avatar_url,
            github_html_url,
            role,
            created_at,
            updated_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        DEV_AI_USER_ID,
        DEV_AI_GITHUB_ID,
        DEV_AI_GITHUB_LOGIN,
        null,
        "http://localhost/",
        "visitor",
        now,
        now,
        now,
      ),
  );

  return { userId: DEV_AI_USER_ID };
}

async function resolveArticleIdForAudit(db: D1Database, articleId: string | undefined): Promise<string | null> {
  if (!articleId) {
    return null;
  }

  const row = await queryFirst<{ id: string }>(
    db.prepare("SELECT id FROM articles WHERE id = ? LIMIT 1").bind(articleId),
  );

  return row?.id ?? null;
}

async function tryInsertAiFailure(
  db: D1Database,
  record: {
    articleId: string | null;
    userId: string;
    task: AiTask;
    model: string;
    inputHash: string;
    errorMessage: string;
  },
): Promise<void> {
  try {
    await insertAiOutput(db, {
      articleId: record.articleId,
      userId: record.userId,
      task: record.task,
      model: record.model,
      inputHash: record.inputHash,
      outputJson: null,
      outputText: null,
      status: "failed",
      errorMessage: record.errorMessage,
    });
  } catch (error) {
    console.error(`[AI ERROR][${record.task}] failed to persist audit row`, error);
  }
}

async function insertAiOutput(
  db: D1Database,
  record: {
    articleId: string | null;
    userId: string;
    task: AiTask;
    model: string;
    inputHash: string;
    outputJson: string | null;
    outputText: string | null;
    status: "success" | "failed";
    errorMessage: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO ai_outputs (
            id,
            article_id,
            user_id,
            task,
            model,
            input_hash,
            output_json,
            output_text,
            status,
            error_message,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        record.articleId,
        record.userId,
        record.task,
        record.model,
        record.inputHash,
        record.outputJson,
        record.outputText,
        record.status,
        record.errorMessage,
        now,
      ),
  );
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf("{");

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}

function isSafeTiptapDoc(value: unknown): value is TiptapDoc {
  if (!value || typeof value !== "object") {
    return false;
  }

  const doc = value as Partial<TiptapDoc>;
  return doc.type === "doc" && Array.isArray(doc.content) && doc.content.every(isSafeNode);
}

function normalizeTiptapDoc(value: unknown): TiptapDoc | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const doc = value as Partial<TiptapDoc>;

  if (doc.type !== "doc" || !Array.isArray(doc.content)) {
    return null;
  }

  const content = doc.content.map(normalizeBlockNode).filter((node): node is TiptapNode => Boolean(node));

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  const normalized = {
    type: "doc",
    content,
  } satisfies TiptapDoc;

  return isSafeTiptapDoc(normalized) ? normalized : null;
}

function normalizeBlockNode(value: unknown): TiptapNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const node = value as Record<string, unknown>;

  if (node.type === "paragraph") {
    return normalizeTextBlockNode("paragraph", node.content, true, normalizeTextAlignAttrs(node.attrs));
  }

  if (node.type === "heading") {
    return normalizeTextBlockNode("heading", node.content, true, normalizeHeadingAttrs(node.attrs));
  }

  if (node.type === "codeBlock") {
    return normalizeTextBlockNode("codeBlock", node.content, false);
  }

  if (node.type === "blockquote") {
    const content = normalizeBlockContent(node.content);
    const attrs = normalizeTextAlignAttrs(node.attrs);
    return attrs
      ? {
          type: "blockquote",
          attrs,
          content: content.length ? content : [{ type: "paragraph" }],
        }
      : {
      type: "blockquote",
      content: content.length ? content : [{ type: "paragraph" }],
    };
  }

  if (node.type === "bulletList" || node.type === "orderedList") {
    const listItems = Array.isArray(node.content)
      ? node.content.map(normalizeListItem).filter((item): item is TiptapNode => Boolean(item))
      : [];

    if (listItems.length === 0) {
      return null;
    }

    return {
      type: node.type,
      content: listItems,
    };
  }

  if (node.type === "listItem") {
    return normalizeListItem(node);
  }

  if (node.type === "horizontalRule") {
    return { type: "horizontalRule" };
  }

  if (node.type === "image") {
    return normalizeImageNode(node);
  }

  if (node.type === "table") {
    return normalizeTableNode(node);
  }

  if (node.type === "tableRow" || node.type === "tableCell" || node.type === "tableHeader") {
    return null;
  }

  if (node.type === "text") {
    return normalizeTextBlockNode("paragraph", [node]);
  }

  return null;
}

function normalizeListItem(value: unknown): TiptapNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const node = value as Record<string, unknown>;
  const content = normalizeBlockContent(node.content);

  return {
    type: "listItem",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

function normalizeBlockContent(value: unknown): TiptapNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const content: TiptapNode[] = [];
  const inlineNodes: TiptapTextNode[] = [];

  for (const child of value) {
    if (isTextLikeNode(child)) {
      const textNode = normalizeTextNode(child, true);
      if (textNode) {
        inlineNodes.push(textNode);
      }
      continue;
    }

    if (inlineNodes.length > 0) {
      content.push({ type: "paragraph", content: inlineNodes.splice(0) });
    }

    const block = normalizeBlockNode(child);
    if (block) {
      content.push(block);
    }
  }

  if (inlineNodes.length > 0) {
    content.push({ type: "paragraph", content: inlineNodes });
  }

  return content;
}

function normalizeTextBlockNode(
  type: "paragraph" | "heading" | "codeBlock",
  value: unknown,
  allowMarks = true,
  attrs?: Record<string, unknown>,
): TiptapNode {
  const content = normalizeInlineContent(value, allowMarks);
  return content.length > 0
    ? {
        type,
        ...(attrs ? { attrs } : {}),
        content,
      }
    : attrs
      ? { type, attrs }
      : { type };
}

function normalizeInlineContent(value: unknown, allowMarks: boolean): TiptapTextNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((child) => normalizeTextNode(child, allowMarks))
    .filter((node): node is TiptapTextNode => Boolean(node));
}

function isTextLikeNode(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).type === "text");
}

function normalizeTextNode(value: unknown, allowMarks: boolean): TiptapTextNode | null {
  if (!isTextLikeNode(value)) {
    return null;
  }

  const node = value as Record<string, unknown>;

  if (typeof node.text !== "string" || node.text.length === 0) {
    return null;
  }

  const marks = allowMarks ? normalizeMarks(node.marks) : [];

  return marks.length > 0
    ? {
      type: "text",
      text: node.text,
      marks,
    }
    : {
      type: "text",
      text: node.text,
    };
}

function normalizeMarks(value: unknown): TiptapTextMark[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const marks: TiptapTextMark[] = [];

  for (const mark of value) {
    if (!mark || typeof mark !== "object") {
      continue;
    }

    const source = mark as Record<string, unknown>;
    const type = source.type;

    if (typeof type !== "string" || !ALLOWED_TEXT_MARKS.has(type)) {
      continue;
    }

    if (
      type === "bold" ||
      type === "italic" ||
      type === "strike" ||
      type === "code" ||
      type === "underline" ||
      type === "subscript" ||
      type === "superscript"
    ) {
      marks.push({ type });
      continue;
    }

    const attrs = source.attrs && typeof source.attrs === "object" ? (source.attrs as Record<string, unknown>) : {};
    if (type === "link") {
      const href = normalizeSafeUrl(attrs.href);
      if (href) {
        marks.push({ type, attrs: { href } });
      }
      continue;
    }

    if (type === "textStyle") {
      const color = normalizeSafeColor(attrs.color);
      if (color) {
        marks.push({ type, attrs: { color } });
      }
      continue;
    }

    if (type === "highlight") {
      const color = normalizeSafeColor(attrs.color);
      if (color) {
        marks.push({ type, attrs: { color } });
      }
    }
  }

  return marks;
}

function isSafeNode(value: unknown): value is TiptapNode | TiptapTextNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as Record<string, unknown>;

  if (node.type === "text") {
    return (
      typeof node.text === "string" &&
      (!("marks" in node) ||
        (Array.isArray(node.marks) &&
          node.marks.every(isSafeMark)))
    );
  }

  if (typeof node.type !== "string" || !ALLOWED_NODE_TYPES.has(node.type)) {
    return false;
  }

  if (node.type === "heading") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    const level = attrs?.level;
    if (level !== 1 && level !== 2 && level !== 3 && level !== 4 && level !== 5 && level !== 6) {
      return false;
    }
  }

  if ((node.type === "paragraph" || node.type === "heading" || node.type === "blockquote") && node.attrs !== undefined) {
    const textAlign = (node.attrs as Record<string, unknown>).textAlign;
    if (textAlign !== undefined && textAlign !== "left" && textAlign !== "center" && textAlign !== "right") {
      return false;
    }
  }

  if (node.type === "image") {
    const attrs = node.attrs;
    if (!attrs || typeof attrs !== "object") {
      return false;
    }
    const imageAttrs = attrs as Record<string, unknown>;
    if (!normalizeSafeUrl(imageAttrs.src)) {
      return false;
    }
    if (imageAttrs.alt !== undefined && typeof imageAttrs.alt !== "string") {
      return false;
    }
    if (imageAttrs.title !== undefined && typeof imageAttrs.title !== "string") {
      return false;
    }
    return true;
  }

  if (node.type === "table") {
    return Array.isArray(node.content) && node.content.every((child) => isSafeNode(child) && child.type === "tableRow");
  }

  if (node.type === "tableRow") {
    return Array.isArray(node.content) && node.content.every((child) => isSafeNode(child) && (child.type === "tableCell" || child.type === "tableHeader"));
  }

  if (node.type === "tableCell" || node.type === "tableHeader") {
    return Array.isArray(node.content) && node.content.every(isSafeNode);
  }

  return !("content" in node) || (Array.isArray(node.content) && node.content.every(isSafeNode));
}

function normalizeHeadingAttrs(value: unknown): Record<string, unknown> {
  const attrs = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const level = normalizeHeadingLevel(attrs.level);
  const textAlign = normalizeTextAlignValue(attrs.textAlign);

  return textAlign ? { level, textAlign } : { level };
}

function normalizeTextAlignAttrs(value: unknown): Record<string, unknown> | undefined {
  const attrs = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const textAlign = normalizeTextAlignValue(attrs.textAlign);
  return textAlign ? { textAlign } : undefined;
}

function normalizeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const level = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 2;
  return level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6 ? level : 2;
}

function normalizeTextAlignValue(value: unknown): "left" | "center" | "right" | undefined {
  return value === "left" || value === "center" || value === "right" ? value : undefined;
}

function normalizeImageNode(node: Record<string, unknown>): TiptapNode | null {
  const attrs = node.attrs && typeof node.attrs === "object" ? (node.attrs as Record<string, unknown>) : {};
  const src = normalizeSafeUrl(attrs.src);

  if (!src) {
    return null;
  }

  const imageAttrs: Record<string, unknown> = { src };

  if (typeof attrs.alt === "string") {
    imageAttrs.alt = truncateText(attrs.alt.trim(), 500);
  }

  if (typeof attrs.title === "string") {
    const title = truncateText(attrs.title.trim(), 500);
    if (title) {
      imageAttrs.title = title;
    }
  }

  return {
    type: "image",
    attrs: imageAttrs,
  };
}

function normalizeTableNode(node: Record<string, unknown>): TiptapNode | null {
  const rows = Array.isArray(node.content)
    ? node.content.map(normalizeTableRowNode).filter((row): row is TiptapNode => Boolean(row))
    : [];

  return rows.length
    ? {
        type: "table",
        content: rows,
      }
    : null;
}

function normalizeTableRowNode(value: unknown): TiptapNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const node = value as Record<string, unknown>;
  const cells = Array.isArray(node.content)
    ? node.content.map(normalizeTableCellNode).filter((cell): cell is TiptapNode => Boolean(cell))
    : [];

  return cells.length
    ? {
        type: "tableRow",
        content: cells,
      }
    : null;
}

function normalizeTableCellNode(value: unknown): TiptapNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const node = value as Record<string, unknown>;
  const type = node.type === "tableHeader" ? "tableHeader" : node.type === "tableCell" ? "tableCell" : null;

  if (!type) {
    return null;
  }

  const content = normalizeBlockContent(node.content);

  return {
    type,
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

function isSafeMark(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const mark = value as Record<string, unknown>;
  const type = mark.type;

  if (typeof type !== "string" || !ALLOWED_TEXT_MARKS.has(type)) {
    return false;
  }

  if (
    type === "bold" ||
    type === "italic" ||
    type === "strike" ||
    type === "code" ||
    type === "underline" ||
    type === "subscript" ||
    type === "superscript"
  ) {
    return true;
  }

  const attrs = mark.attrs;
  if (!attrs || typeof attrs !== "object") {
    return false;
  }

  const record = attrs as Record<string, unknown>;
  if (type === "link") {
    return Boolean(normalizeSafeUrl(record.href));
  }

  if (type === "textStyle" || type === "highlight") {
    return Boolean(normalizeSafeColor(record.color));
  }

  return false;
}

function normalizeSafeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const url = value.trim();

  if (!url || /[\u0000-\u001f\u007f\s]/.test(url)) {
    return undefined;
  }

  if (SAFE_MEDIA_PATH_PATTERN.test(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password) {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeSafeColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const color = value.trim();
  return SAFE_COLOR_PATTERN.test(color) ? color : undefined;
}
