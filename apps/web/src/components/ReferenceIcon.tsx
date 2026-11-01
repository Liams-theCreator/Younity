export default function ReferenceIcon({ name }: { name: string }) {
  return (
    <span className="reference-icon" aria-hidden="true">
      {name}
    </span>
  )
}
