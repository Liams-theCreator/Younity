import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import ReferenceIcon from '../components/ReferenceIcon'
import { formats, formatLabels, type Category } from './model'
import styles from './events.module.css'

const labels = {
  q: 'Keyword',
  format: 'Format',
  category: 'Category',
}
type FilterName = keyof typeof labels
const filterNames = Object.keys(labels) as FilterName[]
const emptyFilters: Record<FilterName, string> = {
  q: '', format: '', category: '',
}

type FilterFieldProps = {
  id: string
  name: FilterName
  icon: string
  children: ReactNode
}

function FilterField({ id, name, icon, children }: FilterFieldProps) {
  return (
    <div className={styles.field}>
      <ReferenceIcon name={icon} />
      <div>
        <label htmlFor={id}>{labels[name]}</label>
        {children}
      </div>
    </div>
  )
}

type EventFiltersProps = {
  id: string
  search: string
  categories: Category[]
  onApply: (params: URLSearchParams) => void
}

export default function EventFilters({ id, search, categories, onApply }: EventFiltersProps) {
  const applied = new URLSearchParams(search)
  const activeFilters = filterNames.filter(name => applied.has(name))
  const [draft, setDraft] = useState(() => {
    const initial = { ...emptyFilters }
    for (const name of filterNames) initial[name] = applied.get(name) ?? ''
    return initial
  })
  const fieldId = (name: FilterName) => `${id}-${name}`

  function control(name: FilterName) {
    return {
      id: fieldId(name),
      name,
      value: draft[name],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { value } = event.currentTarget
        setDraft(previous => ({ ...previous, [name]: value }))
      },
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams()
    for (const name of filterNames) {
      const value = draft[name].trim()
      if (value) next.set(name, value)
    }
    onApply(next)
  }

  function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDraft(emptyFilters)
    onApply(new URLSearchParams())
  }

  function filterLabel(name: FilterName, value: string) {
    if (name === 'category') return categories.find(category => category.slug === value)?.name ?? value
    if (name === 'format') {
      const format = formats.find(item => item === value)
      if (format) return formatLabels[format]
    }
    return value
  }

  return (
    <form id={id} aria-label="Search events" onSubmit={submit} onReset={reset}>
      <div className={styles.searchDock}>
        <div className={styles.searchMain}>
          <FilterField id={fieldId('q')} name="q" icon="search">
            <input {...control('q')} type="search" maxLength={150} placeholder="Event or organizer" />
          </FilterField>
          <FilterField id={fieldId('format')} name="format" icon="devices">
            <select {...control('format')}>
              <option value="">All formats</option>
              {draft.format && !formats.some(format => format === draft.format) && (
                <option value={draft.format}>{draft.format}</option>
              )}
              {formats.map(format => <option key={format} value={format}>{formatLabels[format]}</option>)}
            </select>
          </FilterField>
          <FilterField id={fieldId('category')} name="category" icon="school">
            <select {...control('category')}>
              <option value="">All categories</option>
              {draft.category && !categories.some(category => category.slug === draft.category) && (
                <option value={draft.category}>{draft.category}</option>
              )}
              {categories.map(category => (
                <option key={category.id} value={category.slug}>{category.name}</option>
              ))}
            </select>
          </FilterField>
        </div>
        <button type="submit" className={styles.primaryButton}>
          Search events <ReferenceIcon name="arrow_forward" />
        </button>
      </div>

      <div className={styles.filterBar}>
        {activeFilters.length > 0 && <span>Active filters</span>}
        {activeFilters.map(name => {
          const value = filterLabel(name, applied.get(name) ?? '')
          return (
            <button
              key={name}
              type="button"
              className={styles.filterChip}
              aria-label={`Remove ${labels[name]} filter: ${value}`}
              onClick={() => {
                const next = new URLSearchParams(search)
                next.delete(name)
                onApply(next)
              }}
            >
              {labels[name]}: {value} <ReferenceIcon name="close" />
            </button>
          )
        })}
        <button type="reset" className={styles.clearFilters}>Clear filters</button>
      </div>
    </form>
  )
}
