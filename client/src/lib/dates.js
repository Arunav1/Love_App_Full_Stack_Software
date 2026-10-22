export function parseDay(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Calendar-accurate time elapsed since `start` (years, months, days, h, m, s). */
export function timeSince(start, now = new Date()) {
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalMs = now - start;
  return {
    years,
    months,
    days,
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
    totalDays: Math.floor(totalMs / 86400000),
    totalMs,
  };
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Still awake';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export const dayIndex = (date = new Date()) =>
  Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);

export const sameMonthDay = (a, b) => a && b && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Special day for today, if any: birthday, anniversary or monthiversary. */
export function specialDay(settings, now = new Date()) {
  const birthday = parseDay(settings.birthday);
  const start = parseDay(settings.startDate);
  if (sameMonthDay(birthday, now)) return { kind: 'birthday', text: `Happy Birthday, ${settings.herName}! 🎂` };
  if (start && start < now) {
    const t = timeSince(start, now);
    if (sameMonthDay(start, now) && t.years > 0) {
      return { kind: 'anniversary', text: `Happy ${ordinal(t.years)} anniversary, my love! 💞` };
    }
    if (now.getDate() === start.getDate() && t.totalDays > 20) {
      const m = t.years * 12 + t.months;
      return { kind: 'monthiversary', text: `Happy ${m}-month-versary! 🌸` };
    }
  }
  return null;
}

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const formatDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString(undefined, opts);

/** Deterministic pseudo-random number for a given day – same "memory of the day" all day. */
export function seeded(seed) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
