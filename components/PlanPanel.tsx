'use client';

import { useRef } from 'react';

/** The product's own review screen, as the hero. "Approve and build" replays the build log. */
export function PlanPanel() {
  const log = useRef<HTMLPreElement>(null);

  function replay() {
    const el = log.current;
    if (!el) return;
    el.classList.remove('replay');
    void el.offsetWidth;
    Array.from(el.children).forEach((line, i) => {
      (line as HTMLElement).style.animationDelay = `${i * 0.28}s`;
    });
    el.classList.add('replay');
  }

  return (
    <figure className="plan" aria-label="Example plan">
      <div className="plan-head">
        <span>Plan · Joiners, movers and leavers</span>
        <span>Example</span>
      </div>
      <div className="ask">
        <small>Request</small>
        <p>
          &ldquo;Joiners need sign-off from People, then their manager. Move the ticket through HR checks, IT provisioning
          and Facilities, and stop the SLA while IT wait for kit.&rdquo;
        </p>
      </div>
      <div className="group">
        <h3>
          <span>Already in your Halo</span>
          <span>3</span>
        </h3>
        <ul className="lines">
          <li>
            <span className="chip built">Built</span>
            <span className="what">
              People Operations team <code>2 members</code>
            </span>
          </li>
          <li>
            <span className="chip built">Built</span>
            <span className="what">
              Awaiting Equipment status <code>pauses the SLA</code>
            </span>
          </li>
          <li>
            <span className="chip built">Built</span>
            <span className="what">Joiner - 5 working days SLA</span>
          </li>
        </ul>
      </div>
      <div className="group">
        <h3>
          <span>Will build</span>
          <span>4</span>
        </h3>
        <ul className="lines">
          <li>
            <span className="chip create">Create</span>
            <span className="what">
              New Joiner ticket type <code>8 fields, 4 required</code>
            </span>
          </li>
          <li>
            <span className="chip create">Create</span>
            <span className="what">Approval: People Approvers, then a named approver</span>
          </li>
          <li>
            <span className="chip update">Update</span>
            <span className="what">
              Joiner Workflow <code>+ IT Provisioning, + Facilities</code>
            </span>
          </li>
          <li>
            <span className="chip update">Update</span>
            <span className="what">
              Equipment Ordered action <code>sets Awaiting Equipment</code>
            </span>
          </li>
        </ul>
      </div>
      <div className="group">
        <h3>
          <span>Can&apos;t do yet</span>
          <span>1</span>
        </h3>
        <ul className="lines">
          <li>
            <span className="chip gap">Not yet</span>
            <span className="what">Child tickets for each piece of kit. Listed for your consultant.</span>
          </li>
        </ul>
        <p className="question">
          <b>Question:</b> Do you sync managers from Active Directory? Line-manager approval needs it. If not, we&apos;ll
          use a named approver.
        </p>
      </div>
      <div className="plan-foot">
        <span>Nothing has been written to Halo yet.</span>
        <button className="btn btn-primary" type="button" onClick={replay}>
          Approve and build
        </button>
      </div>
      <pre className="log" ref={log} aria-live="polite">
        <div className="dim">Building on your-instance.haloitsm.com</div>
        <div>
          <span className="ok">+</span> ticket type   New Joiner            created, verified
        </div>
        <div>
          <span className="ok">+</span> approval      People, then approver created, verified
        </div>
        <div>
          <span className="ok">~</span> workflow      Joiner Workflow       updated, verified
        </div>
        <div>
          <span className="ok">~</span> action        Equipment Ordered     updated, verified
        </div>
        <div className="dim">4 changes. Nothing deleted. Audit log saved.</div>
      </pre>
    </figure>
  );
}
