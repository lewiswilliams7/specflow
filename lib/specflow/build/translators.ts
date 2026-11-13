/**
 * Plan step -> Halo API payload. Plain code, no AI.
 *
 * Each translator starts from a TEMPLATE fixture (a real object captured with
 * `npm run get`), deep-cleaned by cleanForCreate so no nested id can touch an
 * existing record, then overrides only what the plan specifies.
 *
 * SPIKE_MAP holds what we've learned about Halo's payloads. Every value says where
 * the evidence came from. `null` = still unknown: the builder skips it and warns.
 * Values marked INFERRED are best guesses from evidence: confirm in the UI (NOTES.md).
 */
import { cleanForCreate } from './clean';
import { type EmailBrand, brandedEmail, textToHtml } from './email-brand';
import { extractList, firstRecord, runtime } from './runtime';

export const SPIKE_MAP = {
  /** FieldInfo.type. Evidence: fieldinfo-141 (text=0), -114 (memo=1), -124 (dropdown=2),
   *  CFperipherals/CFsoftware (multi-select=3), -153 (date=4), -193 (checkbox=6). */
  fieldTypes: {
    text: 0,
    memo: 1,
    dropdown: 2,
    multiselect: 3,
    date: 4,
    checkbox: 6,
    /** Round 38: Halo's own rich text fields are type 10 (CFBridgeDescriptionRich 267, fchangeinformationhtml -82).
     *  Built by the builder in round 39. */
    richtext: 10,
  } as Record<string, number | null>,

  field: {
    label: 'label' as string | null, //   evidence: fieldinfo-141 label "First Name"
    type: 'type' as string | null,
    /** Dropdown values: existing fields use values: [{ name }] tied to a lookup table.
     *  INFERRED that posting values without a lookup id creates a new list. Test with post. */
    options: 'values' as string | null,
  },

  sla: {
    /** Targets are per priority: priorities[].fixtime + fixunits ('H' | 'D'). Evidence: sla-3. */
    priorities: 'priorities' as string | null,
    fixTime: 'fixtime' as string | null,
    fixUnits: 'fixunits' as string | null,
    /** The working hours the SLA clock follows (round 35: workday_id sent 4, kept 4). */
    workday: 'workday_id' as string | null,
  },

  approval: {
    /** steps[].type. Evidence: approval processes 1,2,3,4,7,8 (NOTES.md 2026-10-19). */
    steps: 'steps' as string | null,
    lineManagerStepType: 10 as number | null,
    agentStepType: 1,
    groupStepType: 3,
    adhocStepType: 8,
    /** Approvers chosen by rules. Evidence: approvalprocess-1 step 4 (type 42) with rules 5 and 6 (gethandoveruk, 24 Oct). */
    rulesStepType: 42,
    approverIdKey: 'agent_id_or_cab_id',
    minApproversKey: 'minapprovers',
  },

  ticketType: {
    /** Evidence: tickettype-36. default_team takes the team NAME ("Human Resources"), not an id. */
    teamName: 'default_team' as string | null,
    sla: 'default_sla' as string | null, //                  id
    approvalProcess: 'approval_process_id' as string | null, // id
    summary: 'default_summary' as string | null,
    fields: 'fields' as string | null,
    fieldId: 'fieldid' as string | null,
    /** INFERRED from tickettype-36: endusernew/technew = 3 on what look like required fields, 1 otherwise. */
    mandatoryKeys: ['endusernew', 'technew'] as string[] | null,
    mandatoryValue: 3,
    optionalValue: 1,
  },

  // ---- Areas being mapped (24 Oct). Each null is an unknown: the area stays switched off (rule B2) until a capture
  // (npm run learn -- --apply) fills it. Evidence: learning run on gethandoveruk, 24 Oct (NOTES.md).

  /** Email templates. Evidence: learn, sample -100 kept name, header_text (subject), body_html; Halo derives body_text. */
  emailTemplate: {
    subject: 'header_text' as string | null,
    body: 'body_html' as string | null,
    name: 'name' as string | null,
  },
  /** Branded emails (rule EM1). Evidence: learning run 15, sample -106 built by the builder: Halo kept the table layout,
   *  inline styles, logo <img>, data-enact-brand marker and $variables exactly as sent (1,216 of 1,216 characters,
   *  design.html the same). */
  emailBrand: {
    keptByHalo: true as boolean | null,
  },
  /** Field help text (rule F11). Evidence: every captured field template carries "hint", and Halo's field form calls
   *  it "Hint for Field". Switched on by the owner on 11 Nov before a read-back proof; every save is read back
   *  (verifyUpdate) and warns if Halo didn't keep it. Learning run 27 confirms it. */
  fieldHint: {
    key: 'hint' as string | null,
  },
  /** Dropdowns whose options come from SQL (rule F12). Halo's settings for these (lookup type, method, load type,
   *  connection, the SQL) aren't guessed: a new one copies every plain setting from a field on the same instance that
   *  already takes its options from SQL, and only the SQL is swapped for one of SQL_LISTS. Switched on 11 Nov at the
   *  owner's request; the SQL key is found by its value and each save is read back. */
  dynamicList: {
    copiesFromExistingField: true as boolean | null,
  },
  /** Halo $variables (rule EM2), case-insensitive. Evidence: learning run 16, every whole-word $variable in the subjects
   *  and HTML of the instance's 94 email templates (97 distinct). Meanings in `common` are from how Halo's own templates
   *  use them ("Hi $firstname,", "Logged $DATEOCCURED", "changed to $status", "Technician Assigned: $assignedto"). */
  /** Acknowledgement email on a ticket type (rule EM4). Evidence: run 14, type 70 kept acknowledgementtemplate -103; run 17,
   *  Halo queued that email one second after ticket 4031 was logged through the API (queue record 13). It goes out
   *  only when the sending agent's account is verified (EM5). acknowledgementtemplateooh is the out-of-hours one. */
  ackEmail: {
    key: 'acknowledgementtemplate' as string | null,
    provenOnTrial: true as boolean | null,
  },
  emailVariables: {
    known: [
      '$ORNAME', '$FAULTID', '$SYMPTOM', '$ORPHONE', '$ORWEBSITE', '$LINKTOREQUESTUSER', '$CURRENTDATE',
      '$RICHACTIONNOTE', '$DATECLEARED', '$ORCOLOUR', '$SECTION', '$STATUS', '$SUPPREF', '$USERNAME', '$ACTIONWHO',
      '$AREA', '$CODE', '$LINKTOWEBAPP', '$QUOTEREF', '$SUPPEND', '$SUPPSTART', '$DATEOCCURED', '$ASSIGNEDTO',
      '$CLEARANCE', '$INVOICEID', '$LOCKERCODE', '$LOCKERNAME', '$PASSWORD', '$USEREMAILADDRESS', '$ACCEPTLINK',
      '$APSTARTDATE', '$CAMPAIGNNAME', '$CONFIRMCLOSURE', '$DENYCLOSURE', '$FEEDBACK1', '$FEEDBACK2', '$FEEDBACK3',
      '$FEEDBACK4', '$HELPDESKURL', '$KEYMESSAGE', '$LINKTOARTICLE', '$LINKTOREQUESTAGENT', '$MERGEDREQUESTID',
      '$REJECTLINK', '$RELEASEDESCRIPTION', '$SYMPTOM2', '$THIRDPARTYINVOICENUMBER', '$ACTIVITY', '$ALLFIELDS',
      '$ALLFIELDSQA', '$APPOINTMENTTECHNICIAN', '$APPROVALOUTCOME', '$APSTARTTIME', '$APSUBJECT', '$AREASITE',
      '$CAMPAIGNLINK', '$CATEGORY2', '$CONTRACTAPPOINTMENTSREMAINING', '$COUNTERSIGNAPPROVE', '$COUNTERSIGNREJECT',
      '$DATENOW', '$EMAILHISTORY', '$FEEDBACKCOMMENT', '$FEEDBACKDATE', '$FEEDBACKSCORE', '$FEEDBACKTECH',
      '$FIRSTNAME', '$FIXBYDATE', '$INCOMPLETETIMESHEETPERCENTAGE', '$INCOMPLETETIMESHEETTABLE', '$INVOICELINK',
      '$INVOICENUMBER', '$KBDESCRIPTION', '$KBRESOLUTION', '$KBSUBJECT', '$KBTITLE', '$NEWEMAILADDRESS',
      '$NEWUSERNAME', '$ORLOGOSRC', '$PASSWORDRESETLINK', '$PROJECTAPPOINTMENTSREMAINING', '$QUOTEAPPROVAL',
      '$QUOTEAPPROVALNOTE', '$QUOTELINK', '$RELEASENOTELIST', '$RELEVANTRELEASENOTE', '$REMOTEINVITE',
      '$RESPONDBYDATE', '$SATISFACTIONWEBLINKTEXT', '$SERVICEMESSAGE', '$SERVICENAME', '$SERVICESTATUS',
      '$SLAHOLDRICHACTIONNOTE', '$TIMESHEETDATE', '$TIMESHEETMESSAGE', '$VALIDATE', '$WORKFLOWPROGRESS',
    ] as string[] | null,
    common: {
      $FAULTID: 'ticket number', $SYMPTOM: 'ticket summary', $USERNAME: "requester's name", $FIRSTNAME: "requester's first name",
      $STATUS: 'status', $ASSIGNEDTO: 'assigned agent', $DATEOCCURED: 'date logged (Halo spells it with one R)',
      $LINKTOREQUESTUSER: "link to the ticket for the requester (use as a link's address)", $RICHACTIONNOTE: 'the latest note',
      $ORNAME: 'organisation name',
    } as Record<string, string>,
  },
  /** An action button that emails the requester (rule E1). Evidence: learning run 2, all 86 actions: Halo's own "Email
   *  User" has sendemail 1 ("Send email" ticked), hidesendemail false (box shown), includeto true (To = the ticket's
   *  user), tooverride "". 0 = box shown unticked, 2 = hidden. Sample 106 kept sendemail 1 and template -100. */
  actionEmail: {
    send: 'sendemail' as string | null,
    sendValue: 1 as number | null,
    template: 'emailtemplate_id' as string | null,
    recipient: 'includeto' as string | null,
    recipientRequester: true as boolean | null,
  },
  /** Ticket rules (routing on matching tickets). Evidence: learn. Halo's own rules 13-16 (use 0 = a ticket rule; 1/2 are
   *  impact/urgency priority rules), and sample rule 27, whose type 23 dropdown criterion Halo stored as sent. */
  ticketRule: {
    criteria: 'criteria' as string | null,
    fieldCriteriaConfirmed: true as boolean | null,
    /** Halo's rule 13 "Downtime Started": criteria row fieldname requesttypenew, value_int = ticket type id, type 0. */
    ticketTypeCriterion: 'requesttypenew' as string | null,
    /** Rules 13-16: new_teamid (id) with new_team (name); new_agent_id. -1 = not set. */
    setTeam: 'new_teamid' as string | null,
    setTeamName: 'new_team' as string | null,
    setAgent: 'new_agent_id' as string | null,
  },
  /** A rule that sets the priority: new_priority_id is the priority's NUMBER (rules 14-16 use 1, 2), but /Priority rows
   *  give a guid id (posting it was refused). Where the number lives on a priority: not yet. */
  rulePriority: {
    setPriority: 'new_priority_id' as string | null,
    /** Learning run 2: /Priority rows are per SLA ({ slaid, priorityid, name }); priorityid is the level (Urgent in
     *  SLA 2 and Critical in SLA 3 are both 1), and Halo's rules 14-25 set new_priority_id to it. */
    priorityNumberKey: 'priorityid' as string | null,
  },
  /** Child tickets raised with a ticket. Evidence: probe found /Template. Nothing about children or the trigger yet. */
  /** Child tickets (rule C1). Evidence: learning runs 2-4, templates 1 "New Starter Request" and 30 "Leaver Request":
   *  a parent template (type 1, tickettype_id = the parent's type) lists children[]: templates of type 6 in their own
   *  right (name, summary, tickettype_id, team); a child with no creation_rules is raised straight away. The ticket type
   *  points at the parent through overridewiththefollowingtemplatewhenloggingmanually (New Starter 17 → 1, Leaver 16 →
   *  30). Writing NEW children inline with the parent: bare 500 (run 3). Children made first as their own records,
   *  then linked with children: [{ id }]: kept (run 4, parent 45, children 43 and 44). */
  childTickets: {
    children: 'children' as string | null,
    parentType: 1 as number | null,
    childType: 6 as number | null,
    attach: 'overridewiththefollowingtemplatewhenloggingmanually' as string | null,
    /** Learning run 5: the builder made template 46 with children 47, 48 and pointed ticket type 70 at it, all verified. */
    provenOnTrial: true as boolean | null,
  },
  /** Show a field only for some answers. Evidence: learn, five form rows on gethandoveruk (Absence Management, Employee
   *  Information Change, Employee Transfer, Grievance x2): a loose field row carries group_visibility_conditions = [{
   *  entity_id: ticket type id, entity_id2: field id, type 2, desc, seq, visibility_conditions: [{ lookup_field_id,
   *  lookup_value_id, lookup_value, field_value -1, conditiontype 0, field_usage 0 }] }]. Sections: one example (Laptop
   *  Request) with a different shape, not understood yet, so fields only. */
  visibility: {
    conditions: 'group_visibility_conditions' as string | null,
    groupType: 2 as number | null,
  },
  /** Priority matrix (rule TR3). Evidence: learning run 6, Halo's rules 14-26: impact-only rules have use 1, impact x
   *  urgency rules use 2; criteria rows fieldname impact / urgency, value_int 1 High, 2 Medium, 3 Low (lookup 27 for
   *  impact; urgency from the rule names, e.g. "Priority 4 - Low Impact, Medium Urgency" = impact 3, urgency 2). */
  priorityMatrix: {
    levels: { High: 1, Medium: 2, Low: 3 } as Record<string, number> | null,
    impactOnlyUse: 1 as number | null,
    impactUrgencyUse: 2 as number | null,
  },
  /** A rule that sets the category: new_category_1_id / new_category_1_name are on every rule (-1 / ""), but no rule
   *  read sets one. Proven only once learn round 7 builds one. */
  ruleCategory: {
    setId: 'new_category_1_id' as string | null,
    setName: 'new_category_1_name' as string | null,
    /** Learning run 7: rule 30 read back with new_category_1_id 262 and its path. */
    provenOnTrial: true as boolean | null,
  },
  /** Categories (rule K1). Evidence: learning run 6: 105 Category rows, value = the path "Level 1>Level 2>Level 3"
   *  (Halo fills category_name and level1-3 from it), type_id = which category list (1 = category 1). Sample 261 kept
   *  value. A multi-level path is proven by learn round 7. */
  category: {
    nameKey: 'value' as string | null,
    separator: '>' as string | null,
    /** Learning run 7: category 262 "zz Enact sample>Software>Licensing" read back split into three levels. */
    provenOnTrial: true as boolean | null,
  },
  /** Agent notifications (rule N1). Evidence: learning run 6, Notification 2-6: eventno, delivery_method (0 pop-up,
   *  1 email), emailtemplate_id (agent template "Technician Update"), agents[] { agent_id, role_id }. Events seen by
   *  name: 2 new ticket logged to a team, 6 P1 ticket logged, 17 ticket updated by the user, 33 ticket re-assigned,
   *  1008 mention. Whether agents can be subscribed without a role: learn round 7. */
  notification: {
    /** Learning run 7: notification 31 subscribed 8 agents through copied roles (N2). Run 8: notification 32 reached
     *  only the agent asked for, no roles. */
    /** 3 = "New Ticket Logged" (the event Halo's own runbook triggers use). */
    events: { new_ticket: 3, new_ticket_for_team: 2, p1_logged: 6, updated_by_user: 17, reassigned: 33, mentioned: 1008 } as Record<string, number> | null,
    /** Off again (25 Oct, Lewis): a notification with no conditions fires for EVERY matching ticket, and consultants
     *  notify a team, not named agents (N3).
     *  Conditions: learning run 9, the runbook triggers are notification records with conditions[] { fieldname
     *  "RequestType", fieldid 1, type 0, value_int = ticket type id, value_display, value_type "int", tablename "faults" }
     *  and custom fields as { fieldname CF..., fieldid, type 0, value_int = option id, value_type "int" }.
     *  Rule N4 (learning runs 10-11): on CREATE Halo drops conditions and team_name; on an UPDATE of the saved
     *  notification it keeps conditions (rows as above) and team_id (read back as team_name "Software Licensing"). */
    conditions: 'conditions' as string | null,
    teamRecipient: 'team_id' as string | null,
    /** Rule N5 (Lewis, 25 Oct): team_id only FILTERS which tickets count; nobody is told unless subscribed. Notification
     *  34 (team Software Licensing, no agents) sent nothing on event 2 or 3. So the team's members are subscribed as
     *  agents (direct subscriptions work: notification 32) and team_id stays as the filter. Round 13: notification 35
     *  built and read back (event 3, team filter, ticket type condition, Kaleem + Lewis direct); Kaleem received the
     *  new-request alert (Lewis, 25 Oct). Halo doesn't alert the agent who logged the ticket. */
    teamMeaningChecked: true as boolean | null,
    provenOnTrial: true as boolean | null,
  },
  /** Runbooks. Evidence: probe found CustomIntegration and Webhook endpoints; contents not captured. */
  /** Round 30: the new objects are switched on only once the REAL builder has built them on the trial (dry-run gate,
   *  apply, read-back, re-run without duplicates). Rounds 28-29 proved the payloads by hand-written requests only. */
  builderProof: { round30: 'built' as string | null }, // round 30 (Concord, 12 Nov): site 22, user 60, type 57, service 170, workday 4, holidays b12175bc/d079b70c, canned text 31 built and read back; re-run reused all 13; type 57 show rule + field removed, then retired
  /** Services (round 29, Concord trial): service 169 made from these keys alone and kept every one. */
  /** Form rows (round 36, Concord 13 Nov): zz Enact r36 form row kept override_hint, Halo's "Override Field Hint" (Lewis:
   *  the per-form hint, set where visibility is set). The label override is likely override_fieldname (seen empty on Halo's
   *  own Incident rows) but no write has proven it yet. */
  formRow: { hintOverride: 'override_hint' as string | null, labelOverride: null as string | null },
  /** Service categories (round 36): category 26 { name, parent_id: 8 } kept. parent_id 0 = top level. */
  serviceCategory: { parent: 'parent_id' as string | null },
  service: {
    /** Round 36: service 170 kept a service_request_details row for ticket type 65 (shape from Halo's own services 122 and 71). */
    requestDetails: 'service_request_details' as string | null,
    category: 'service_category_id' as string | null,
    ticketType: 'service_tickettype_id' as string | null,
    summary: 'summary' as string | null,
    portal: 'showinusercatalog' as string | null,
  },
  /** Users and sites (round 29): user 58 { name, firstname, surname, emailaddress, site_id }, site 21 { name, client_id },
   *  both kept exactly. Never from a copy (S1b). */
  people: {
    userSite: 'site_id' as string | null,
    userEmail: 'emailaddress' as string | null,
    siteOrganisation: 'client_id' as string | null,
  },
  /** Organisations: round 28's copy answered 500 and still renamed Client 12 (S1b). A minimal create isn't proven yet. */
  organisation: { create: 'name' as string | null }, // round 30: Client 13 from { name } alone, kept
  /** Working hours (round 28: a copy of workday 1 kept all 31 settings, as workday 3) and bank holidays (HL1, round 29:
   *  POST /Holiday { workday_id, name, date, end_date, allday, holiday_type 1 } → holid 208 on workday 3). */
  workingHours: { holidayResource: 'Holiday' as string | null, holidayWorkday: 'workday_id' as string | null },
  /** Canned text: round 28's copy and a text update were kept; a create from name and text alone isn't proven yet. */
  cannedText: { create: 'name' as string | null }, // round 30: canned text 31 { name, text, html } built by the builder, read back
  /** Lookup values (LK1): adding one is proven (round 29), but which list is which (list names) isn't yet. */
  lookupList: { names: 'lookupid 11' as string | null }, // round 30: list 11's row ids are the other lists' lookupids (12 Impact Level, 13 Risk Of Failure Level, 27 Urgency Level ...)
  /** Knowledge base (round 30: article 47 from { name, description, faqlists: [{ id }] } kept). Halo refuses an article
   *  without an FAQ list ("You must select an FAQ list", round 28). On once round 31 builds one with the builder. */
  kb: { faqLists: 'faqlists' as string | null, builder: 'built' as string | null }, // round 31: article 48 built, re-run reused it
  /** Read-only on a form: value 4 on the new-ticket screens (rule F13). On once Lewis sees a field locked in Halo. */
  // Round 33 + Lewis in Halo's screen (12 Nov): on the NEW ticket screens (endusernew, technew) the values are 0 Not visible,
  // 1 Visible not required, 2 Warn if empty, 3 Required, 4 Read only. 2 was NOT read-only (he could type in it). On the
  // DETAIL screens (enduserdetail, techdetail) 2 means "show on a separate tab", so those are never touched.
  readOnly: { value: 4 as number | null, keys: ['endusernew', 'technew'] as string[] | null, seenInHalo: null as string | null },
  /** Roles (round 31): POST /Roles { name } made role 87a07edb… (guid id, numeric id_int 12, no id in the reply); its
   *  claims (72) copied from IT Agent were kept exactly. Permissions are copied whole from an existing role, never
   *  edited one claim at a time (the claim codes aren't documented). On after round 32's builder proof. */
  role: { claims: 'claims' as string | null, builder: 'built' as string | null }, // round 32: role ccb9d887 built from IT Agent, claims identical, re-run reused it
  /** Asset types (round 31): AssetType { name, assetgroup_id } made type 160, kept; fields come from /AssetTypeInfo
   *  (round 32 tests adding them). */
  assetType: { group: 'assetgroup_id' as string | null, builder: 'built' as string | null },
  assetFields: { rows: 'fields' as string | null, builder: 'built' as string | null }, // round 33: type 162 built with Name, Serial Number, Model, Date Purchased in order; re-run reused it // round 32: type 161 built + re-run reused; fields rows { field_id, field_name, sequence, type, tab_id, techdetail, userdetail } sent to type 160 were kept (catalogue: /AssetTypeInfo). fields: on after round 33's builder proof
  /** Retire a ticket type (T8, round 29: visible false on type 56, gone from the lists). */
  retire: { key: 'visible' as string | null },
  /** Round 39: zz Enact r36 form kept allowattachments true and minattachments 1 (rule T9). */
  attachments: { allow: 'allowattachments' as string | null, min: 'minattachments' as string | null },
  /** Remove a field from a form (round 28: rows sent without field 312 → gone from type 56). */
  removeFields: { by: 'rows' as string | null },
  runbook: {
    resource: null as string | null,
  },
};

/**
 * Rule B2 (2026-10-24): an area is offered to the planner only when everything its payloads need is known from
 * evidence (no null left in its SPIKE_MAP sections). Until then plans list it under "can't do yet", and a plan that
 * uses it anyway fails the checks.
 */
export interface Feature {
  key: string;
  /** Plain name, for "can't do yet" and check messages. */
  name: string;
  sections: (keyof typeof SPIKE_MAP)[];
  /** Planner instructions, shown only once the feature is ready. */
  prompt: string;
}
export const FEATURES: Feature[] = [
  {
    key: 'emails',
    name: 'email templates and emails sent from action buttons',
    sections: ['emailTemplate', 'actionEmail'],
    prompt: `- email_template: name, subject, body (plain text, blank line between paragraphs; Halo variables: ${emailVariablePrompt()}). Don't add a logo, colours or a signature: the workspace's branding is added by the builder. Check inventory.email_templates first and reuse one that fits.
- outcome create may have send_email: email_template ref: when an agent uses the button, the email to the requester opens with "Send email" ticked and that template filled in (E1). outcome set: { send_email: ref } does the same on an EXISTING action. Emails on events (ticket logged, status changed) aren't supported yet.`,
  },
  {
    key: 'ticket_rules',
    name: 'ticket rules that route tickets to a team or agent',
    sections: ['ticketRule'],
    prompt: `- ticket_rule (runs when a ticket is logged): name, when: [{ ticket_type: ref } and/or { field: ref of a DROPDOWN field, equals: one of its options }] (all must match; include the ticket type unless the rule is meant for every type), then: { team?: ref, agent?: ref }. Check inventory.ticket_rules for one that already does it.`,
  },
  {
    key: 'priority_matrix',
    name: 'the priority matrix (impact and urgency)',
    sections: ['priorityMatrix'],
    prompt: `- ticket_rule when may also hold { impact: "High"|"Medium"|"Low" } and { urgency: "High"|"Medium"|"Low" }: with ONLY those and then.priority it is a priority matrix rule (TR3). Check inventory.ticket_rules first: the matrix usually exists ("Priority 2 - High Impact, Medium Urgency"); to change one, update it: ticket_rule set: { priority: level } (match by its exact name).`,
  },
  {
    key: 'rule_category',
    name: 'ticket rules that set a category',
    sections: ['ruleCategory'],
    prompt: `- ticket_rule then may also have category: ref of a category step (reuse or create).`,
  },
  {
    key: 'categories',
    name: 'categories',
    sections: ['category'],
    prompt: `- category: name = the full path with ">" between levels, e.g. "Hardware>Laptop>Repair" (K1). Check inventory.categories first; reuse by exact path.`,
  },
  {
    key: 'notifications',
    name: 'agent notifications on events',
    sections: ['notification'],
    prompt: `- notification (alerts AGENTS, not requesters): name, event: "new_ticket" | "new_ticket_for_team" | "p1_logged" | "updated_by_user" | "reassigned" | "mentioned", by: "popup" | "email", team: team ref (its members are told, and only that team's tickets count), agents?: [agent refs] (told as well), when: [{ ticket_type: ref } and/or { field: DROPDOWN ref, equals: option }] (always scope it: N3). Other events aren't supported yet.`,
  },
  {
    key: 'rule_priority',
    name: 'ticket rules that set a priority',
    sections: ['rulePriority'],
    prompt: `- ticket_rule then may also have priority: a priority LEVEL number from inventory.details.priority_levels (e.g. 2).`,
  },
  {
    key: 'child_tickets',
    name: 'child tickets raised automatically',
    sections: ['childTickets'],
    prompt: `- ticket_template: name, attach_to: ticket_type ref (a ticket type with no template of its own; inventory.details shows it), children: [{ summary, ticket_type: ref, team?: ref }]: every ticket of attach_to raises these child tickets straight away (C1). Child tickets raised in order or on approval aren't supported yet.`,
  },
  {
    key: 'visibility',
    name: 'showing a field only for some answers',
    sections: ['visibility'],
    prompt: `- ticket_type set may have show_field_when: [{ field: ref of a field placed DIRECTLY on that form (not in a section), when: ref of a DROPDOWN or MULTI-SELECT field on the same form, equals: ONE of its options }]: the field shows only for that answer (V1); for a multi-select it shows when that option is among the answers picked (V2). Add the field with add_fields first if it isn't on the form. A field shown by a rule that the request calls required (or "conditional") is still added with mandatory: true: Halo only asks for it while it's shown. Sections can't be made conditional yet.`,
  },
  {
    key: 'acknowledgement',
    name: 'acknowledgement emails when a ticket is logged',
    sections: ['ackEmail'],
    prompt: `- ticket_type set may have acknowledgement_email: ref of an email_template step: Halo emails the requester that template as soon as a ticket of that type is logged (EM4). For a NEW ticket type, add an update step after creating it. Halo only sends it if the agent account it sends as is verified (EM5): say so in assumptions.
- "Email the requester when it moves to <status>": Halo's status settings don't send an email when a ticket enters a status (EM3). Do it on the action that moves the ticket there: outcome with new_status and send_email (E1), or outcome set: { send_email } on an existing one. Say in assumptions that the email goes when an agent uses that button, not when the status is changed some other way.`,
  },
  {
    key: 'field_hints',
    name: 'field help text (hints)',
    sections: ['fieldHint'],
    prompt: `- field create may have hint: the help text Halo shows with the field, on the agent form and the portal. Use the brief's help text word for word. field update set: { hint } changes it on an existing field. A form can show its OWN help text for a shared field (Halo's Override Field Hint): put hint on that form's field entry (ticket_type create fields: [{ ref, mandatory, hint }], update add_fields: [{ ref, hint }], or update set: { field_hints: [{ ref, hint }] } for a field already on the form). So REUSE the field and give each form its own hint; never make a second field just for different help text. Changing the field's own hint (field update set: { hint }) changes it on every form without an override.`,
  },
  {
    key: 'dynamic_lists',
    name: 'dropdowns filled from Halo data (user and site pickers)',
    sections: ['dynamicList'],
    prompt: `- A dropdown whose options are a live list from Halo (rule F12): field create with type "dropdown", NO options, and dynamic: { list: "users" | "sites", copy_settings_from: ref of a REUSE step of an existing field that inventory.details.custom_fields marks "[dynamic list]" }. users = every active user (a user picker: line manager, the person leaving, who it's for); sites = every site (site / building); organisations = every organisation (customer / client). Never write SQL. To switch an EXISTING field that is already "[dynamic list]" to another of these lists, update it: field update set: { dynamic_list: "users" | "sites" | "organisations" } (no new field, no swap needed). If no field on the instance is marked "[dynamic list]", don't build it: say in unsupported that one dynamic list field has to be made by hand in Halo first. For "sites" and "organisations", say in assumptions to open the field in Halo and press Test once, since those lists haven't been run on a live instance yet.
- Swap one field for another on forms (e.g. a fixed dropdown for a dynamic one): ticket_type update (or field_group update) set: { replace_fields: [{ old: ref, new: ref }] }. The new field takes the old one's place, mandatory setting and show rules. Add an update step for EVERY ticket type and field group the old field is on (inventory.details). Enact never deletes: name the old field in assumptions so the user can delete it in Halo. Give the new field the same label and hint as the old one unless asked otherwise.`,
  },
  {
    key: 'services',
    name: 'services in the service catalogue',
    sections: ['service', 'serviceCategory', 'builderProof'],
    prompt: `- service (an entry in the portal's service catalogue): create { name, summary (the description people see on the self-service portal: when a brief or design gives a request type a description, it goes here, word for word), service_category: ref of a service_category step (inventory.service_categories lists paths "Parent > Child"; reuse one by its FULL path, match: { name: "HR > HR Shared Services" }), ticket_type: ticket_type ref (what the portal logs when someone requests it), show_on_portal?: true (default) }. update set: { name? (rename), summary?, ticket_type?, service_category?, show_on_portal? }. A service category can be renamed or moved: service_category update set: { name?, parent?: ref of another service_category, top_level?: true }. Order moves so no category is ever four levels deep, and never move a category under itself or its own child (move the child out first). Halo allows at most THREE levels of service categories (SC2, e.g. HR > Recruitment > Onboarding): a deeper path goes in its third level, and say so in assumptions. Enact adds the ticket type under the service's Service Request Details, so people can request it on the portal; to make an existing service requestable, update it with set: { ticket_type: ref of its ticket type }. Check inventory.services first and update the one that exists. Put a service where the request says. Walk the requested path from the top: reuse each level that exists AT THAT PLACE in the tree (full path in inventory.service_categories), and create the rest in order, each under the one before: service_category create { name, parent: ref of the level above } (no parent = top level). A category with the same name in another branch is a different category: never reuse it for this path. Never create a category whose full path already exists.`,
  },
  {
    key: 'imports',
    name: 'users and sites from a list',
    sections: ['people', 'builderProof'],
    prompt: `- site: create { name, organisation: ref of a REUSED organisation step (inventory.organisations) }. Reuse sites already in inventory.sites.
- user (an end user, NOT an agent): create { name: "First Last", firstname, surname, email, site: site ref }. Only people the brief or an attached list names, with their email. Never invent an email. Enact matches users on email: one already there is left alone.
- organisation: reuse by exact name from inventory.organisations.`,
  },
  {
    key: 'organisations',
    name: 'new organisations',
    sections: ['organisation', 'builderProof'],
    prompt: `- organisation: create { name } when the brief names one that inventory.organisations doesn't have (rule S1b: Enact never copies an organisation).`,
  },
  {
    key: 'working_hours',
    name: 'working hours and bank holidays',
    sections: ['workingHours', 'builderProof'],
    prompt: `- working_hours: create { name, based_on: exact name from inventory.working_hours, start: "09:00", end: "17:30", days: ["mon","tue","wed","thu","fri"] } (same hours every day). Reuse by name when it exists.
- holiday (a bank holiday on a working hours): create { name, date: "YYYY-MM-DD", working_hours: working_hours ref }. One step per date. Only dates the brief gives or that are certain (UK bank holidays for a year the brief names); say in assumptions which list you used. Enact skips a date already on those working hours.`,
  },
  {
    key: 'canned_text',
    name: 'canned text',
    sections: ['cannedText', 'builderProof'],
    prompt: `- canned_text: create { name, text }: a saved reply agents insert into a ticket. text in plain words, line breaks as \n.`,
  },
  {
    key: 'kb_articles',
    name: 'knowledge base articles',
    sections: ['kb'],
    prompt: `- kb_article: create { name (the article title), body (the article in plain words, paragraphs separated by \n\n), faq_list: ref of a REUSED faq_list step (exact name from inventory.faq_lists) }. Write only what the brief or an attached document says; never invent steps or facts. Reuse an article already in inventory.kb_articles.`,
  },
  {
    // Round 39 (T9): zz Enact r36 form kept allowattachments and minattachments.
    key: 'attachments',
    name: 'attachments on a form',
    sections: ['attachments'],
    prompt: `- Attachments are a setting on the form, not a field (T9): ticket_type update (or create) set: { attachments: { allow: true, min: 0 } }; min: 1 when the request says an attachment is required on EVERY ticket (a conditional or optional upload stays min 0, and say in assumptions it can't be required only sometimes). Never create a field for an upload.`,
  },
  {
    key: 'read_only',
    name: 'read-only fields on a form',
    sections: ['readOnly'],
    prompt: `- A field that should show but not be typed in (e.g. filled in automatically): ticket_type update set: { read_only: [field refs] }, in the SAME step as the add_fields that puts a new field on the form.`,
  },
  {
    key: 'roles',
    name: 'agent roles',
    sections: ['role'],
    prompt: `- role (agent permissions): create { name, based_on_role: ref of a REUSED role step (exact name from inventory.roles) }: the new role gets exactly the permissions of that role. Enact can't change single permissions: name any differences in unsupported.`,
  },
  {
    key: 'asset_types',
    name: 'asset types',
    sections: ['assetType'],
    prompt: `- asset_type: create { name, asset_group: ref of a REUSED asset_group step (exact name from inventory.asset_groups) }.`,
  },
  {
    key: 'asset_fields',
    name: 'fields on asset types',
    sections: ['assetFields'],
    prompt: `- asset_type create may have asset_fields: [names from inventory.asset_fields, in order]: the fields shown on that asset type. Only names in that list; any other field goes in unsupported.`,
  },
  {
    key: 'lookup_values',
    name: 'values in Halo\'s own lists (closure codes, asset statuses, risk levels)',
    sections: ['lookupList', 'builderProof'],
    prompt: `- lookup_value: a value in one of Halo's own lists that isn't a custom field (impact, urgency, risk, closure or fault codes, asset statuses...): create { name, list: the NUMBER from inventory.lookup_lists for that list }. Only lists named there. A custom dropdown field's options are NOT this: use field update add_options. Enact skips a value already in the list.`,
  },
  {
    key: 'retire',
    name: 'retiring ticket types',
    sections: ['retire', 'builderProof'],
    prompt: `- Retire an old ticket type: ticket_type update set: { retire: true }. It disappears from the ticket type lists and the portal; nothing is deleted and its tickets stay. Only for types the brief says to retire or replace.`,
  },
  {
    key: 'remove_fields',
    name: 'removing fields from a form',
    sections: ['removeFields', 'builderProof'],
    prompt: `- Take fields off a form: ticket_type update (or field_group update) set: { remove_fields: [field refs] }. The field itself stays in Halo with its data; only this form stops showing it. Never remove a field a show rule on the same form depends on.`,
  },
  {
    key: 'email_branding',
    name: 'branded email layouts (logo, colour and footer)',
    sections: ['emailBrand'],
    prompt: '',
  },
  {
    key: 'runbooks',
    name: 'runbooks and integrations',
    sections: ['runbook'],
    prompt: '',
  },
];

/** What's still unknown for a feature: "section.key" for every null. Empty = ready. */
export function featureGaps(f: Feature): string[] {
  return f.sections.flatMap((sec) => Object.entries(SPIKE_MAP[sec] as Record<string, unknown>).filter(([, v]) => v === null).map(([k]) => `${sec}.${k}`));
}
export const featureReady = (f: Feature) => featureGaps(f).length === 0;

/** Rule F12: the SQL lists Enact ships. The planner picks one by name; it never writes SQL against a client's database. */
export const SQL_LISTS = {
  users: {
    what: 'every active user, shown as "Name (email)"',
    sql: "SELECT u.uid AS ID, u.uusername + ISNULL(' (' + NULLIF(u.uemail, '') + ')', '') AS Display FROM users u WHERE u.uinactive = 0 AND u.uusername <> 'General User' ORDER BY u.uusername",
    ranOnLiveInstance: true, // 11 Nov: Halo's Test returned every user
  },
  sites: {
    what: 'every site',
    sql: 'SELECT s.ssitenum AS ID, s.sdesc AS Display FROM site s ORDER BY s.sdesc',
    ranOnLiveInstance: false,
  },
  organisations: {
    what: 'every organisation (customer / client)',
    sql: 'SELECT a.aarea AS ID, a.aareadesc AS Display FROM area a ORDER BY a.aareadesc',
    ranOnLiveInstance: false,
  },
} as const;
export type SqlList = keyof typeof SQL_LISTS;

/** The setting that holds a field's SQL, found by its value (rule F12). */
export function sqlKeyOf(row: Record<string, unknown> | null | undefined): string | null {
  for (const [k, v] of Object.entries(row ?? {})) if (typeof v === 'string' && /\bselect\b[\s\S]+\bfrom\b/i.test(v)) return k;
  return null;
}
/** Planner lines for the features that are ready. */
export const readyFeaturePrompt = () => FEATURES.filter(featureReady).map((f) => f.prompt).filter(Boolean).join('\n');
/** The Halo variables the planner may use: the evidenced list once learn has read it, else the three seen so far. */
export function emailVariablePrompt(): string {
  const { known, common } = SPIKE_MAP.emailVariables;
  if (!known) return '$FAULTID (ticket number), $symptom (summary), $STATUS';
  return `${Object.entries(common).map(([v, m]) => `${v} (${m})`).join(', ')}. Use only these; a variable Halo doesn't know is refused by the checks`;
}
/** Plain names of the features not ready yet, for the planner's "unsupported" guidance. */
export const notReadyFeatureNames = () => FEATURES.filter((f) => !featureReady(f)).map((f) => f.name);

/** The features a plan step relies on. */
export function featuresOf(step: PlanStep): Feature[] {
  const keys = new Set<string>();
  if (step.object === 'email_template' || step.send_email || step.set?.send_email) keys.add('emails');
  if (step.object === 'ticket_rule') keys.add('ticket_rules');
  if (step.then?.priority !== undefined || step.set?.priority !== undefined) keys.add('rule_priority');
  if ((step.when ?? []).some((c) => 'impact' in c || 'urgency' in c)) keys.add('priority_matrix');
  if (step.then?.category) keys.add('rule_category');
  if (step.object === 'category') keys.add('categories');
  if (step.object === 'notification') keys.add('notifications');
  if (step.object === 'ticket_template') keys.add('child_tickets');
  if (step.object === 'service' || step.object === 'service_category') keys.add('services');
  if (step.object === 'user' || step.object === 'site') keys.add('imports');
  if (step.object === 'organisation' && step.action === 'create') keys.add('organisations');
  if (step.object === 'working_hours' || step.object === 'holiday') keys.add('working_hours');
  if (step.object === 'canned_text') keys.add('canned_text');
  if (step.object === 'lookup_value') keys.add('lookup_values');
  if (step.object === 'kb_article' || step.object === 'faq_list') keys.add('kb_articles');
  if (step.set?.read_only?.length) keys.add('read_only');
  if (step.set?.attachments) keys.add('attachments');
  if (step.object === 'role' && step.action === 'create') keys.add('roles');
  if (step.object === 'asset_type' || step.object === 'asset_group') keys.add('asset_types');
  if (step.asset_fields?.length) keys.add('asset_fields');
  if (step.set?.retire) keys.add('retire');
  if (step.set?.remove_fields?.length) keys.add('remove_fields');
  if (step.set?.show_field_when?.length) keys.add('visibility');
  if (step.brand) keys.add('email_branding');
  if (step.hint !== undefined || step.set?.hint !== undefined) keys.add('field_hints');
  if (step.dynamic || step.set?.replace_fields?.length || step.set?.dynamic_list) keys.add('dynamic_lists');
  if (step.set?.acknowledgement_email) keys.add('acknowledgement');
  return FEATURES.filter((f) => keys.has(f.key));
}

function departmentOf(ref: string, refs: Refs, warn: (m: string) => void): Record<string, unknown> {
  const row = refs[ref]?.row;
  if (row?.department_id === undefined) {
    warn(`department_of: "${ref}" has no department to copy (reuse a team for it)`);
    return {};
  }
  return { department_id: row.department_id };
}

type Row = Record<string, unknown>;

/** Existing rows of a field list, ready to send back: nested display objects dropped (rule U2). */
/**
 * Rule F12: a dropdown filled from SQL. Every plain setting is copied from a field on this instance that already takes
 * its options from SQL (so Halo's own lookup type, method, load type and connection come with it), then the identity,
 * label, hint and SQL are this field's own. Lists and objects aren't copied: they tie a field to its forms and values.
 */
function dynamicField(step: PlanStep, fallback: Row, refs: Refs, warn: (m: string) => void): Row {
  const d = step.dynamic!;
  const src = refs[d.copy_settings_from]?.row;
  const key = sqlKeyOf(src);
  const preset = SQL_LISTS[d.list];
  if (!preset) { warn(`dynamic list: Enact has no "${d.list}" list (it has ${Object.keys(SQL_LISTS).join(', ')})`); return fallback; }
  if (!src || !key) { warn(`dynamic list: "${d.copy_settings_from}" must be a REUSED field that already takes its options from SQL (rule F12)`); return fallback; }
  const plain = Object.fromEntries(Object.entries(src).filter(([k, v]) => (v === null || typeof v !== 'object') && !/^(id|guid|name|label|hint|summary|defaultvalue|defaultvalue_lookup)$/i.test(k)));
  return {
    ...plain,
    name: bareFieldName(step.name),
    label: step.label ?? step.name,
    hint: step.hint ?? '',
    summary: FIELD_SUMMARY_PLACEHOLDER, // cleared by afterCreate (rule F6)
    usage: 1, // rule F10
    [key]: preset.sql,
  };
}

/** Rule F12: put the new field where the old one was on a form, with its mandatory setting and show rules. */
function replaceRows(rows: Row[], pairs: { old: string; new: string }[], refs: Refs, warn: (m: string) => void) {
  const vk = SPIKE_MAP.visibility.conditions;
  for (const p of pairs) {
    const oldId = Number(refs[p.old]?.id);
    const newId = Number(refs[p.new]?.id);
    const at = rows.findIndex((r) => Number(r.fieldid) === oldId);
    if (at < 0) {
      if (!rows.some((r) => Number(r.fieldid) === newId)) warn(`replace_fields: "${refs[p.old]?.row?.label ?? p.old}" isn't directly on this form (inside a section? replace it on the field group)`);
      continue; // already swapped on an earlier run
    }
    // A show rule elsewhere on the form that depends on the old field would break.
    const dependants = rows.filter((r) => (((vk && r[vk]) as Row[]) ?? []).some((g) => ((g.visibility_conditions as Row[]) ?? []).some((c) => Number(c.lookup_field_id) === oldId)));
    if (dependants.length) { warn(`replace_fields: ${dependants.length} show rule(s) on this form depend on "${refs[p.old]?.row?.label ?? p.old}"; not swapped`); continue; }
    const { id: _id, guid: _guid, ...rest } = rows[at];
    if (vk && Array.isArray(rest[vk])) rest[vk] = (rest[vk] as Row[]).map(({ id: _g, ...g }) => ({ ...g, entity_id2: newId }));
    rows[at] = { ...rest, fieldid: newId };
  }
}

/** Problems if a swapped-out field is still on the form after saving (rule F12). */
function checkReplaced(back: unknown, pairs: { old: string; new: string }[] | undefined, refs: Refs | undefined, what: string): string[] {
  const got = (back as Row[]) ?? [];
  return (pairs ?? []).filter((p) => got.some((r) => Number(r.fieldid) === Number(refs?.[p.old]?.id))).map((p) => `${what}: "${refs?.[p.old]?.row?.label ?? p.old}" is still on the form after saving; take it off by hand`);
}

/** Take fields off a form: the rows without them (round 28). Refuses a field a show rule on the form depends on. */
function removeRows(rows: Row[], refsToRemove: string[], refs: Refs, warn: (m: string) => void, vk: string | null): Row[] {
  const ids = new Set(refsToRemove.map((r) => Number(refs[r]?.id)).filter((n) => n > 0));
  for (const r of refsToRemove) if (!(Number(refs[r]?.id) > 0)) warn(`remove_fields: "${r}" has no field id`);
  const keep: Row[] = [];
  for (const row of rows) {
    if (!ids.has(Number(row.fieldid))) { keep.push(row); continue; }
    const dependants = rows.filter((x) => (((vk && x[vk]) as Row[]) ?? []).some((g) => ((g.visibility_conditions as Row[]) ?? []).some((c) => Number(c.lookup_field_id) === Number(row.fieldid))));
    if (dependants.length) { warn(`remove_fields: ${dependants.length} show rule(s) on this form depend on field ${row.fieldid}; not removed`); keep.push(row); }
  }
  return keep;
}
function checkRemoved(back: unknown, removed: string[] | undefined, refs: Refs | undefined, what: string): string[] {
  if (!removed?.length || !refs) return [];
  return removed.filter((r) => ((back as Row[]) ?? []).some((b) => Number(b.fieldid) === Number(refs[r]?.id))).map((r) => `${what}: ${refs[r]?.row?.label ?? refs[r]?.name ?? r} is still on it after saving`);
}

/** A Service Request Details row: the shape of Halo's own (services 122 and 71, round 35), kept on service 170 (round 36). */
function requestRow(ticketTypeId: unknown): Row {
  return { servicedetail_type: 0, servicedetail_requesttypeid: ticketTypeId, servicedetail_label: 'Request this Service', servicedetail_shownewreqscreen: true, icon: 'plus-circle', sequenceid: 10, allow_all_items: true };
}

function keepRows(rows: unknown): Row[] {
  return ((rows as Row[]) ?? []).map((r) => {
    const { group: _g, fieldinfo: _f, ...rest } = r;
    return rest;
  });
}

/**
 * Rule T5 (2026-10-23): a ticket type's form also carries Halo's own fields (Details = symptom2, Agent,
 * Followers = -52, category, hidden AI fields). Replacing the whole form dropped them: New Joiner had no
 * Details box. Keep a source form's loose rows unless they are VISIBLE custom fields (the source's own questions).
 */
function isStandardRow(r: Row): boolean {
  if (Number(r.fieldid) === 0) return false; // a section row
  const name = String((r.fieldinfo as Row)?.name ?? '');
  const visible = ['endusernew', 'technew', 'enduserdetail', 'techdetail'].some((k) => Number(r[k]) > 0);
  return !(name.startsWith('CF') && visible);
}

/** Add fields / change mandatory on a list of field rows (ticket type or field group). */
/** Rough "same field" test on labels: lower-case words with simple endings removed ("Starting Date" ~ "Start date"). */
function sameMeaning(a: string, b: string): boolean {
  const stem = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.replace(/(ing|ed|s)$/, '')).join(' ');
  return stem(a) === stem(b);
}

/** Field name of each existing row, by row id (rule F9: standard field names aren't unique across Halo). */
function rowNames(current: Row): Map<number, string> {
  return new Map(((current.fields as Row[]) ?? []).map((r) => [Number(r.id), String((r.fieldinfo as Row)?.name ?? '').toLowerCase()]));
}

/** Every label shown on a form: loose fields and fields inside its sections (from the detail read). */
function formLabels(current: Row): string[] {
  const out: string[] = [];
  for (const r of (current.fields as Row[]) ?? []) {
    const fi = r.fieldinfo as Row | undefined;
    if (fi?.label) out.push(String(fi.label));
    for (const f of ((r.group as Row)?.fields as Row[]) ?? []) if ((f.fieldinfo as Row)?.label) out.push(String((f.fieldinfo as Row).label));
  }
  return out;
}

function editFieldRows(rows: Row[], refs: Refs, add: { ref: string; mandatory?: boolean }[] = [], mand: { ref: string; mandatory: boolean }[] = [], shape: Row, warn: (m: string) => void, labelsOnForm: string[] = [], names: Map<number, string> = new Map()): Row[] {
  // Rule F9 (2026-10-23): FProjectStartDate looked up by name was id -19, but the one on Change Scheduling is -105.
  // Match a field to a form row by id OR by the row's own field name.
  const sameField = (r: Row, ref: string) =>
    Number(r.fieldid) === Number(refs[ref]?.id) || (!!refs[ref]?.name && names.get(Number(r.id)) === String(refs[ref]?.name).toLowerCase());
  const m = SPIKE_MAP.ticketType;
  const level = (b?: boolean) => (b ? m.mandatoryValue : m.optionalValue);
  for (const c of mand) {
    const row = rows.find((r) => sameField(r, c.ref));
    if (!row) { warn(`field_mandatory: ${c.ref} isn't on this form; add it with add_fields`); continue; }
    for (const k of m.mandatoryKeys ?? []) row[k] = level(c.mandatory);
  }
  let seq = Math.max(0, ...rows.map((r) => Number(r.seq) || 0));
  for (const f of add) {
    // A field created earlier in this plan has a placeholder id in the dry run ("<new x>"): keep it as is, so later
    // checks in the same step can still find the row (a number conversion made it NaN).
    const raw = refs[f.ref]?.id;
    const id = typeof raw === 'string' && raw.startsWith('<new') ? raw : Number(raw);
    if (rows.some((r) => sameField(r, f.ref))) continue; // already there (e.g. a re-run): nothing to do
    // Rule F8 (2026-10-23): "Start date" added to a form that already had "Starting Date" in a section.
    const label = String(refs[f.ref]?.row?.label ?? '');
    const twin = label ? labelsOnForm.find((l) => sameMeaning(l, label)) : undefined;
    if (twin) { warn(`add_fields: "${label}" NOT added: the form already has "${twin}" (rule F8). Make that one mandatory instead.`); continue; }
    const row: Row = { ...shape, fieldid: id, seq: ++seq };
    for (const k of m.mandatoryKeys ?? []) row[k] = level(f.mandatory);
    rows.push(row);
  }
  return rows;
}

/** Problems if the read-back rows don't carry the fields / mandatory levels we sent. */
function checkFieldRows(back: unknown, sent: unknown, what: string): string[] {
  const m = SPIKE_MAP.ticketType;
  const got = (back as Row[]) ?? [];
  const out: string[] = [];
  for (const r of (sent as Row[]) ?? []) {
    const key = Number(r.fieldid) !== 0 ? 'fieldid' : 'groupid';
    const b = got.find((g) => Number(g[key]) === Number(r[key]) && (key === 'groupid' ? Number(g.fieldid) === 0 : true));
    if (!b) { out.push(`${what}: ${key} ${r[key]} not on the form after saving`); continue; }
    for (const k of m.mandatoryKeys ?? []) if (r[k] !== undefined && Number(b[k]) !== Number(r[k])) out.push(`${what}: ${key} ${r[key]} ${k} is ${b[k]}, wanted ${r[k]}`);
    const hk = SPIKE_MAP.formRow.hintOverride;
    if (hk && r[hk] !== undefined && String(b[hk] ?? '') !== String(r[hk])) out.push(`${what}: ${key} ${r[key]} help text is ${JSON.stringify(b[hk] ?? '')}, wanted ${JSON.stringify(r[hk])}`);
  }
  return out;
}

/**
 * Rule W8 (2026-10-24): change the buttons on EXISTING stages. Add puts a new button on a stage; retarget sends a
 * button already on the stage somewhere else. Local step ids only (W1/W2). Re-runs change nothing (U4).
 * Removing a button is not supported. Returns whether anything changed.
 */
function applyButtons(p: Row, add: ButtonChange[], retarget: ButtonChange[], refs: Refs): boolean {
  const steps = p.steps as Row[];
  const byName = (n: string) => steps.find((s) => String(s.name).toLowerCase() === n.toLowerCase());
  const need = (n: string) => { const s = byName(n); if (!s) throw new Error(`Workflow has no stage named "${n}"`); return s; };
  let changed = false;
  for (const c of retarget) {
    const from = need(c.step);
    const to = need(c.to_step);
    const row = ((from.actions as Row[]) ?? []).find((a) => Number(a.action_id) === Number(refs[c.via]?.id));
    if (!row) throw new Error(`"${refs[c.via]?.name}" isn't a button on "${c.step}", so it can't be re-pointed. Add it instead.`);
    if (Number(row.end_step) === Number(to.step_id)) continue;
    row.end_step = to.step_id;
    changed = true;
  }
  for (const c of add) {
    const from = need(c.step);
    const to = need(c.to_step);
    const actions = (from.actions as Row[]) ?? [];
    const there = actions.find((a) => Number(a.action_id) === Number(refs[c.via]?.id));
    if (there && Number(there.end_step) === Number(to.step_id)) continue; // already as wanted (re-run)
    if (there) throw new Error(`"${refs[c.via]?.name}" is already a button on "${c.step}" (to another stage); re-point it instead (W4)`);
    // Shape: an existing plain action on this stage, or on any stage.
    const sample = actions.find((a) => Number(a.action_type) === 1) ?? steps.flatMap((s) => (s.actions as Row[]) ?? []).find((a) => Number(a.action_type) === 1) ?? {};
    const { id: _id, guid: _guid, ...shape } = sample;
    actions.push({
      ...shape,
      action_type: 1,
      action_id: refs[c.via]?.id,
      action_name: refs[c.via]?.name ?? '',
      action_outcome: '',
      start_step: from.step_id,
      end_step: to.step_id,
      seq: actions.length + 1,
      approval_result: -1,
      conditions: [],
      conditions_exec: [],
      group_restrictions: [],
    });
    from.actions = actions;
    changed = true;
  }
  return changed;
}

/**
 * A readable, stable name for an approval stage: shown in Halo, and how re-runs recognise a stage already added (U4).
 * Halo shows it as "<process> - <stage> - <approver>", so a rules stage names only the condition (rule P9).
 */
export function stageName(a: Approver, refs: Refs): string {
  const who = (ref?: string) => refs[ref ?? '']?.name ?? ref ?? '';
  const label = (ref: string) => String(refs[ref]?.row?.label ?? refs[ref]?.label ?? who(ref));
  if ('rules' in a) return `If ${a.rules.map((r) => `${label(r.field)} is ${r.equals}`).join(', or ')}`.slice(0, 100);
  if ('line_manager' in a) return 'Line manager';
  if ('adhoc' in a) return 'Chosen by the agent';
  if ('agent' in a) return `Approval: ${who(a.agent)}`.slice(0, 100);
  return `Approval: ${who(a.group)}`.slice(0, 100);
}

/** Every name a stage may already have in Halo: today's, and the "Rules: <field name> is <answer>" of builds before P9. */
export function stageNames(a: Approver, refs: Refs): string[] {
  if (!('rules' in a)) return [stageName(a, refs)];
  // A pre-P9 build named the field by whatever it knew then: its label when the field was reused, its CF name when the
  // same plan created it (no Halo row yet). Recognise both (run 20 added a second stage when only one was checked).
  const by = (f: (ref: string) => string | undefined) => `Rules: ${a.rules.map((r) => `${f(r.field) ?? r.field} is ${r.equals}`).join(', ')}`.slice(0, 100);
  const legacy = [
    by((ref) => (refs[ref]?.row?.label as string | undefined) ?? refs[ref]?.label),
    by((ref) => refs[ref]?.name),
  ];
  return [...new Set([stageName(a, refs), ...legacy])];
}

/** One approval stage row, shaped like an existing one (rule P3: display labels never copied). */
function stageRow(shape: Row, a: Approver, refs: Refs, sequence: number): Row {
  const m = SPIKE_MAP.approval;
  const { id: _id, guid: _guid, processid: _p, ...rest } = shape;
  const row: Row = { ...rest, sequence, name: stageName(a, refs), agent_name: '', cab_name: '' };
  if ('line_manager' in a) row.type = m.lineManagerStepType;
  else if ('adhoc' in a) row.type = m.adhocStepType;
  else if ('rules' in a) {
    // Rule P7: approvers come from rules; when no rule matches the ticket, the stage approves itself.
    row.type = m.rulesStepType;
    row[m.approverIdKey] = 0;
    row.autoapproveifnoapprovers = true;
  } else if ('agent' in a) {
    row.type = m.agentStepType;
    row[m.approverIdKey] = refs[a.agent]?.id;
  } else if ('group' in a) {
    row.type = m.groupStepType;
    row[m.approverIdKey] = refs[a.group]?.id;
    row[m.minApproversKey] = a.min ?? 1;
  }
  return row;
}

/** Buttons that resolve, close or cancel a ticket (Halo system actions): never rerouted into a new stage (rule W5). */
export const CLOSING_ACTION = /resolv|close|cancel|complete|reject/i;
/** Halo actions that don't move a ticket on (they open a dialog): never a way out of a stage (rule W6). */
export const NON_MOVING_ACTION = /re-?assign|add note|note|email|reply|log time|merge|split|link|watch|follow/i;

/** Insert new stages into a workflow payload (new copy OR an existing workflow). Local ids only (rule W1/W2). */
function applyInserts(p: Row, inserts: InsertStep[], refs: Refs): Row {
  const steps = p.steps as Row[];
  const stages = p.stages as Row[];
  const byName = (n: string) => steps.find((s) => String(s.name).toLowerCase() === n.toLowerCase());
  for (const ins of inserts) {
    const after = byName(ins.after_step);
    if (!after) throw new Error(`Workflow has no step named "${ins.after_step}"`);
    if (byName(ins.name)) throw new Error(`Workflow already has a step named "${ins.name}"`);
    // Rule W4 (2026-10-23): an action already on the step can't also lead into the new stage (one button, two destinations).
    if (((after.actions as Row[]) ?? []).some((a) => Number(a.action_id) === Number(refs[ins.enter_via]?.id)))
      throw new Error(`"${refs[ins.enter_via]?.name}" is already an action on "${ins.after_step}"; use a new action to enter "${ins.name}"`);
    const newStepId = Math.max(...steps.map((s) => Number(s.step_id))) + 1;
    const newStage = Number(after.stage_number) + 1;

    // Make room in the progress bar: shift later stages (and the steps on them) along by one.
    for (const st of stages) if (Number(st.sequence) >= newStage) st.sequence = Number(st.sequence) + 1;
    for (const s of steps) if (Number(s.stage_number) >= newStage) s.stage_number = Number(s.stage_number) + 1;
    stages.push({ sequence: newStage, name: ins.name, edit_outcome: -1, type: 1 });
    stages.sort((a, b) => Number(a.sequence) - Number(b.sequence));

    // Action rows copy the shape of an existing outcome action on the "after" step (ids of that row dropped).
    const actions = (after.actions as Row[]) ?? [];
    const { id: _id, guid: _guid, ...shape } = actions.find((a) => Number(a.action_type) === 1) ?? actions[0] ?? {};
    const action = (via: string, from: number, to: number, seq: number): Row => ({
      ...shape,
      action_type: 1,
      action_id: refs[via]?.id,
      action_name: refs[via]?.name ?? '',
      action_outcome: '',
      start_step: from,
      end_step: to,
      seq,
      approval_result: -1,
      conditions: [],
      conditions_exec: [],
      group_restrictions: [],
    });

    // Rule W5 (2026-10-24): A's own buttons that went where the new stage now leads would let people skip it
    // ("Checks Done" was added, but Request Fulfilment's old buttons still went straight on). Send them into the
    // new stage instead. Buttons that resolve or close keep going where they did: rerouting those would close the
    // ticket while it sits in the new stage. Approval branches are left alone.
    const exitIds = new Set(ins.exits.map((e) => Number(byName(e.to_step)?.step_id)));
    for (const a of actions) {
      if (Number(a.action_type) !== 1 || Number(a.approval_result ?? -1) !== -1) continue;
      if (!exitIds.has(Number(a.end_step)) || CLOSING_ACTION.test(String(a.action_name ?? ''))) continue;
      a.end_step = newStepId;
    }

    // Into the new step: the plan's own button on the "after" step.
    actions.push(action(ins.enter_via, Number(after.step_id), newStepId, actions.length + 1));
    after.actions = actions;

    // The new step itself, shaped like the "after" step, with its own exit actions.
    const { id: _sid, guid: _sguid, ...afterShape } = after;
    const newStep: Row = { ...afterShape, name: ins.name, step_id: newStepId, stage_number: newStage, isstart: false, isend: false, islaststep: false, actions: [] };
    steps.push(newStep);
    newStep.actions = ins.exits.map((e, i) => {
      const target = byName(e.to_step);
      if (!target) throw new Error(`Workflow has no step named "${e.to_step}"`);
      return action(e.via, newStepId, Number(target.step_id), i + 1);
    });
  }
  // Designer boxes for new steps are added by Halo itself (proven 2026-10-19: designer showed Awaiting Equipment).
  return p;
}

// ---------- plan types ----------

export interface Ref {
  id: number | string;
  name?: string;
  /** Full record of a reused object (detail read), so later steps can copy settings from it. */
  row?: Record<string, unknown>;
  /** The label a plan gave a field it creates, for readable names before Halo has a row for it. */
  label?: string;
}
export type Refs = Record<string, Ref>;

export interface PlanStep {
  id: string;
  object: 'team' | 'field' | 'sla' | 'approval_process' | 'ticket_type' | 'status' | 'outcome' | 'workflow' | 'agent' | 'approval_group' | 'field_group' | 'email_template' | 'ticket_rule' | 'ticket_template' | 'category' | 'notification' | 'service' | 'service_category' | 'user' | 'site' | 'organisation' | 'working_hours' | 'holiday' | 'canned_text' | 'lookup_value' | 'kb_article' | 'faq_list' | 'role' | 'asset_type' | 'asset_group';
  action: 'create' | 'reuse' | 'update';
  name?: string;
  /** email_template: the workspace's branding (rule EM1). Added by the app or the run, never by the planner. */
  brand?: EmailBrand;
  /** field: help text shown with the field (rule F11). */
  hint?: string;
  /** service: one line on the portal; ticket_type / service_category refs; show_on_portal (default true). */
  summary?: string;
  ticket_type?: string;
  service_category?: string;
  show_on_portal?: boolean;
  /** service_category: the category it sits under (a service_category ref); none = top level. */
  parent?: string;
  /** user: firstname, surname, email, site ref. site: organisation ref. */
  firstname?: string;
  surname?: string;
  email?: string;
  site?: string;
  organisation?: string;
  /** working_hours: same hours every day; days mon..sun. holiday: date YYYY-MM-DD on a working_hours ref. */
  start?: string;
  end?: string;
  days?: string[];
  date?: string;
  working_hours?: string;
  /** kb_article: its faq_list ref (the article text is body). */
  faq_list?: string;
  /** role: copy permissions from this REUSED role. asset_type: its REUSED asset_group. */
  based_on_role?: string;
  asset_group?: string;
  /** asset_type: field names from /AssetTypeInfo, in order. Resolved to ids before building (prepare). */
  asset_fields?: string[];
  /** canned_text: the reply text. lookup_value: the list's lookupid. */
  text?: string;
  list?: number;
  /** field create: options from one of Enact's SQL lists, with Halo's settings copied from an existing SQL field (F12). */
  dynamic?: { list: SqlList; copy_settings_from: string };
  label?: string;
  type?: string;
  options?: string[];
  resolve_days?: number;
  approver?: string;
  match?: { name: string };
  fields?: { ref: string; mandatory?: boolean; hint?: string }[];
  team?: string;
  sla?: string;
  approval?: string;
  /** status: SLA behaviour while in this status, e.g. 'hold'. Omit to keep the template's. */
  sla_action?: string;
  colour?: string;
  /** outcome (action): ref of the status the ticket moves to. */
  new_status?: string;
  /** workflow: insert one new step after an existing one. */
  insert_step?: InsertStep;
  /** workflow: insert several steps, in order; later ones may come after earlier inserted ones. */
  insert_steps?: InsertStep[];
  /** sla: per-priority resolve targets by priority name, e.g. { "Critical": "4h", "Low": "5d" }. */
  targets?: Record<string, string>;
  /** team / approval_group: agent refs. */
  members?: string[];
  /** approval_group: how many members must approve. */
  approvals_needed?: number;
  /** ticket_type: field group refs, added after the plain fields. */
  groups?: string[];
  /** workflow: name of an existing workflow on THIS instance to copy. */
  copy_of?: string;
  /** any create: name of an existing record on THIS instance to copy the shape from (rule D3). */
  based_on?: string;
  /** approval_process: approval stages in order. Each stage is ONE of these (rule P1). */
  approvers?: Approver[];
  /** update: properties to change on an existing record, as refs (e.g. { workflow: "wf" }). */
  set?: {
    /** service / service_category: a new name (round 38: both kept a rename). */
    name?: string;
    // ticket_type
    workflow?: string;
    approval?: string;
    team?: string;
    sla?: string;
    add_groups?: string[];
    add_fields?: { ref: string; mandatory?: boolean; hint?: string }[];
    /** ticket_type: this form's own help text for fields already on it (Halo's Override Field Hint, rule F14). */
    field_hints?: { ref: string; hint: string }[];
    /** ticket_type: add back Halo's standard fields (Details, Followers...) from this REUSED ticket type (rule T5). */
    copy_standard_fields_from?: string;
    // ticket_type (its own loose fields) and field_group: change mandatory on fields already there
    field_mandatory?: { ref: string; mandatory: boolean }[];
    // team
    department_of?: string;
    // status
    sla_action?: string;
    // workflow: add stages to an EXISTING workflow in place (rule W3)
    insert_steps?: InsertStep[];
    /** approval_process: stages added at the end of an existing process (rule P8). */
    add_stages?: Approver[];
    /** workflow: put a button on an EXISTING stage (rule W8). */
    add_actions?: ButtonChange[];
    /** workflow: send a button already on a stage somewhere else (rule W8). */
    retarget_actions?: ButtonChange[];
    // field: add dropdown/multi-select options, change the label
    add_options?: string[];
    label?: string;
    /** field: help text (rule F11). */
    hint?: string;
    /** field: switch an existing dynamic list field to another of Enact's SQL lists (rule F12). */
    dynamic_list?: SqlList;
    /** ticket_type / field_group: swap a field on the form for another, in the same place (rule F12). */
    replace_fields?: { old: string; new: string }[];
    // approval_group / team
    add_members?: string[];
    // outcome: email the requester when the button is pressed
    send_email?: string;
    // ticket_type: show a section only for some answers
    show_field_when?: FieldCondition[];
    /** ticket_type: ref of an email_template step, emailed to the requester when a ticket is logged (EM4). */
    acknowledgement_email?: string;
    /** sla: the working hours its clock follows. */
    working_hours?: string;
    /** ticket_type: these fields show but can't be typed in (round 31). */
    read_only?: string[];
    /** ticket_type: retire it (T8: visible false). Never deleted. */
    retire?: boolean;
    /** ticket_type: attachments on the form (T9): allow them, and how many are required (0 = optional). */
    attachments?: { allow?: boolean; min?: number };
    /** service_category: move under another category (a service_category ref), or top_level: true (SC1, round 39). */
    top_level?: boolean;
    parent?: string;
    /** ticket_type / field_group: take these fields off the form (the fields stay in Halo). */
    remove_fields?: string[];
    /** service */
    summary?: string;
    ticket_type?: string;
    service_category?: string;
    show_on_portal?: boolean;
    // ticket_rule: change the priority an existing rule sets (e.g. a priority matrix cell)
    priority?: number | string;
    // email_template
    subject?: string;
    body?: string;
  };
  /** team: put the team in the same department as this reused team (step ref). Rule T3. */
  department_of?: string;
  /** outcome: Font Awesome icon name for the action button (default arrow-right). Rule O3. */
  icon?: string;
  /** email_template: subject line and body. */
  subject?: string;
  body?: string;
  /** outcome: email_template ref sent when the button is pressed. */
  send_email?: string;
  /** ticket_rule: conditions (all must match) and what it sets. */
  when?: RuleCondition[];
  then?: { team?: string; priority?: number | string; agent?: string; category?: string };
  /** notification: which event, how, and who. */
  event?: string;
  by?: 'popup' | 'email';
  agents?: string[];
  /** ticket_template: the ticket type that raises these children, and the children. */
  attach_to?: string;
  children?: { summary: string; ticket_type: string; team?: string }[];
}

export type RuleCondition = { ticket_type: string } | { field: string; equals: string } | { impact: string } | { urgency: string };

/** Show `field` (ref, placed directly on the form) only when the dropdown `when` (ref) is `equals` (rule V1). */
export interface FieldCondition {
  field: string;
  when: string;
  equals: string;
}

/** A button on a workflow stage: on `step`, the action `via` (outcome ref) moves the ticket to `to_step`. */
export interface ButtonChange {
  step: string;
  via: string;
  to_step: string;
}

export interface InsertStep {
  name: string;
  after_step: string; //                         existing (or earlier inserted) step name
  enter_via: string; //                          outcome ref: action on after_step that moves into the new step
  exits: { via: string; to_step: string }[]; //  outcome refs: actions on the new step, to step names
}

export type Approver =
  | { line_manager: true } //                 type 10
  | { agent: string } //                      type 1, ref to an agent step
  | { group: string; min?: number } //        type 3, ref to an approval_group step
  | { adhoc: true } //                        type 8, agent picks at the time
  | { rules: ApprovalRule[] }; //             type 42, approvers from rules (P7); approves itself when none match

/** One approval rule: when the dropdown `field` (ref) is `equals`, `group` or `agent` (refs) must approve (rule P7). */
export interface ApprovalRule {
  field: string;
  equals: string;
  group?: string;
  agent?: string;
}

export interface Plan {
  /** Planner output: one or two plain sentences to the user. */
  reply?: string;
  request: string;
  steps: PlanStep[];
  /** Planner output: parts of the request the builder can't do yet, in plain words. */
  /** What the instance already has for each part of the request, so the plan only builds the gap. */
  existing_coverage?: { requirement: string; status: 'built' | 'partial' | 'missing'; existing?: string }[];
  unsupported?: string[];
  /** Planner output: choices it made that the user should check (e.g. which template it based things on). */
  assumptions?: string[];
  /** Planner output: things it needs answered before the plan is safe to build. */
  questions?: string[];
  /** Planner output (M13): decisions with a few clear answers, shown as buttons. The part they decide isn't built
   *  until the user picks one. */
  choices?: { question: string; options: string[] }[];
  /** App planner: this turn was a new request, so it started a fresh plan instead of revising the last one (M12). */
  fresh?: boolean;
}

export interface Translator {
  resource: string;
  template: string; // file in fixtures/
  /** The name Halo will actually store, if it differs from what we send. Used to find and verify. */
  storedName?: (step: PlanStep) => string;
  /** A real follow-up update to send straight after creating. Some objects only finish setting up on their first save. */
  /** Return null when there's nothing to do for this record. `sent` = the payload that was created. */
  afterCreate?: (id: number, sent: Record<string, unknown>) => Record<string, unknown> | null;
  /** Records that belong to the one just created and need its ids (e.g. approval rules, rule P7). Created straight after it. */
  related?: (created: Record<string, unknown>, step: PlanStep, refs: Refs) => Promise<{ resource: string; payload: Record<string, unknown> | ((made: Record<string, unknown>[]) => Record<string, unknown>); label: string }[]>;
  /** For action 'create': problems in a fresh read-back once the related records exist (e.g. children linked, C1). */
  verifyAfterRelated?: (back: Record<string, unknown>, step: PlanStep) => string[];
  /** What `related` will add, for the dry run. */
  relatedPreview?: (step: PlanStep, refs: Refs) => string[];
  /** Property holding the record's name, if not `name` (e.g. Outcome uses `outcome`). */
  nameKey?: string;
  /** For action 'update': the partial payload (without id) to send. `current` = the record's detail read. */
  update?: (step: PlanStep, refs: Refs, warn: (msg: string) => void, current: Record<string, unknown>) => Record<string, unknown>;
  /** For action 'update': check the read-back. Returns problems; without it, scalar keys are compared. */
  verifyUpdate?: (back: Record<string, unknown>, changes: Record<string, unknown>, step: PlanStep, refs: Refs) => string[];
  /** For action 'create': problems in the read-back beyond the name (e.g. a field that isn't a ticket field, rule F10). */
  verifyCreate?: (back: Record<string, unknown>, step: PlanStep, refs?: Refs) => string[];
  build: (step: PlanStep, refs: Refs, warn: (msg: string) => void) => Record<string, unknown>;
  /** Find a record this create would duplicate, when "same name" isn't the right test (users by email, sites by
   *  organisation, holidays by date). Replaces the name lookup for creates. */
  findExisting?: (step: PlanStep, refs: Refs) => Promise<Record<string, unknown> | undefined>;
  /** Read a record back when GET /resource/id doesn't (holidays have guid ids). */
  readBack?: (created: Record<string, unknown>, step: PlanStep, refs: Refs) => Promise<Record<string, unknown> | null>;
  /** Dry run: what a created record will look like to later steps (e.g. a new team's members, for notifications). */
  previewRow?: (step: PlanStep, refs: Refs) => Record<string, unknown>;
  /** Async lookups before build (build itself is synchronous): e.g. asset field names to ids. */
  prepare?: (step: PlanStep, refs: Refs) => Promise<void>;
  /** Only reuse is supported (create refused with a warning). */
  reuseOnly?: boolean;
  /** Update keys saved in a request of their own, after the others (SV2). */
  saveAlone?: string[];
}

// ---------- helpers ----------

function fromTemplate(file: string, resource: string): Record<string, unknown> {
  // Templates come from the connected instance itself (lib/discover.ts), per instance and per run.
  const record = runtime().templates.get(file);
  if (!record) throw new Error(`No ${resource} template for this instance (${file}). Discovery should have found one.`);
  return cleanForCreate(record);
}

/** Template file for a field of a given plan type ("text", "dropdown", ...). */
export function fieldTemplateFile(type = 'text'): string {
  return `template-field-${type}.json`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Template file for "copy this named workflow". */
export function workflowTemplateFile(copyOf?: string): string {
  return copyOf ? `template-workflow--${slug(copyOf)}.json` : 'template-workflow.json';
}

/** The record a step should copy its shape from, if the plan names one (based_on, or copy_of for workflows). */
export function namedTemplate(step: PlanStep): string | undefined {
  return step.based_on ?? (step.object === 'workflow' ? step.copy_of : undefined);
}

/** Which template file a step uses: a named one if the plan says "based_on", else the default for its kind. */
export function templateFileFor(step: PlanStep, fallback: string): string {
  const named = namedTemplate(step);
  return named ? `template-${step.object}--${slug(named)}.json` : fallback;
}

export const FIELD_SUMMARY_PLACEHOLDER = 'created by builder';

/** "CFOnboardStartDate" → "OnboardStartDate". Halo adds the CF back. */
export function bareFieldName(name = ''): string {
  return name.replace(/^CF/i, '');
}

function set(payload: Record<string, unknown>, prop: string | null, value: unknown, what: string, warn: (m: string) => void) {
  if (prop) payload[prop] = value;
  else warn(`SPIKE_MAP gap: don't know where "${what}" goes yet; skipped`);
}

/** A gap in SPIKE_MAP: warn (so the dry run and rule B1 stop an apply) and leave the payload alone. */
function gap(what: string, warn: (m: string) => void) {
  warn(`SPIKE_MAP gap: don't know how Halo stores ${what} yet; needs a learning run (npm run learn -- --apply)`);
}

/** A criteria row "dropdown field equals option" (rule P7 evidence: approvalprocessrule-5/6). */
function dropdownCriterion(fieldName: string, option: { id?: unknown; name?: unknown }): Row {
  return { tablename: 'faults', fieldname: fieldName, value_type: 'int', value_int: 0, value_string: String(option.id), value_display: String(option.name), type: 23 };
}

/** The option row of a dropdown ref. Fields created in this plan only get ids when built: a placeholder in the dry run. */
function optionOf(ref: string, equals: string, refs: Refs, warn: (m: string) => void): { id: unknown; name: unknown } | null {
  const r = refs[ref];
  if (typeof r?.id === 'string' && r.id.startsWith('<new')) return { id: `<option "${equals}" of ${ref}>`, name: equals };
  const option = ((r?.row?.values as Row[]) ?? []).find((v) => String(v.name).trim().toLowerCase() === equals.trim().toLowerCase());
  if (!option) warn(`"${r?.row?.label ?? r?.name ?? ref}" has no option "${equals}"`);
  return option ? { id: option.id, name: option.name } : null;
}

/** Point an action button at an email template (feature "emails"). */
function setActionEmail(p: Row, templateRef: string, refs: Refs, warn: (m: string) => void) {
  const m = SPIKE_MAP.actionEmail;
  if (!m.send || !m.template || m.sendValue === null) return gap('an action\'s email (which sendemail number means send)', warn);
  p[m.send] = m.sendValue;
  p.hidesendemail = false; // the "Send email" box is shown (as on Halo's Email User)
  p[m.template] = refs[templateRef]?.id;
  if (!m.recipient || m.recipientRequester === null) return gap('who an action\'s email goes to', warn);
  p[m.recipient] = m.recipientRequester;
  p.tooverride = ''; // no fixed recipient: the ticket's user
}

// ---------- translators ----------

export const translators: Record<PlanStep['object'], Translator> = {
  team: {
    resource: 'Team',
    template: 'template-team.json',
    // A team made in this plan: later notifications need its members in the dry run (12 Nov enterprise test).
    previewRow: (step, refs) => ({ agents: (step.members ?? []).map((m) => ({ agent_id: refs[m]?.id })) }),
    build: (step, refs, warn) => {
      // Evidence: team-6. Members are agents[] rows { agent_id }; the template's members are dropped.
      const p = fromTemplate(templateFileFor(step, 'template-team.json'), 'Team');
      p.name = step.name;
      p.agents = (step.members ?? []).map((m) => ({ agent_id: refs[m]?.id }));
      p.managers = [];
      // Rule T3 (2026-10-19): a team's department comes from whatever template it was copied from
      // (People Operations landed in "IT" via 1st Line Support). Take it from a named team instead.
      if (step.department_of) Object.assign(p, departmentOf(step.department_of, refs, warn));
      return p;
    },
    update: (step, refs, warn, current) => {
      const out: Record<string, unknown> = {};
      if (step.set?.department_of) Object.assign(out, departmentOf(step.set.department_of, refs, warn));
      if (step.set?.add_members?.length) {
        // Evidence: team-12 agents[] rows { agent_id, ... }. Existing rows sent back as they are.
        const agents = ((current.agents as Row[]) ?? []).map((a) => ({ ...a }));
        for (const m of step.set.add_members) {
          const id = Number(refs[m]?.id);
          if (agents.some((a) => Number(a.agent_id) === id)) continue; // already in the team
          agents.push({ agent_id: id });
        }
        out.agents = agents;
      }
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
    verifyUpdate: (back, changes) => {
      const out: string[] = [];
      if (changes.department_id !== undefined && Number(back.department_id) !== Number(changes.department_id)) out.push(`department is ${back.department_id}`);
      if (changes.agents) {
        const ids = ((back.agents as Row[]) ?? []).map((a) => Number(a.agent_id));
        for (const a of changes.agents as Row[]) if (!ids.includes(Number(a.agent_id))) out.push(`agent ${a.agent_id} not in the team after saving`);
      }
      return out;
    },
  },

  field: {
    // Ticket custom fields are FieldInfo. /Field is asset fields (NOTES.md, 2026-10-19).
    resource: 'FieldInfo',
    template: 'template-field-<type>.json',
    // Halo prefixes custom field names with "CF" itself: sending "CFx" stores "CFCFx" (2026-10-19, field 310).
    storedName: (step) => `CF${bareFieldName(step.name)}`,
    // Rule F6 (2026-10-19): a field created via the API only works fully (dropdown options show)
    // after one real save. Create with a placeholder summary, then clear it: a real change, clean result.
    afterCreate: (id) => ({ id, summary: '' }),
    verifyCreate: (back, step) => {
      const out = Number(back.usage) === 1 ? [] : [`Field saved as usage ${back.usage}, not a ticket field (1): values typed on a form won't be stored (rule F10)`];
      if (step?.dynamic) {
        const key = sqlKeyOf(back);
        const want = SQL_LISTS[step.dynamic.list]?.sql;
        if (!key || back[key] !== want) out.push(`dynamic list: the SQL didn't save (rule F12); found ${key ? JSON.stringify(String(back[key]).slice(0, 80)) : 'none'}`);
      }
      return out;
    },
    build: (step, _refs, warn) => {
      // Prefer a template of the same field type: each type carries its own defaults.
      // A text template made dropdowns with inputtype -1 and no load_type, and their options didn't show (2026-10-19).
      // F12: a dropdown filled from SQL copies an existing SQL field on the instance, not a template.
      if (step.dynamic) return dynamicField(step, {}, _refs, warn);
      const p = fromTemplate(templateFileFor(step, fieldTemplateFile(step.type)), 'FieldInfo');
      const m = SPIKE_MAP.field;
      p.name = bareFieldName(step.name);
      set(p, m.label, step.label, 'field label', warn);
      p.hint = '';
      if (step.hint !== undefined) {
        if (SPIKE_MAP.fieldHint.key) p[SPIKE_MAP.fieldHint.key] = step.hint;
        else gap('field help text (hint)', warn);
      }
      p.summary = FIELD_SUMMARY_PLACEHOLDER; // cleared by afterCreate (rule F6)
      p.defaultvalue = '';
      // Rule F10: always a ticket field, whatever the template was. usage 1010 (custom table) never stores ticket values.
      p.usage = 1;
      delete p.defaultvalue_lookup; // e.g. "Standard Laptop" from the dropdown template

      const code = step.type ? SPIKE_MAP.fieldTypes[step.type] : null;
      if (code === null || code === undefined) warn(`SPIKE_MAP gap: no type code for "${step.type}"; template's type kept`);
      else set(p, m.type, code, 'field type', warn);

      if (step.options?.length) {
        set(p, m.options, step.options.map((name) => ({ name })), 'dropdown options', warn);
      } else if (m.options) {
        delete p[m.options];
      }
      return p;
    },
    update: (step, _refs, warn, current) => {
      const m = SPIKE_MAP.field;
      const st = step.set ?? {};
      const out: Record<string, unknown> = {};
      if (st.label && m.label) out[m.label] = st.label;
      if (st.hint !== undefined) {
        if (SPIKE_MAP.fieldHint.key) out[SPIKE_MAP.fieldHint.key] = st.hint;
        else gap('field help text (hint)', warn);
      }
      if (st.dynamic_list) {
        // F12: same field, same settings, another of Enact's lists. Only a field that already takes its options from SQL.
        const key = sqlKeyOf(current);
        const preset = SQL_LISTS[st.dynamic_list];
        if (!preset) warn(`dynamic_list: Enact has no "${st.dynamic_list}" list (it has ${Object.keys(SQL_LISTS).join(', ')})`);
        else if (!key) warn(`dynamic_list: "${current.label ?? step.match?.name}" doesn't take its options from SQL, so its list can't be switched (create a dynamic field and replace it instead)`);
        else if (current[key] !== preset.sql) out[key] = preset.sql;
      }
      if (st.add_options?.length && m.options) {
        // Existing values keep their ids; new ones go on the end as { name } (same shape as on create).
        const values = ((current[m.options] as Row[]) ?? []).map((v) => ({ ...v }));
        for (const name of st.add_options) {
          if (values.some((v) => String(v.name).toLowerCase() === name.toLowerCase())) continue; // already an option
          values.push({ name });
        }
        out[m.options] = values;
      }
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
    verifyUpdate: (back, changes) => {
      const m = SPIKE_MAP.field;
      const out: string[] = [];
      if (m.label && changes[m.label] !== undefined && back[m.label] !== changes[m.label]) out.push(`label is ${JSON.stringify(back[m.label])}`);
      const hk = SPIKE_MAP.fieldHint.key;
      if (hk && changes[hk] !== undefined && back[hk] !== changes[hk]) out.push(`hint is ${JSON.stringify(back[hk])}`);
      const sk = sqlKeyOf(changes);
      if (sk && back[sk] !== changes[sk]) out.push(`the SQL list didn't save (rule F12)`);
      if (m.options && changes[m.options]) {
        const have = ((back[m.options] as Row[]) ?? []).map((v) => String(v.name).toLowerCase());
        for (const v of changes[m.options] as Row[]) if (!have.includes(String(v.name).toLowerCase())) out.push(`option "${v.name}" missing after saving`);
      }
      return out;
    },
  },

  sla: {
    resource: 'SLA',
    template: 'template-sla.json',
    build: (step, _refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-sla.json'), 'SLA');
      const m = SPIKE_MAP.sla;
      p.name = step.name;
      if (step.targets) {
        const rows = m.priorities ? (p[m.priorities] as Record<string, unknown>[] | undefined) : undefined;
        for (const [prio, target] of Object.entries(step.targets)) {
          const row = rows?.find((r) => String(r.name).toLowerCase() === prio.toLowerCase());
          const t = String(target).match(/^(\d+(?:\.\d+)?)\s*([hd])$/i);
          if (!row || !t || !m.fixTime || !m.fixUnits) {
            warn(!row
              ? `The SLA this is copied from has no "${prio}" priority (it has ${(rows ?? []).map((r) => r.name).join(', ')}), so the ${target} target for ${prio} can't be set (rule M10)`
              : `SLA target "${prio}: ${target}" isn't a time like "4h" or "5d"`);
            continue;
          }
          row[m.fixTime] = Number(t[1]);
          row[m.fixUnits] = t[2].toUpperCase();
        }
      } else if (step.resolve_days !== undefined) {
        const rows = m.priorities ? (p[m.priorities] as Record<string, unknown>[] | undefined) : undefined;
        if (!rows || !m.fixTime || !m.fixUnits) {
          warn(`SPIKE_MAP gap: don't know how to set the resolve target yet; skipped`);
        } else {
          // Same target for every priority. A real plan could vary it per priority.
          for (const row of rows) {
            row[m.fixTime] = step.resolve_days;
            row[m.fixUnits] = 'D';
          }
        }
      }
      // Round 35 (Concord, zz SLA 5): workday_id is the working hours the SLA clock follows; sent 4, kept 4.
      if (step.working_hours) set(p, SPIKE_MAP.sla.workday, _refs[step.working_hours]?.id, 'SLA working hours', warn);
      return p;
    },
    update: (step, refs, warn) => {
      const out: Row = {};
      if (step.set?.working_hours && SPIKE_MAP.sla.workday) out[SPIKE_MAP.sla.workday] = refs[step.set.working_hours]?.id;
      if (!Object.keys(out).length) warn('update: nothing to set (an SLA update can change its working hours)');
      return out;
    },
    verifyCreate: (back, step, refs) => (step.working_hours && SPIKE_MAP.sla.workday && refs && Number(back[SPIKE_MAP.sla.workday]) !== Number(refs[step.working_hours]?.id) ? [`SLA follows working hours ${back[SPIKE_MAP.sla.workday]}, wanted ${refs[step.working_hours]?.name}`] : []),
  },

  approval_process: {
    resource: 'ApprovalProcess',
    template: 'template-approvalprocess.json',
    // Rule P7 (2026-10-24): a rules stage needs one ApprovalProcessRule per condition, pointing at the process and
    // the stage by id. Evidence: approvalprocessrule-5/6 (criteria type 23 on a dropdown, value_string = option id).
    relatedPreview: (step, refs) =>
      [...(step.approvers ?? []), ...(step.set?.add_stages ?? [])].flatMap((a) => ('rules' in a ? a.rules : [])).map((r) => `rule: if ${refs[r.field]?.row?.label ?? refs[r.field]?.name ?? r.field} is "${r.equals}", ${refs[r.group ?? r.agent ?? '']?.name ?? r.group ?? r.agent} approves`),
    related: async (record, step, refs) => {
      const out: { resource: string; payload: Record<string, unknown>; label: string }[] = [];
      const stages = [...((record.steps as Row[]) ?? [])].sort((a, b) => Number(a.sequence) - Number(b.sequence));
      const wanted = step.action === 'update' ? step.set?.add_stages ?? [] : step.approvers ?? [];
      // Rules already on this process (a re-run, or a stage added earlier): never create them twice (U4).
      const existing = extractList(await runtime().halo.get('/ApprovalProcessRule')).filter((r) => Number(r.approval_process_id) === Number(record.id)).map((r) => String(r.name));
      for (const [i, a] of wanted.entries()) {
        if (!('rules' in a)) continue;
        const stage = stages.find((s) => stageNames(a, refs).includes(String(s.name))) ?? (step.action === 'create' ? stages[i] : undefined);
        if (!stage?.id) throw new Error(`Approval "${step.name ?? step.match?.name}": the rules stage isn't there after saving, so its rules can't be attached`);
        for (const r of a.rules) {
          const field = refs[r.field];
          const info = firstRecord(await runtime().halo.get(`/FieldInfo/${field?.id}`, { includedetails: 'true' })) ?? {};
          const option = ((info.values as Row[]) ?? []).find((v) => String(v.name).trim().toLowerCase() === r.equals.trim().toLowerCase());
          if (!option) throw new Error(`Approval rule: "${info.label ?? field?.name}" has no option "${r.equals}"`);
          const who = refs[r.group ?? r.agent ?? ''];
          const name = `${step.name ?? step.match?.name}: ${info.label ?? field?.name} is ${r.equals}`.slice(0, 100);
          if (existing.includes(name)) continue;
          out.push({
            resource: 'ApprovalProcessRule',
            label: `rule: if ${info.label ?? field?.name} is "${r.equals}", ${who?.name} approves`,
            payload: {
              name,
              precedence: 50,
              type: r.group ? SPIKE_MAP.approval.groupStepType : SPIKE_MAP.approval.agentStepType,
              agent_id_or_cab_id: who?.id,
              approval_process_id: record.id,
              approval_process_step_id: stage.id,
              usage: 0,
              notifyonapprove: true,
              notifyonreject: true,
              criteria: [dropdownCriterion(String(info.name ?? field?.name), option)],
            },
          });
        }
      }
      return out;
    },
    // Rule P8 (2026-10-24): add stages to the END of an existing approval process in place. Its own stages go back as
    // they are (ids kept, as U2); new ones are recognised by name on a re-run (U4).
    update: (step, refs, warn, current) => {
      const add = step.set?.add_stages ?? [];
      if (!add.length) { warn('update: nothing to set'); return {}; }
      const rows = ((current.steps as Row[]) ?? []).map((r) => ({ ...r }));
      if (!rows.length) { warn('Approval process has no stages to copy the shape from; nothing added'); return {}; }
      let seq = Math.max(0, ...rows.map((r) => Number(r.sequence) || 0));
      let changed = false;
      for (const a of add) {
        // Today's name first: if it's there, the stage is done. Only then look for an old name to rename (P9).
        if (rows.some((r) => String(r.name) === stageName(a, refs))) continue;
        const there = rows.find((r) => stageNames(a, refs).includes(String(r.name)));
        if (there) {
          // P9: a stage named the old way ("Rules: CFField is Yes") is renamed in place, nothing else changes.
          if (String(there.name) !== stageName(a, refs)) { there.name = stageName(a, refs); changed = true; }
          continue;
        }
        seq += 10;
        rows.push(stageRow(rows[0], a, refs, seq));
        changed = true;
      }
      return changed ? { steps: rows } : {};
    },
    verifyUpdate: (back, _changes, step, refs) => {
      const names = ((back.steps as Row[]) ?? []).map((r) => String(r.name));
      return (step.set?.add_stages ?? []).filter((a) => !stageNames(a, refs).some((n) => names.includes(n))).map((a) => `approval: stage "${stageName(a, refs)}" not there after saving`);
    },
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-approvalprocess.json'), 'ApprovalProcess');
      const m = SPIKE_MAP.approval;
      p.name = step.name;
      const approvers: Approver[] =
        step.approvers ?? (step.approver === 'requester_manager' ? [{ line_manager: true }] : []);
      if (!approvers.length) return p;

      const steps = m.steps ? (p[m.steps] as Record<string, unknown>[] | undefined) : undefined;
      if (!steps?.length) {
        warn(`Approval template has no steps to copy the shape from; approvers skipped`);
        return p;
      }
      const shape = steps[0];
      p[m.steps as string] = approvers.map((a, i) => stageRow(shape, a, refs, i + 1));
      return p;
    },
  },

  agent: {
    // Reuse only: plans name existing people. Evidence: GET /Agent lists agents by name.
    resource: 'Agent',
    template: '',
    build: () => {
      throw new Error('Creating agents is not supported: they are people with licences. Reuse an existing agent.');
    },
  },

  approval_group: {
    // Halo calls approval groups CABs. Evidence: GET /CAB lists "Human Resource Approval Group" etc.
    resource: 'CAB',
    template: 'template-cab.json',
    build: (step, refs) => {
      // Evidence: cab-4. members[] { agent_id, type 0 }; approvals_needed; template roles dropped.
      const p = fromTemplate(templateFileFor(step, 'template-cab.json'), 'CAB');
      p.name = step.name;
      p.members = (step.members ?? []).map((m) => ({ agent_id: refs[m]?.id, type: 0 }));
      p.roles = [];
      p.approvals_needed = step.approvals_needed ?? 1;
      p.all_must_approve = false;
      return p;
    },
    update: (step, refs, warn, current) => {
      if (!step.set?.add_members?.length) { warn('update: nothing to set'); return {}; }
      const members = ((current.members as Row[]) ?? []).map((m) => ({ ...m }));
      for (const a of step.set.add_members) {
        const id = Number(refs[a]?.id);
        if (members.some((m) => Number(m.agent_id) === id)) continue; // already a member
        members.push({ agent_id: id, type: 0 });
      }
      return { members };
    },
    verifyUpdate: (back, changes) => {
      const ids = ((back.members as Row[]) ?? []).map((m) => Number(m.agent_id));
      return ((changes.members as Row[]) ?? []).filter((m) => !ids.includes(Number(m.agent_id))).map((m) => `approval group: agent ${m.agent_id} not a member after saving`);
    },
  },

  ticket_type: {
    resource: 'TicketType',
    template: 'template-tickettype.json',
    afterCreate: (id, sent) => (sent._restore_tab_display ? { id, tab_display: sent._restore_tab_display } : null),
    update: (step, refs, warn, current) => {
      const m = SPIKE_MAP.ticketType;
      const out: Record<string, unknown> = {};
      const st = step.set ?? {};
      if (st.workflow) out.workflow_id = refs[st.workflow]?.id;
      if (st.approval) out.approval_process_id = refs[st.approval]?.id;
      if (st.team && m.teamName) out[m.teamName] = refs[st.team]?.name; // rule T1: team by NAME
      if (st.sla && m.sla) out[m.sla] = refs[st.sla]?.id;
      if (st.add_groups?.length || st.add_fields?.length || st.field_mandatory?.length || st.copy_standard_fields_from || st.replace_fields?.length || st.field_hints?.length) {
        // Rule U2 (2026-10-23): the form is one list. Send ALL existing rows back (ids kept) plus the new ones.
        const rows = keepRows(current[m.fields as string]);
        if (st.replace_fields?.length) replaceRows(rows, st.replace_fields, refs, warn);
        const shape: Row = { usage: 0, groupid: 0, enduserdetail: 1, techdetail: 1, enduseraction: 1, techaction: 1 };
        editFieldRows(rows, refs, st.add_fields, st.field_mandatory, shape, warn, formLabels(current), rowNames(current));
        // Rule F14: this form's own help text for a shared field (Override Field Hint on the row).
        for (const h of [...(st.add_fields ?? []).filter((f) => f.hint !== undefined), ...(st.field_hints ?? [])]) {
          const hk = SPIKE_MAP.formRow.hintOverride;
          if (!hk) { gap('form help text override', warn); break; }
          const row = rows.find((x) => String(x.fieldid) === String(refs[h.ref]?.id));
          if (!row) { warn(`field_hints: ${refs[h.ref]?.row?.label ?? h.ref} isn't directly on this form`); continue; }
          row[hk] = h.hint;
        }
        let seq = Math.max(0, ...rows.map((r) => Number(r.seq) || 0));
        for (const g of st.add_groups ?? []) {
          const gid = Number(refs[g]?.id);
          if (rows.some((r) => Number(r.groupid) === gid && Number(r.fieldid) === 0)) continue; // already there
          rows.push({ fieldid: 0, groupid: gid, seq: ++seq, usage: 0, endusernew: 1, technew: 1, enduserdetail: 1, techdetail: 1, enduseraction: 1, techaction: 1 });
        }
        if (st.copy_standard_fields_from) {
          // Rule T5: put back Halo's standard fields from the type this one was copied from.
          const src = refs[st.copy_standard_fields_from]?.row;
          if (!src) warn(`copy_standard_fields_from: ${st.copy_standard_fields_from} must be a REUSED ticket type`);
          let n = Math.max(0, ...rows.map((r) => Number(r.seq) || 0));
          for (const r of keepRows(((src?.[m.fields as string] as Row[]) ?? []).filter(isStandardRow))) {
            if (rows.some((x) => Number(x.fieldid) === Number(r.fieldid))) continue;
            const { id: _id, guid: _guid, tickettype_id: _tt, ...rest } = r;
            rows.push({ ...rest, seq: ++n });
          }
        }
        out[m.fields as string] = rows;
      }
      if (st.show_field_when?.length) {
        // Rule V1: the condition sits on the field's own row on this form (shape: SPIKE_MAP.visibility evidence).
        const v = SPIKE_MAP.visibility;
        const rows = (out[m.fields as string] as Row[]) ?? keepRows(current[m.fields as string]);
        const names = rowNames(current);
        const onForm = (ref: string) => rows.find((r) => String(r.fieldid) === String(refs[ref]?.id) || (!!refs[ref]?.name && names.get(Number(r.id)) === String(refs[ref]?.name).toLowerCase()));
        for (const c of st.show_field_when) {
          const row = onForm(c.field);
          if (!row) { warn(`show_field_when: "${refs[c.field]?.row?.label ?? refs[c.field]?.name}" isn't placed directly on this form (add it with add_fields; fields inside sections can't be conditional yet)`); continue; }
          const inSection = ((current[m.fields as string] as Row[]) ?? []).some((r) => (((r.group as Row)?.fields as Row[]) ?? []).some((f) => Number(f.fieldid) === Number(refs[c.when]?.id)));
          if (!onForm(c.when) && !inSection) { warn(`show_field_when: the dropdown "${refs[c.when]?.row?.label ?? refs[c.when]?.name}" isn't on this form, so the condition could never be met`); continue; }
          const option = optionOf(c.when, c.equals, refs, warn);
          if (!option || !v.conditions || v.groupType === null) continue;
          const groups = ((row[v.conditions] as Row[]) ?? []).map((g) => ({ ...g }));
          const same = (g: Row) => ((g.visibility_conditions as Row[]) ?? []).some((x) => Number(x.lookup_field_id) === Number(refs[c.when]?.id) && String(x.lookup_value_id) === String(option.id));
          if (groups.some(same)) continue; // already there (re-run)
          groups.push({
            entity_id: Number(current.id),
            entity_id2: refs[c.field]?.id,
            entity_id3: 0,
            type: v.groupType,
            desc: `Condition Group ${groups.length + 1}`,
            seq: groups.length + 1,
            visibility_conditions: [{ tickettype_id: 0, field_id: 0, lookup_field_id: refs[c.when]?.id, lookup_value_id: option.id, lookup_value: option.name, field_value: -1, category_value_name: '', conditiontype: 0, field_usage: 0 }],
          });
          row[v.conditions] = groups;
        }
        out[m.fields as string] = rows;
      }
      if (st.acknowledgement_email) {
        // Rule EM4: the template's id on the ticket type. EM5 (verified sending agent) is said in the plan, not checked here.
        const key = SPIKE_MAP.ackEmail.key;
        const id = refs[st.acknowledgement_email]?.id;
        if (!key) warn('SPIKE_MAP gap: acknowledgement email key unknown');
        else if (id === undefined || id === null) warn(`acknowledgement_email: "${st.acknowledgement_email}" has no email template id yet`);
        else if (Number(current[key]) !== Number(id)) out[key] = id;
      }
      if (st.retire && SPIKE_MAP.retire.key) out[SPIKE_MAP.retire.key] = false; // rule T8
      if (st.attachments) {
        // Rule T9: attachments are a setting on the form, not a field.
        const a = SPIKE_MAP.attachments;
        if (st.attachments.allow !== undefined && a.allow) out[a.allow] = st.attachments.allow;
        if (st.attachments.min !== undefined && a.min) { out[a.min] = st.attachments.min; if (st.attachments.min > 0 && a.allow) out[a.allow] = true; }
      }
      if (st.read_only?.length) {
        const ro = SPIKE_MAP.readOnly;
        const key = m.fields as string;
        const rows = (out[key] as Row[]) ?? keepRows(current[key]);
        for (const r of st.read_only) {
          // String compare: a field added in this same step has a placeholder id in the dry run (round 32).
          const row = rows.find((x) => String(x.fieldid) === String(refs[r]?.id));
          if (!row) { warn(`read_only: ${refs[r]?.row?.label ?? r} isn't directly on this form (add it in the same step with add_fields)`); continue; }
          for (const k of ro.keys ?? []) row[k] = ro.value;
        }
        out[key] = rows;
      }
      if (st.remove_fields?.length) {
        const key = m.fields as string;
        const rows = (out[key] as Row[]) ?? keepRows(current[key]);
        out[key] = removeRows(rows, st.remove_fields, refs, warn, SPIKE_MAP.visibility.conditions);
      }
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
    verifyUpdate: (back, changes, step, refs) => {
      const m = SPIKE_MAP.ticketType;
      const out: string[] = [];
      for (const [k, v] of Object.entries(changes)) {
        if (k === m.fields) {
          out.push(...checkFieldRows(back[k], v, 'form'));
          out.push(...checkReplaced(back[k], step?.set?.replace_fields, refs, 'form'));
          out.push(...checkRemoved(back[k], step?.set?.remove_fields, refs, 'form'));
          // V1: every condition we sent is on the field's row after saving.
          const vk = SPIKE_MAP.visibility.conditions as string;
          for (const r of v as Row[]) {
            const want = ((r[vk] as Row[]) ?? []).filter((g) => !g.id);
            if (!want.length) continue;
            const got = ((back[k] as Row[]) ?? []).find((b) => Number(b.fieldid) === Number(r.fieldid) && Number(r.fieldid) > 0);
            const have = ((got?.[vk] as Row[]) ?? []).flatMap((g) => (g.visibility_conditions as Row[]) ?? []);
            for (const g of want) for (const c of (g.visibility_conditions as Row[]) ?? [])
              if (!have.some((h) => Number(h.lookup_field_id) === Number(c.lookup_field_id) && String(h.lookup_value_id) === String(c.lookup_value_id)))
                out.push(`form: field ${r.fieldid} has no condition "${c.lookup_value}" after saving`);
          }
        }
        else if (JSON.stringify(back[k]) !== JSON.stringify(v)) out.push(`${k} is ${JSON.stringify(back[k])}, wanted ${JSON.stringify(v)}`);
      }
      return out;
    },
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-tickettype.json'), 'TicketType');
      const m = SPIKE_MAP.ticketType;
      p.name = step.name;
      set(p, m.summary, step.name, 'default summary', warn);
      // Rule T4 (2026-10-19): a copied type keeps the source's "override with this template when logging
      // manually". New Joiner (copy of New Starter Request) got template 1, which switched every new ticket
      // back to New Starter Request. A new type must never inherit it.
      p.overridewiththefollowingtemplatewhenloggingmanually = -1;
      // Rule T7 (2026-10-23): Halo rejects creating a ticket type with a tabbed form (tab_display 1) with a bare 500.
      // Found by bisect on a copy of Change Request. Create untabbed, then switch tabs back on (afterCreate).
      if (Number(p.tab_display) > 0) {
        p._restore_tab_display = p.tab_display;
        p.tab_display = 0;
      }
      if (step.team) set(p, m.teamName, refs[step.team]?.name, 'default team', warn);
      if (step.sla) set(p, m.sla, refs[step.sla]?.id, 'default SLA', warn);
      if (step.approval) {
        set(p, m.approvalProcess, refs[step.approval]?.id, 'approval process', warn);
        // Display name copied from the template would otherwise still name the template's process.
        if ('approval_process_name' in p) p.approval_process_name = refs[step.approval]?.name ?? '';
      }

      if (!m.fields || !m.fieldId) {
        warn(`SPIKE_MAP gap: don't know how fields attach to a ticket type yet; skipped`);
      } else {
        // Replace the template's own questions, but keep Halo's standard fields (rule T5).
        // Rule T6: a plan that names no fields and no sections means "same form as the source": keep it whole.
        if (!step.fields?.length && !step.groups?.length) {
          p[m.fields] = keepRows(p[m.fields]);
          return p;
        }
        const standard = keepRows(((p[m.fields] as Row[]) ?? []).filter(isStandardRow));
        p[m.fields] = (step.fields ?? []).map((f, i) => {
          const level = f.mandatory ? m.mandatoryValue : m.optionalValue;
          const row: Record<string, unknown> = {
            [m.fieldId as string]: refs[f.ref]?.id,
            seq: i + 1,
            usage: 0,
            groupid: 0,
            enduserdetail: 1,
            techdetail: 1,
            enduseraction: 1,
            techaction: 1,
          };
          for (const key of m.mandatoryKeys ?? []) row[key] = level;
          if (f.hint !== undefined) { if (SPIKE_MAP.formRow.hintOverride) row[SPIKE_MAP.formRow.hintOverride] = f.hint; else gap('form help text override', warn); }
          return row;
        });
        // Field groups attach as rows with groupid and fieldid 0 (evidence: tickettype-36 rows 10420/10424).
        const offset = (step.fields ?? []).length;
        for (const [i, g] of (step.groups ?? []).entries()) {
          (p[m.fields] as Record<string, unknown>[]).push({
            fieldid: 0, groupid: refs[g]?.id, seq: offset + i + 1, usage: 0,
            endusernew: 1, technew: 1, enduserdetail: 1, techdetail: 1, enduseraction: 1, techaction: 1,
          });
        }
        const rows = p[m.fields] as Row[];
        for (const r of standard) if (!rows.some((x) => Number(x.fieldid) === Number(r.fieldid))) rows.push({ ...r, seq: rows.length + 1 });
      }
      return p;
    },
  },

  // ---------- Round 30: minimal-payload objects (never from a copy, rule S1b) ----------

  service_category: {
    // Round 36: category 26 { name, parent_id } kept exactly. Matched by name under the same parent.
    resource: 'ServiceCategory',
    template: '',
    findExisting: async (step, refs) => {
      const parent = step.parent ? Number(refs[step.parent]?.id) : 0;
      const rows = extractList(await runtime().halo.get('/ServiceCategory'));
      return rows.find((r) => String(r.name ?? '').trim().toLowerCase() === String(step.name ?? '').trim().toLowerCase() && (!(parent > 0) || Number(r.parent_id ?? 0) === parent));
    },
    build: (step, refs, warn) => {
      const p: Row = { name: step.name };
      set(p, SPIKE_MAP.serviceCategory.parent, step.parent ? refs[step.parent]?.id : 0, 'service category parent', warn);
      return p;
    },
    // Round 38: category 26 kept a rename. Moving to another parent isn't proven (round 39), so only the name changes.
    // Round 38: rename kept; round 39: parent_id 0 and back to 8 kept (moving). SC2 still applies: 3 levels at most.
    update: (step, refs, warn) => {
      const st = step.set ?? {};
      const out: Row = {};
      if (st.name) out.name = st.name;
      const k = SPIKE_MAP.serviceCategory.parent;
      if (k && st.top_level) out[k] = 0;
      else if (k && st.parent) out[k] = refs[st.parent]?.id;
      if (!Object.keys(out).length) warn('service category update: nothing to set');
      return out;
    },
    verifyCreate: (back, step, refs) => {
      const k = SPIKE_MAP.serviceCategory.parent;
      const want = step.parent ? refs?.[step.parent]?.id : 0;
      return k && String(back[k] ?? 0) !== String(want) ? [`sits under ${back[k]}, wanted ${want}`] : [];
    },
  },

  service: {
    // Round 29: service 169 from these keys alone, every one kept (SPIKE_MAP.service).
    resource: 'Service',
    template: '',
    build: (step, refs, warn) => {
      const m = SPIKE_MAP.service;
      const p: Row = { name: step.name, showintechcatalog: true, servicerequestlbl: 'Request this Service' };
      set(p, m.summary, step.summary ?? '', 'service summary', warn);
      if (step.service_category) set(p, m.category, refs[step.service_category]?.id, 'service category', warn);
      else warn('service: no service_category');
      if (step.ticket_type) set(p, m.ticketType, refs[step.ticket_type]?.id, 'service ticket type', warn);
      else warn('service: no ticket_type, so the portal would have nothing to log');
      set(p, m.portal, step.show_on_portal !== false, 'show on the portal', warn);
      // Rule SV1: a service is requestable on the portal only with a Service Request Details row. Added after create
      // (round 36 proved it on an existing service).
      if (step.ticket_type && m.requestDetails) p._enact_after = { [m.requestDetails]: [requestRow(refs[step.ticket_type]?.id)] };
      return p;
    },
    afterCreate: (id, sent) => (sent._enact_after ? { id, ...(sent._enact_after as Row) } : null),
    saveAlone: ['service_request_details'],
    // Halo adds its own keys and ids to each Service Request Details row: check the ticket types are there, not the JSON.
    verifyUpdate: (back, changes) => {
      const out: string[] = [];
      for (const [k, v] of Object.entries(changes)) {
        if (k === SPIKE_MAP.service.requestDetails) {
          const got = new Set(((back[k] as Row[]) ?? []).map((r) => String(r.servicedetail_requesttypeid)));
          for (const r of (v as Row[]) ?? []) if (!got.has(String(r.servicedetail_requesttypeid))) out.push(`Service Request Details has no row for ticket type ${r.servicedetail_requesttypeid}`);
        } else if (JSON.stringify(back[k]) !== JSON.stringify(v)) out.push(`${k} is ${JSON.stringify(back[k])}, wanted ${JSON.stringify(v)}`);
      }
      return out;
    },
    update: (step, refs, warn, current) => {
      const m = SPIKE_MAP.service;
      const st = step.set ?? {};
      const out: Row = {};
      // Rule SV1: make sure the service's ticket type can be requested (Config > Service Request Details).
      const tt = st.ticket_type ? refs[st.ticket_type]?.id : m.ticketType ? current?.[m.ticketType] : undefined;
      if (m.requestDetails && tt !== undefined && tt !== null && Number(tt) !== 0) {
        const have = ((current?.[m.requestDetails] as Row[]) ?? []);
        if (!have.some((r) => String(r.servicedetail_requesttypeid) === String(tt))) out[m.requestDetails] = [...have, requestRow(tt)];
      }
      if (st.name) out.name = st.name; // round 38: zz service 170 kept a rename
      if (st.summary !== undefined && m.summary) out[m.summary] = st.summary;
      if (st.ticket_type && m.ticketType) out[m.ticketType] = refs[st.ticket_type]?.id;
      if (st.service_category && m.category) out[m.category] = refs[st.service_category]?.id;
      if (st.show_on_portal !== undefined && m.portal) out[m.portal] = st.show_on_portal;
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
    verifyCreate: (back, step) => {
      const m = SPIKE_MAP.service;
      return m.summary && step.summary !== undefined && String(back[m.summary] ?? '') !== step.summary ? [`summary is "${back[m.summary]}", wanted "${step.summary}"`] : [];
    },
  },

  organisation: {
    // Reuse is proven everywhere; create stays behind SPIKE_MAP.organisation until a minimal create is proven.
    resource: 'Client',
    template: '',
    build: (step) => ({ name: step.name }),
  },

  site: {
    // Round 29: site 21 { name, client_id } kept exactly.
    resource: 'Site',
    template: '',
    findExisting: async (step, refs) => {
      const org = Number(refs[step.organisation ?? '']?.id);
      const rows = extractList(await runtime().halo.get('/Site', { search: String(step.name ?? '') }));
      return rows.find((r) => String(r.name ?? '').trim().toLowerCase() === String(step.name ?? '').trim().toLowerCase() && (!(org > 0) || Number(r.client_id) === org));
    },
    build: (step, refs, warn) => {
      const p: Row = { name: step.name };
      if (!step.organisation) warn('site: no organisation');
      set(p, SPIKE_MAP.people.siteOrganisation, refs[step.organisation ?? '']?.id, 'site organisation', warn);
      return p;
    },
  },

  user: {
    // Round 29: user 58 { name, firstname, surname, emailaddress, site_id } kept exactly. Matched on email.
    resource: 'Users',
    template: '',
    findExisting: async (step) => {
      const email = String(step.email ?? '').trim().toLowerCase();
      if (!email) return undefined;
      const rows = extractList(await runtime().halo.get('/Users', { search: email }));
      return rows.find((r) => String(r.emailaddress ?? r.email ?? '').trim().toLowerCase() === email);
    },
    build: (step, refs, warn) => {
      const m = SPIKE_MAP.people;
      if (!step.email) warn('user: no email (Enact never invents one)');
      const p: Row = { name: step.name ?? `${step.firstname ?? ''} ${step.surname ?? ''}`.trim(), firstname: step.firstname ?? '', surname: step.surname ?? '' };
      set(p, m.userEmail, step.email, 'user email', warn);
      if (!step.site) warn('user: no site');
      set(p, m.userSite, refs[step.site ?? '']?.id, 'user site', warn);
      return p;
    },
    verifyCreate: (back, step) => (String(back.emailaddress ?? '').toLowerCase() !== String(step.email ?? '').toLowerCase() ? [`email is "${back.emailaddress}", wanted "${step.email}"`] : []),
  },

  working_hours: {
    // Round 28: a copy of Default Working Hours kept all 31 settings (workday 3). Holidays are separate (HL1).
    resource: 'Workday',
    template: 'template-workday.json',
    build: (step, _refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-workday.json'), 'Workday');
      p.name = step.name;
      p.holidays = [];
      const t = (hhmm?: string) => (hhmm && /^\d{1,2}:\d{2}$/.test(hhmm) ? `1901-01-01T${hhmm.padStart(5, '0')}:00` : null);
      if (step.start || step.end) {
        const start = t(step.start);
        const end = t(step.end);
        if (!start || !end) warn('working_hours: start and end must be "HH:MM"');
        else {
          p.start = start; p.end = end; p.alldayssame = true;
          for (const d of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) { p[`start${d}`] = start; p[`end${d}`] = end; }
        }
      }
      if (step.days?.length) {
        const on = new Set(step.days.map((d) => d.slice(0, 3).toLowerCase()));
        for (const d of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) p[`inc${d}`] = on.has(d.slice(0, 3));
      }
      return p;
    },
  },

  holiday: {
    // Rule HL1 (round 29): POST /Holiday with workday_id; its id is a guid, the number is holid.
    resource: 'Holiday',
    template: '',
    findExisting: async (step, refs) => {
      const wd = Number(refs[step.working_hours ?? '']?.id);
      if (!(wd > 0)) return undefined;
      const rows = extractList(await runtime().halo.get('/Holiday'));
      return rows.find((r) => Number(r.workday_id) === wd && String(r.date ?? '').startsWith(String(step.date ?? '')));
    },
    readBack: async (created) => extractList(await runtime().halo.get('/Holiday')).find((r) => String(r.id) === String(created.id) || (created.holid !== undefined && Number(r.holid) === Number(created.holid))) ?? null,
    build: (step, refs, warn) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(step.date ?? ''))) warn('holiday: date must be YYYY-MM-DD');
      if (!step.working_hours) warn('holiday: no working_hours');
      const day = `${step.date}T00:00:00`;
      const p: Row = { name: step.name, date: day, end_date: day, allday: true, holiday_type: 1, isrecurring: false };
      set(p, SPIKE_MAP.workingHours.holidayWorkday, refs[step.working_hours ?? '']?.id, 'holiday working hours', warn);
      return p;
    },
    verifyCreate: (back, step) => (String(back.date ?? '').startsWith(String(step.date)) ? [] : [`date is ${back.date}, wanted ${step.date}`]),
  },

  canned_text: {
    // Round 28: copy 30 and its text update were kept; create from name + text is proven by round 30.
    resource: 'CannedText',
    template: '',
    build: (step) => {
      const text = String(step.text ?? '');
      const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return { name: step.name, text, html: text.split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join('') };
    },
    verifyCreate: (back, step) => (String(back.text ?? '').replace(/\r\n/g, '\n').trim() === String(step.text ?? '').trim() ? [] : ['text not kept as sent']),
  },

  faq_list: {
    resource: 'FAQLists',
    template: '',
    reuseOnly: true,
    build: (_step, _refs, warn) => { warn('FAQ lists can only be reused for now'); return {}; },
  },

  kb_article: {
    // Round 30: article 47 { name, description, faqlists: [{ id }] } kept exactly (SPIKE_MAP.kb).
    resource: 'KBArticle',
    template: '',
    build: (step, refs, warn) => {
      const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = String(step.body ?? '').split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('');
      if (!String(step.body ?? '').trim()) warn('kb_article: no body');
      const p: Row = { name: step.name, description: html };
      if (!step.faq_list) warn('kb_article: no faq_list (Halo refuses an article without one)');
      set(p, SPIKE_MAP.kb.faqLists, [{ id: refs[step.faq_list ?? '']?.id }], 'article FAQ list', warn);
      return p;
    },
    verifyCreate: (back, step) => {
      const lists = ((back.faqlists as Row[]) ?? []).map((f) => Number(f.id));
      return step.faq_list && !lists.length ? ['the article has no FAQ list after saving'] : [];
    },
  },

  role: {
    // Round 31: POST /Roles { name } answers without an id (guid ids; id_int is the number), so it's found by name.
    resource: 'Roles',
    template: '',
    findExisting: async (step) => extractList(await runtime().halo.get('/Roles')).find((r) => String(r.name ?? '').trim().toLowerCase() === String(step.name ?? '').trim().toLowerCase()),
    build: (step, refs, warn) => {
      const src = refs[step.based_on_role ?? '']?.row;
      const claims = (src?.[SPIKE_MAP.role.claims as string] as Row[] | undefined) ?? null;
      if (!step.based_on_role) warn('role: no based_on_role');
      else if (!claims?.length) warn(`role: ${step.based_on_role} has no permissions to copy`);
      return { name: step.name, _enact_claims: claims };
    },
    afterCreate: (id, sent) => (sent._enact_claims ? { id, [SPIKE_MAP.role.claims as string]: sent._enact_claims } : null),
    verifyCreate: (back, step) => {
      const want = (step as PlanStep & { _claims?: number })._claims;
      const got = ((back[SPIKE_MAP.role.claims as string] as Row[]) ?? []).length;
      return want !== undefined && got !== want ? [`role has ${got} permissions, wanted ${want}`] : got ? [] : ['role has no permissions after saving'];
    },
  },

  asset_group: {
    resource: 'AssetGroup',
    template: '',
    reuseOnly: true,
    build: (_s, _r, warn) => { warn('asset groups can only be reused for now'); return {}; },
  },

  asset_type: {
    // Round 31: type 160 from { name, assetgroup_id } kept. Round 32: fields rows sent in an update were kept, so the
    // fields go in a follow-up save straight after the create (the shape that was proven).
    resource: 'AssetType',
    template: '',
    prepare: async (step) => {
      if (!step.asset_fields?.length) return;
      const rows = extractList(await runtime().halo.get('/AssetTypeInfo'));
      const byName = new Map<string, Row>();
      for (const r of rows) if (!byName.has(String(r.field_name ?? '').trim().toLowerCase())) byName.set(String(r.field_name ?? '').trim().toLowerCase(), r);
      (step as PlanStep & { _asset_rows?: Row[] })._asset_rows = step.asset_fields.map((n, i) => {
        const r = byName.get(n.trim().toLowerCase());
        return r ? { field_id: r.field_id, field_name: r.field_name, sequence: i + 1, type: r.type, tab_id: -1, techdetail: 1, userdetail: 1 } : { _missing: n };
      });
    },
    build: (step, refs, warn) => {
      const p: Row = { name: step.name };
      if (!step.asset_group) warn('asset_type: no asset_group');
      set(p, SPIKE_MAP.assetType.group, refs[step.asset_group ?? '']?.id, 'asset group', warn);
      const rows = (step as PlanStep & { _asset_rows?: Row[] })._asset_rows ?? [];
      for (const r of rows) if (r._missing) warn(`asset_type: no asset field named "${r._missing}" on this instance`);
      if (rows.length) p._enact_fields = rows.filter((r) => !r._missing);
      return p;
    },
    afterCreate: (id, sent) => ((sent._enact_fields as Row[] | undefined)?.length && SPIKE_MAP.assetFields.rows ? { id, [SPIKE_MAP.assetFields.rows]: sent._enact_fields } : null),
    verifyCreate: (back, step) => {
      const want = (step.asset_fields ?? []).map((n) => n.trim().toLowerCase());
      const got = ((back.fields as Row[]) ?? []).map((f) => String(f.field_name ?? '').trim().toLowerCase());
      const missing = want.filter((n) => !got.includes(n));
      return missing.length ? [`asset type is missing fields after saving: ${missing.join(', ')}`] : [];
    },
  },

  lookup_value: {
    // Rule LK1 (round 29): POST /Lookup { lookupid, name, sequence }. Behind SPIKE_MAP.lookupList until lists have names.
    resource: 'Lookup',
    template: '',
    findExisting: async (step) => extractList(await runtime().halo.get('/Lookup', { lookupid: String(step.list ?? 0) })).find((r) => Number(r.lookupid) === Number(step.list) && String(r.name ?? '').trim().toLowerCase() === String(step.name ?? '').trim().toLowerCase()),
    readBack: async (created, step) => extractList(await runtime().halo.get('/Lookup', { lookupid: String(step.list ?? 0) })).find((r) => Number(r.lookupid) === Number(step.list) && String(r.id) === String(created.id)) ?? null,
    build: (step, _refs, warn) => {
      if (!(Number(step.list) !== 0 && Number.isFinite(Number(step.list)))) warn('lookup_value: no list');
      return { lookupid: Number(step.list), name: step.name, sequence: 99 };
    },
  },

  field_group: {
    // Evidence: fieldgroup-14. name + header; fields[] rows like a ticket type's, with mandatory 3/1.
    resource: 'FieldGroup',
    template: 'template-fieldgroup.json',
    build: (step, refs) => {
      const p = fromTemplate(templateFileFor(step, 'template-fieldgroup.json'), 'FieldGroup');
      const m = SPIKE_MAP.ticketType;
      p.name = step.name;
      p.header = step.label ?? step.name;
      p.fields = (step.fields ?? []).map((f, i) => {
        const row: Record<string, unknown> = {
          fieldid: refs[f.ref]?.id, seq: i + 1, usage: 1, tableid: 1,
          enduserdetail: 1, techdetail: 2, enduseraction: 1, techaction: 1,
        };
        for (const key of m.mandatoryKeys ?? []) row[key] = f.mandatory ? m.mandatoryValue : m.optionalValue;
        return row;
      });
      return p;
    },
    update: (step, refs, warn, current) => {
      const st = step.set ?? {};
      if (!st.add_fields?.length && !st.field_mandatory?.length && !st.replace_fields?.length) { warn('update: nothing to set'); return {}; }
      const rows = keepRows(current.fields);
      if (st.replace_fields?.length) replaceRows(rows, st.replace_fields, refs, warn);
      editFieldRows(rows, refs, st.add_fields, st.field_mandatory, { usage: 1, tableid: 1, enduserdetail: 1, techdetail: 2, enduseraction: 1, techaction: 1 }, warn, formLabels(current), rowNames(current));
      return { fields: rows };
    },
    verifyUpdate: (back, changes, step, refs) => [...checkFieldRows(back.fields, changes.fields, 'field group'), ...checkReplaced(back.fields, step?.set?.replace_fields, refs, 'field group')],
  },

  status: {
    // Evidence: status-28 (On Hold). name + shortname; slaaction 'hold' pauses the SLA.
    resource: 'Status',
    template: 'template-status.json',
    build: (step) => {
      const p = fromTemplate(templateFileFor(step, 'template-status.json'), 'Status');
      p.name = step.name;
      p.shortname = step.name;
      if (step.sla_action !== undefined) p.slaaction = step.sla_action;
      if (step.colour) p.colour = step.colour;
      return p;
    },
    update: (step, _refs, warn) => {
      if (step.set?.sla_action === undefined) { warn('update: nothing to set'); return {}; }
      return { slaaction: step.set.sla_action };
    },
  },

  outcome: {
    // "Outcome" = an action button. Evidence: outcome-11 (Re-Assign). Name lives in `outcome` and `buttonname`.
    resource: 'Outcome',
    template: 'template-outcome.json',
    nameKey: 'outcome',
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-outcome.json'), 'Outcome');
      p.outcome = step.name;
      p.buttonname = step.name;
      // Template is a system action: don't inherit its behaviour or its keyboard shortcut.
      // INFERRED: systemid 0 = plain custom action (verify in NOTES.md).
      p.systemid = 0;
      p.hotkey = '';
      p.newstatus = step.new_status ? refs[step.new_status]?.id : 0;
      if (step.colour) p.colour = step.colour;
      // Rule O3 (2026-10-19): the icon comes from the template action. On gethandoveruk that was
      // "Triage Not Required", so every new forward action showed an X. Use the plan's icon, or a neutral one.
      // Evidence for the property: outcome-11 has icon "users" (a Font Awesome name).
      p.icon = step.icon ?? 'arrow-right';
      // Rule O4 (2026-10-25): the template action's default assignment came along too: sample 106, copied from
      // "Escalated", defaulted to team 2nd Line Support and agent 1. A new action assigns nothing unless the plan says.
      Object.assign(p, { defaultteam: '', defaultagent: 0, defaultagent_name: '', defaultpriority: 0 });
      if (step.send_email) setActionEmail(p, step.send_email, refs, warn);
      return p;
    },
    update: (step, refs, warn) => {
      const out: Row = {};
      if (step.set?.send_email) setActionEmail(out, step.set.send_email, refs, warn);
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
  },

  workflow: {
    // Evidence: workflow-9. Internal links use LOCAL numbers (step_id, start_step/end_step, stage sequence),
    // so a cleaned copy keeps them. Global ids (id, fdid, guid) and flow_id are stripped by clean.ts.
    resource: 'Workflow',
    template: 'template-workflow.json',
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, workflowTemplateFile()), 'Workflow');
      p.name = step.name;
      const inserts = [...(step.insert_steps ?? []), ...(step.insert_step ? [step.insert_step] : [])];
      return inserts.length ? applyInserts(p, inserts, refs) : p;
    },
    // Rule W3 (2026-10-23): add stages to an EXISTING workflow in place. Send its own steps and stages
    // back with the new ones added; its ids stay, so tickets already on it keep their place.
    update: (step, refs, warn, current) => {
      const st = step.set ?? {};
      if (!st.insert_steps?.length && !st.add_actions?.length && !st.retarget_actions?.length) { warn('update: nothing to set'); return {}; }
      let p: Row = { steps: structuredClone(current.steps ?? []), stages: structuredClone(current.stages ?? []) };
      let changed = false;
      // A re-run finds its stages already there: skip those (rule U4), add the rest.
      const have = new Set(((current.steps as Row[]) ?? []).map((x) => String(x.name).toLowerCase()));
      const todo = (st.insert_steps ?? []).filter((i) => !have.has(i.name.toLowerCase()));
      if (todo.length) { p = applyInserts(p, todo, refs); changed = true; }
      if (st.add_actions?.length || st.retarget_actions?.length) changed = applyButtons(p, st.add_actions ?? [], st.retarget_actions ?? [], refs) || changed;
      return changed ? { steps: p.steps, stages: p.stages } : {};
    },
    verifyUpdate: (back, _changes, step, refs) => {
      const steps = (back.steps as Row[]) ?? [];
      const names = steps.map((s) => String(s.name).toLowerCase());
      const out = (step.set?.insert_steps ?? []).filter((i) => !names.includes(i.name.toLowerCase())).map((i) => `workflow: stage "${i.name}" not there after saving`);
      for (const c of [...(step.set?.add_actions ?? []), ...(step.set?.retarget_actions ?? [])]) {
        const from = steps.find((s) => String(s.name).toLowerCase() === c.step.toLowerCase());
        const to = steps.find((s) => String(s.name).toLowerCase() === c.to_step.toLowerCase());
        const ok = ((from?.actions as Row[]) ?? []).some((a) => Number(a.action_id) === Number(refs[c.via]?.id) && Number(a.end_step) === Number(to?.step_id));
        if (!ok) out.push(`workflow: "${refs[c.via]?.name}" on "${c.step}" doesn't lead to "${c.to_step}" after saving`);
      }
      return out;
    },
  },

  email_template: {
    // Feature "emails". Evidence: probe 24 Oct (header_text = subject, body_html = body). Shape from one of the
    // instance's own templates (discovery).
    resource: 'EmailTemplate',
    template: 'template-emailtemplate.json',
    build: (step, _refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-emailtemplate.json'), 'EmailTemplate');
      const m = SPIKE_MAP.emailTemplate;
      set(p, m.name, step.name, 'email template name', warn);
      set(p, m.subject, step.subject ?? step.name, 'email subject', warn);
      set(p, m.body, step.brand ? brandedEmail(step.body ?? '', step.brand) : toHtml(step.body ?? ''), 'email body', warn);
      // The copied template's designer content and plain-text copy would otherwise still be the source's (Halo
      // re-derives body_text from body_html: sample -100).
      p.design = { design: '', html: p[m.body as string] };
      delete p.body_text;
      return p;
    },
    update: (step, _refs, warn) => {
      const m = SPIKE_MAP.emailTemplate;
      const out: Row = {};
      if (step.set?.subject) set(out, m.subject, step.set.subject, 'email subject', warn);
      if (step.set?.body) set(out, m.body, step.brand ? brandedEmail(step.set.body, step.brand) : toHtml(step.set.body), 'email body', warn);
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
  },

  ticket_rule: {
    // Feature "ticket_rules". Evidence: SPIKE_MAP.ticketRule. Shape from one of the instance's own ticket rules (use 0),
    // with everything that rule did wiped first: a copy of "Downtime Started" would otherwise flag tickets as downtime.
    resource: 'TicketRules',
    template: 'template-ticketrule.json',
    verifyCreate: (back) => (((back.criteria as Row[]) ?? []).length ? [] : ['ticket rule saved with no conditions: it would match every ticket']),
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-ticketrule.json'), 'TicketRules');
      const m = SPIKE_MAP.ticketRule;
      p.name = step.name;
      p.use = 0; // a ticket rule, not an impact/urgency priority rule
      p.active = true;
      p.stopmatching = false;
      // Wipe the source rule's own effects: every new_* back to "not set", no field setters, scripts, pop-ups or events.
      for (const k of Object.keys(p)) {
        if (!k.startsWith('new_')) continue;
        p[k] = typeof p[k] === 'string' ? '' : k.endsWith('_status_id') ? 0 : -1;
      }
      Object.assign(p, { outcomes: [], outcome_id: 0, outcome_name: '', script_id: 0, script_name: '', popupmsg: '', events: [], olas: [], database_lookups: [], criteria_groups: [] });
      const criteria: Row[] = [];
      for (const c of step.when ?? []) {
        if ('ticket_type' in c) {
          if (!m.ticketTypeCriterion) { gap('a ticket rule condition on the ticket type', warn); continue; }
          criteria.push({ tablename: 'faults', fieldname: m.ticketTypeCriterion, value_type: 'int', value_int: refs[c.ticket_type]?.id, value_string: '', partialmatch: false, matchseparatedvalues: false, type: 0 });
        } else if ('impact' in c || 'urgency' in c) {
          // TR3: impact / urgency are Halo's own fields with levels 1-3.
          const pm = SPIKE_MAP.priorityMatrix;
          const which = 'impact' in c ? 'impact' : 'urgency';
          const word = String((c as Record<string, string>)[which]);
          const level = pm.levels?.[word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()];
          if (!level) { warn(`ticket rule: ${which} "${word}" isn't High, Medium or Low`); continue; }
          criteria.push({ tablename: 'faults', fieldname: which, value_type: 'int', value_int: level, value_string: '', partialmatch: false, matchseparatedvalues: false, type: 0 });
        } else {
          if (!m.fieldCriteriaConfirmed) { gap('a ticket rule condition on a field', warn); continue; }
          const option = optionOf(c.field, c.equals, refs, warn);
          if (option) criteria.push(dropdownCriterion(String(refs[c.field]?.name ?? ''), option));
        }
      }
      if (!criteria.length) warn('ticket rule: no conditions, so it would match every ticket');
      // TR3: a rule on impact / urgency alone is a priority matrix rule (use 1 impact only, use 2 with urgency).
      const conds = step.when ?? [];
      if (conds.length && conds.every((c) => 'impact' in c || 'urgency' in c)) {
        const pm = SPIKE_MAP.priorityMatrix;
        p.use = conds.some((c) => 'urgency' in c) ? pm.impactUrgencyUse : pm.impactOnlyUse;
        if (!conds.some((c) => 'impact' in c)) warn('priority matrix rule: needs an impact (Halo\'s matrix rules always have one)');
      }
      set(p, m.criteria, criteria, 'ticket rule conditions', warn);
      const t = step.then ?? {};
      if (t.team) {
        set(p, m.setTeam, refs[t.team]?.id, 'the team a rule sets', warn);
        set(p, m.setTeamName, refs[t.team]?.name, 'the team a rule sets (name)', warn);
      }
      if (t.agent) set(p, m.setAgent, refs[t.agent]?.id, 'the agent a rule sets', warn);
      if (t.category) {
        const cm = SPIKE_MAP.ruleCategory;
        set(p, cm.setId, refs[t.category]?.id, 'the category a rule sets', warn);
        set(p, cm.setName, refs[t.category]?.name, 'the category a rule sets (name)', warn);
      }
      if (t.priority !== undefined) {
        const pm = SPIKE_MAP.rulePriority;
        const level = Number(t.priority);
        if (!pm.setPriority || !pm.priorityNumberKey) gap('the priority a rule sets (its number)', warn);
        else if (!Number.isInteger(level) || level < 1) warn(`ticket rule: priority "${t.priority}" isn't a priority level number`);
        else p[pm.setPriority] = level;
      }
      if (!t.team && !t.agent && t.priority === undefined && !t.category) warn('ticket rule: sets nothing');
      return p;
    },
    // TR3: change what an existing rule sets (a matrix cell's priority). Only the changed key is sent (U2).
    update: (step, _refs, warn) => {
      const out: Row = {};
      const level = Number(step.set?.priority);
      if (step.set?.priority !== undefined) {
        if (!Number.isInteger(level) || level < 1) warn(`ticket rule: priority "${step.set.priority}" isn't a priority level number`);
        else if (SPIKE_MAP.rulePriority.setPriority) out[SPIKE_MAP.rulePriority.setPriority] = level;
      }
      if (!Object.keys(out).length) warn('update: nothing to set');
      return out;
    },
  },

  category: {
    // Rule K1 (SPIKE_MAP.category). value is the path; Halo fills the levels. Re-runs find it by path.
    resource: 'Category',
    template: 'template-category.json',
    nameKey: 'value',
    // The path as Halo stores it: levels trimmed, joined by ">" (so "A > B" finds "A>B" on a re-run).
    storedName: (step) => String(step.name ?? '').split(SPIKE_MAP.category.separator ?? '>').map((x) => x.trim()).filter(Boolean).join(SPIKE_MAP.category.separator ?? '>'),
    build: (step, _refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-category.json'), 'Category');
      const m = SPIKE_MAP.category;
      const path = String(step.name ?? '').split(m.separator ?? '>').map((x) => x.trim()).filter(Boolean).join(m.separator ?? '>');
      if (!path) warn('category: no path');
      set(p, m.nameKey, path, 'category path', warn);
      // Halo derives these from value (sample 261): never send the source's.
      for (const k of ['category_name', 'level1', 'level2', 'level3', 'level4']) delete p[k];
      Object.assign(p, { sla_id: -1, priority_id: -1, translations: [] });
      return p;
    },
  },

  notification: {
    // Rule N1 (SPIKE_MAP.notification). Shape from one of the instance's own notifications; its subscribers dropped.
    resource: 'Notification',
    template: 'template-notification.json',
    // N4: conditions and the team only stick on a save AFTER creation.
    afterCreate: (id, sent) => (sent._enact_after ? { id, ...(sent._enact_after as Row) } : null),
    // N2: only the agents asked for, and no one subscribed through a role.
    verifyCreate: (back) => {
      const out: string[] = [];
      if (!((back.agents as Row[]) ?? []).length) out.push('notification saved with nobody subscribed: nobody would be told (N5)');
      if (!((back.conditions as Row[]) ?? []).length) out.push('notification saved without conditions (N3)');
      if (((back.roles as Row[]) ?? []).length || ((back.user_roles as Row[]) ?? []).length) out.push(`notification is also sent to whole roles (${((back.roles as Row[]) ?? []).map((r) => r.role_name).join(', ')})`);
      const extra = ((back.agents as Row[]) ?? []).filter((a) => String(a.role_name ?? '') !== '');
      if (extra.length) out.push(`notification reaches agents through roles: ${[...new Set(extra.map((a) => a.agent_name))].join(', ')}`);
      return out;
    },
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-notification.json'), 'Notification');
      const m = SPIKE_MAP.notification;
      p.name = step.name;
      const event = m.events?.[step.event ?? ''];
      if (!event) warn(`notification: event "${step.event}" isn't one Enact knows (${Object.keys(m.events ?? {}).join(', ')})`);
      else p.eventno = event;
      p.delivery_method = step.by === 'email' ? 1 : 0;
      // N5: tell the team's members (subscribed directly) plus any agents named; the team itself is only a filter.
      const teamRow = refs[step.team ?? '']?.row;
      const members = ((teamRow?.agents as Row[]) ?? []).map((a) => Number(a.agent_id)).filter((n) => n > 0);
      const named = (step.agents ?? []).map((a) => refs[a]?.id);
      if (step.team && !teamRow) warn(`notification: the members of "${refs[step.team]?.name}" aren't known (a team created in this plan); name the agents too`);
      if (step.team && teamRow && !members.length) warn(`notification: "${refs[step.team]?.name}" has no members to tell`);
      const ids: unknown[] = [];
      for (const id of [...members, ...named]) if (id !== undefined && !ids.some((x) => String(x) === String(id))) ids.push(id);
      p.agents = ids.map((id) => ({ agent_id: id }));
      const after: Row = {};
      if (step.team) set(after, m.teamRecipient, refs[step.team]?.id, 'which team a notification tells', warn);
      if (!(step.agents ?? []).length && !step.team) warn('notification: nobody to notify');
      // N3: scoped by conditions, like Halo's own runbook triggers.
      const conds: Row[] = [];
      for (const c of step.when ?? []) {
        if ('ticket_type' in c) conds.push({ fieldname: 'RequestType', fieldid: 1, change_context: 0, type: 0, value_int: refs[c.ticket_type]?.id, value_string: '', value_display: refs[c.ticket_type]?.name ?? '', value_type: 'int', tablename: 'faults' });
        else if ('field' in c) {
          const option = optionOf(c.field, c.equals, refs, warn);
          if (option) conds.push({ fieldname: refs[c.field]?.name, fieldid: refs[c.field]?.id, change_context: 0, type: 0, value_int: option.id, value_string: '', value_display: option.name, value_type: 'int', tablename: 'faults' });
        } else warn('notification: only ticket type and dropdown conditions are supported');
      }
      if (!conds.length) warn('notification: no conditions, so it fires for every matching ticket on the instance (N3)');
      set(after, m.conditions, conds, 'notification conditions', warn);
      if (Object.keys(after).length) p._enact_after = after;
      // Rule N2 (2026-10-25): the source's ROLE subscriptions came along (roles[]), and Halo expanded them to everyone
      // in Facilities, HR, IT and Administrator: 8 agents instead of 1. Nobody is subscribed but the plan's agents.
      Object.assign(p, { agent_id: 0, user_id: 0, email_list: '', condition_count: 0, rule_id: -1, roles: [], user_roles: [], conditions: [] });
      return p;
    },
  },

  ticket_template: {
    // Feature "child_tickets", rule C1 (SPIKE_MAP.childTickets). The parent is created first WITHOUT children; each
    // child is then made as its own type 6 template; then the parent lists them by id; then the ticket type points at
    // the parent. Shapes come from one of the instance's own parent templates and its first child.
    resource: 'Template',
    template: 'template-template.json',
    verifyAfterRelated: (back, step) => {
      const have = ((back[SPIKE_MAP.childTickets.children ?? 'children'] as Row[]) ?? []).map((c) => String(c.name));
      return (step.children ?? []).filter((c) => !have.includes(c.summary)).map((c) => `child ticket "${c.summary}" isn't on the template after saving`);
    },
    build: (step, refs, warn) => {
      const p = fromTemplate(templateFileFor(step, 'template-template.json'), 'Template');
      const m = SPIKE_MAP.childTickets;
      p.name = step.name;
      if (m.parentType !== null) p.type = m.parentType;
      // The source's own content never comes along: its summary uses its own fields, its details, custom field
      // values and to-do list are its own.
      Object.assign(p, { summary: '', details: '', details_html: '', customfields: [], todo_list: [] });
      // CT1 (run 23): at child_template_type 1 Halo raises no children at all. Whatever the source had, it's 0 here.
      p.child_template_type = 0;
      p.enable_task_dependencies = false;
      const attach = refs[step.attach_to ?? ''];
      // C2 (2026-10-25): the parent's team came from the source template (Leaver: "Human Resources"), and a template
      // applied when logging sets the ticket's team. The parent keeps the ticket type's own team.
      p.team = String(attach?.row?.default_team ?? '');
      if (!attach) warn('ticket_template: attach_to is missing');
      p.tickettype_id = attach?.id;
      if (!m.children || m.childType === null) gap('child tickets', warn);
      else delete p[m.children]; // children are made and linked after the parent (C1)
      if (!(step.children ?? []).length) warn('ticket_template: no child tickets');
      // C1: a ticket type that already raises a template would have it replaced: refuse, don't overwrite.
      const current = Number(attach?.row?.[m.attach ?? ''] ?? -1);
      if (current > 0) warn(`"${attach?.name}" already uses template ${current} when logged; Enact won't replace it`);
      return p;
    },
    relatedPreview: (step, refs) => [
      ...(step.children ?? []).map((c) => `child ticket "${c.summary}" (${refs[c.ticket_type]?.name ?? c.ticket_type}${c.team ? `, ${refs[c.team]?.name ?? c.team}` : ''})`),
      'the template lists its child tickets',
      `${refs[step.attach_to ?? '']?.name ?? step.attach_to} uses this template when logged`,
    ],
    related: async (record, step, refs) => {
      const m = SPIKE_MAP.childTickets;
      if (!m.children || m.childType === null || !m.attach) return [];
      // Child shape: the first child of the template the parent was copied from (Halo's own), cleaned.
      const src = runtime().templates.get(templateFileFor(step, 'template-template.json')) ?? {};
      const first = ((src[m.children] as Row[]) ?? [])[0];
      const childSrc = first?.id ? firstRecord(await runtime().halo.get(`/Template/${first.id}`, { includedetails: 'true' })) ?? {} : {};
      const shape: Row = cleanForCreate(childSrc);
      Object.assign(shape, { details: '', details_html: '', customfields: [], todo_list: [], creation_rules: [] });
      const kids = step.children ?? [];
      const out: { resource: string; payload: Row | ((made: Row[]) => Row); label: string }[] = kids.map((c) => ({
        resource: 'Template',
        label: `child ticket "${c.summary}"`,
        payload: { ...shape, name: c.summary, summary: c.summary, type: m.childType, tickettype_id: refs[c.ticket_type]?.id, team: c.team ? refs[c.team]?.name ?? '' : '' },
      }));
      out.push({ resource: 'Template', label: 'template lists its child tickets', payload: (made) => ({ id: record.id, [m.children as string]: made.slice(0, kids.length).map((k) => ({ id: k.id })) }) });
      const tt = refs[step.attach_to ?? ''];
      const current = tt?.id ? firstRecord(await runtime().halo.get(`/TicketType/${tt.id}`, { includedetails: 'true' })) ?? {} : {};
      if (tt?.id && Number(current[m.attach]) !== Number(record.id))
        out.push({ resource: 'TicketType', label: `${tt.name} uses template "${record.name}"`, payload: { id: tt.id, [m.attach]: record.id } });
      return out;
    },
  },
};

/** Plain text (paragraphs split by blank lines) to simple HTML for an email body. HTML passes through. */
const toHtml = (text: string) => textToHtml(text);

/** Every ref a step points at, so the builder can check order before running. */
export function refsOf(step: PlanStep): string[] {
  return [
    step.team,
    step.sla,
    step.approval,
    step.new_status,
    step.set?.workflow,
    step.set?.approval,
    step.set?.department_of,
    step.set?.copy_standard_fields_from,
    step.set?.team,
    step.set?.sla,
    ...(step.set?.add_groups ?? []),
    ...(step.set?.add_fields ?? []).map((f) => f.ref),
    ...(step.set?.field_hints ?? []).map((f) => f.ref),
    ...(step.set?.field_mandatory ?? []).map((f) => f.ref),
    ...(step.set?.replace_fields ?? []).flatMap((r) => [r.old, r.new]),
    step.dynamic?.copy_settings_from,
    ...(step.set?.add_members ?? []),
    ...(step.set?.insert_steps ?? []).flatMap((x) => [x.enter_via, ...x.exits.map((e) => e.via)]),
    ...[...(step.set?.add_actions ?? []), ...(step.set?.retarget_actions ?? [])].map((c) => c.via),
    step.department_of,
    ...(step.approvers ?? []).map((a) => ('agent' in a ? a.agent : 'group' in a ? a.group : undefined)),
    ...(step.approvers ?? []).flatMap((a) => ('rules' in a ? a.rules.flatMap((r) => [r.field, r.group, r.agent]) : [])),
    ...(step.set?.add_stages ?? []).flatMap((a) => ('agent' in a ? [a.agent] : 'group' in a ? [a.group] : 'rules' in a ? a.rules.flatMap((r) => [r.field, r.group, r.agent]) : [])),
    ...[...(step.insert_steps ?? []), ...(step.insert_step ? [step.insert_step] : [])].flatMap((x) => [x.enter_via, ...x.exits.map((e) => e.via)]),
    ...(step.fields ?? []).map((f) => f.ref),
    ...(step.members ?? []),
    ...(step.groups ?? []),
    step.send_email,
    step.set?.send_email,
    ...(step.set?.show_field_when ?? []).flatMap((c) => [c.field, c.when]),
    step.set?.acknowledgement_email,
    ...(step.when ?? []).map((c) => ('ticket_type' in c ? c.ticket_type : 'field' in c ? c.field : undefined)),
    step.then?.team,
    step.then?.agent,
    step.then?.category,
    ...(step.agents ?? []),
    step.attach_to,
    ...(step.children ?? []).flatMap((c) => [c.ticket_type, c.team]),
    step.ticket_type,
    step.service_category,
    step.parent,
    step.set?.parent,
    step.set?.ticket_type,
    step.set?.service_category,
    step.site,
    step.organisation,
    step.working_hours,
    step.faq_list,
    step.set?.working_hours,
    step.based_on_role,
    step.asset_group,
    ...(step.set?.read_only ?? []),
    ...(step.set?.remove_fields ?? []),
  ].filter((r): r is string => Boolean(r));
}
