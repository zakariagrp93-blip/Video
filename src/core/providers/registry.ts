import type { Settings } from '../../shared/schemas';
import type { SecretStore } from '../settings/settingsStore';
import { OpenAIImageProvider, VectorImageProvider } from './image/imageProviders';
import { AnthropicLLMProvider } from './llm/anthropicLlm';
import { OfflineLLMProvider } from './llm/offline/offlineLlm';
import { OpenAILLMProvider } from './llm/openaiLlm';
import { ElevenLabsTTSProvider } from './tts/elevenlabsTts';
import { FishAudioTTSProvider } from './tts/fishAudioTts';
import { OpenAITTSProvider } from './tts/openaiTts';
import { PiperTTSProvider } from './tts/piper/piperTts';
import type { ImageProvider, LLMProvider, TTSProvider } from './types';

/**
 * Builds interchangeable providers from settings. Providers read keys lazily
 * from the secret store, so changing a key in Settings takes effect immediately.
 */
export class ProviderRegistry {
  readonly llm: Record<Settings['llmProvider'], LLMProvider>;
  readonly image: Record<Settings['imageProvider'], ImageProvider>;
  readonly tts: Record<Settings['ttsProvider'], TTSProvider>;

  constructor(
    private readonly settings: () => Settings,
    secrets: SecretStore,
    voicesDir: string,
  ) {
    this.llm = {
      offline: new OfflineLLMProvider(),
      anthropic: new AnthropicLLMProvider(() => secrets.get('anthropicApiKey'), () => this.settings().llmModel.anthropic),
      openai: new OpenAILLMProvider(() => secrets.get('openaiApiKey'), () => this.settings().llmModel.openai),
    };
    this.image = {
      vector: new VectorImageProvider(),
      openai: new OpenAIImageProvider(() => secrets.get('openaiApiKey'), () => this.settings().imageModel),
    };
    this.tts = {
      piper: new PiperTTSProvider(voicesDir, () => this.settings().voices.piper),
      elevenlabs: new ElevenLabsTTSProvider(() => secrets.get('elevenlabsApiKey'), () => this.settings().elevenlabsModel, () => this.settings().voices.elevenlabs),
      fishaudio: new FishAudioTTSProvider(() => secrets.get('fishaudioApiKey'), () => this.settings().fishaudioModel, () => this.settings().voices.fishaudio),
      openai: new OpenAITTSProvider(() => secrets.get('openaiApiKey'), () => this.settings().openaiTtsModel, () => this.settings().voices.openai),
    };
  }

  currentLlm(): LLMProvider {
    return this.llm[this.settings().llmProvider];
  }
  currentImage(): ImageProvider {
    return this.image[this.settings().imageProvider];
  }
  currentTts(): TTSProvider {
    return this.tts[this.settings().ttsProvider];
  }
}
