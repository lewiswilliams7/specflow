import type { Metadata } from 'next';
import { PlanView } from '@/components/PlanView';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import example from '@/lib/example-plan.json';
import { site } from '@/lib/site';
import type { Plan } from '@/lib/specflow/plan-types';

export const metadata: Metadata = {
  title: `A real plan: joiners, movers and leavers · ${site.name}`,
  description: `The plan ${site.name} made from a plain-English brief, and built and checked on a Halo instance.`,
};

const plan = example as unknown as Plan;

export default function Example() {
  return (
    <>
      <SiteHeader />
      <main className="section example">
        <div className="wrap narrow">
          <div className="section-head">
            <span className="eyebrow">A real plan, not a mock-up</span>
            <h1>Joiners, movers and leavers for a 2,000-person company</h1>
            <p>
              This is the brief we gave {site.name}, and the plan it made. It was built on a Halo test instance on {site.proof.exampleRunDate}:
              {' '}{site.proof.objectsInOneRun} objects created and each one read back from Halo and checked. Names of people are changed.
            </p>
          </div>

          <figure className="brief">
            <figcaption>The brief, as written</figcaption>
            <blockquote>{plan.request}</blockquote>
          </figure>

          <PlanView
            plan={plan}
            errors={[]}
            inventory={null as never}
            heading="The plan"
            foot={<><span>Built and checked on a Halo test instance, {site.proof.exampleRunDate}.</span><a className="btn btn-primary btn-sm" href="/signup">Try it on your instance</a></>}
          />

          <div className="notice info example-note">
            <div>
              <b>What’s changed since this run.</b> Some items under “Can’t do yet” can now be built: fields that only show for
              certain answers, ticket rules that route by answer, child tickets and categories. The approval that depends on
              an answer, and emails on approval, are still to do by hand.
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
