'use client';

import { useState } from 'react';

type Choice = { question: string; options: string[] };

/**
 * Decisions the planner needs before it builds that part (rule M13), as buttons. Picking one sends it as the next
 * message; "Something else" puts the question in the box to answer in your own words.
 */
export function Choices({ choices, live }: { choices: Choice[]; live: boolean }) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const answered = choices.every((_, i) => picked[i]);

  const send = (text: string) => window.dispatchEvent(new CustomEvent('specflow:send', { detail: text }));
  const pick = (i: number, option: string) => {
    const next = { ...picked, [i]: option };
    setPicked(next);
    // One choice: send straight away. Several: send once every one has an answer.
    if (choices.every((_, j) => next[j])) send(choices.map((c, j) => `${c.question} ${next[j]}`).join('\n'));
  };
  const other = (c: Choice) => window.dispatchEvent(new CustomEvent('specflow:reply', { detail: `${c.question} ` }));

  return (
    <div className="questions choices">
      <b>{live ? 'Choose before I build this part:' : 'I asked you to choose:'}</b>
      {choices.map((c, i) => (
        <div key={c.question} className="choice">
          <p>{c.question}</p>
          {live ? (
            <div className="choice-options" role="group" aria-label={c.question}>
              {c.options.map((o, n) => (
                <button key={o} type="button" className={`btn btn-sm ${picked[i] === o ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={picked[i] === o} disabled={answered} onClick={() => pick(i, o)}>
                  <span className="choice-num">{n + 1}</span> {o}
                </button>
              ))}
              <button type="button" className="btn btn-sm btn-quiet" disabled={answered} onClick={() => other(c)}>
                Something else
              </button>
            </div>
          ) : (
            <p className="subtle">{c.options.join(' · ')}</p>
          )}
        </div>
      ))}
    </div>
  );
}
