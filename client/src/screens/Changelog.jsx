import { useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import Accordion from "../components/Accordion";
import { CHANGELOG } from "./Subjects";

export default function Changelog() {
  const { t } = useTheme();
  const [open, setOpen] = useState(0);

  return (
    <div>
      {CHANGELOG.map((rel, i) => (
        <Accordion
          key={i}
          title={rel.date}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        >
          {(rel.items || []).map((item, j) => (
            <div key={j} style={{ color: t.sub, fontSize: 14, padding: "5px 0", paddingLeft: 4, lineHeight: 1.45 }}>
              — {item}
            </div>
          ))}
        </Accordion>
      ))}
    </div>
  );
}
