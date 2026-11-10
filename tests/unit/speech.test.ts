import { describe, expect, it } from 'vitest';
import { displayTokens, normalizeForSpeech, numberSyllables, splitClauses, splitSentences, wordCount } from '../../src/core/text/speech';

describe('normalizeForSpeech', () => {
  it('handles French amounts, percentages and rates', () => {
    expect(normalizeForSpeech('Ton compte affiche 1 000 000 €.', 'fr')).toBe('Ton compte affiche 1000000 euros.');
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
