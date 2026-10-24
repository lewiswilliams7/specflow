import { PilotForm } from '@/components/PilotForm';
import { PlanPanel } from '@/components/PlanPanel';
import { site } from '@/lib/site';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <div>
              <h1>Describe the process. Approve the plan. {site.name} builds it in Halo.</h1>
              <p className="lede">
                Tell {site.name} what you need in plain English: the forms, approvals, SLAs and workflow stages. It reads
                your instance, shows exactly what it will create or change, and asks when something is unclear. Reply to
                refine it, like a conversation with a colleague who knows Halo.
              </p>
              <div className="cta-row">
                <a className="btn btn-primary btn-lg" href="/signup">Start free</a>
                <a className="btn btn-secondary btn-lg" href="#pilot">Apply for a pilot</a>
              </div>
              <p className="fineprint">Free to connect and generate plans. Building starts with our partner pilots in {site.pilotStart}. <a href="/pricing">See pricing</a></p>
            </div>
            <PlanPanel />
          </div>
        </section>

        <section className="section proof" aria-label="What we've proven">
          <div className="wrap">
            <div>
              <strong>47 objects</strong>
              <span>Built and checked in one run on a real Halo instance during testing: a full joiners, movers and leavers setup.</span>
            </div>
            <div>
              <strong>65 rules</strong>
              <span>Halo quirks we&apos;ve found and fixed, so they never reach your instance. The list grows with every build.</span>
            </div>
            <div>
              <strong>0 deletes</strong>
              <span>{site.name} never deletes anything in Halo. It creates, reuses and updates, and tells you what it can&apos;t do.</span>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head">
              <h2>How it works</h2>
              <p>Four steps, and you approve the plan before anything changes.</p>
            </div>
            <ol className="steps">
              <li>
                <h3>Connect</h3>
                <p>Add a Halo API application with the permissions we list. {site.name} reads your configuration, never your tickets.</p>
              </li>
              <li>
                <h3>Describe</h3>
                <p>Write what you need the way you&apos;d explain it to a colleague. If something is unclear, {site.name} asks before it plans.</p>
              </li>
              <li>
                <h3>Review</h3>
                <p>See what&apos;s already in Halo, what will be created, what will be updated and what it can&apos;t do. Change anything before you approve.</p>
              </li>
              <li>
                <h3>Build</h3>
                <p>{site.name} builds in the right order, checks each change after it&apos;s saved, and stops at the first problem. You get a report to sign off.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="split">
              <div className="section-head">
                <h2>It works with what you&apos;ve already built</h2>
                <p>
                  Real instances are never empty. Before planning, {site.name} reads every ticket type, form, approval, SLA
                  and workflow stage you have, and checks each part of your request against them. It reuses what fits,
                  updates what&apos;s nearly there, and only creates what&apos;s missing. No &ldquo;v2&rdquo; copies.
                </p>
              </div>
              <div className="plan-card" aria-label="Example: what's already there">
                <div className="plan-section">
                  <h3>Already in your Halo</h3>
                  <ul className="diff">
                    <li className="keep"><span className="sign">=</span><div className="what"><b>Mover form with required fields</b> <span className="kind">already there</span><p>Name, new department and date are required</p></div></li>
                    <li className="keep"><span className="sign">=</span><div className="what"><b>Leaver SLA, 4 hours for Critical</b> <span className="kind">already there</span><p>Leaver: 1 day, Critical 4 hours</p></div></li>
                    <li className="change"><span className="sign">~</span><div className="what"><b>Joiner workflow stages</b> <span className="kind">partly there</span><p>Has IT Provisioning and Facilities; HR checks will be added</p></div></li>
                    <li className="cant"><span className="sign">!</span><div className="what"><b>Email the manager when a joiner is approved</b> <span className="kind">can’t do yet</span><p>Listed for your consultant instead of half-built</p></div></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="builds">
          <div className="wrap">
            <div className="section-head">
              <h2>What it builds today</h2>
              <p>The groundwork of most Halo implementations. We&apos;d rather tell you what&apos;s not covered than build it badly.</p>
            </div>
            <div className="remit">
              <div className="card">
                <h3><span className="badge add">Builds</span>Builds and updates</h3>
                <ul>
                  <li>Custom fields <span>text, memo, date, dropdown, multi-select, checkbox</span></li>
                  <li>Forms and sections, with required fields</li>
                  <li>Ticket types, with team, SLA, approval and workflow</li>
                  <li>Approval processes <span>groups, named approvers, line managers, ad-hoc, several stages</span></li>
                  <li>SLAs, with targets per priority</li>
                  <li>Workflow stages, actions and statuses that pause the SLA</li>
                  <li>Teams and approval groups, with members</li>
                </ul>
              </div>
              <div className="card">
                <h3><span className="badge cant">Not yet</span>Listed for your consultant</h3>
                <ul>
                  <li>Fields that only show for certain answers</li>
                  <li>Approvals or routing that depend on a field&apos;s value</li>
                  <li>Email notifications and templates</li>
                  <li>Child tickets and ticket templates</li>
                  <li>Categories, roles and permissions</li>
                  <li>Portal and service catalogue, reports</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="safety">
          <div className="wrap">
            <div className="section-head">
              <h2>Built for instances people rely on</h2>
              <p>Configuration changes break SLAs and stop tickets moving. {site.name} is designed so you always know what it will do and what it did.</p>
            </div>
            <dl className="safety">
              <div><dt>You see every change first</dt><dd>The preview lists each object it will create, and the before and after of every update. Nothing is written until you approve, and nothing is written at all if the preview finds a problem.</dd></div>
              <div><dt>It never deletes</dt><dd>There is no delete anywhere in {site.name}. If something needs removing, it tells you and you decide.</dd></div>
              <div><dt>Every change is checked</dt><dd>After each save, {site.name} reads the record back from Halo and compares it with what it sent. A mismatch stops the build.</dd></div>
              <div><dt>Full audit trail</dt><dd>Who asked, who approved, and every change sent to Halo, with timestamps. Export it for your change board.</dd></div>
              <div><dt>It says what it can&apos;t do</dt><dd>Anything outside what it builds goes on a list in plain words, ready for your consultant, instead of being half-built.</dd></div>
            </dl>
          </div>
        </section>

        <section className="section partners">
          <div className="wrap">
            <div className="section-head">
              <h2>For Halo partners: your standard build, on every new client</h2>
              <p>Most implementations start with the same groundwork. Save your firm&apos;s build once, then apply it to each new client&apos;s instance in under an hour, matched to what they already have.</p>
            </div>
            <div className="card pack">
              <h3>A build pack, applied to a new client</h3>
              <ol>
                <li>Pick your firm&apos;s standard pack: service request forms, approvals, SLAs.</li>
                <li>{site.name} matches it to the client&apos;s teams, agents and priorities.</li>
                <li>You review the plan with the client, then build.</li>
                <li>The sign-off report goes straight into your project file.</li>
              </ol>
              <span className="badge accent">Part of the pilot</span>
            </div>
          </div>
        </section>

        <section className="section pilot" id="pilot">
          <div className="wrap">
            <div className="section-head">
              <h2>Apply for a pilot</h2>
              <p>We&apos;re working with a small number of Halo partners from {site.pilotStart}. Pilots run on new or test instances, and we build alongside you.</p>
              <ul>
                <li>You bring real client requests; we build them with you.</li>
                <li>Paid per build during the pilot, agreed upfront.</li>
                <li>Your feedback decides what {site.name} builds next.</li>
              </ul>
            </div>
            <PilotForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
