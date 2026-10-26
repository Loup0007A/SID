import { Fragment } from "react";

/** Texte du tuto : paragraphes séparés par une ligne vide, **gras**. */
export function Rich({ text, className = "", pClassName = "" }: { text: string; className?: string; pClassName?: string }) {
  return (
    <div className={className}>
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i} className={pClassName}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <Fragment key={j}>{part}</Fragment>
          )}
        </p>
      ))}
    </div>
  );
}
