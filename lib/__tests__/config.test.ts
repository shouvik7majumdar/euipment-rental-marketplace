import { describe, it, expect } from 'vitest';
import { stroopsToXLM, xlmToStroops, truncateAddress, formatTimestamp } from '../config';

describe('Config Utility Helpers', () => {
  describe('stroopsToXLM', () => {
    it('converts BigInt stroops to XLM string with 7 decimal precision', () => {
      expect(stroopsToXLM(BigInt(10_000_000))).toBe('1.0000000');
      expect(stroopsToXLM(BigInt(100_000_000))).toBe('10.0000000');
      expect(stroopsToXLM(BigInt(500))).toBe('0.0000500');
      expect(stroopsToXLM(BigInt(0))).toBe('0.0000000');
    });
  });

  describe('xlmToStroops', () => {
    it('converts XLM string to BigInt stroops correctly', () => {
      expect(xlmToStroops('1')).toBe(BigInt(10_000_000));
      expect(xlmToStroops('10.5')).toBe(BigInt(105_000_000));
      expect(xlmToStroops('0.00005')).toBe(BigInt(500));
      expect(xlmToStroops('0')).toBe(BigInt(0));
    });

    it('returns 0 for negative or invalid inputs', () => {
      expect(xlmToStroops('-5')).toBe(BigInt(0));
      expect(xlmToStroops('abc')).toBe(BigInt(0));
    });
  });

  describe('truncateAddress', () => {
    it('truncates a long stellar address correctly', () => {
      const addr = 'GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3';
      expect(truncateAddress(addr)).toBe('GBPM3E...CIW3');
    });

    it('returns empty string or short string unmodified', () => {
      expect(truncateAddress('')).toBe('');
      expect(truncateAddress('GBPM3E')).toBe('GBPM3E');
    });
  });

  describe('formatTimestamp', () => {
    it('formats a unix timestamp to local date string', () => {
      const ts = 1719000000; // 2024-06-21
      const formatted = formatTimestamp(ts);
      expect(formatted).toContain('2024');
    });
  });
});
