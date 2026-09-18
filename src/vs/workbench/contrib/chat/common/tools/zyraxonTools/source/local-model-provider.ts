import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as child_process from "child_process";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LocalModelInfo {
  path: string;
  name: string;
  sizeBytes: number;
  quantization?: string;
  family?: string;
}

export interface GenerateOptions {
  model: LocalModelInfo;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  chatFormat?: boolean;
}

export interface GenerateResult {
  text: string;
  tokensPerSec: number;
  totalTokens: number;
  backend: string;
  evalTimeMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GGUF_MAGIC = 0x46475547;
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_TEMPERATURE = 0.7;

// ─── Path Helpers ─────────────────────────────────────────────────────────────

export function getModelDir(): string {
  const home = os.homedir();
  return path.join(home, ".zyraxon", "models");
}

function ensureModelDir(): string {
  const dir = getModelDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── GGUF Validation ──────────────────────────────────────────────────────────

function readGGUFHeader(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.readUInt32LE(0);
    return magic === GGUF_MAGIC;
  } catch {
    return false;
  }
}

// ─── Scan for Models ──────────────────────────────────────────────────────────

export async function scanForModels(dirs?: string[]): Promise<LocalModelInfo[]> {
  const modelDir = ensureModelDir();
  const searchPaths = dirs ?? [
    modelDir,
    path.join(os.homedir(), "Downloads"),
    path.join(os.homedir(), ".ollama", "models"),
    "C:\\zyraxon-workspace\\models",
  ];

  const results: LocalModelInfo[] = [];
  const visited = new Set<string>();

  for (const dir of searchPaths) {
    if (!fs.existsSync(dir) || visited.has(dir)) continue;
    visited.add(dir);

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".gguf")) continue;

      const fullPath = path.join(dir, entry.name);
      if (!readGGUFHeader(fullPath)) continue;

      const stat = fs.statSync(fullPath);
      const nameWithoutExt = entry.name.replace(/\.gguf$/i, "");

      const quantMatch = nameWithoutExt.match(
        /(?:Q2_K|Q3_K_S|Q3_K_M|Q3_K_L|Q4_0|Q4_K_S|Q4_K_M|Q5_0|Q5_K_S|Q5_K_M|Q6_K|Q8_0|F16|F32)/i
      );
      const familyMatch = nameWithoutExt.match(
        /(llama|mistral|codellama|phi|qwen|gemma|deepseek|yi|mixtral)/i
      );

      results.push({
        path: fullPath,
        name: nameWithoutExt,
        sizeBytes: stat.size,
        quantization: quantMatch?.[0]?.toUpperCase(),
        family: familyMatch?.[1]?.toLowerCase(),
      });
    }
  }

  return results;
}

// ─── Backend Detection ────────────────────────────────────────────────────────

export interface BackendInfo {
  name: string;
  available: boolean;
  path?: string;
}

function findLlamaCppCli(): string | null {
  const portablePath = "C:\\zyraxon-workspace\\llama-cpp\\llama-cli.exe";
  if (fs.existsSync(portablePath)) return portablePath;

  try {
    const result = child_process.spawnSync("where", ["llama-cli.exe"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim().split("\n")[0].trim();
    }
  } catch { /* not found */ }

  return null;
}

export async function detectBackends(): Promise<BackendInfo[]> {
  const backends: BackendInfo[] = [];

  // 1. llama-cpp-cli (portable)
  const cliPath = findLlamaCppCli();
  backends.push({
    name: "llama-cpp-cli",
    available: cliPath !== null,
    path: cliPath ?? undefined,
  });

  // 2. llama-cpp-python
  try {
    const result = child_process.spawnSync("python", [
      "-c",
      "import llama_cpp; print(llama_cpp.__version__)",
    ], { encoding: "utf-8", timeout: 10000, windowsHide: true });
    backends.push({
      name: "llama-cpp-python",
      available: result.status === 0,
      path: result.stdout.trim() || undefined,
    });
  } catch {
    backends.push({ name: "llama-cpp-python", available: false });
  }

  // 3. Ollama
  try {
    const result = child_process.spawnSync("ollama", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    backends.push({
      name: "ollama",
      available: result.status === 0,
      path: result.stdout.trim() || undefined,
    });
  } catch {
    backends.push({ name: "ollama", available: false });
  }

  // 4. node-llama-cpp
  try {
    const result = child_process.spawnSync("node", [
      "-e",
      "import('node-llama-cpp').then(m => console.log('ok'))",
    ], { encoding: "utf-8", timeout: 10000, windowsHide: true });
    backends.push({
      name: "node-llama-cpp",
      available: result.status === 0 && result.stdout.includes("ok"),
    });
  } catch {
    backends.push({ name: "node-llama-cpp", available: false });
  }

  return backends;
}

// ─── CLI Backend ──────────────────────────────────────────────────────────────

async function generateWithCli(opts: GenerateOptions): Promise<GenerateResult> {
  const cliPath = findLlamaCppCli();
  if (!cliPath) throw new Error("llama-cli.exe not found");

  const modelPath = opts.model.path;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;

  let fullPrompt: string;

  if (opts.chatFormat) {
    const OPEN = String.fromCharCode(60);
    const CLOSE = String.fromCharCode(62);
    const IMS = OPEN + "im_start" + CLOSE;
    const IME = OPEN + "im_end" + CLOSE;
    const NL = String.fromCharCode(10);

    const sysPrompt = opts.systemPrompt ?? "You are a helpful assistant.";

    fullPrompt =
      IMS + NL +
      "system" + NL +
      sysPrompt + NL +
      IME + NL +
      IMS + NL +
      "user" + NL +
      opts.prompt + NL +
      IME + NL +
      IMS + NL +
      "assistant" + NL;
  } else {
    fullPrompt = opts.prompt;
  }

  const args = [
    "-m", modelPath,
    "-p", fullPrompt,
    "-n", String(maxTokens),
    "--temp", String(temperature),
    "--no-display-prompt",
    "--log-disable",
  ];

  if (opts.stop && opts.stop.length > 0) {
    for (const s of opts.stop) {
      args.push("--stop", s);
    }
  }

  const startTime = Date.now();

  return new Promise<GenerateResult>((resolve, reject) => {
    const proc = child_process.spawn(cliPath, args, {
      env: {
        ...process.env,
        LLAMA_N_GPU_LAYERS: "0",
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      const elapsed = Date.now() - startTime;

      if (code !== 0 && !stdout) {
        reject(new Error(`llama-cli exited with code ${code}: ${stderr}`));
        return;
      }

      let tokensPerSec = 0;
      let totalTokens = 0;

      const tpsMatch = stdout.match(/([\d.]+)\s*t\/s/);
      if (tpsMatch) {
        tokensPerSec = parseFloat(tpsMatch[1]);
      }

      const tokensMatch = stdout.match(/eval\s+count\s*=\s*(\d+)/);
      if (tokensMatch) {
        totalTokens = parseInt(tokensMatch[1], 10);
      }

      const generatedText = stdout.trim();

      resolve({
        text: generatedText,
        tokensPerSec,
        totalTokens,
        backend: "llama-cpp-cli",
        evalTimeMs: elapsed,
      });
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn llama-cli: ${err.message}`));
    });
  });
}

// ─── Python Backend ───────────────────────────────────────────────────────────

async function generateWithPython(opts: GenerateOptions): Promise<GenerateResult> {
  const modelPath = opts.model.path.replace(/\\/g, "\\\\");
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const prompt = opts.prompt.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  const systemPrompt = (opts.systemPrompt ?? "You are a helpful assistant.")
    .replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

  const pyCode = `
import json, time, llama_cpp

m = llama_cpp.Llama(model_path="${modelPath}", n_ctx=4096, n_gpu_layers=0)
t0 = time.time()

msgs = [
    {"role": "system", "content": "${systemPrompt}"},
    {"role": "user", "content": "${prompt}"}
]

out = m.create_chat_completion(messages=msgs, max_tokens=${maxTokens}, temperature=${temperature})
dt = time.time() - t0
text = out["choices"][0]["message"]["content"]
usage = out.get("usage", {})
tok = usage.get("completion_tokens", 0)
tps = tok / dt if dt > 0 else 0

print(json.dumps({"text": text, "tps": tps, "tokens": tok, "elapsed_ms": int(dt * 1000)}))
`.trim();

  const startTime = Date.now();

  return new Promise<GenerateResult>((resolve, reject) => {
    const proc = child_process.spawn("python", ["-c", pyCode], {
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`python exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve({
          text: result.text,
          tokensPerSec: result.tps,
          totalTokens: result.tokens,
          backend: "llama-cpp-python",
          evalTimeMs: result.elapsed_ms,
        });
      } catch (e) {
        reject(new Error(`Failed to parse python output: ${stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn python: ${err.message}`));
    });
  });
}

// ─── Ollama Backend ───────────────────────────────────────────────────────────

async function generateWithOllama(opts: GenerateOptions): Promise<GenerateResult> {
  const baseUrl = "http://localhost:11434";
  const modelName = opts.model.name;

  const messages: Array<{ role: string; content: string }> = [];

  if (opts.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }
  messages.push({ role: "user", content: opts.prompt });

  const body = JSON.stringify({
    model: modelName,
    messages,
    stream: false,
    options: {
      num_predict: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      top_p: opts.topP,
    },
  });

  const startTime = Date.now();

  return new Promise<GenerateResult>((resolve, reject) => {
    const url = new URL("/api/chat", baseUrl);
    const req = require("http") as typeof import("http");
    const request = req.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res: import("http").IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          const elapsed = Date.now() - startTime;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.message?.content ?? "";
            const evalCount = parsed.eval_count ?? 0;
            const evalDurationNs = parsed.eval_duration ?? 1;
            const tps = evalCount / (evalDurationNs / 1e9);

            resolve({
              text,
              tokensPerSec: tps,
              totalTokens: evalCount,
              backend: "ollama",
              evalTimeMs: elapsed,
            });
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${data}`));
          }
        });
      }
    );

    request.on("error", (err: Error) => {
      reject(new Error(`Ollama request failed: ${err.message}`));
    });

    request.write(body);
    request.end();
  });
}

// ─── Node-Llama Backend ──────────────────────────────────────────────────────

async function generateWithNodeLlama(opts: GenerateOptions): Promise<GenerateResult> {
  const startTime = Date.now();

  try {
    const nodeLlama = await import("node-llama-cpp");

    const context = await nodeLlama.getLlama();
    const model = await context.loadModel({
      modelPath: opts.model.path as any,
    });

    const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

    const sequence = model.createSequence();
    await sequence.append(opts.prompt);

    const response = await sequence.generate({
      maxTokens,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      topP: opts.topP,
    });

    const elapsed = Date.now() - startTime;

    return {
      text: response.text,
      tokensPerSec: response.tokensPerSec,
      totalTokens: response.tokens.length,
      backend: "node-llama-cpp",
      evalTimeMs: elapsed,
    };
  } catch (err: any) {
    throw new Error(`node-llama-cpp failed: ${err.message}`);
  }
}

// ─── Main Generate Function ───────────────────────────────────────────────────

export async function generateLocally(opts: GenerateOptions): Promise<GenerateResult> {
  const cliPath = findLlamaCppCli();

  // Priority: CLI > Python > Ollama > Node-Llama
  if (cliPath) {
    try {
      return await generateWithCli(opts);
    } catch (err: any) {
      console.warn(`[local-model] CLI backend failed, trying next: ${err.message}`);
    }
  }

  // Try Python
  try {
    const result = child_process.spawnSync("python", ["-c", "import llama_cpp"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    if (result.status === 0) {
      return await generateWithPython(opts);
    }
  } catch { /* python not available */ }

  // Try Ollama
  try {
    const result = child_process.spawnSync("ollama", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    if (result.status === 0) {
      return await generateWithOllama(opts);
    }
  } catch { /* ollama not available */ }

  // Try node-llama-cpp
  try {
    return await generateWithNodeLlama(opts);
  } catch { /* node-llama not available */ }

  throw new Error(
    "No local inference backend available. Install one of: " +
    "llama-cpp portable (C:\\zyraxon-workspace\\llama-cpp), " +
    "llama-cpp-python (pip install llama-cpp-python), " +
    "Ollama (https://ollama.ai), or " +
    "node-llama-cpp (npm install node-llama-cpp)"
  );
}

// ─── Download Model ───────────────────────────────────────────────────────────

export async function downloadModel(
  huggingFaceUrl: string,
  filename?: string
): Promise<LocalModelInfo> {
  const modelDir = ensureModelDir();

  let downloadUrl = huggingFaceUrl;
  if (huggingFaceUrl.includes("huggingface.co")) {
    downloadUrl = huggingFaceUrl.replace(
      "huggingface.co",
      "huggingface.co/resolve/main"
    );
  }

  const targetName = filename ?? path.basename(new URL(downloadUrl).pathname);
  if (!targetName.endsWith(".gguf")) {
    throw new Error("Target file must be a .gguf file");
  }

  const targetPath = path.join(modelDir, targetName);

  if (fs.existsSync(targetPath)) {
    if (readGGUFHeader(targetPath)) {
      const stat = fs.statSync(targetPath);
      return {
        path: targetPath,
        name: targetName.replace(/\.gguf$/i, ""),
        sizeBytes: stat.size,
      };
    }
    fs.unlinkSync(targetPath);
  }

  console.log(`[local-model] Downloading ${targetName} to ${modelDir}...`);

  return new Promise<LocalModelInfo>((resolve, reject) => {
    const https = downloadUrl.startsWith("https")
      ? require("https")
      : require("http");

    const followRedirect = (url: string) => {
      https.get(url, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          followRedirect(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] ?? "0", 10);
        let downloaded = 0;
        const fileStream = fs.createWriteStream(targetPath);

        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          fileStream.write(chunk);

          if (totalBytes > 0) {
            const pct = ((downloaded / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r[local-model] Download progress: ${pct}%`);
          }
        });

        res.on("end", () => {
          fileStream.end();
          console.log(`\n[local-model] Download complete: ${targetPath}`);

          if (!readGGUFHeader(targetPath)) {
            fs.unlinkSync(targetPath);
            reject(new Error("Downloaded file is not a valid GGUF file"));
            return;
          }

          const stat = fs.statSync(targetPath);
          resolve({
            path: targetPath,
            name: targetName.replace(/\.gguf$/i, ""),
            sizeBytes: stat.size,
          });
        });

        res.on("error", (err: Error) => {
          fileStream.end();
          fs.unlinkSync(targetPath);
          reject(err);
        });
      }).on("error", (err: Error) => {
        reject(new Error(`Download request failed: ${err.message}`));
      });
    };

    followRedirect(downloadUrl);
  });
}

// ─── Quick Test ───────────────────────────────────────────────────────────────

export async function quickTest(
  model?: LocalModelInfo
): Promise<{ success: boolean; backend: string; text: string; timeMs: number }> {
  const models = model ? [model] : await scanForModels();

  if (models.length === 0) {
    return {
      success: false,
      backend: "none",
      text: "No local GGUF models found. Use scanForModels() or downloadModel() to get started.",
      timeMs: 0,
    };
  }

  const testModel = models[0];

  try {
    const start = Date.now();
    const result = await generateLocally({
      model: testModel,
      prompt: "Say hello in exactly 3 words.",
      maxTokens: 20,
      temperature: 0.3,
    });

    return {
      success: true,
      backend: result.backend,
      text: result.text,
      timeMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      backend: "none",
      text: `Test failed: ${err.message}`,
      timeMs: 0,
    };
  }
}
