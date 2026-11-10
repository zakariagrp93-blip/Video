import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DURATION_OPTIONS,
  EDIT_MUSIC_LABELS,
  EDIT_MUSIC_STYLES,
  LANGUAGES,
  LANGUAGE_LABELS,
  NARRATOR_OPTIONS,
  STORYTELLING_LABELS,
  STORYTELLING_STYLES,
  VISUAL_STYLES,
  VISUAL_STYLE_LABELS,
  type Category,
  type DurationOption,
  type EditMusicStyle,
  type Language,
  type NarratorOption,
  type StorytellingStyle,
  type VisualStyle,
} from '../../shared/constants';
import type { ProviderInfoDTO } from '../../shared/ipc';
import type { Navigate } from '../App';
import { api, errorText } from '../api';
import { IconSpark } from '../components/Icons';
import { Badge, Button, Card, Field, Segmented, Select, useToast } from '../components/ui';

const MOTIVATION_EXAMPLES: Record<'fr' | 'en', string[]> = {
  fr: ['Motivation argent : personne ne viendra te rendre riche', 'Discipline : se lever à 5h pendant qu’ils dorment', 'Réussite : ils ont ri de ton rêve', 'Mental : ton plus grand ennemi, c’est ta tête'],
  en: ['Money motivation: nobody is coming to make you rich', 'Discipline: up at 5 a.m. while they sleep', 'Success: they laughed at your dream', 'Mindset: your biggest enemy is your own head'],
};

const STICK_EXAMPLES: Record<'fr' | 'en', string[]> = {
  fr: ['Et si tu épargnais 5 € par jour pendant 10 ans ?', 'Pourquoi les riches empruntent au lieu de vendre', 'Comment un café par jour te coûte une voiture', 'Et si tout le monde arrêtait de payer en liquide ?'],
  en: ['What if you saved $5 a day for 10 years?', 'Why the rich borrow instead of selling', 'How a daily coffee costs you a car', 'What if everyone stopped using cash?'],
};

const EXAMPLES = [
  'What if you received €1 million at age 18?',
  'What if you invested €200 a month for 30 years?',
  'What does a €3 coffee every day really cost?',
  'Investing at 25 vs 35: the real difference',
  '€5,000 on a credit card, paying only the minimum',
];

export function Generator({ navigate }: { navigate: Navigate }) {
  const toast = useToast();
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<DurationOption>('60');
  const [language, setLanguage] = useState<Language>('fr');
  const [narrator, setNarrator] = useState<NarratorOption>('auto');
  const [storytelling, setStorytelling] = useState<StorytellingStyle>('hypothetical');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('minimal-finance');
  const [category, setCategory] = useState<Category>('finance');
  const [editMusic, setEditMusic] = useState<EditMusicStyle>('auto');
  const [problems, setProblems] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderInfoDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api()
      .getSettings()
      .then(({ settings }) => {
        setDuration(settings.defaultDuration);
        setLanguage(settings.defaultLanguage);
      });
  }, []);

  const options = useMemo(
    () => ({ topic: topic.trim(), duration, language, narrator, storytelling, visualStyle, category, editMusic }),
    [topic, duration, language, narrator, storytelling, visualStyle, category, editMusic],
  );
  const motivation = category === 'motivation';
  const stick = category === 'stickfigure';
  const examples = motivation ? MOTIVATION_EXAMPLES[language === 'en' ? 'en' : 'fr'] : stick ? STICK_EXAMPLES[language === 'en' ? 'en' : 'fr'] : EXAMPLES;

  // Live preflight: tells the user *before* generating if a provider cannot handle the request.
  useEffect(() => {
    const t = setTimeout(() => {
      void api().providerInfo(options.topic.length >= 8 ? options : undefined).then(setProviders);
      if (options.topic.length >= 8) void api().preflight(options).then(setProblems);
      else setProblems([]);
    }, 300);
    return () => clearTimeout(t);
  }, [options]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const issues = await api().preflight(options);
      if (issues.length) {
        setProblems(issues);
        return;
      }
      const { projectId } = await api().generate(options);
      toast('success', 'Generation started');
      navigate({ name: 'progress', projectId });
    } catch (e) {
      toast('error', errorText(e));
    } finally {
      setSubmitting(false);
    }
  };

  const tooShort = topic.trim().length > 0 && topic.trim().length < 8;

  return (
    <div className="page narrow">
      <h1>Create a video</h1>
      <p className="muted">Enter a topic. Everything else — script, scenes, voice, animation, subtitles and export — is automatic.</p>

      <Card>
        <Field
          label="Category"
          hint={
            motivation
              ? 'Cinematic black-and-gold shots, a deep narrator, a beat-synced soundtrack and huge words on screen.'
              : stick
                ? 'Claude writes the script, then animates every shot in code (stick figures, bright cartoon world, whip transitions) and checks its own frames. Needs an Anthropic API key; about $1–3 per video.'
                : 'The white mascot tells a finance story with objects, charts and captions.'
          }
        >
          <Segmented value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
        </Field>
        <Field label="Topic" error={tooShort ? 'Topic is too short (min 8 characters).' : null} hint="One question or scenario works best.">
          <textarea className="input topic" value={topic} maxLength={300} placeholder={examples[0]} onChange={(e) => setTopic(e.target.value)} rows={3} autoFocus />
        </Field>
        <div className="chips">
          {examples.map((ex) => (
            <button key={ex} className="chip" onClick={() => setTopic(ex)}>
              {ex}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <Field label="Video duration">
            <Segmented value={duration} onChange={setDuration} options={DURATION_OPTIONS.map((d) => ({ value: d, label: d === 'auto' ? 'Automatic' : `${d} s` }))} />
          </Field>
          <Field label="Language">
            <Segmented value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))} />
          </Field>
          <Field label="Narration">
            <Segmented value={narrator} onChange={setNarrator} options={NARRATOR_OPTIONS.map((n) => ({ value: n, label: n === 'auto' ? 'Automatic' : n === 'male' ? 'Male' : 'Female' }))} />
          </Field>
          {stick ? null : motivation ? (
            <Field label="Music" hint="Automatic picks the style that fits the theme (money/discipline → phonk, success → epic, mindset → piano).">
              <Select value={editMusic} onChange={setEditMusic} options={EDIT_MUSIC_STYLES.map((m) => ({ value: m, label: EDIT_MUSIC_LABELS[m] }))} />
            </Field>
          ) : (
            <>
              <Field label="Storytelling">
                <Select value={storytelling} onChange={setStorytelling} options={STORYTELLING_STYLES.map((s) => ({ value: s, label: STORYTELLING_LABELS[s] }))} />
              </Field>
              <Field label="Visual style" hint={visualStyle === 'custom-brand' ? 'Uses the brand name and colours from Settings.' : 'Black background, white mascot, yellow and red highlights.'}>
                <Select value={visualStyle} onChange={setVisualStyle} options={VISUAL_STYLES.map((s) => ({ value: s, label: VISUAL_STYLE_LABELS[s] }))} />
              </Field>
            </>
          )}
          <Field label="Generation mode">
            <div className="mode-pill">
              <IconSpark size={14} /> Fully automatic
            </div>
          </Field>
        </div>

        {providers && (
          <div className="providers-row">
            <span className="muted small">Providers:</span>
            <Badge tone={providers.llm.ready ? 'danger' : 'neutral'}>Script · {providers.llm.label}</Badge>
            <Badge tone={providers.tts.ready ? 'danger' : 'neutral'}>Voice · {providers.tts.label}</Badge>
            <Badge tone={providers.image.ready ? 'danger' : 'neutral'}>Images · {providers.image.label}</Badge>
          </div>
        )}

        {problems.length > 0 && (
          <div className="alert alert-danger">
            {problems.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
          </div>
        )}

        <div className="form-actions">
          <Button variant="primary" size="lg" disabled={submitting || topic.trim().length < 8 || problems.length > 0} onClick={submit}>
            {submitting ? 'Starting…' : 'GENERATE VIDEO'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
