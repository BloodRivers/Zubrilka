// Расписание повторений и недельная статистика: node client/test/progress.test.mjs
import assert from "node:assert/strict";
import { addDays, dayKey, dueReviews, isDue, nextReview, nextStreak, weeklyStats } from "../src/progress.js";

const now = new Date(2026, 10, 24);

assert.equal(dayKey(now), "2026-11-24");
assert.equal(addDays("2026-11-24", 1), "2026-11-25");
assert.equal(addDays("2026-03-01", -1), "2026-02-28");

assert.equal(nextReview(null, { score: 1, total: 2, weak_topics: ["x"] }, now).interval, 1);
assert.equal(nextReview(null, { score: 0, total: 5, weak_topics: [] }, now).interval, 1);
assert.equal(nextReview(null, { score: 4, total: 5, weak_topics: [] }, now).interval, 2);
assert.equal(nextReview(null, { score: 5, total: 5, weak_topics: [] }, now).interval, 3);
assert.equal(nextReview({ interval: 3 }, { score: 5, total: 5, weak_topics: [] }, now).interval, 6);
assert.equal(nextReview({ interval: 30 }, { score: 5, total: 5, weak_topics: [] }, now).interval, 30);
assert.equal(nextReview(null, { score: 1, total: 1, weak_topics: [] }, now).due, "2026-11-27");

assert.equal(isDue({ due: "2026-11-24" }, now), true);
assert.equal(isDue({ due: "2026-11-25" }, now), false);
assert.deepEqual(
  dueReviews({ reviews: { a: { due: "2026-11-23" }, b: { due: "2026-11-24" }, c: { due: "2026-12-01" } } }, now).map((r) => r.test_id),
  ["a", "b"]
);

assert.deepEqual(nextStreak({ last: "2026-11-24", days: 2 }, now), { last: "2026-11-24", days: 2 });
assert.deepEqual(nextStreak({ last: "2026-11-23", days: 2 }, now), { last: "2026-11-24", days: 3 });
assert.deepEqual(nextStreak({ last: "2026-11-20", days: 5 }, now), { last: "2026-11-24", days: 1 });

const results = [
  { score: 4, total: 5, created_at: { toMillis: () => new Date(2026, 10, 24).getTime() } },
  { score: 1, total: 2, created_at: { toMillis: () => new Date(2026, 10, 20).getTime() } },
  { score: 5, total: 5, created_at: { toMillis: () => new Date(2026, 10, 1).getTime() } },
];
assert.deepEqual(weeklyStats(results, now), { tests: 2, accuracy: 71 });
assert.deepEqual(weeklyStats([], now), { tests: 0, accuracy: 0 });

console.log("ok: progress");
