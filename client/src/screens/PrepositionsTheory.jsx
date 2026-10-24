import { useTheme } from "../theme/ThemeContext";

const tableStyle = (t) => ({
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  borderRadius: 16,
  overflow: "hidden",
  border: `1px solid ${t.border}`,
  background: t.surface,
});

const thStyle = (t) => ({
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: t.sub,
  background: t.raised,
  borderBottom: `1px solid ${t.border}`,
});

const tdStyle = (t, last = false) => ({
  padding: "10px 14px",
  fontSize: 13,
  lineHeight: 1.6,
  color: t.text,
  borderBottom: last ? "none" : `1px solid ${t.border}`,
  verticalAlign: "top",
});

const pillStyle = (t) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  border: `1px solid ${t.border}`,
  background: t.raised,
  fontSize: 12,
  fontWeight: 600,
  margin: "2px 4px 2px 0",
});

function Section({ title, children }) {
  const { t } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{title}</div>
      {children}
    </div>
  );
}

function Pills({ items, t }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {items.map((item) => (
        <span key={item} style={pillStyle(t)}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function PrepositionsTheory() {
  const { t } = useTheme();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
      <Section title="1) По строению">
        <table style={tableStyle(t)}>
          <thead>
            <tr>
              <th style={thStyle(t)}>Вид</th>
              <th style={thStyle(t)}>Примеры</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle(t)}>Простые (одно слово)</td>
              <td style={tdStyle(t)}><Pills items={["без", "в", "до", "для", "за", "из", "к", "на", "над", "о", "от", "по", "под", "перед", "при", "про", "с", "у", "через"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Сложные (через дефис)</td>
              <td style={tdStyle(t)}><Pills items={["из-за", "из-под"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t, true)}>Составные (из нескольких слов)</td>
              <td style={tdStyle(t, true)}><Pills items={["в течение", "в продолжение", "несмотря на", "в соответствии с", "по мере", "по поводу", "на основании", "на основе", "при условии", "в целях"]} t={t} /></td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="2) По производности">
        <table style={tableStyle(t)}>
          <thead>
            <tr>
              <th style={thStyle(t)}>Разряд</th>
              <th style={thStyle(t)}>Примеры</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle(t)}>Непроизводные</td>
              <td style={tdStyle(t)}><Pills items={["без", "в", "до", "для", "за", "из", "к", "на", "над", "о", "от", "по", "под", "перед", "при", "про", "с", "у", "через"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Производные от имён существительных</td>
              <td style={tdStyle(t)}><Pills items={["в течение", "в продолжение", "ввиду", "вследствие", "насчёт", "по поводу", "в соответствии с", "посредством", "за счёт", "наподобие", "вроде", "в виде"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Производные от наречий</td>
              <td style={tdStyle(t)}><Pills items={["возле", "вокруг", "мимо", "после", "позади"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t, true)}>Отглагольные (от деепричастий)</td>
              <td style={tdStyle(t, true)}><Pills items={["благодаря", "спустя", "включая", "несмотря на"]} t={t} /></td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="3) По значению">
        <table style={tableStyle(t)}>
          <thead>
            <tr>
              <th style={thStyle(t)}>Разряд</th>
              <th style={thStyle(t)}>Примеры</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle(t)}>Пространственные (место, направление)</td>
              <td style={tdStyle(t)}><Pills items={["в", "на", "к", "из", "до", "от", "под", "над", "перед", "у", "по", "через", "около"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Временные</td>
              <td style={tdStyle(t)}><Pills items={["в", "к", "до", "после", "в течение", "в продолжение", "спустя", "по мере", "около"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Причинные</td>
              <td style={tdStyle(t)}><Pills items={["из-за", "ввиду", "вследствие", "по причине", "благодаря"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Целевые</td>
              <td style={tdStyle(t)}><Pills items={["для", "за", "в целях"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Образа действия (способ, средство)</td>
              <td style={tdStyle(t)}><Pills items={["с помощью", "при помощи", "посредством", "за счёт"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Уступительные</td>
              <td style={tdStyle(t)}><Pills items={["несмотря на", "вопреки"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Условные</td>
              <td style={tdStyle(t)}><Pills items={["при", "при условии"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Сравнительные</td>
              <td style={tdStyle(t)}><Pills items={["наподобие", "вроде", "в виде"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t)}>Объектные</td>
              <td style={tdStyle(t)}><Pills items={["о", "про", "насчёт", "по поводу"]} t={t} /></td>
            </tr>
            <tr>
              <td style={tdStyle(t, true)}>Источник информации</td>
              <td style={tdStyle(t, true)}><Pills items={["по", "согласно", "в соответствии с", "на основе", "на основании"]} t={t} /></td>
            </tr>
          </tbody>
        </table>

        <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.6 }}>
          * У одного и того же предлога может быть сразу несколько значений (омонимия). В таких случаях решает контекст.
        </div>
      </Section>
    </div>
  );
}
