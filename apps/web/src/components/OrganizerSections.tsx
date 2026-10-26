import RegistrationSelect from './RegistrationSelect'
import ReferenceIcon from './ReferenceIcon'
import type { ReactNode } from 'react'

import { organizationTypes, organizationTypeLabels } from '../registration/organizationDraft'
import type { OrganizationDetails } from '../registration/organizationDraft'

export function OrganizerSection({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section className="organizer-section" aria-labelledby={`organizer-section-${number}`}>
      <h2 id={`organizer-section-${number}`}>
        <span aria-hidden="true">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function OrganizationFields({
  details,
  onChange,
  children,
  errors = {},
}: {
  details: OrganizationDetails
  onChange: (field: keyof OrganizationDetails, value: string) => void
  errors?: Partial<Record<keyof OrganizationDetails, string>>
  children?: ReactNode
}) {
  function input(
    field: keyof OrganizationDetails,
    label: string,
    placeholder: string,
    autoComplete?: string,
  ) {
    return (
      <div className="form-field">
        <div className="field-label">
          <label htmlFor={field}>{label}</label>
          <span className="required-hint">Required</span>
        </div>
        <input
          id={field}
          name={field}
          type={field === 'phone' ? 'tel' : 'text'}
          required
          maxLength={255}
          aria-invalid={Boolean(errors[field])}
          aria-describedby={errors[field] ? `${field}-error` : undefined}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={details[field]}
          onChange={(event) => onChange(field, event.target.value)}
        />
        {errors[field] && (
          <p className="field-error" id={`${field}-error`}>
            {errors[field]}
          </p>
        )}
      </div>
    )
  }
  return (
    <>
      <OrganizerSection number={1} title="Organization & academic anchor">
        {input(
          'organizationName',
          'Organization / University Entity Name',
          'e.g., Department of Computer Science, University Innovation Center',
          'organization',
        )}
        <div className="organizer-category-row">
          <RegistrationSelect
            id="category"
            label="Entity Category"
            placeholder="Select institutional category"
            options={organizationTypes.map((value) => ({
              value,
              label: organizationTypeLabels[value],
            }))}
            value={details.category}
            error={errors.category}
            onChange={(value) => onChange('category', value)}
          />
        </div>
        {details.category === 'OTHER' && input('customCategory', 'Custom Entity Category', 'Enter your entity category')}
      </OrganizerSection>
      <OrganizerSection number={2} title="Lead organizer details">
        <div className="organizer-field-row">
          {input(
            'representativeName',
            'Representative Full Name',
            'e.g., Yasmine El Mansouri',
            'name',
          )}
          {input(
            'position',
            'Title / Academic Position',
            'e.g., Program Director / Academic Coordinator',
            'organization-title',
          )}
        </div>
        {input('phone', 'Direct Contact Phone', 'e.g., +212 6 00 12 34 56', 'tel')}
        {children}
      </OrganizerSection>
    </>
  )
}

export function OrganizerReviewNotice() {
  return (
    <aside className="organizer-review-notice mt-6!" aria-label="Organizer verification notice">
      <span className="review-shield">
        <ReferenceIcon name="verified_user" />
      </span>
      <div>
        <div className="review-notice-heading">
          <strong>Mandatory Institutional Review</strong>
          <span className="pending-badge">Pending Review Upon Submission</span>
        </div>
        <p>
          Organizer applications require administrator review before event publishing privileges are
          unlocked. Updates regarding your verification status will be delivered directly to your institutional email address.
        </p>
      </div>
    </aside>
  )
}

export function OrganizerHeader() {
  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full
bg-primary-container text-pure-white font-label-sm text-caption
font-bold`}
          >
            1
          </span>
          <span className="font-label-md text-label-md text-primary font-bold tracking-tight">
            Step 1 of 2: Institutional &amp; Organizer Dossier
          </span>
        </div>
      </div>
      <div className="w-full grid grid-cols-2 gap-2 mt-1">
        <div className="h-1.5 w-full bg-primary-container rounded-full"></div>
        <div className="h-1.5 w-full bg-surface-container-highest rounded-full"></div>
      </div>
    </div>
  )
}
