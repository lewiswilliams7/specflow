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
              <span className="eyebrow">For Halo partners and consultants</span>
              <h1>Your client&apos;s design, built in their Halo.</h1>
              <p className="lede">
                Paste the brief or attach the form design spreadsheet. {site.name} reads the client&apos;s instance, plans every
                ticket type, field, approval, SLA and workflow, and builds it once you approve. You keep the workshops and the
                judgement. {site.name} does the clicking.
              </p>
              <div className="cta-row">
                <a className="btn btn-primary btn-lg" href="/signup">Start free</a>
                <a className="btn btn-secondary btn-lg" href="/example">See a real plan</a>
              </div>
              <p className="fineprint">Free to connect a test instance and generate plans. Partner pilots start in {site.pilotStart}. <a href="#pilot">Apply for a pilot</a></p>
            </div>
            <PlanPanel />
          </div>
        </section>

        <section className="section proof" aria-label="What we've proven">
          <div className="wrap">
            {site.liveProof ? (
              <div>
                <strong>{site.liveProof.forms} forms</strong>
                <span>{site.liveProof.note}.</span>
              </div>
            ) : null}
            <div>
              <strong>{site.proof.objectsInOneRun} objects</strong>
              <span>Built and checked in one run on a Halo test instance: a full joiners, movers and leavers setup. <a href="/example">See the plan</a></span>
            </div>
            <div>
              <strong>{site.proof.rules} rules</strong>
              <span>Halo quirks we&apos;ve found and fixed, so they never reach a client&apos;s instance.</span>
            </div>
            <div>
              <strong>{site.proof.deletes} deletes</strong>
              <span>{site.name} creates, reuses and updates. It has no way to delete anything in Halo.</span>
            </div>
            <div>
              <strong>Every change</strong>
              <span>Read back from Halo after it&apos;s saved and compared with what was sent. A mismatch stops the build.</span>
            </div>
          </div>
        </section>

        <section className="section" id="partners">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">For Halo partners</span>
              <h2>Implementation days go on design, not data entry</h2>
              <p>On a fixed-price build, every hour spent clicking through configuration screens comes out of your margin. {site.name} takes that part.</p>
            </div>
            <div className="value-grid">
              <article className="card value">
                <h3>Keeps fixed-price builds profitable</h3>
                <p>Agree the design with the client, then let {site.name} build it. Your consultant reviews the plan and checks the result instead of creating fields one by one.</p>
              </article>
              <article className="card value">
                <h3>The same standard on every client</h3>
                <p>{site.name} follows {site.proof.rules} rules on every build, whoever runs it. New consultants build the way your best one does, and the quirks stay fixed.</p>
              </article>
              <article className="card value">
                <h3>Something for the client to sign</h3>
                <p>The plan shows what exists, what will be built and what&apos;s left for you. Every build ends with a sign-off report listing each record by Halo ID, in the client&apos;s brand.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="design-sheet">
          <div className="wrap">
            <div className="split">
              <div className="section-head">
                <span className="eyebrow">New: attach the design</span>
                <h2>Send the form design spreadsheet. Get the build plan.</h2>
                <p>
                  Attach the request form design you agreed with the client. {site.name} reads it in code, row by row, so every
                  label, option, show rule and line of help text goes into the plan exactly as written. It plans each form on
                  its own, then checks the whole plan against the client&apos;s instance.
                </p>
                <ul className="ticks">
                  <li><b>Word for word.</b> Labels, options and help text come from the sheet, not from a summary of it.</li>
                  <li><b>Nothing invented.</b> A list with no values written, or a type it can&apos;t build, is listed as yours to do.</li>
                  <li><b>Reuses what&apos;s there.</b> A field the client already has, with the same type, is reused, never renamed.</li>
                </ul>
              </div>
              <div className="sheet-demo" aria-label="Example: a design sheet row becomes plan steps">
                <div className="sheet">
                  <div className="sheet-bar"><span>request-forms-design.xlsx</span></div>
                  <table>
                    <thead><tr><th>Field</th><th>Type</th><th>Required?</th><th>Help text</th></tr></thead>
                    <tbody>
                      <tr><td>Start Date</td><td>Date</td><td>Yes</td><td>Required start date</td></tr>
                      <tr><td>Line Manager</td><td>User lookup</td><td>Yes</td><td>Select the line manager</td></tr>
                      <tr><td>Equipment</td><td>Single selection</td><td>No</td><td>Select what&apos;s needed</td></tr>
                      <tr><td>Other Details</td><td>Memo</td><td>If shown</td><td>Shown if Other is picked</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="plan-card">
                  <div className="plan-section">
                    <h3>Plan for New Starter Request</h3>
                    <ul className="diff">
                      <li className="keep"><span className="sign">=</span><div className="what"><b>Start Date</b> <span className="kind">already there</span><p>Reused, with its help text added</p></div></li>
                      <li className="add"><span className="sign">+</span><div className="what"><b>Line Manager</b> <span className="kind">new field</span><p>A live list of Halo users</p></div></li>
                      <li className="add"><span className="sign">+</span><div className="what"><b>Other Details</b> <span className="kind">new field</span><p>Shown only when Other is picked</p></div></li>
                      <li className="cant"><span className="sign">!</span><div className="what"><b>Portal category</b> <span className="kind">yours to do</span><p>Listed for you to set in the portal</p></div></li>
                    </ul>
                  </div>
                </div>
              </div>
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
                <p>Add a Halo API application with the permissions we list. {site.name} reads the configuration, never tickets.</p>
              </li>
              <li>
                <h3>Describe</h3>
                <p>Write it the way you&apos;d brief a colleague, paste the client&apos;s requirements, or attach the design spreadsheet. If a decision is yours, {site.name} asks with one-click answers.</p>
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
                  <li>Approval processes <span>groups, named approvers, line managers, ad-hoc, several stages, and stages that only apply for certain answers</span></li>
                  <li>SLAs, with targets per priority</li>
                  <li>Workflow stages, actions and statuses that pause the SLA</li>
                  <li>Teams and approval groups, with members</li>
                  <li>Fields that only show for certain answers</li>
                  <li>Help text on every field <span>word for word from the design</span></li>
                  <li>Live dropdowns of Halo users, sites or organisations <span>made from a list field the instance already has</span></li>
                  <li>Ticket rules <span>routing and priority based on the ticket type and answers</span></li>
                  <li>Email templates in the client&apos;s brand <span>logo, colour, footer and Halo&apos;s own variables</span></li>
                  <li>Action buttons that email the requester <span>including when they move the ticket to a new status</span></li>
                  <li>Acknowledgement emails when a ticket is logged</li>
                  <li>Child tickets raised when a ticket is logged</li>
                  <li>Categories, and ticket rules that set them</li>
                  <li>Agent notifications for a team, scoped to a ticket type</li>
                  <li>Services in the portal catalogue <span>with their summary and the ticket type they log</span></li>
                  <li>Users, sites and organisations from a list <span>matched on email and name, so a re-run never duplicates</span></li>
                  <li>Working hours and bank holidays</li>
                  <li>Canned text, and values in Halo&apos;s own lists <span>impact, urgency, risk and similar</span></li>
                  <li>Retiring old ticket types and taking fields off forms <span>hidden, never deleted</span></li>
                  <li>Form design spreadsheets and long briefs <span>planned form by form, then checked as one plan</span></li>
                  <li>Sign-off reports for every build <span>print or save as a PDF</span></li>
                </ul>
              </div>
              <div className="card">
                <h3><span className="badge cant">Not yet</span>Still done by hand</h3>
                <ul>
                  <li>Emails when a rule or an approval changes the status</li>
                  <li>Child tickets raised in order or after approval</li>
                  <li>Mailbox and email-to-ticket rules</li>
                  <li>Roles and permissions, asset types, knowledge base articles</li>
                  <li>Reports, dashboards, runbooks</li>
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
            <div className="safety-split">
            <dl className="safety">
              <div><dt>You see every change first</dt><dd>The preview lists each object it will create, and the before and after of every update. Nothing is written until you approve, and nothing is written at all if the preview finds a problem.</dd></div>
              <div><dt>It never deletes</dt><dd>There is no delete anywhere in {site.name}. There&apos;s no automatic undo either: the report lists every record it created by Halo ID, so removing one is a short job for you, in Halo.</dd></div>
              <div><dt>Every change is checked</dt><dd>After each save, {site.name} reads the record back from Halo and compares it with what it sent. A mismatch stops the build.</dd></div>
              <div><dt>A report for your change board</dt><dd>Every build is recorded: what was asked, who ran it, when, and every record written with its Halo ID and the before and after of each change. Print it or save it as a PDF.</dd></div>
              <div><dt>It says what it can&apos;t do</dt><dd>Anything outside what it builds goes on a list in plain words, ready for you to set up in Halo, instead of being half-built.</dd></div>
            </dl>
              <div>
                <pre className="build-log" aria-label="The builder's own output from a test run">
<span className="dim">Checking the whole plan first (dry run) …</span>{'\n'}<span className="dim">Dry run clean: applying.</span>{'\n'}<span className="dim">Pre-flight OK: everything the plan needs to find exists.</span>{'\n\n'}<span className="ok">+</span> site             Head Office  created, verified{'\n'}<span className="ok">+</span> user             a.patel@…  created, verified{'\n'}<span className="eq">✓</span> service_category IT Requests  reused{'\n'}<span className="ok">+</span> service          New Starter  created, verified{'\n'}<span className="ok">+</span> working_hours    Office Hours  created, verified{'\n'}<span className="ok">+</span> holiday          Christmas Day  created, verified{'\n'}<span className="ok">+</span> canned_text      Request received  created, verified{'\n\n'}<span className="dim">Run again:</span>{'\n'}<span className="eq">=</span> site             Head Office  already exists, reused{'\n'}<span className="eq">=</span> user             a.patel@…  already exists, reused{'\n'}<span className="dim">…nothing duplicated.</span>
                </pre>
                <p className="build-log-cap">The shape of a real build on our test instance, with the names changed. Every write is read back from Halo, and running the same plan again changes nothing.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="wrap">
            <div className="section-head">
              <h2>Questions your client&apos;s IT team will ask</h2>
            </div>
            <div className="faq">
              <details>
                <summary>Can it read our request form design template?</summary>
                <p>Yes. Attach the spreadsheet to a message. {site.name} reads the form name, fields, types, mandatory flags, options, show rules and help text in code, so nothing is paraphrased. Anything it can&apos;t build, such as attachments or tables on a form, is listed for you.</p>
              </details>
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
              <details>
                <summary>Is {site.name} made by Halo?</summary>
                <p>No. {site.name} is independent and works through Halo&apos;s public API, with an API application you create and can switch off at any time.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="section pilot" id="pilot">
          <div className="wrap">
            <div className="section-head">
              <h2>Apply for a pilot</h2>
              <p>We&apos;re taking a small number of Halo partners from {site.pilotStart}. Bring a real client design; we build it with you on a test instance first.</p>
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
