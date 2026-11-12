'use client';

import { useState } from 'react';

/**
 * The planner's questions, each with its own answer box, just above the message box. Answers go as one reply
 * ("question: answer" per line); a question left blank is left out, so you can answer some now and some later.
 */
export function Questions({ questions }: { questions: string[] }) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
  const [open, setOpen] = useState(true);
  const [sent, setSent] = useState(false);
  const filled = answers.filter((a) => a.trim()).length;

  if (sent) return null;
  const send = () => {
    const text = questions.map((q, i) => (answers[i].trim() ? `${q}\n${answers[i].trim()}` : '')).filter(Boolean).join('\n\n');
    if (!text) return;
    setSent(true);
    window.dispatchEvent(new CustomEvent('specflow:send', { detail: text }));
  };

  return (
    <div className="ask" aria-label="Questions from the planner">
      <button type="button" className="ask-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <b>{questions.length === 1 ? 'One question before you build' : `${questions.length} questions before you build`}</b>
        <span className="subtle">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <form
          className="ask-body"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {questions.map((q, i) => (
            <label key={q} className="ask-q">
              <span>{q}</span>
              <textarea
                rows={1}
                value={answers[i]}
                placeholder="Your answer"
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
            </label>
          ))}
          <div className="ask-foot">
            <span className="subtle">{filled ? `${filled} of ${questions.length} answered` : 'Leave any you want to skip blank'}</span>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!filled}>Send answers</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
