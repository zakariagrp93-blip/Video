import { describe, expect, it } from 'vitest';
import { displayTokens, normalizeForSpeech, numberSyllables, sentenceProsody, splitClauses, splitSentences, wordCount } from '../../src/core/text/speech';

describe('normalizeForSpeech', () => {
  it('handles French amounts, percentages and rates', () => {
    expect(normalizeForSpeech('Ton compte affiche 1 000 000 €.', 'fr')).toBe('Ton compte affiche 1 million d’euros.');
    expect(normalizeForSpeech('Soit 3 750 €/mois', 'fr')).toBe('Soit 3750 euros par mois');
    expect(normalizeForSpeech('un rendement de 5 %', 'fr')).toBe('un rendement de 5 pour cent');
    expect(normalizeForSpeech('environ 2,4 millions €', 'fr')).toBe('environ 2,4 millions d’euros');
  });
  it('handles English prefix currencies', () => {
    expect(normalizeForSpeech('You get €1 million at 18.', 'en')).toBe('You get 1 million euros at 18.');
    expect(normalizeForSpeech('That is $45,000/year', 'en')).toBe('That is 45000 dollars per year');
    expect(normalizeForSpeech('€1 a day', 'en')).toBe('1 euro a day');
  });
});

describe('amount shorthand (read correctly by every voice)', () => {
  it.each([
    ['93k€', '93000 euros'],
    ['93 k€', '93000 euros'],
    ['€93k', '93000 euros'],
    ['93K euros', '93000 euros'],
    ['1,5M€', '1,5 million d’euros'],
    ['2,5 M€', '2,5 millions d’euros'],
    ['2 Md€', '2 milliards d’euros'],
    ['100k abonnés', '100000 abonnés'],
    ['1 000 000 €', '1 million d’euros'],
    ['2 500 000 €', '2,5 millions d’euros'],
    ['93 000 €', '93000 euros'],
  ])('fr: %s → %s', (input, out) => expect(normalizeForSpeech(input, 'fr')).toBe(out));

  it.each([
    ['€93k', '93000 euros'],
    ['$1.5M', '1.5 million dollars'],
    ['$2bn', '2 billion dollars'],
    ['1,000,000 dollars', '1000000 dollars'],
  ])('en: %s → %s', (input, out) => expect(normalizeForSpeech(input, 'en')).toBe(out));

  it('leaves words that merely start with k or M alone', () => {
    expect(normalizeForSpeech('3 kilos et 2 Mondes', 'fr')).toBe('3 kilos et 2 Mondes');
  });
});

describe('storytelling rhythm', () => {
  it('slows punchlines, speeds long explanations, pauses after questions and ellipses', () => {
    expect(sentenceProsody('Et là, surprise.').speed).toBeLessThan(1);
    expect(sentenceProsody('Et là, surprise.').pause).toBeGreaterThan(1);
    expect(sentenceProsody('Combien aurais-tu après trente ans de placements réguliers ?').pause).toBe(1.5);
    expect(sentenceProsody('Ça fait environ 3 750 € par mois…').pause).toBe(2);
    expect(sentenceProsody('Si tu places cet argent à cinq pour cent par an pendant trente ans tu obtiens une somme énorme.').speed).toBeGreaterThan(1);
  });
});

describe('tokenization', () => {
  it('keeps numbers with their units together', () => {
    expect(displayTokens('Tu as 1 000 000 € à 18 ans ?')).toEqual(['Tu', 'as', '1 000 000 €', 'à', '18', 'ans ?']);
    expect(wordCount('Tu as 1 000 000 € à 18 ans ?')).toBe(6);
  });
  it('splits clauses without breaking decimals', () => {
    expect(splitClauses('Environ 2,4 millions, sans rien faire. Incroyable !')).toEqual([
      { text: 'Environ 2,4 millions', punct: ',' },
      { text: 'sans rien faire', punct: '.' },
      { text: 'Incroyable', punct: '!' },
    ]);
  });
  it('splits sentences', () => {
    expect(splitSentences('Imagine. Tu as 18 ans ! Et après ? 2.5 % net.')).toEqual(['Imagine.', 'Tu as 18 ans !', 'Et après ?', '2.5 % net.']);
  });
  it('estimates number syllables', () => {
    expect(numberSyllables(1000000, 'fr')).toBe(3); // un million
    expect(numberSyllables(18, 'fr')).toBe(2); // dix-huit
    expect(numberSyllables(3750, 'fr')).toBeGreaterThanOrEqual(5);
  });
});
