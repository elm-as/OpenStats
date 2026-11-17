import { describe, expect, it } from 'vitest';
import { fmt } from './ResultAtoms';

describe('ResultAtoms fmt()', () => {
  it('formats confidence interval objects instead of raw JSON', () => {
    expect(fmt({ lower: 39.287889, upper: 39.471704 })).toBe('[39.2879 ; 39.4717]');
  });

  it('formats integers, floats, booleans and nulls cleanly', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(true)).toBe('Oui');
    expect(fmt(103905)).toBe((103905).toLocaleString('fr-FR'));
  });
});
