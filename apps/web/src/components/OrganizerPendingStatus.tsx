import { Link } from 'react-router'
import '../registration/stitch.css'

export default function OrganizerPendingStatus() {
  return (
    <div className="organizer-status-preview">
      <div
        className={`bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col
          justify-center items-center`}
      >
        <main className="w-full">
          <div className="flex flex-col w-full">
            <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
              <div
                className={`absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-secondary-fixed/40
                  rounded-full blur-3xl -z-10 pointer-events-none opacity-60`}
              ></div>
              <div
                className={`absolute top-72 -right-24 w-80 h-80 bg-primary-fixed/30 rounded-full blur-3xl
                  -z-10 pointer-events-none opacity-40`}
              ></div>
              <div className="mb-8 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary
                        text-on-primary font-label-sm text-label-sm font-bold`}
                    >
                      2
                    </span>
                    <span className="font-label-md text-label-md text-primary font-bold tracking-tight">
                      Step 2 of 2: Institutional Application Status
                    </span>
                  </div>
                </div>
                <div className="w-full grid grid-cols-2 gap-2 mt-1">
                  <div className="h-1.5 w-full bg-primary rounded-full"></div>
                  <div className="h-1.5 w-full bg-primary rounded-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary animate-pulse opacity-90"></div>
                  </div>
                </div>
              </div>
              <div
                className={`bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-10 mb-8 relative
                  overflow-hidden`}
              >
                <div className="mb-8 text-left">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-2">
                    Institutional Dossier Submitted
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                    Your accreditation application is currently under rigorous review by the Younity
                    Moroccan Academic Governance Desk.
                  </p>
                </div>
                <div
                  className={`bg-status-pending-bg p-4 sm:p-5 rounded-xl mb-8 flex flex-col md:flex-row
                    items-start md:items-center justify-between gap-4`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full bg-status-pending-border/40 flex items-center
                        justify-center shrink-0 text-status-pending-text`}
                    >
                      <span className="material-symbols-outlined text-[24px]">hourglass_top</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
                            font-semibold bg-status-pending-border/30 text-status-pending-text`}
                        >
                          En Examen Académique
                        </span>
                        <span className="font-label-sm text-label-sm text-tertiary">
                          ID: #YNT-ORG-2025-0842
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        Organizer authorization is strictly verified across Morocco’s public &amp;
                        private university councils to uphold departmental accreditation and
                        institutional mandate.
                      </p>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                      bg-surface-container-lowest shadow-sm text-tertiary font-label-sm
                      text-label-sm`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      schedule
                    </span>
                    <span className="">Status: Queued</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2
                        className={`font-headline-sm text-headline-sm text-on-surface flex items-center
                          gap-2`}
                      >
                        <span className="material-symbols-outlined text-primary">
                          verified_user
                        </span>
                        Validation Pipeline
                      </h2>
                      <span className="font-caption text-caption uppercase tracking-wider text-outline">
                        Stage 2 in progress
                      </span>
                    </div>
                    <div
                      className={`space-y-4 relative pl-3 before:absolute before:left-[21px] before:top-4
                        before:bottom-4 before:w-0.5 before:bg-surface-container-highest`}
                    >
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-status-approved-bg text-status-approved-text
                            flex items-center justify-center shrink-0 z-10 shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        </div>
                        <div className="flex-1 bg-surface-container-low p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                              Institutional Dossier Uploaded
                            </h3>
                            <span className="font-caption text-caption text-outline">
                              Today, 14:32
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                            Faculty credentials, departmental affiliation, and academic
                            authorization records received.
                          </p>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-primary text-on-primary flex items-center
                            justify-center shrink-0 z-10 shadow-md ring-4 ring-primary-fixed`}
                        >
                          <span className="material-symbols-outlined text-[16px] animate-spin">
                            sync
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container p-4 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className="font-label-md text-label-md text-primary font-bold">
                                Credential &amp; Mandate Review
                              </h3>
                              <span
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-full
                                  bg-secondary-container text-on-secondary-container`}
                              >
                                Active
                              </span>
                            </div>
                            <span className="font-caption text-caption text-tertiary font-medium">
                              In Queue
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface mb-3 leading-relaxed">
                            Liaison officers are authenticating faculty sponsorship letters with the
                            Mohammed V University rectorate records.
                          </p>
                          <div
                            className={`flex items-center gap-2 text-xs text-tertiary
                              bg-surface-container-lowest/80 p-2.5 rounded-lg`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-secondary">
                              mark_email_read
                            </span>
                            <span className="">
                              Confirmation receipt dispatch queued to:{' '}
                              <strong>k.tazi@um5.ac.ma</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4 opacity-60">
                        <div
                          className={`w-7 h-7 rounded-full bg-surface-container-highest text-outline flex
                            items-center justify-center shrink-0 z-10`}
                        >
                          <span className="material-symbols-outlined text-[16px]">lock</span>
                        </div>
                        <div className="flex-1 bg-surface-container-low/70 p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-label-md text-label-md text-tertiary">
                              Event Management Console Activation
                            </h3>
                            <span className="font-caption text-caption text-outline">Step 3</span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            Publish hackathons, manage student RSVP lists, reserve university
                            auditoriums, and issue verified attendance certificates.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-primary/5 rounded-xl p-6 relative overflow-hidden flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full bg-primary/10 flex items-center
                            justify-center shrink-0`}
                        >
                          <span className="material-symbols-outlined text-primary text-[22px]">
                            contact_support
                          </span>
                        </div>
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            Academic Liaison Desk
                          </h3>
                          <span className="font-caption text-caption text-secondary uppercase tracking-wider">
                            Direct Campus Support
                          </span>
                        </div>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        Need immediate clearance for an urgent national hackathon or
                        inter-university summit? Our campus liaison team is on call.
                      </p>
                      <div className="flex flex-col gap-3">
                        <a
                          className={`flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest
                            shadow-sm hover:bg-surface-container-high transition-colors
                            text-on-surface group`}
                          href="mailto:organizer-support@younity.ma"
                        >
                          <div
                            className={`w-8 h-8 rounded-md bg-surface-container flex items-center
                              justify-center shrink-0 text-secondary group-hover:text-primary`}
                          >
                            <span className="material-symbols-outlined text-[18px]">mail</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              Email Inquiries
                            </span>
                            <span
                              className={`font-medium text-xs sm:text-sm text-on-surface
                                group-hover:text-primary`}
                            >
                              organizer-support@younity.ma
                            </span>
                          </div>
                        </a>
                        <a
                          className={`flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest
                            shadow-sm hover:bg-surface-container-high transition-colors
                            text-on-surface group`}
                          href="https://wa.me/212600123456"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <div
                            className={`w-8 h-8 rounded-md bg-surface-container flex items-center
                              justify-center shrink-0 text-secondary group-hover:text-primary`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              support_agent
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              Direct WhatsApp • Rectorate Line
                            </span>
                            <span
                              className={`font-medium text-xs sm:text-sm text-on-surface
                                group-hover:text-primary`}
                            >
                              +212 6 00 12 34 56
                            </span>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className={`flex flex-col md:flex-row items-center justify-between gap-4 py-5 px-3
                  border-t border-surface-container mt-2`}
              >
                <div
                  className={`flex items-center gap-2.5 text-on-surface-variant font-body-sm text-body-sm
                    text-left`}
                >
                  <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                    info
                  </span>
                  <span className="">
                    Notification will be sent via institutional email once verification concludes.
                  </span>
                </div>
                <div
                  className={`flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto
                    justify-end`}
                >
                  <Link
                    className={`inline-flex items-center justify-center min-h-[48px] px-7 py-3 rounded-xl
                      font-medium text-sm text-[#17243D] bg-white border border-[#E2E8F0]
                      shadow-sm hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all
                      duration-150 cursor-pointer w-full sm:w-auto text-center whitespace-nowrap`} to="/">
                    Explore Campus Events as Attendee
                  </Link>
                  <Link
                    className={`inline-flex items-center justify-center min-h-[48px] px-7 py-3 rounded-xl
                      font-semibold text-sm text-white bg-[#2854D9] shadow-sm hover:bg-[#1E42B3]
                      hover:shadow transition-all duration-150 cursor-pointer w-full sm:w-auto
                      text-center whitespace-nowrap`} to="/">
                    Return to Younity Portal
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
