export type AiProvider = 'gemini' | 'groq' | 'openrouter' | 'custom'

export interface AiConfig {
  provider: AiProvider
  model: string
  apiKey: string
  baseUrl?: string
}

export interface AiProviderMeta {
  id: AiProvider
  label: string
  hint: string
  modelPlaceholder: string
  needsBaseUrl?: boolean
  keyUrl: string
}

export const AI_PROVIDER_MAP: Record<AiProvider, AiProviderMeta> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    hint: 'Ücretsiz katmanı var — kendi Gemini API key’ini kullan.',
    modelPlaceholder: 'gemini-2.0-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    hint: 'Ücretsiz katmanı var — hızlı açık modeller.',
    modelPlaceholder: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Birçok ücretsiz model (isimleri :free ile biter).',
    modelPlaceholder: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    id: 'custom',
    label: 'Özel (OpenAI uyumlu)',
    hint: 'Kendi sunucun ya da Ollama gibi yerel bir servis.',
    modelPlaceholder: 'llama3.1',
    needsBaseUrl: true,
    keyUrl: '',
  },
}

export const AI_PROVIDERS: AiProviderMeta[] = Object.values(AI_PROVIDER_MAP)

const STORAGE_KEY = 'jj-ai-config'

export function loadAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AiConfig>
    if (!parsed.provider || !parsed.model || !parsed.apiKey) return null
    return parsed as AiConfig
  } catch {
    return null
  }
}

export function saveAiConfig(config: AiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
