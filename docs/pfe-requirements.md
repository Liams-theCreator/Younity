# PFE subject — ft_transcendence v21.2

Source: [supplied subject](resources/ft-transcendence-v21.2.pdf), received 2026-09-16. Page references below use printed page numbers (PDF viewer page = printed page + 1). This is a working summary; the supplied PDF remains authoritative. Document instructions describe assignment requirements, not permission to start implementation.

## Product fit

The application idea is chosen by the team (III.1, p. 7). An Event Management Platform is explicitly listed as an example (V.3, p. 23). Younity fits that direction in principle; this does not establish evaluation approval or completion. The example features and suggested modules are not mandatory. A game is not required for a non-gaming project.

## Mandatory foundation

- Team of 4–5 people; assign Product Owner, Project Manager/Scrum Master, Technical Lead/Architect, and developer responsibilities. All members develop and contribute to mandatory work and modules. Document roles and contributions; everyone must explain the project and their work (II, pp. 4–6).
- Web application with frontend, backend, and database (III.2, p. 8).
- Git history with meaningful commits from all members and evidence of distributed work.
- Containerized deployment, runnable with one command; Docker, Podman, or equivalent.
- Latest stable Google Chrome compatibility, without JavaScript warnings/errors in the browser console.
- Accessible, relevant, non-placeholder Privacy Policy and Terms of Service pages; missing/inadequate pages are a rejection condition.
- Simultaneous active users; correct concurrent actions, applicable real-time updates, and no race conditions/data corruption.
- Clear, responsive, accessible frontend and a CSS framework or styling solution (III.3, p. 9).
- Local credentials/configuration in a Git-ignored `.env`, with `.env.example` provided.
- Clear database schema and well-defined relations.
- Secure email/password signup and login, including salted password hashing. OAuth/2FA are optional modules, not substitutes for the stated baseline.
- Frontend and backend validation for all forms and user inputs.
- HTTPS for connections to the backend from browsers, scripts, external APIs, etc.; internal backend connections may be unencrypted.

## Module rules — selection pending

- At least 14 points: major = 2, minor = 1 (IV, pp. 10–11).
- Only fully functional, properly implemented, demonstrable modules count; incomplete modules receive zero.
- Respect dependencies and incompatibilities. Bonus modules beyond 14 may earn at most 5 extra points when bonus conditions are met (VII, p. 30).
- Choose coherent modules after clarifying the product. No module bundle or point total has been agreed for Younity.
- Do not assume the example projects' suggested module lists define or guarantee a scoring bundle; use the detailed module definitions.

Potentially relevant definitions to preserve for later scope discussion (not selections):

| Module | Points | Required scope to consider |
| --- | --- | --- |
| Frontend + backend frameworks | 2 | Both capabilities; a full-stack framework can qualify when both sides are used. Frontend-only/backend-only are listed separately as 1-point alternatives; do not assume additive credit for overlapping framework work. |
| ORM | 1 | Use an ORM for the database. |
| Advanced search | 1 | Filters, sorting, and pagination. |
| Organization system | 2 | Organization create/edit/delete, member addition/removal, and organization-specific actions including create/read/update. |
| Advanced permissions | 2 | User management, role management, role-dependent views/actions. |
| Notifications | 1 | Complete notification system for all creation/update/deletion actions; deadline alerts alone do not establish completion. |
| Real-time features | 2 | Cross-client updates, graceful connection/disconnection, efficient broadcasting using WebSockets or similar. |
| User interaction | 2 | Basic chat, user profiles, and friends system; event interactions alone do not satisfy this definition. |
| Standard user management | 2 | Profile editing, avatar/default avatar, friends with online status, profile page; baseline login alone is insufficient. |
| Multiple languages | 1 | At least three complete translations, switcher, and all user-facing text translatable. |
| RTL support | 1 | At least one RTL language, full layout mirroring and adjustments, seamless direction switching. |
| ML recommendations | 2 | Behavior-based personalization, collaborative/content-based filtering, and improvement over time; interest filters alone do not establish completion. |

Detailed definitions: IV.1–IV.4, pp. 12–15. Other available categories include cybersecurity, gaming, DevOps, data/analytics, blockchain, and justified custom modules. None is automatically required by Younity's concept.

## Documentation and evaluation

English root README required (VI, pp. 27–29), including:

- Prescribed italic first line identifying the 42 curriculum and team logins; use the exact source wording when authoring the final README.
- Description/name/features; prerequisites and step-by-step setup/run instructions, including versions and configuration.
- Resources and explicit disclosure of AI use by task and project part.
- Team roles/responsibilities; work organization, management tools, communication channels.
- Stack choices and rationale; database structure, relations, key fields/types.
- Implemented features and their contributors; selected modules, point calculation, justification, implementation, and contributors.
- Individual contributions and challenges overcome.

Only work in the submitted repository is evaluated. A short live modification may be requested depending on evaluation guidelines (VIII, p. 31). The AI guidance stresses understanding, checking/testing generated work, and peer review (I, pp. 2–3). Regular meetings and particular management tools are recommendations, not compulsory tooling (II.1.2).

## Information still needed

- Team confirmed: five software engineers working full-time. User treats one month as the delivery deadline; exact start/end dates remain open. Work is allocated by tasks across technical areas, not by frontend/backend/DevOps/database specialties. Required coordination responsibilities remain unassigned; relevant technical experience is still unknown.
- Separate evaluation sheet or local clarifications, if any.
- Explorer deliverables and deadline; the PFE subject does not define those.
- Remaining product resources before agreeing an MVP and module selection.
