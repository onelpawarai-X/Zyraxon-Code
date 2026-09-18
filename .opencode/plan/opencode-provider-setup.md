# OpenCode Provider Setup — Zyraxon-Code

## Architecture Overview

Zyraxon-Code is a VS Code fork with two AI provider systems:

1. **Bridge Provider** (`zyraxonBridge/`) — Connects to local bridge at `http://127.0.0.1:4096/v1` for free OpenCode models. Fetches models dynamically, injects Zyraxon mode prompts. **Already working.**
2. **AiProviderService** (`aiProvider/`) — Generic provider system with hardcoded `BUILTIN_PROVIDERS`. Has OpenAI, Anthropic, Google, Groq, OpenRouter but **no 'opencode' provider**.

The bridge provider is the primary path for free models. The `opencode.jsonc` config file is for the OpenCode CLI/TUI (separate tool), not for the editor itself.

---

## File Changes

### 1. CREATE `opencode.jsonc` (project root)

OpenCode CLI config. Provider definitions for when `opencode` CLI is run from this project:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "opencode": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenCode Free",
      "options": {
        "baseURL": "https://models.zyraxon.ai/v1"
      },
      "models": {}
    },
    "openai": {
      "npm": "@ai-sdk/openai",
      "name": "OpenAI"
    },
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "Anthropic"
    },
    "google": {
      "npm": "@ai-sdk/google",
      "name": "Google Gemini"
    },
    "groq": {
      "npm": "@ai-sdk/openai",
      "name": "Groq",
      "options": { "baseURL": "https://api.groq.com/openai/v1" }
    },
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter",
      "options": { "baseURL": "https://openrouter.ai/api/v1" }
    }
  }
}
```

### 2. MODIFY `src/vs/platform/aiProvider/aiProviderTypes.ts`

Add 'opencode' to `BUILTIN_PROVIDERS` array (after line 189):

```typescript
{
    id: 'opencode',
    name: 'OpenCode Free',
    description: 'Free models via OpenCode — no API key needed',
    authType: 'none',
    configSchema: {
        baseUrl: 'string?'
    },
    models: []  // Models fetched dynamically from catalog URL
}
```

Key: `authType: 'none'` — no API key required. Empty models array because the bridge fetches them dynamically.

### 3. MODIFY `src/vs/platform/aiProvider/aiProviderService.ts`

**3a.** Add `'opencode'` to `_getDefaultBaseUrl()` (line 280-288):
```typescript
private _getDefaultBaseUrl(providerId: string): string {
    const defaults: Record<string, string> = {
        'openai': 'https://api.openai.com/v1',
        'anthropic': 'https://api.anthropic.com/v1',
        'google': 'https://generativelanguage.googleapis.com/v1beta',
        'groq': 'https://api.groq.com/openai/v1',
        'openrouter': 'https://openrouter.ai/api/v1',
        'opencode': 'https://models.zyraxon.ai/v1'  // ADD THIS
    };
    return defaults[providerId] || 'https://api.openai.com/v1';
}
```

**3b.** In `_getHeaders()` (line 260-278), skip Authorization header when no API key is configured:
```typescript
private _getHeaders(config: ProviderConfiguration): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (config.config.apiKey) {
        headers['Authorization'] = `Bearer ${config.config.apiKey}`;
    }
    // ... rest unchanged
}
```
This already works correctly — if `apiKey` is undefined/empty, no Authorization header is sent.

### 4. MODIFY `src/vs/workbench/contrib/chat/browser/zyraxonBridge/zyraxonBridge.contribution.ts`

Add the `openAIModelCatalogBaseUrl` configuration setting to the existing registration (after line 36):

```typescript
import { ZYRAXON_MODEL_CATALOG_BASE_URL_SETTING, DEFAULT_ZYRAXON_MODEL_CATALOG_BASE_URL } from './zyraxonBridgeLanguageModelProvider.js';

// Inside the existing registerConfiguration call, add to properties:
[ZYRAXON_MODEL_CATALOG_BASE_URL_SETTING]: {
    type: 'string',
    default: DEFAULT_ZYRAXON_MODEL_CATALOG_BASE_URL,
    markdownDescription: nls.localize('zyraxon.modelCatalogBaseUrl', 'Base URL for the OpenCode model catalog. Free models are fetched from this endpoint. No API key required.'),
},
```

### 5. MODIFY `src/vs/workbench/contrib/chat/browser/zyraxonBridge/zyraxonBridgeLanguageModelProvider.ts`

**5a.** Add exported constants (after line 24):
```typescript
export const ZYRAXON_MODEL_CATALOG_BASE_URL_SETTING = 'zyraxon.ai.openAIModelCatalogBaseUrl';
export const DEFAULT_ZYRAXON_MODEL_CATALOG_BASE_URL = 'https://models.zyraxon.ai/v1';
```

**5b.** Add `_catalogBaseUrl` field and reader (in constructor, after `_mode` init):
```typescript
private _catalogBaseUrl: string;

// In constructor:
this._catalogBaseUrl = this._readCatalogBaseUrl();

// Add method:
private _readCatalogBaseUrl(): string {
    const value = this._configurationService.getValue<string>(ZYRAXON_MODEL_CATALOG_BASE_URL_SETTING);
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    return DEFAULT_ZYRAXON_MODEL_CATALOG_BASE_URL;
}
```

**5c.** In `_refresh()`, use catalog base URL for model fetching (instead of bridge URL):
```typescript
async _refresh(): Promise<void> {
    const catalogUrl = `${this._catalogBaseUrl.replace(/\/$/, '')}/models`;
    // ... rest of fetch logic uses catalogUrl instead of constructing from this._bridgeUrl
}
```

**5d.** In constructor config change listener, add catalog URL change handling:
```typescript
if (e.affectsConfiguration(ZYRAXON_MODEL_CATALOG_BASE_URL_SETTING)) {
    this._catalogBaseUrl = this._readCatalogBaseUrl();
    this._refresh();
}
```

---

## How Models Are Loaded and Served

### Free Models (OpenCode Provider — No API Key)

```
User opens model picker
    → ZyraxonBridgeLanguageModelProvider._refresh()
    → GET https://models.zyraxon.ai/v1/models  (catalog base URL)
    → Parses model list, fires onDidChange
    → Models appear in picker as "opencode:<provider>/<model-id>"
    → User selects model
    → sendChatRequest() called
    → POST http://127.0.0.1:4096/v1/chat/completions (bridge URL)
    → Bridge routes to upstream provider
    → SSE stream returned to editor
```

### BYOK Models (OpenAI, Anthropic, etc.)

```
User configures API key via AiProviderService.setConfiguration()
    → Stored in storage under 'zyraxon.ai.providers'
    → When model selected, getProviderConfigForModel() finds matching provider
    → _makeChatRequest() uses provider's default base URL + API key header
    → Direct API call to provider (e.g., https://api.openai.com/v1/chat/completions)
```

### Key Distinction

- **Catalog URL** (`zyraxon.ai.openAIModelCatalogBaseUrl`) — where to **fetch the model list** from
- **Bridge URL** (`chat.zyraxon.bridgeUrl`) — where to **send chat requests** to
- These can be different! The catalog can be remote while the bridge is local.

---

## Summary of Changes

| File | Action | What |
|------|--------|------|
| `opencode.jsonc` | CREATE | OpenCode CLI config with all 6 providers |
| `aiProviderTypes.ts` | EDIT | Add 'opencode' to BUILTIN_PROVIDERS |
| `aiProviderService.ts` | EDIT | Add 'opencode' to default base URLs |
| `zyraxonBridge.contribution.ts` | EDIT | Register `openAIModelCatalogBaseUrl` setting |
| `zyraxonBridgeLanguageModelProvider.ts` | EDIT | Use catalog base URL for model fetching |

## Verification

1. `opencode.jsonc` — valid JSON5, correct provider structure
2. `aiProviderTypes.ts` — TypeScript compiles, 'opencode' has `authType: 'none'`
3. `aiProviderService.ts` — 'opencode' in defaults map, no auth header when no key
4. Bridge — catalog URL setting registered, `_refresh()` reads from config
5. Build: `npm run compile` should pass
