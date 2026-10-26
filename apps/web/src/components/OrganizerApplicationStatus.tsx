import { mockRevisedDossier, REGISTRATION_UNAVAILABLE } from '../registration/service'
import { useState } from 'react'
import { Link } from 'react-router'
import ReferenceIcon from './ReferenceIcon'
import OrganizerPendingStatus from './OrganizerPendingStatus'
import type { ApplicationState } from '../registration/applicationState'

export default function OrganizerApplicationStatus({
  state,
  onStateChange,
}: {
  state: Exclude<ApplicationState, 'form'>
  onStateChange: (state: ApplicationState) => void
}) {
  const [replacement, setReplacement] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  switch (state) {
    case 'pending':
      return <OrganizerPendingStatus />
    case 'approved':
      return (
        <main className="w-full">
          <div className="flex flex-col w-full">
            <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
              <div
                className={`absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96
bg-secondary-fixed/40 rounded-full blur-3xl -z-10 pointer-events-none
opacity-60`}
              ></div>
              <div
                className={`absolute top-72 -right-24 w-80 h-80 bg-primary-fixed/30 rounded-full
blur-3xl -z-10 pointer-events-none opacity-40`}
              ></div>
              <div className="mb-8 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full
bg-primary text-on-primary font-label-sm text-label-sm font-bold`}
                    >
                      {'2'}
                    </span>
                    <span className="font-label-md text-label-md text-primary font-bold tracking-tight">
                      {'Step 2 of 2: Institutional Application Decision'}
                    </span>
                  </div>
                </div>
                <div className="w-full grid grid-cols-2 gap-2 mt-1">
                  <div className="h-1.5 w-full bg-primary rounded-full"></div>
                  <div className="h-1.5 w-full bg-primary rounded-full"></div>
                </div>
              </div>
              <div
                className={`bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-10 mb-8
relative overflow-hidden`}
              >
                <div className="mb-8 text-left">
                  <h1
                    className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-2"
                    id="page-title"
                    tabIndex={-1}
                  >
                    {'Institutional Dossier: Application Approved & Verified'}
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                    {
                      'The Younity Moroccan Academic Governance Desk has completed its review. Full accreditation and organizer publishing privileges have been officially granted.'
                    }
                  </p>
                </div>
                <div
                  className={`bg-emerald-500/10 p-4 sm:p-5 rounded-xl mb-8 flex flex-col md:flex-row
items-start md:items-center justify-between gap-4 border
border-emerald-500/20`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center
shrink-0 text-emerald-600`}
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        <ReferenceIcon name="verified" />
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
font-semibold bg-[#DCFCE7] text-[#16A34A]`}
                        >
                          {'Dossier Validé'}
                        </span>
                        <span className="font-label-sm text-label-sm text-tertiary">
                          {'ID: #YNT-ORG-2025-0842'}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        {
                          "Your university accreditation was confirmed with Morocco's academic rectorate councils. Full campus organizer publishing access is now unlocked."
                        }
                      </p>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCFCE7]
text-[#16A34A] font-label-sm text-label-sm font-semibold shadow-sm`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
                    <span className="">{'Status: Approved & Active'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                          <ReferenceIcon name="verified_user" />
                        </span>
                        {'Validation Pipeline'}
                      </h2>
                      <span className="font-caption text-caption uppercase tracking-wider text-emerald-600 font-semibold">
                        {'STAGE 3 CONCLUDED • 100% VERIFIED'}
                      </span>
                    </div>
                    <div
                      className={`space-y-4 relative pl-3 before:absolute before:left-[21px]
before:top-4 before:bottom-4 before:w-0.5 before:bg-emerald-500/30`}
                    >
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-status-approved-bg text-status-approved-text
flex items-center justify-center shrink-0 z-10 shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            <ReferenceIcon name="check" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container-low p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                              {'Institutional Dossier Uploaded'}
                            </h3>
                            <span className="font-caption text-caption text-outline">
                              {'Today, 14:32'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                            {
                              'Faculty credentials, departmental affiliation, and academic authorization records received.'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-status-approved-bg text-status-approved-text
flex items-center justify-center shrink-0 z-10 shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            <ReferenceIcon name="check" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container p-4 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className="font-label-md text-label-md text-on-surface font-bold">
                                {'Credential & Mandate Review'}
                              </h3>
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#DCFCE7] text-[#16A34A]">
                                {'Accredited'}
                              </span>
                            </div>
                            <span className="font-caption text-caption text-emerald-600 font-medium">
                              {'Verified & Approved'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface mb-3 leading-relaxed">
                            {
                              'Liaison officers concluded the review with Mohammed V University rectorate records. Official accreditation mandate confirmed.'
                            }
                          </p>
                          <div
                            className={`flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border
border-emerald-200 p-2.5 rounded-lg mb-2`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0 mt-0.5">
                              <ReferenceIcon name="check_circle" />
                            </span>
                            <span className="">
                              <strong>{'✓ Verification Confirmed:'}</strong>
                              {
                                'Official faculty sponsorship mandate authenticated for university campus initiatives.'
                              }
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-2 text-xs text-tertiary
bg-surface-container-lowest/80 p-2.5 rounded-lg`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-secondary">
                              <ReferenceIcon name="mark_email_read" />
                            </span>
                            <span className="">
                              {'Formal accreditation decree dispatched to:'}
                              <strong>{'k.tazi@um5.ac.ma'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-primary text-on-primary flex items-center
justify-center shrink-0 z-10 shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            <ReferenceIcon name="rocket_launch" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container p-4 rounded-xl shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="font-label-md text-label-md text-on-surface font-bold">
                                {'Event Management Console Activated'}
                              </h3>
                            </div>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                            {
                              'Access to event publishing, RSVP attendee validation, and campus auditorium reservations is now fully operational.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-primary/5 rounded-xl p-6 relative overflow-hidden flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[22px]">
                            <ReferenceIcon name="contact_support" />
                          </span>
                        </div>
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            {'Academic Liaison Desk'}
                          </h3>
                          <span className="font-caption text-caption text-secondary uppercase tracking-wider">
                            {'Direct Campus Support'}
                          </span>
                        </div>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {
                          'Need assistance setting up your organization profile or scheduling your inaugural campus hackathon? Our campus liaison team is here to assist.'
                        }
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
                            <span className="material-symbols-outlined text-[18px]">
                              <ReferenceIcon name="mail" />
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              {'Email Inquiries'}
                            </span>
                            <span className="font-medium text-xs sm:text-sm text-on-surface group-hover:text-primary">
                              {'organizer-support@younity.ma'}
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
                              <ReferenceIcon name="support_agent" />
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              {'Direct WhatsApp • Rectorate Line'}
                            </span>
                            <span className="font-medium text-xs sm:text-sm text-on-surface group-hover:text-primary">
                              {'+212 6 00 12 34 56'}
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
                <div className="flex items-center gap-2.5 text-on-surface-variant font-body-sm text-body-sm text-left">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">
                    <ReferenceIcon name="mark_email_read" />
                  </span>
                  <span className="">
                    {'Official accreditation credentials dispatched to'}
                    <strong>{'k.tazi@um5.ac.ma'}</strong>
                    {'.'}
                  </span>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto justify-end">
                  <Link
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-lg bg-surface-container
text-tertiary hover:bg-surface-container-high transition-colors
font-label-md text-label-md text-center inline-flex items-center
justify-center font-medium`}
                    to="/"
                  >
                    {'Explore Campus Events'}
                  </Link>
                  <Link
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#2854D9] text-white
hover:bg-[#1f44b2] transition-colors font-label-md text-label-md
text-center font-semibold inline-flex items-center justify-center
shadow-sm`}
                    to="/"
                  >
                    {'Enter Organizer Dashboard'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      )
    case 'rejected':
      return (
        <main className="w-full">
          <div className="flex flex-col w-full">
            <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
              <div
                className={`absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96
bg-secondary-fixed/40 rounded-full blur-3xl -z-10 pointer-events-none
opacity-60`}
              ></div>
              <div
                className={`absolute top-72 -right-24 w-80 h-80 bg-primary-fixed/30 rounded-full
blur-3xl -z-10 pointer-events-none opacity-40`}
              ></div>
              <div className="mb-8 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full
bg-primary text-on-primary font-label-sm text-label-sm font-bold`}
                    >
                      {'2'}
                    </span>
                    <span className="font-label-md text-label-md text-primary font-bold tracking-tight">
                      {'Step 2 of 2: Institutional Application Decision'}
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
                className={`bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-10 mb-8
relative overflow-hidden`}
              >
                <div className="mb-8 text-left">
                  <h1
                    className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-2"
                    id="page-title"
                    tabIndex={-1}
                  >
                    {'Institutional Dossier: Application Not Approved'}
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                    {
                      'The Younity Moroccan Academic Governance Desk has completed its review. Accreditation could not be granted for this submission.'
                    }
                  </p>
                </div>
                <div
                  className={`bg-error-container/20 p-4 sm:p-5 rounded-xl mb-8 flex flex-col
md:flex-row items-start md:items-center justify-between gap-4 border
border-error/20`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0 text-error">
                      <span className="material-symbols-outlined text-[24px]">
                        <ReferenceIcon name="cancel" />
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
font-semibold bg-error/15 text-error`}
                        >
                          {'Dossier Non Validé'}
                        </span>
                        <span className="font-label-sm text-label-sm text-tertiary">
                          {'ID: #YNT-ORG-2025-0842'}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        {
                          "Your accreditation application was thoroughly evaluated across Morocco's university councils but did not satisfy the institutional verification criteria."
                        }
                      </p>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
bg-surface-container-lowest shadow-sm text-error font-label-sm
text-label-sm`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-error">
                      <ReferenceIcon name="error" />
                    </span>
                    <span className="">{'Status: Application Declined'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                          <ReferenceIcon name="verified_user" />
                        </span>
                        {'Validation Pipeline'}
                      </h2>
                      <span className="font-caption text-caption uppercase tracking-wider text-outline">
                        {'Stage 2 Concluded'}
                      </span>
                    </div>
                    <div
                      className={`space-y-4 relative pl-3 before:absolute before:left-[21px]
before:top-4 before:bottom-4 before:w-0.5
before:bg-surface-container-highest`}
                    >
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-status-approved-bg text-status-approved-text
flex items-center justify-center shrink-0 z-10 shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            <ReferenceIcon name="check" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container-low p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                              {'Institutional Dossier Uploaded'}
                            </h3>
                            <span className="font-caption text-caption text-outline">
                              {'Today, 14:32'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                            {
                              'Faculty credentials, departmental affiliation, and academic authorization records received.'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-error text-on-error flex items-center
justify-center shrink-0 z-10 shadow-md`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            <ReferenceIcon name="close" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container p-4 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className="font-label-md text-label-md text-error font-bold">
                                {'Credential & Mandate Review'}
                              </h3>
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-error/15 text-error">
                                {'Not Approved'}
                              </span>
                            </div>
                            <span className="font-caption text-caption text-tertiary font-medium">
                              {'Decision Final'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface mb-3 leading-relaxed">
                            {
                              'Liaison officers concluded the review with Mohammed V University rectorate records. Official accreditation mandate could not be confirmed.'
                            }
                          </p>
                          <div
                            className={`flex items-start gap-2 text-xs text-error bg-error/10 border
border-error/20 p-2.5 rounded-lg mb-2`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-error shrink-0 mt-0.5">
                              <ReferenceIcon name="warning" />
                            </span>
                            <span className="">
                              <strong>{'Rejection Reason:'}</strong>
                              {
                                'Official faculty sponsorship mandate missing or unaccredited student organization entity.'
                              }
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-2 text-xs text-tertiary
bg-surface-container-lowest/80 p-2.5 rounded-lg`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-secondary">
                              <ReferenceIcon name="mark_email_read" />
                            </span>
                            <span className="">
                              {'Formal notification letter dispatched to:'}
                              <strong>{'k.tazi@um5.ac.ma'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4 opacity-60">
                        <div
                          className={`w-7 h-7 rounded-full bg-surface-container-highest text-outline flex
items-center justify-center shrink-0 z-10`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            <ReferenceIcon name="lock" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container-low/70 p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-label-md text-label-md text-tertiary">
                              {'Event Management Console (Access Restricted)'}
                            </h3>
                            <span className="font-caption text-caption text-outline">
                              {'Step 3: Locked'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {
                              'Access to event publishing, RSVP attendee validation, and auditorium reservations requires an approved institutional organizer dossier.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-primary/5 rounded-xl p-6 relative overflow-hidden flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[22px]">
                            <ReferenceIcon name="contact_support" />
                          </span>
                        </div>
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            {'Academic Liaison Desk'}
                          </h3>
                          <span className="font-caption text-caption text-secondary uppercase tracking-wider">
                            {'Direct Campus Support'}
                          </span>
                        </div>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {
                          'Wish to contest this decision or provide supplementary faculty authorization letters? Our academic liaison team assists with formal appeal reviews.'
                        }
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
                            <span className="material-symbols-outlined text-[18px]">
                              <ReferenceIcon name="mail" />
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              {'Email Inquiries'}
                            </span>
                            <span className="font-medium text-xs sm:text-sm text-on-surface group-hover:text-primary">
                              {'organizer-support@younity.ma'}
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
                              <ReferenceIcon name="support_agent" />
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              {'Direct WhatsApp • Rectorate Line'}
                            </span>
                            <span className="font-medium text-xs sm:text-sm text-on-surface group-hover:text-primary">
                              {'+212 6 00 12 34 56'}
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
                <div className="flex items-center gap-2.5 text-on-surface-variant font-body-sm text-body-sm text-left">
                  <span className="material-symbols-outlined text-error text-[20px] shrink-0">
                    <ReferenceIcon name="mark_email_read" />
                  </span>
                  <span className="">
                    {'Official decision notice dispatched to'}
                    <strong>{'k.tazi@um5.ac.ma'}</strong>
                    {'.'}
                  </span>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto justify-end">
                  <Link
                    className={`inline-flex items-center justify-center min-h-[48px] px-7 py-3
rounded-xl font-medium text-sm text-[#17243D] bg-white border
border-[#E2E8F0] shadow-sm hover:bg-[#F8FAFC] hover:border-[#CBD5E1]
transition-all duration-150 cursor-pointer w-full sm:w-auto
text-center whitespace-nowrap`}
                    to="/"
                  >
                    {'Explore Campus Events as Attendee'}
                  </Link>
                  <Link
                    className={`inline-flex items-center justify-center min-h-[48px] px-7 py-3
rounded-xl font-semibold text-sm text-white bg-[#2854D9] shadow-sm
hover:bg-[#1E42B3] hover:shadow transition-all duration-150
cursor-pointer w-full sm:w-auto text-center whitespace-nowrap`}
                    to="/"
                  >
                    {'Return to Younity Portal'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      )
    case 'needs_edit':
      return (
        <main className="w-full">
          <div className="flex flex-col w-full">
            <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
              <div
                className={`absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96
bg-secondary-fixed/40 rounded-full blur-3xl -z-10 pointer-events-none
opacity-60`}
              ></div>
              <div
                className={`absolute top-72 -right-24 w-80 h-80 bg-primary-fixed/30 rounded-full
blur-3xl -z-10 pointer-events-none opacity-40`}
              ></div>
              <div className="mb-8 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full
bg-primary text-on-primary font-label-sm text-label-sm font-bold`}
                    >
                      {'2'}
                    </span>
                    <span className="font-label-md text-label-md text-primary font-bold tracking-tight">
                      {'Step 2 of 2: Institutional Application Status'}
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
                className={`bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-10 mb-8
relative overflow-hidden`}
              >
                <div className="mb-8 text-left">
                  <h1
                    className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-2"
                    id="page-title"
                    tabIndex={-1}
                  >
                    {'Institutional Dossier Submitted'}
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                    {
                      'Your accreditation application is currently under rigorous review by the Younity Moroccan Academic Governance Desk.'
                    }
                  </p>
                </div>
                <div
                  className={`bg-status-pending-bg border border-status-pending-border p-4 sm:p-5
rounded-xl mb-6 flex flex-col md:flex-row items-start md:items-center
justify-between gap-4`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full bg-status-pending-border/40 flex items-center
justify-center shrink-0 text-status-pending-text`}
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        <ReferenceIcon name="warning" />
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
font-semibold bg-status-pending-border/30 text-status-pending-text`}
                        >
                          {'Modifications Requises'}
                        </span>
                        <span className="font-label-sm text-label-sm text-tertiary">
                          {'ID: #YNT-ORG-2025-0842'}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        {
                          'The accreditation committee reviewed your dossier and requested changes to your official proof of authorization. Please review the notes and re-upload your verification document below to proceed.'
                        }
                      </p>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
bg-surface-container-lowest shadow-sm text-status-pending-text
font-label-sm text-label-sm font-semibold`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-status-pending-text">
                      <ReferenceIcon name="edit_note" />
                    </span>
                    <span className="">{'Status: Action Required'}</span>
                  </div>
                </div>
                <div
                  className={`bg-surface-container-low border border-status-pending-border/40
rounded-xl p-5 mb-8 flex flex-col sm:flex-row items-start gap-4
shadow-sm`}
                >
                  <div
                    className={`w-9 h-9 rounded-full bg-status-pending-border/30 flex items-center
justify-center shrink-0 text-status-pending-text mt-0.5`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      <ReferenceIcon name="rate_review" />
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-label-md text-label-md text-on-surface font-bold">
                        {'Official Dean Endorsement Missing / Incomplete'}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold
bg-status-pending-border/30 text-status-pending-text`}
                      >
                        {'Reviewer Feedback'}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      {
                        'The uploaded file was missing the faculty seal and countersignature. Please provide an authorized mandate letter from your dean or department head.'
                      }
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                          <ReferenceIcon name="verified_user" />
                        </span>
                        {'Validation Pipeline'}
                      </h2>
                      <span className="font-caption text-caption uppercase tracking-wider text-outline">
                        {'Stage 2 in progress'}
                      </span>
                    </div>
                    <div
                      className={`space-y-4 relative pl-3 before:absolute before:left-[21px]
before:top-4 before:bottom-4 before:w-0.5
before:bg-surface-container-highest`}
                    >
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-status-approved-bg text-status-approved-text
flex items-center justify-center shrink-0 z-10 shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            <ReferenceIcon name="check" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container-low p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                              {'Institutional Dossier Uploaded'}
                            </h3>
                            <span className="font-caption text-caption text-outline">
                              {'Initial Submission'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                            {
                              'Faculty credentials, departmental affiliation, and academic authorization records received.'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`w-7 h-7 rounded-full bg-status-pending-text text-on-primary flex
items-center justify-center shrink-0 z-10 shadow-md ring-4
ring-status-pending-border/40`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            <ReferenceIcon name="priority_high" />
                          </span>
                        </div>
                        <div
                          className={`flex-1 bg-surface-container p-4 rounded-xl shadow-sm border
border-status-pending-border/30`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-label-md text-label-md text-status-pending-text font-bold">
                                {'Credential & Mandate Review'}
                              </h3>
                              <span
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-full
bg-status-pending-border/40 text-status-pending-text`}
                              >
                                {'Awaiting New Proof'}
                              </span>
                            </div>
                            <span className="font-caption text-caption text-status-pending-text font-medium">
                              {'Action Required'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface mb-3 leading-relaxed">
                            {
                              'Liaison officers require a countersigned Dean endorsement before validation can resume.'
                            }
                          </p>
                          <div
                            className={`flex items-center gap-2 text-xs text-tertiary
bg-surface-container-lowest/80 p-2.5 rounded-lg`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-secondary">
                              <ReferenceIcon name="help_outline" />
                            </span>
                            <span className="">
                              {'Awaiting replacement mandate document from:'}
                              <strong>{'k.tazi@um5.ac.ma'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative flex items-start gap-4 opacity-60">
                        <div
                          className={`w-7 h-7 rounded-full bg-surface-container-highest text-outline flex
items-center justify-center shrink-0 z-10`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            <ReferenceIcon name="lock" />
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-container-low/70 p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-label-md text-label-md text-tertiary">
                              {'Event Management Console Activation'}
                            </h3>
                            <span className="font-caption text-caption text-outline">
                              {'Step 3'}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {
                              'Publish hackathons, manage student RSVP lists, reserve university auditoriums, and issue verified attendance certificates.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-5 space-y-5">
                    <div className="bg-primary/5 rounded-xl p-6 relative overflow-hidden flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[22px]">
                            <ReferenceIcon name="contact_support" />
                          </span>
                        </div>
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            {'Academic Liaison Desk'}
                          </h3>
                          <span className="font-caption text-caption text-secondary uppercase tracking-wider">
                            {'Direct Campus Support'}
                          </span>
                        </div>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {
                          'Need immediate clearance for an urgent national hackathon or inter-university summit? Our campus liaison team is on call.'
                        }
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
                            <span className="material-symbols-outlined text-[18px]">
                              <ReferenceIcon name="mail" />
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              {'Email Inquiries'}
                            </span>
                            <span className="font-medium text-xs sm:text-sm text-on-surface group-hover:text-primary">
                              {'organizer-support@younity.ma'}
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
                              <ReferenceIcon name="support_agent" />
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-caption text-caption text-outline">
                              {'Direct WhatsApp • Rectorate Line'}
                            </span>
                            <span className="font-medium text-xs sm:text-sm text-on-surface group-hover:text-primary">
                              {'+212 6 00 12 34 56'}
                            </span>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-8 bg-surface-container-lowest border
border-surface-container-highest p-6 sm:p-8 rounded-xl shadow-sm
mx-auto max-w-3xl w-full`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      <ReferenceIcon name="upload_file" />
                    </span>
                    <h3 className="font-label-md text-label-md text-on-surface font-bold">
                      {'Re-upload Proof of Affiliation & Authorization'}
                    </h3>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                    {
                      'Please upload an authorized university mandate letter or faculty endorsement bearing the official dean or department head signature and stamp.'
                    }
                  </p>
                  <label
                    htmlFor="reupload-file"
                    className={`block border-2 border-dashed border-outline-variant
hover:border-primary rounded-xl p-8 text-center
bg-surface-container-low/50 hover:bg-surface-container-low
transition-colors cursor-pointer group`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      setReplacement(event.dataTransfer.files[0]?.name ?? '')
                    }}
                  >
                    <div
                      className={`w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center
justify-center text-primary group-hover:scale-105 transition-transform`}
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        <ReferenceIcon name="cloud_upload" />
                      </span>
                    </div>
                    <p className="font-label-md text-label-md text-on-surface font-semibold mb-1">
                      {'Drop authorized university mandate letter or faculty endorsement here'}
                    </p>
                    <p className="font-caption text-caption text-secondary font-medium mb-2">
                      {'or'}
                      <span className="text-primary underline font-bold">{'browse files'}</span>
                      {'from your computer'}
                    </p>
                    <span className="inline-block font-caption text-caption text-outline">
                      {'Local file selection only. Upload requirements await backend integration.'}
                    </span>
                    <input
                      id="reupload-file"
                      type="file"
                      aria-label="Replacement affiliation document"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg"
                      onChange={(event) => setReplacement(event.target.files?.[0]?.name ?? '')}
                    />
                    {replacement && <p role="status">Selected: {replacement}</p>}
                  </label>
                </div>
              </div>
              <div
                className={`flex flex-col md:flex-row items-center justify-between gap-4 py-5 px-3
border-t border-surface-container mt-2`}
              >
                <div className="flex items-center gap-2.5 text-on-surface-variant font-body-sm text-body-sm text-left">
                  <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                    <ReferenceIcon name="info" />
                  </span>
                  <span className="">
                    {
                      'Notification will be sent via institutional email once verification concludes.'
                    }
                  </span>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto justify-end">
                  <Link
                    className={`inline-flex items-center justify-center min-h-[48px] px-7 py-3
rounded-xl font-medium text-sm text-[#17243D] bg-white border
border-[#E2E8F0] shadow-sm hover:bg-[#F8FAFC] hover:border-[#CBD5E1]
transition-all duration-150 cursor-pointer w-full sm:w-auto
whitespace-nowrap`}
                    to="/"
                  >
                    {'Return to Younity Portal'}
                  </Link>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3
rounded-xl font-semibold text-sm text-white bg-[#2854D9] shadow-sm
hover:bg-[#1E42B3] hover:shadow transition-all duration-150
cursor-pointer w-full sm:w-auto whitespace-nowrap`}
                    onClick={() => {
                      if (import.meta.env.DEV) onStateChange(mockRevisedDossier())
                      else setSubmissionError(REGISTRATION_UNAVAILABLE)
                    }}
                  >
                    <span>{'Submit Revised Dossier'}</span>
                  </button>
                  {submissionError && <p className="notice error" role="alert">{submissionError}</p>}
                </div>
              </div>
            </div>
          </div>
        </main>
      )
  }
}
