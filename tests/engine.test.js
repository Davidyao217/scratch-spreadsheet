import { describe, it, expect, beforeEach } from 'vitest';
import { initEngine, setCell, getCache, clearAllCells } from '../src/engine';

describe('Spreadsheet Engine', () => {
  beforeEach(() => {
    clearAllCells();
  });

  it('evaluates basic arithmetic', () => {
    setCell('A1', '=1+2*3');
    expect(getCache()['A1']).toBe(7);
  });

  it('handles cell references', () => {
    setCell('A1', '10');
    setCell('B1', '=A1*2');
    expect(getCache()['B1']).toBe(20);
  });

  it('updates dependencies when upstream cells change', () => {
    setCell('A1', '5');
    setCell('A2', '=A1+5');
    expect(getCache()['A2']).toBe(10);
    
    setCell('A1', '10');
    expect(getCache()['A2']).toBe(15);
  });

  it('computes SUM function correctly', () => {
    initEngine({
      'A1': '10',
      'A2': '20',
      'A3': '30',
      'A4': '=SUM(A1:A3)'
    });
    expect(getCache()['A4']).toBe(60);
  });

  it('computes COUNT function correctly, ignoring non-numbers', () => {
    initEngine({
      'A1': '10',
      'A2': 'hello',
      'A3': '',
      'A4': '20',
      'A5': '=COUNT(A1:A4)'
    });
    expect(getCache()['A5']).toBe(2);
  });

  it('detects circular dependencies', () => {
    setCell('A1', '=B1');
    setCell('B1', '=A1');
    expect(getCache()['A1']).toBe('#CIRC!');
    expect(getCache()['B1']).toBe('#CIRC!');
  });
});
