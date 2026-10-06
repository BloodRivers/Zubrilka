export const PAUSE_S = 1.0;

export function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

export function levDist(ref, hyp) {
  const n = ref.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[n][m];
}

export function computeMetrics({ words = [], duration = 0, sourceText = "", transcript = "" }) {
  let maxGap = 0;
  let longGaps = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > maxGap) maxGap = gap;
    if (gap > PAUSE_S) longGaps += 1;
  }
  const ref = tokenize(sourceText);
  const hyp = tokenize(transcript);
  const dist = levDist(ref, hyp);
  return {
    duration,
    wordCount: words.length,
    maxGap: Number(maxGap.toFixed(2)),
    longGaps,
    pauseLimit: PAUSE_S,
    wordsPerSec: duration ? Number((words.length / duration).toFixed(2)) : 0,
    refWords: ref.length,
    hypWords: hyp.length,
    wer: ref.length ? Number((dist / ref.length).toFixed(2)) : 0,
  };
}