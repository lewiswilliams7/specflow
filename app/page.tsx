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
              <span className="eyebrow">For Halo consultants and admins</span>
              <h1>Write the brief. Approve the plan. {site.name} builds it in Halo.</h1>
              <p className="lede">
                Forms, approvals, SLAs, workflows, ticket rules, notifications and emails, from a brief in plain English.
                {' '}{site.name} reads the instance first and reuses what&apos;s there. It shows every change before writing,
                then checks each one after. You spend your days on the design, not clicking through configuration screens.
              </p>
              <div className="cta-row">
                <a className="btn btn-primary btn-lg" href="/signup">Start free</a>
                <a className="btn btn-secondary btn-lg" href="/example">See a real plan</a>
              </div>
              <p className="fineprint">Free to connect and generate plans. Building starts with our partner pilots in {site.pilotStart}. <a href="#pilot">Apply for a pilot</a></p>
            </div>
            <PlanPanel />
          </div>
        </section>

        <section className="section proof" aria-label="What we've proven">
          <div className="wrap">
            <div>
              <strong>{site.proof.objectsInOneRun} objects</strong>
              <span>Built and checked in one run on a Halo test instance: a full joiners, movers and leavers setup. <a href="/example">See the plan</a></span>
            </div>
            <div>
              <strong>{site.proof.rules} rules</strong>
              <span>Halo quirks we&apos;ve found and fixed, so they never reach your instance. The list grows with every build.</span>
            </div>
            <div>
              <strong>{site.proof.deletes} deletes</strong>
              <span>{site.name} never deletes anything in Halo. It creates, reuses and updates, and tells you what it can&apos;t do.</span>
            </div>
          </div>
        </section>

        <section className="section partners" id="partners">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">For Halo partners</span>
              <h2>Your standard build, on every new client</h2>
              <p>Most implementations start with the same groundwork. {site.name} does the clicking, so a fixed-price build takes less of your team&apos;s time and every day you save is margin.</p>
              <ul className="ticks">
                <li><b>Matched to each client.</b> It reads their teams, agents, priorities and existing setup, and reuses what fits.</li>
                <li><b>In the client&apos;s brand.</b> Email templates and sign-off reports carry the client&apos;s logo, colour and footer. You see each email before it&apos;s built.</li>
                <li><b>Something to hand over.</b> Every build has a sign-off report: who ran it, every record with its Halo ID, ready to print or save as a PDF.</li>
              </ul>
            </div>
            <div className="card pack">
              <h3>A build pack, applied to a new client</h3>
              <ol>
                <li>Pick your firm&apos;s standard pack: service request forms, approvals, SLAs.</li>
                <li>{site.name} matches it to the client&apos;s teams, agents and priorities.</li>
                <li>You review the plan with the client, then build.</li>
                <li>The sign-off report goes straight into your project file.</li>
              </ol>
              <span className="badge accent">Build packs are part of the pilot</span>
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

        <section className="section" id="rules">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">{site.proof.rules} rules and counting</span>
              <h2>It already knows where Halo catches people out</h2>
              <p>Every quirk we hit while testing became a rule {site.name} follows on every build. Three you may have met:</p>
            </div>
            <div className="rule-grid">
              <article className="card rule">
                <span className="rule-tag">Workflows</span>
                <h3>A new stage that can be skipped</h3>
                <p>Insert a stage between two others and the old buttons still jump straight past it. {site.name} sends those buttons into the new stage, and leaves resolve, close and approval routes alone.</p>
              </article>
              <article className="card rule">
                <span className="rule-tag">Notifications</span>
                <h3>A team notification that tells nobody</h3>
                <p>A notification&apos;s team only filters which tickets count. Nobody is told unless they&apos;re subscribed, so {site.name} subscribes the team&apos;s members and scopes it to the ticket type.</p>
              </article>
              <article className="card rule">
                <span className="rule-tag">Child tickets</span>
                <h3>Tickets landing in the wrong team</h3>
                <p>A copied template keeps the team it came from. In testing, tickets went to Human Resources instead of Software Licensing. {site.name} gives new templates the ticket type&apos;s own team.</p>
              </article>
            </div>
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
                    <li className="cant"><span className="sign">!</span><div className="what"><b>Approval by IT Security only for admin rights</b> <span className="kind">can’t do yet</span><p>Listed for you to set up in Halo, instead of half-built</p></div></li>
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
              <p>The groundwork of most Halo implementations. Anything a plan needs that isn&apos;t on this list is shown in the plan as yours to do, never half-built.</p>
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
                  <li>Fields that only show for certain answers</li>
                  <li>Ticket rules <span>routing and priority based on the ticket type and answers</span></li>
                  <li>Email templates in the client&apos;s brand <span>logo, colour, footer and Halo&apos;s own variables</span></li>
                  <li>Action buttons that email the requester <span>including when they move the ticket to a new status</span></li>
                  <li>Acknowledgement emails when a ticket is logged</li>
                  <li>Child tickets raised when a ticket is logged</li>
                  <li>Categories, and ticket rules that set them</li>
                  <li>Agent notifications for a team, scoped to a ticket type</li>
                  <li>Sign-off reports for every build <span>print or save as a PDF</span></li>
                </ul>
              </div>
              <div className="card">
                <h3><span className="badge cant">Not yet</span>Still done by hand</h3>
                <ul>
                  <li>Approvals that depend on a field&apos;s value</li>
                  <li>Emails when a rule or an approval changes the status</li>
                  <li>Child tickets raised in order or after approval</li>
                  <li>Roles and permissions</li>
                  <li>Portal and service catalogue, reports, runbooks</li>
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
              <div><dt>It never deletes</dt><dd>There is no delete anywhere in {site.name}. There&apos;s no automatic undo either: the report lists every record it created by Halo ID, so removing one is a short job for you, in Halo.</dd></div>
              <div><dt>Every change is checked</dt><dd>After each save, {site.name} reads the record back from Halo and compares it with what it sent. A mismatch stops the build.</dd></div>
              <div><dt>A report for your change board</dt><dd>Every build is recorded: what was asked, who ran it, when, and every record written with its Halo ID and the before and after of each change. Print it or save it as a PDF.</dd></div>
              <div><dt>It says what it can&apos;t do</dt><dd>Anything outside what it builds goes on a list in plain words, ready for you to set up in Halo, instead of being half-built.</dd></div>
            </dl>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="wrap">
            <div className="section-head">
              <h2>Questions your client&apos;s IT team will ask</h2>
            </div>
            <div className="faq">
              <details>
                <summary>What does {site.name} read in Halo?</summary>
                <p>Configuration only: ticket types, fields and forms, approvals, SLAs, workflows, statuses, teams, agents, rules, templates and categories. It never reads tickets or their contents.</p>
              </details>
              <details>
                <summary>Where is our data kept, and how is the Halo secret stored?</summary>
                <p>In the UK. The app runs in London and its database is in London. The Halo client secret is encrypted with AES-256 and only decrypted on our server at the moment it talks to Halo. It is never sent to your browser.</p>
              </details>
              <details>
                <summary>What access does it need?</summary>
                <p>A Halo API application using Client ID and Secret (Services), logging in as an agent. To build, it needs permission to change configuration, not just read it. Use a test instance first; that&apos;s what our pilots do.</p>
              </details>
              <details>
                <summary>Can we undo a build?</summary>
                <p>Not automatically, because {site.name} never deletes anything. Every build&apos;s report lists each record created, by Halo ID, and every change with its before and after, so you can put things back by hand. Nothing is written until you approve a preview, and the build stops at the first problem.</p>
              </details>
              <details>
                <summary>What if Halo changes its API?</summary>
                <p>Every save is read back from Halo and compared with what was sent. If Halo stores something differently, the build stops there and says what didn&apos;t match, instead of carrying on.</p>
              </details>
              <details>
                <summary>Does it work with HaloPSA?</summary>
                <p>We&apos;ve tested on HaloITSM only. HaloPSA shares much of the same configuration, but we won&apos;t say it works until we&apos;ve built on it.</p>
              </details>
              <details>
                <summary>Does it replace the consultant?</summary>
                <p>No. It replaces the clicking. The design, the workshops and the judgement stay with you, and anything it can&apos;t build is listed in the plan as yours to do.</p>
              </details>
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
