import type { ReactNode } from "react"

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  subtext: string
}

export function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border hover:shadow-md transition">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-secondary rounded-xl">{icon}</div>
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-4xl font-bold text-foreground mb-1">{value}</div>
      <div className="text-xs text-muted-foreground font-medium">{subtext}</div>
    </div>
  )
}
