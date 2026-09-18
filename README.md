*This project has been created as part of the 42 curriculum by imellali, asyani.*

# Younity

Connecting Moroccan university students with opportunities to learn, meet, and build.

## Main idea

Younity is a responsive web application intended to bring hackathons, conferences, workshops, and networking events into one place. It helps Moroccan university students discover opportunities relevant to their interests and academic fields, while helping universities, clubs, NGOs, and other organizations reach students.

Today, information about these opportunities is often scattered across social media pages, informal groups, and word of mouth. Younity aims to make discovery easier and give organizers a central place to publish and maintain event information.

The project is being developed for a PFE at 1337 coding school and an internship in The Explorer program at UM6P.

## Project status

Younity is in the discovery and product-definition stage. The features below are a **proposed scope for discussion**, not a list of implemented features or an agreed MVP. The core/optional split still needs team agreement and alignment with the PFE module requirements.

The team consists of five software engineers working full-time toward a one-month delivery window. Work will be assigned through concrete tasks across the application rather than fixed frontend, backend, database, or DevOps specializations.

## Who it is for

- **Students:** Moroccan university students looking for academic and extracurricular opportunities.
- **Organizers:** universities, student clubs, NGOs, associations, and organizations that publish student-focused events.
- **Administrators:** the people responsible for platform access and event-listing quality. Their permissions and moderation workflow are proposed below and still need agreement.

UM6P students, university clubs, and Moroccan NGO youth networks are proposed early adopters.

## Main features — proposed core

| Feature | What users should be able to do |
| --- | --- |
| Central event directory | Browse hackathons, conferences, workshops, and networking events in one place. |
| Event search and filtering | Find relevant opportunities by criteria such as event category, academic field, date, and location. Exact filters remain to be agreed. |
| Event details | Read an event's description, organizer, date, location or online format, eligibility, deadline, and participation instructions where applicable. |
| Student accounts and interests | Sign up and log in securely, maintain basic profile information, and specify interests to support relevant discovery. |
| Organizer dashboard | Create, edit, and manage event listings, keeping dates, deadlines, and participation information current. |
| Appropriate access permissions | Allow organizers to manage their own listings and protect account and event-management actions from unauthorized changes. |
| Responsive, accessible interface | Browse and use the application on desktop and mobile browsers with clear navigation and accessible forms. |

Search criteria, event-detail fields, and ownership permissions above are proposed refinements of the supplied concept. The initial event sourcing and publishing/review process still need to be defined.

## Optional features — candidates for later prioritization

These features extend the core discovery and publishing flow. They are not delivery commitments.

| Feature | Intended value |
| --- | --- |
| Personalized recommendations | Suggest opportunities based on students' interests and, if justified later, their activity. The recommendation method is undecided; machine learning is not assumed. |
| Notifications and deadline reminders | Alert students about relevant new opportunities, event changes, and approaching deadlines. Delivery channels and notification rules remain open. |
| Community and networking tools | Help students connect around shared interests and events. Specific interactions have not been defined. |
| Organizer analytics | Help organizers understand engagement with their listings. Useful metrics and how to measure them remain to be agreed. |

Recommendations, alerts, and community building come from the Explorer materials and product description; placing them in the optional group is a proposal to keep the first delivery focused. Organizer analytics is a proposed extension of the engagement metrics in the canvases.

## User stories and journeys

These stories illustrate how each user would interact with the proposed features. They describe intended behavior, not implemented functionality. Optional extensions remain outside the proposed core unless the team agrees otherwise.

### Student story — discover a relevant opportunity

> As a Moroccan university student, I want to find opportunities that match my interests and availability so that I can participate without searching through scattered sources.

For example, a student interested in software engineering wants to find a hackathon or workshop they can attend.

1. **Create an account and sign in:** the student signs up securely and completes basic profile information, including academic field and interests.
2. **Explore opportunities:** they open the event directory and search or filter by relevant criteria, such as category, date, and location.
3. **Evaluate an event:** they open its details to check the organizer, description, eligibility, schedule, location or online format, and registration deadline.
4. **Take the next step:** they follow the event's participation instructions. Whether this means registering inside Younity or visiting the organizer's registration page is still undecided.
5. **Check for changes:** they return to the listing to see the latest information before participating.

**Optional extensions:** personalized recommendations could help them discover additional events; notifications could communicate changes and approaching deadlines; community tools could help them connect with other students. The precise interactions still need definition.

**Access boundary:** students manage their own profiles and explore listings; they cannot edit an organizer's events or access administration tools. Browsing without an account remains an open decision.

### Organizer story — publish and maintain an event

> As an event organizer, I want to publish opportunities and keep their details accurate so that I can reach relevant students and help them participate.

For example, a university club is organizing a workshop for students interested in entrepreneurship.

1. **Get organizer access:** a representative signs in and obtains permission to manage the organization's listings. How this access is requested and approved remains to be agreed.
2. **Create a listing:** through the organizer dashboard, they enter the event description, intended audience, date, location or online format, deadline, and participation instructions where applicable.
3. **Check and submit the details:** the application validates required information and explains anything that needs correction. Whether publication is immediate or requires admin review remains undecided.
4. **Reach students:** once published, the event appears in the directory and relevant search results, where students can view its details.
5. **Maintain the listing:** the organizer updates information when plans change. A proposed cancellation or unpublishing action would prevent students from relying on an event that is no longer available; its exact behavior still needs agreement.

**Optional extensions:** notifications could inform interested students of updates, and an analytics view could show agreed engagement metrics. Attendance or registration counts would require a reliable way to collect that information.

**Access boundary:** organizer permissions apply only to listings they are authorized to manage. Organizer access does not grant control over other organizations or platform-wide administration.

### Admin story — maintain trustworthy listings and appropriate access

> As a platform administrator, I want to manage publishing access and address problematic listings so that students can use a reliable event directory.

This is a proposed administration workflow introduced for discussion; organizer verification, moderation rules, and enforcement actions have not been agreed.

1. **Sign in with admin access:** an authorized administrator opens a restricted administration area. Users cannot grant themselves administrator privileges.
2. **Manage publishing access:** they review organizer-access requests if an approval process is adopted, and grant or revoke publishing permissions according to agreed criteria.
3. **Inspect event listings:** they review event information and identify misleading, inappropriate, or incomplete listings. This could happen before publication or after publication, depending on the chosen moderation policy.
4. **Resolve listing problems:** under the proposed workflow, they can ask the organizer to correct information or unpublish a listing when it violates the agreed rules. How correction requests are communicated is still open.
5. **Address misuse:** they can restrict publishing access for an organizer that repeatedly breaks the rules, if this action is included in the agreed admin scope.

**Access boundary:** administration should expose only the information and actions needed for platform management. Admins must not be able to read passwords. Account deletion, appeals, reporting tools, and moderation history are not assumed features and need separate scope decisions.

## Decisions still open

- Whether event registration happens within Younity or through an external organizer link.
- Who can publish events and how listing reliability will be checked.
- Whether browsing requires an account, how organizer access is granted, and which admin moderation actions are included.
- Which optional features, if any, belong in the first release.
- The initial audience, supported languages, and exact notification/community workflows.
- The technology stack and PFE module selection.

Native mobile applications are outside the current scope. Paid promotion and organizer willingness to pay remain business hypotheses, not agreed features.

## PFE requirements

The supplied `ft_transcendence` v21.2 subject requires a frontend, backend, database, secure authentication, simultaneous-user support, HTTPS, validated inputs, containerized startup with one command, and relevant Privacy Policy and Terms of Service pages. It also requires at least 14 points from fully implemented modules.

The product features above do not yet constitute a validated module selection. See the [PFE requirements summary](docs/pfe-requirements.md) for the mandatory foundation, module details, and documentation obligations.

## Development and documentation

No application implementation or run instructions are available yet. Setup instructions, the chosen stack, database schema, team logins and coordination responsibilities, module accounting, and actual individual contributions will be documented as they are established.

## Resources

- [Project context and decisions](docs/project-context.md)
- [PFE requirements summary](docs/pfe-requirements.md)
- [Supplied PFE subject — ft_transcendence v21.2](docs/resources/ft-transcendence-v21.2.pdf)
- [Explorer startup canvas — variant 1](docs/resources/explorer-canvas-1.png)
- [Explorer startup canvas — variant 2](docs/resources/explorer-canvas-2.png)
- [Explorer assumption worksheet](docs/resources/explorer-assumptions.png)

### AI assistance

AI has been used to summarize supplied resources, maintain project context, extract PFE requirements, and draft this README, its proposed feature grouping, and student/organizer/admin journeys. No application code has been generated for Younity at this stage. The team must review and agree on the proposed scope.
