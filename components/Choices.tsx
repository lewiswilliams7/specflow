'use client';

import { useState } from 'react';

type Choice = { question: string; options: string[] };

/**
 * Decisions the planner needs before it builds that part (rule M13), as small buttons just above the message box.
 * Picking an answer for every question sends them as the next message; "Other" puts the question in the box.
 */
export function Choices({ choices }: { choices: Choice[] }) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);

  const pick = (i: number, option: string) => {
    const next = { ...picked, [i]: option };
    setPicked(next);
    if (choices.every((_, j) => next[j])) {
      setSent(true);
      window.dispatchEvent(new CustomEvent('specflow:send', { detail: choices.map((c, j) => `${c.question} ${next[j]}`).join('\n') }));
    }
  };
  const other = (c: Choice) => window.dispatchEvent(new CustomEvent('specflow:reply', { detail: `${c.question} ` }));

  if (sent) return null;
  return (
    <div className="choices" aria-label="Choices before building">
      {choices.map((c, i) => (
        <div key={c.question} className="choice" role="group" aria-label={c.question}>
          <span className="choice-q">{c.question}</span>
          <span className="choice-options">
            {c.options.map((o, n) => (
              <button key={o} type="button" className={`chip${picked[i] === o ? ' on' : ''}`} aria-pressed={picked[i] === o} onClick={() => pick(i, o)}>
                <span className="choice-num">{n + 1}</span>
                {o}
              </button>
            ))}
            <button type="button" className="chip quiet" onClick={() => other(c)}>Other</button>
          </span>
        </div>
      ))}
    </div>
  );
}
