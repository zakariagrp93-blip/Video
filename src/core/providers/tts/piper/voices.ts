import type { Language } from '../../../../shared/constants';
import type { VoiceInfo } from '../../types';

/**
 * Piper neural voices (MIT-licensed engine; voices trained on openly licensed
 * datasets — see each MODEL_CARD shipped inside the archive). Downloaded on
 * demand from the official rhasspy/piper GitHub release.
 */
export interface PiperVoiceSpec extends VoiceInfo {
  archiveUrl: string;
  /** Base file name inside the archive (without .onnx). */
  modelName: string;
}

const BASE = 'https://github.com/rhasspy/piper/releases/download/v0.0.2';

function v(id: string, language: Language, gender: VoiceInfo['gender'], label: string, sizeMb: number): PiperVoiceSpec {
  return { id, language, gender, label, sizeMb, modelName: id, archiveUrl: `${BASE}/voice-${id}.tar.gz` };
}

export const PIPER_VOICES: PiperVoiceSpec[] = [
  v('fr-siwis-medium', 'fr', 'female', 'Siwis (FR, female, medium quality)', 64),
  v('fr-gilles-low', 'fr', 'male', 'Gilles (FR, male, low quality)', 20),
  v('fr-siwis-low', 'fr', 'female', 'Siwis (FR, female, low quality)', 20),
  v('en-us-lessac-medium', 'en', 'female', 'Lessac (EN-US, female, medium quality)', 64),
  v('en-us-ryan-medium', 'en', 'male', 'Ryan (EN-US, male, medium quality)', 64),
  v('en-gb-alan-low', 'en', 'male', 'Alan (EN-GB, male, low quality)', 20),
  v('en-us-amy-low', 'en', 'female', 'Amy (EN-US, female, low quality)', 20),
  v('es-mls_9972-low', 'es', 'unspecified', 'MLS 9972 (ES, low quality)', 20),
  v('es-mls_10246-low', 'es', 'unspecified', 'MLS 10246 (ES, low quality)', 20),
  v('de-thorsten-low', 'de', 'male', 'Thorsten (DE, male, low quality)', 20),
  v('de-ramona-low', 'de', 'female', 'Ramona (DE, female, low quality)', 20),
  v('de-karlsson-low', 'de', 'male', 'Karlsson (DE, male, low quality)', 20),
];

/** Default choice per language/gender — first match wins. */
export function defaultPiperVoice(language: Language, gender: 'male' | 'female' | 'auto'): PiperVoiceSpec {
  const forLang = PIPER_VOICES.filter((x) => x.language === language);
  if (gender !== 'auto') {
    const g = forLang.find((x) => x.gender === gender);
    if (g) return g;
  }
  return forLang[0]!;
}
