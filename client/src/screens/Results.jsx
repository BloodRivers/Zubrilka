import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import Button from "../components/Button";
import MathText from "../components/MathText";
import TestEditModal from "../components/TestEditModal";
import { peekReturnTo } from "../nav";
import { sfx } from "../sfx";

function joinMath(items) {
  const clean = items.filter(Boolean);
  if (!clean.length) return null;
  return clean.reduce(
    (acc, text, i) => (
      <>
        {acc}
        {i > 0 && ", "}
        <MathText as="span" text={text} />
      </>
    ),
    null
  );
}

export default function Results() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { state } = useLocation();
  const score = state?.score ?? 0;
  const total = state?.total ?? 0;
  const weak = state?.weak ?? [];
  const detail = state?.detail;
  const choice = Array.isArray(detail?.choice) ? detail.choice : Array.isArray(detail) ? detail : [];
  const quizlet = Array.isArray(detail?.quizlet) ? detail.quizlet : [];
  const matchPairs = Array.isArray(detail?.match) ? detail.match : [];
  const written = state?.written || detail?.written || null;
  const quizletScore = state?.quizlet_score ?? quizlet.filter((c) => c.known).length;
  const quizletTotal = state?.quizlet_total ?? quizlet.length;
  const matchScore = state?.match_score ?? matchPairs.filter((p) => p.ok).length;
  const matchTotal = state?.match_total ?? matchPairs.length;
  const subjectId = state?.subjectId;
  const testId = state?.testId;
  const from = state?.from;
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => { sfx.win(); }, []);

  const goDone = () => {
    if (from) navigate(from, { replace: true, state: from.startsWith("/note/") ? { from: peekReturnTo() || undefined } : undefined });
    else if (subjectId) navigate(`/subject/${subjectId}`, { state: { tab: "tests" } });
    else {
      const ret = peekReturnTo();
      navigate(ret || "/", { replace: true });
    }
  };

  const scoreLabel = choice.length > 0
    ? "верно"
    : quizletTotal > 0 && total === quizletTotal
      ? "знакомо"
      : matchTotal > 0 && total === matchTotal
        ? "пар"
        : written?.grade != null && total === 5
          ? "оценка"
          : "верно";
  const showQuizletBadge = quizletTotal > 0 && (choice.length > 0 || matchTotal > 0 || written?.grade != null);
  const showMatchBadge = matchTotal > 0 && (choice.length > 0 || quizletTotal > 0 || written?.grade != null);
  const showWrittenBadge = written?.grade != null && (choice.length > 0 || quizletTotal > 0 || matchTotal > 0);

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>Итог теста</div>
      {total > 0 && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <div style={{ color: t.text, fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em" }}>
            {score}/{total}
          </div>
          <div style={{ color: t.sub, fontSize: 15 }}>{scoreLabel}</div>
        </div>
      )}

      {(showQuizletBadge || showMatchBadge || showWrittenBadge) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {showQuizletBadge && (
            <span style={{ fontSize: 13, color: t.text, border: `1px solid ${t.border}`, padding: "6px 12px", borderRadius: 999 }}>
              Квизлет {quizletScore}/{quizletTotal}
            </span>
          )}
          {showMatchBadge && (
            <span style={{ fontSize: 13, color: t.text, border: `1px solid ${t.border}`, padding: "6px 12px", borderRadius: 999 }}>
              Пары {matchScore}/{matchTotal}
            </span>
          )}
          {showWrittenBadge && (
            <span style={{ fontSize: 13, color: t.text, border: `1px solid ${t.border}`, padding: "6px 12px", borderRadius: 999 }}>
              Письменно {written.grade}/5
            </span>
          )}
        </div>
      )}

      {weak.length > 0 ? (
        <>
          <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Стоит повторить</div>
          {weak.map((topic, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 0",
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{topic}</div>
              <div style={{ fontSize: 12, color: t.sub, border: `1px solid ${t.border}`, padding: "5px 10px", borderRadius: 999 }}>
                повторить
              </div>
            </div>
          ))}
          {testId && (
            <div style={{ marginTop: 14 }}>
              <Button
                variant="dashed"
                onClick={() => navigate(`/test/${testId}/quiz/weak`, { state: { from } })}
              >
                Повторить слабые темы
              </Button>
            </div>
          )}
        </>
      ) : (
        total > 0 && <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Все темы усвоены уверенно.</div>
      )}

      {choice.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Разбор ответов</div>
          {choice.map((item, i) => {
            const ok = Boolean(item.ok ?? item.correct);
            const correctIdx = item.correctIdx ?? item.correct;
            const correctList = Array.isArray(correctIdx) ? correctIdx : [Number(correctIdx)];
            const pickedList = Array.isArray(item.picked) ? item.picked : item.i != null ? [item.i] : [];
            return (
              <div
                key={i}
                style={{
                  padding: "14px 16px",
                  marginBottom: 10,
                  borderRadius: 16,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: ok ? t.invBg : "transparent",
                      border: ok ? "none" : `1px solid ${t.sub}`,
                      color: ok ? t.inv : t.sub,
                    }}
                  >
                    {ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                  </div>
                  <div style={{ color: t.text, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
                    {i + 1}. <MathText as="span" text={item.q} />
                  </div>
                </div>
                {!ok && pickedList.length > 0 && item.options && (
                  <div style={{ color: t.sub, fontSize: 13, paddingLeft: 32, marginBottom: 4 }}>
                    Твой ответ: {joinMath(pickedList.map((p) => item.options[p]))}
                  </div>
                )}
                {item.options && (
                  <div style={{ color: t.text, fontSize: 13, paddingLeft: 32 }}>
                    Верно: {joinMath(correctList.map((p) => item.options[p]))}
                  </div>
                )}
                {item.explain?.trim() && (
                  <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45, marginTop: 8, paddingLeft: 32 }}>
                    <MathText as="span" text={item.explain.trim()} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(written?.questions?.length || written?.comment) && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface }}>
          <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Письменный ответ</div>
          <div style={{ color: t.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{written.grade}/5</div>
          {Array.isArray(written.questions) ? (
            written.questions.map((r, i) => (
              <div key={i} style={{ marginTop: 8, paddingTop: 8, borderTop: i > 0 ? `1px solid ${t.border}` : "none" }}>
                <div style={{ color: t.text, fontSize: 14, fontWeight: 600, marginBottom: 3 }}><MathText text={r.prompt} /></div>
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45 }}>{r.grade}/5 · {r.comment || "—"}</div>
              </div>
            ))
          ) : (
            <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.45 }}>{written.comment}</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
        {testId && (
          <Button variant="dashed" onClick={() => setEditOpen(true)}>
            Редактировать тест
          </Button>
        )}
        <Button onClick={goDone}>Готово</Button>
      </div>

      <TestEditModal
        open={editOpen}
        testId={testId}
        title={state?.title}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
