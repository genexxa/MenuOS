export function PortionScaler({
  portions,
  onChange,
}: {
  portions: number
  onChange: (portions: number) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2">
      <span className="text-sm text-neutral-500">Portions</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, portions - 1))}
          className="h-7 w-7 rounded-md border border-neutral-300 text-sm"
          aria-label="Réduire les portions"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-medium">{portions}</span>
        <button
          type="button"
          onClick={() => onChange(portions + 1)}
          className="h-7 w-7 rounded-md border border-neutral-300 text-sm"
          aria-label="Augmenter les portions"
        >
          +
        </button>
      </div>
    </div>
  )
}
