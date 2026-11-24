// Повторение по расписанию: даты считаются локальным днём пользователя.

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(key, n) {
  const [y, m, d] = String(key).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

export function nextReview(prev, result, now = new Date()) {
  const weak = Array.isArray(result?.weak_topics) ? result.weak_topics : [];
  const total = Number(result?.total) || 0;
  const score = Number(result?.score) || 0;
  const accuracy = total ? score / total : 0;
  const prevInterval = Number(prev?.interval) || 0;

  let interval;
  if (!total || accuracy < 0.7 || weak.length) interval = 1;
  else if (accuracy >= 0.95) interval = Math.min(30, prevInterval ? prevInterval * 2 : 3);
  else interval = Math.min(30, prevInterval ? prevInterval + 1 : 2);

  return {
    due: addDays(dayKey(now), interval),
    interval,
    weak_topics: weak,
    title: result?.title || prev?.title || "",
    subject_id: result?.subject_id ?? prev?.subject_id ?? null,
  };
}

export function isDue(review, now = new Date()) {
  return Boolean(review?.due) && review.due <= dayKey(now);
}

export function dueReviews(profile, now = new Date()) {
  const reviews = profile?.reviews || {};
  return Object.entries(reviews)
    .filter(([, review]) => isDue(review, now))
    .map(([test_id, review]) => ({ test_id, ...review }))
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
}

export function nextStreak(streak, now = new Date()) {
  const today = dayKey(now);
  const last = streak?.last;
  const days = Number(streak?.days) || 0;
  if (last === today) return { last: today, days: Math.max(1, days) };
  if (last === addDays(today, -1)) return { last: today, days: days + 1 };
  return { last: today, days: 1 };
}

function resultDay(result) {
  const raw = result?.created_at;
  const ms = raw?.toMillis?.() ?? (typeof raw === "number" ? raw : 0);
  if (ms) return dayKey(new Date(ms));
  if (typeof raw?.seconds === "number") return dayKey(new Date(raw.seconds * 1000));
  return String(raw || "").slice(0, 10);
}

export function weeklyStats(results, now = new Date()) {
  const today = dayKey(now);
  const from = addDays(today, -6);
  const week = (results || []).filter((r) => {
    const day = resultDay(r);
    return day >= from && day <= today;
  });
  const total = week.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const correct = week.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  return { tests: week.length, accuracy: total ? Math.round((correct / total) * 100) : 0 };
}
