'use client';

import { useRef } from 'react';
import { Mark } from '@/components/SiteChrome';
import { site } from '@/lib/site';

/** The product itself as the hero: a request, the planner's reply and the plan as a change review. */
export function PlanPanel() {
  const log = useRef<HTMLPreElement>(null);

  function replay() {
    const el = log.current;
    if (!el) return;
    el.hidden = false;
    el.classList.remove('replay');
    void el.offsetWidth;
    Array.from(el.children).forEach((line, i) => {
      (line as HTMLElement).style.animationDelay = `${i * 0.28}s`;
    });
    el.classList.add('replay');
  }

  return (
    <figure className="shot" aria-label="Example conversation and plan">
      <div className="shot-bar">
        <i /><i /><i />
        <span>Joiners, movers and leavers</span>
      </div>
      <div className="shot-body">
        <div className="msg-user">
          <div className="bubble">
            Joiners need sign-off from People, then a named approver. Move them through HR checks, IT provisioning and
            Facilities, and stop the SLA while IT wait for kit.
          </div>
        </div>
        <div className="msg-planner">
          <div className="planner-who">
            <Mark size={18} />
            <span>{site.name}</span>
            <span className="badge accent"><span className="dot" />1 question to answer</span>
          </div>
          <p className="reply">
            You already have the People Operations team, an Awaiting Equipment status that pauses the SLA and a 5-day
            joiner SLA, so I&apos;ll reuse those and build the rest.
          </p>
          <div className="plan-card">
            <div className="plan-section">
              <h3>Changes to your Halo</h3>
              <ul className="diff">
                <li className="add"><span className="sign">+</span><div className="what"><b>New Joiner</b> <span className="kind">new ticket type</span><p>8 fields, 4 required; team People Operations</p></div></li>
                <li className="add"><span className="sign">+</span><div className="what"><b>Joiner approval</b> <span className="kind">new approval</span><p>People Approvers, then a named approver</p></div></li>
                <li className="change"><span className="sign">~</span><div className="what"><b>Joiner Workflow</b> <span className="kind">workflow</span><p>Add stages HR Checks, IT Provisioning and Facilities</p></div></li>
                <li className="keep"><span className="sign">=</span><div className="what"><b>Awaiting Equipment</b> <span className="kind">reused</span><p>Already pauses the SLA</p></div></li>
                <li className="cant"><span className="sign">!</span><div className="what"><b>Child tickets for each piece of kit</b> <span className="kind">can’t do yet</span></div></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="shot-foot">
        <span>Nothing has been written to Halo yet.</span>
        <button className="btn btn-primary btn-sm" type="button" onClick={replay}>Approve and build</button>
      </div>
      <pre className="log" ref={log} aria-live="polite" hidden>
        <div className="dim">Building on your-instance.haloitsm.com</div>
        <div><span className="ok">+</span> ticket type   New Joiner            created, verified</div>
        <div><span className="ok">+</span> approval      Joiner approval       created, verified</div>
        <div><span className="ok">~</span> workflow      Joiner Workflow       updated, verified</div>
        <div className="dim">3 changes. Nothing deleted. Audit log saved.</div>
      </pre>
    </figure>
  );
}
