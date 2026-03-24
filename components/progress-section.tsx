interface ProgressSectionProps {
  currentValue: number
  maxValue: number
  label: string
}

export function ProgressSection({ currentValue, maxValue, label }: ProgressSectionProps) {
  const percentage = Math.min((currentValue / maxValue) * 100, 100)

  return (
    <div className="bg-card p-8 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground text-center">
        Event Completion
      </h3>
      <div className="w-full bg-secondary h-4 rounded-full overflow-hidden">
        <div
          className="bg-primary h-full transition-all duration-1000"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-center mt-3 text-sm text-muted-foreground font-medium">
        {percentage.toFixed(1)}% {label}
      </p>
    </div>
  )
}
