import { PilotForm } from '@/components/PilotForm';
import { PlanPanel } from '@/components/PlanPanel';
import { site } from '@/lib/site';

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="var(--accent)" />
      <path d="M8 9.5h12M8 14h8M8 18.5h12" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="var(--paper)" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="#top" aria-label={`${site.name} home`}>
            <Mark />
            <b>{site.wordmark}</b>
          </a>
          <nav className="nav" aria-label="Main">
            <a className="hide-sm" href="#how">How it works</a>
            <a className="hide-sm" href="#builds">What it builds</a>
            <a className="hide-sm" href="#safety">Safety</a>
            <a className="btn btn-primary" href="#pilot">Apply for a pilot</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <div>
              <p className="eyebrow">For HaloITSM and HaloPSA teams</p>
              <h1>
                Describe the process. Approve the plan. <em>{site.name} builds it in Halo.</em>
              </h1>
              <p className="lede">
                Tell {site.name} what you need in plain English: the forms, approvals, SLAs and workflow stages. It reads
                your instance, shows you exactly what it will create or change, and only builds once you&apos;ve approved
                it. Every change is checked after it&apos;s saved.
              </p>
              <div className="cta-row">
                <a className="btn btn-primary" href="#pilot">Apply for a pilot</a>
                <a className="btn btn-ghost" href="#how">See how it works</a>
              </div>
              <p className="fineprint">Paid pilots for Halo partners start in {site.pilotStart}.</p>
            </div>
            <PlanPanel />
          </div>
        </section>

        <section className="band proof" aria-label="What we've proven">
          <div className="wrap">
            <div>
              <strong>47 objects</strong>
              <span>Built and checked in one run on a real Halo instance during testing: a full joiners, movers and leavers setup.</span>
            </div>
            <div>
              <strong>60+ rules</strong>
              <span>Halo quirks we&apos;ve found and fixed, so they never reach your instance. The list grows with every build.</span>
            </div>
            <div>
              <strong>0 deletes</strong>
              <span>{site.name} never deletes anything in Halo. It creates, reuses and updates, and tells you what it can&apos;t do.</span>
            </div>
          </div>
        </section>

        <section className="band" id="how">
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

        <section className="band">
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
              <div className="coverage" aria-label="Example coverage check">
                <div className="row">
                  <span className="chip built">Built</span>
                  <p>Mover form with required fields<span>Mover: name, new department and date required</span></p>
                </div>
                <div className="row">
                  <span className="chip built">Built</span>
                  <p>Leaver SLA, 4 hours for Critical<span>Leaver - 1 day, critical 4 hours</span></p>
                </div>
                <div className="row">
                  <span className="chip update">Partial</span>
                  <p>Joiner workflow stages<span>Has IT Provisioning and Facilities, missing HR checks</span></p>
                </div>
                <div className="row">
                  <span className="chip gap">Missing</span>
                  <p>Email the manager when a joiner is approved<span>Not supported yet: listed for your consultant</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="builds">
          <div className="wrap">
            <div className="section-head">
              <h2>What it builds today</h2>
              <p>The groundwork of most Halo implementations. We&apos;d rather tell you what&apos;s not covered than build it badly.</p>
            </div>
            <div className="remit">
              <div>
                <h3><span className="dot yes" aria-hidden="true" />Builds and updates</h3>
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
              <div>
                <h3><span className="dot not" aria-hidden="true" />Not yet</h3>
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

        <section className="band" id="safety">
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

        <section className="band partners">
          <div className="wrap">
            <div className="section-head">
              <h2>For Halo partners: your standard build, on every new client</h2>
              <p>Most implementations start with the same groundwork. Save your firm&apos;s build once, then apply it to each new client&apos;s instance in under an hour, matched to what they already have.</p>
            </div>
            <div className="pack">
              <h3>A build pack, applied to a new client</h3>
              <ol>
                <li>Pick your firm&apos;s standard pack: service request forms, approvals, SLAs.</li>
                <li>{site.name} matches it to the client&apos;s teams, agents and priorities.</li>
                <li>You review the plan with the client, then build.</li>
                <li>The sign-off report goes straight into your project file.</li>
              </ol>
              <span className="tag">Part of the pilot</span>
            </div>
          </div>
        </section>

        <section className="band pilot" id="pilot">
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

      <footer>
        <div className="wrap">
          <div className="row">
            <span>© 2026 {site.name}. Made by {site.company}.</span>
            <span>{site.location}</span>
          </div>
          <p>HaloITSM and HaloPSA are products of Halo Service Solutions. {site.name} is independent and not affiliated with or endorsed by Halo.</p>
        </div>
      </footer>
    </>
  );
}
