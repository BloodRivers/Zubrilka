import { useTheme } from "../theme/ThemeContext";
import { CONJUNCTION_CATEGORIES, CONJUNCTION_NOTES } from "../data/conjunctions";

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

const catById = Object.fromEntries(CONJUNCTION_CATEGORIES.map((category) => [category.id, category]));
const rows = (ids) => ids.map((id) => catById[id]).filter(Boolean);

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

function Table({ title, categories, t }) {
  return (
    <table style={tableStyle(t)}>
      <thead>
        <tr>
          <th style={thStyle(t)}>{title}</th>
          <th style={thStyle(t)}>Примеры</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((category, index) => {
          const last = index === categories.length - 1;
          return (
            <tr key={category.id}>
              <td style={tdStyle(t, last)}>{category.title}</td>
              <td style={tdStyle(t, last)}>
                <Pills items={category.words} t={t} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ConjunctionsTheory() {
  const { t } = useTheme();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
      <Section title="1) По строению">
        <Table title="Вид" categories={rows(["simple", "compound"])} t={t} />
      </Section>

      <Section title="2) Сочинительные (по функции)">
        <Table title="Разряд" categories={rows(["connecting", "contrast", "disjunctive"])} t={t} />
      </Section>

      <Section title="3) Подчинительные (по функции)">
        <Table
          title="Разряд"
          categories={rows(["explanatory", "causal", "purposive", "temporal", "conditional", "comparative", "concessive", "result"])}
          t={t}
        />
      </Section>

      {CONJUNCTION_NOTES.map((note) => (
        <div key={note.title} style={{ borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface, padding: "14px 16px" }}>
          <div style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{note.title}</div>
          <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.6 }}>{note.text}</div>
        </div>
      ))}
    </div>
  );
}
