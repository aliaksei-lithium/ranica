import { describe, expect, it } from 'vitest';
import { easter, holidaysAround, holidaysOf, orthodoxEaster } from '../src/compose/holidays';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('holidays', () => {
  it('computes Western and Orthodox Easter', () => {
    expect(iso(easter(2026))).toBe('2026-04-05');
    expect(iso(easter(2027))).toBe('2027-03-28');
    expect(iso(orthodoxEaster(2026))).toBe('2026-04-12');
    expect(iso(orthodoxEaster(2027))).toBe('2027-05-02');
  });

  it('merges a holiday shared by Berlin and Belarus', () => {
    const xmas = holidaysOf(2026, 'de').filter((h) => h.date === '2026-12-25');
    expect(xmas).toEqual([{ date: '2026-12-25', name: '1. Weihnachtstag', regions: ['berlin', 'belarus'], off: true }]);
  });

  it('places movable days', () => {
    const by = new Map(holidaysOf(2026, 'en').map((h) => [h.name, h.date]));
    expect(by.get('Radunitsa')).toBe('2026-04-21');
    expect(by.get('1st Sunday of Advent')).toBe('2026-11-29');
    expect(by.get('Clocks go back')).toBe('2026-10-25');
    expect(by.get('Whit Monday')).toBe('2026-05-25');
  });

  it('lists today and the next few, across the new year', () => {
    const h = holidaysAround('2026-11-11', 'de');
    expect(h.today.map((x) => x.name)).toEqual(['Martinstag']);
    expect(h.next.map((x) => [x.date, x.name, x.inDays])).toEqual([
      ['2026-11-29', '1. Advent', 18], ['2026-12-06', '2. Advent', 25], ['2026-12-06', 'Nikolaus', 25], ['2026-12-13', '3. Advent', 32],
    ]);
    expect(holidaysAround('2026-12-31', 'en', 2).next.map((x) => x.date)).toEqual(['2027-01-01', '2027-01-02']);
  });
});
