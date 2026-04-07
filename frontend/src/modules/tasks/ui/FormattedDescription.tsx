/* Parse description — handles HTML tags, \n, numbered lists, bullets.
   Preserves original line breaks and paragraph spacing faithfully. */
export function FormattedDescription({ text }: { text?: string }) {
  if (!text || text.trim() === "" || text === "Sem descrição") {
    return (
      <p className="text-[11px] text-[hsl(var(--task-text-muted)/0.6)] italic leading-relaxed">
        Sem descrição disponível
      </p>
    );
  }

  // ── HTML content ──
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  if (hasHtml) {
    const sanitized = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "");
    return (
      <div
        className="formatted-desc text-[11px] text-[hsl(var(--task-text)/0.85)] leading-[1.7] max-w-none
          [&_br]:block
          [&_p]:mb-2 [&_p]:leading-[1.7]
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5
          [&_li]:mb-1 [&_li]:text-[hsl(var(--task-text)/0.85)] [&_li]:leading-[1.6]
          [&_strong]:text-[hsl(var(--task-text))] [&_strong]:font-semibold
          [&_b]:text-[hsl(var(--task-text))] [&_b]:font-semibold
          [&_a]:text-[hsl(var(--task-purple))] [&_a]:underline [&_a]:underline-offset-2
          [&_h1]:text-sm [&_h1]:font-bold [&_h1]:text-[hsl(var(--task-text))] [&_h1]:mt-3 [&_h1]:mb-1
          [&_h2]:text-xs [&_h2]:font-bold [&_h2]:text-[hsl(var(--task-text))] [&_h2]:mt-2.5 [&_h2]:mb-1
          [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-[hsl(var(--task-text))] [&_h3]:mt-2 [&_h3]:mb-0.5"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  // ── Plain text — split by newlines, preserving empty lines as paragraph breaks ──
  const rawLines = text.replace(/\\n/g, "\n").split(/\n/);

  // Group consecutive non-empty lines into paragraphs, empty lines create breaks
  const paragraphs: Array<{ type: "gap" } | { type: "line"; content: string }> = [];
  for (const raw of rawLines) {
    if (raw.trim() === "") {
      // Only add gap if last item isn't already a gap
      if (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].type !== "gap") {
        paragraphs.push({ type: "gap" });
      }
    } else {
      paragraphs.push({ type: "line", content: raw });
    }
  }

  // Remove trailing gap
  if (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].type === "gap") {
    paragraphs.pop();
  }

  if (paragraphs.length === 0) {
    return (
      <p className="text-[11px] text-[hsl(var(--task-text-muted)/0.6)] italic leading-relaxed">
        Sem descrição disponível
      </p>
    );
  }

  // Single line — simple render
  if (paragraphs.length === 1 && paragraphs[0].type === "line") {
    return (
      <p className="text-[11px] text-[hsl(var(--task-text)/0.85)] leading-[1.7] whitespace-pre-wrap">
        {paragraphs[0].content}
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {paragraphs.map((item, i) => {
        if (item.type === "gap") {
          return <div key={`gap-${i}`} className="h-2.5" aria-hidden="true" />;
        }

        const line = item.content;

        // Numbered step: "1. text" or "1) text"
        const stepMatch = line.match(/^(\d+)[.)]\s*(.*)/);
        if (stepMatch) {
          return (
            <div key={i} className="flex items-start gap-2.5 py-0.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--task-yellow)/0.1)] text-[9px] font-bold text-[hsl(var(--task-yellow))] border border-[hsl(var(--task-yellow)/0.15)] mt-px">
                {stepMatch[1]}
              </span>
              <p className="text-[11px] text-[hsl(var(--task-text)/0.85)] leading-[1.7]">{stepMatch[2]}</p>
            </div>
          );
        }

        // Bullet: "- text", "• text", "* text"
        const bulletMatch = line.match(/^[-•*]\s*(.*)/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1 py-px">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--task-purple)/0.6)]" />
              <p className="text-[11px] text-[hsl(var(--task-text)/0.85)] leading-[1.7]">{bulletMatch[1]}</p>
            </div>
          );
        }

        // Label line: "Label: value" — only if starts with uppercase word(s)
        const labelMatch = line.match(/^([A-ZÀ-Ú][A-Za-zÀ-ÿ]*(?:\s[a-zà-ÿ]+)*):\s+(.*)/);
        if (labelMatch) {
          return (
            <div key={i} className="py-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--task-text-muted)/0.7)]">
                {labelMatch[1]}
              </span>
              <p className="text-[11px] text-[hsl(var(--task-text)/0.85)] leading-[1.7] mt-0.5">{labelMatch[2]}</p>
            </div>
          );
        }

        // Regular line
        return (
          <p key={i} className="text-[11px] text-[hsl(var(--task-text)/0.85)] leading-[1.7] py-px whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
  );
}
