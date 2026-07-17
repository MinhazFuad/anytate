import ThemeToggle from '@/components/ThemeToggle'

export default function ThemeStyleGuide() {
  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-body">
      <div className="max-w-[1280px] mx-auto space-y-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold mb-2">Style Guide & Tokens</h1>
            <p className="text-sm text-text-secondary font-display">Anytate UI Component Library</p>
          </div>
          <ThemeToggle />
        </div>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-medium border-b border-border pb-2">1. Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: '--bg', bg: 'bg-bg' },
              { name: '--surface', bg: 'bg-surface' },
              { name: '--surface-2', bg: 'bg-surface-2' },
              { name: '--surface-hover', bg: 'bg-surface-hover' },
              { name: '--border', bg: 'bg-border' },
              { name: '--border-strong', bg: 'bg-border-strong' },
              { name: '--accent-cyan', bg: 'bg-accent-cyan' },
              { name: '--accent-cyan-hover', bg: 'bg-accent-cyan-hover' },
              { name: '--accent-cyan-muted', bg: 'bg-accent-cyan-muted' },
              { name: '--accent-magenta', bg: 'bg-accent-magenta' },
              { name: '--accent-amber', bg: 'bg-accent-amber' },
              { name: '--accent-green', bg: 'bg-accent-green' },
              { name: '--accent-red', bg: 'bg-accent-red' },
            ].map((token) => (
              <div key={token.name} className="flex flex-col gap-2 p-3 bg-surface border border-border rounded-lg">
                <div className={`w-full h-12 rounded border border-border ${token.bg}`}></div>
                <div className="text-[11px] font-data font-medium text-text-primary text-center">{token.name}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-medium border-b border-border pb-2">2. Typography</h2>
          <div className="space-y-4 bg-surface border border-border rounded-lg p-6">
            <div className="space-y-1">
              <div className="font-display font-semibold text-2xl">Display / Chrome (JetBrains Mono)</div>
              <div className="text-sm text-text-secondary font-display">Used for page titles, buttons, headers. (e.g. Page Title)</div>
            </div>
            <div className="space-y-1">
              <div className="font-body text-base">Body (Inter)</div>
              <div className="text-sm text-text-secondary font-body">Used for paragraph text, tooltips. (e.g. The quick brown fox jumps over the lazy dog.)</div>
            </div>
            <div className="space-y-1">
              <div className="font-data text-sm">Data / Utility (IBM Plex Mono)</div>
              <div className="text-[11px] text-text-secondary font-data">Used for numbers, coordinates, timestamps. (e.g. 104, 305)</div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-medium border-b border-border pb-2">4. Buttons</h2>
          <div className="flex flex-wrap gap-4 items-center bg-surface border border-border rounded-lg p-6">
            <button className="px-6 py-2.5 bg-accent-cyan hover:bg-accent-cyan-hover text-bg font-display font-medium rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
              Primary Button <span className="ml-2 px-1.5 py-0.5 bg-bg/20 text-bg/90 rounded-[2px] text-[11px] font-data font-semibold">[Enter]</span>
            </button>
            <button className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover hover:border-accent-cyan text-text-primary font-display font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
              Secondary Button
            </button>
            <button className="px-6 py-2.5 bg-transparent border border-accent-red text-accent-red hover:bg-accent-red/10 font-display font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
              Destructive
            </button>
            <button className="px-6 py-2.5 bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary font-display font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
              Ghost Button
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-medium border-b border-border pb-2">5. Form Inputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface border border-border rounded-lg p-6">
            <div className="space-y-2">
              <label className="text-[11px] text-text-secondary font-display font-medium uppercase tracking-[0.03em]">Text Input</label>
              <input type="text" placeholder="Placeholder text..." className="w-full bg-surface-2 border border-border rounded-md px-4 py-2 text-sm font-body text-text-primary placeholder:text-text-tertiary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] text-text-secondary font-display font-medium uppercase tracking-[0.03em]">Textarea</label>
              <textarea placeholder="Reasoning text..." className="w-full h-24 bg-surface-2 border border-border rounded-md px-4 py-3 text-[14px] leading-[1.6] font-body text-text-primary placeholder:text-text-tertiary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring" />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-medium border-b border-border pb-2">6. Badges & Status Pills</h2>
          <div className="flex flex-wrap gap-4 items-center bg-surface border border-border rounded-lg p-6">
            <span className="px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-[0.03em] bg-accent-amber/15 text-accent-amber rounded-full">Pending Review</span>
            <span className="px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-[0.03em] bg-accent-green/15 text-accent-green rounded-full">Approved</span>
            <span className="px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-[0.03em] bg-accent-magenta/15 text-accent-magenta rounded-full">Flagged</span>
            <span className="px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-[0.03em] bg-transparent border border-dashed border-border-strong text-text-tertiary rounded-full">Draft (Unsaved)</span>
            <span className="px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-[0.03em] bg-[#E8670C]/15 text-[#E8670C] rounded-full">Traffic Cone</span>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-medium border-b border-border pb-2">8. Cards & Elevation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface border border-border p-6 rounded-lg text-sm">
              Standard Card (No shadow, 1px border)
            </div>
            <div className="bg-surface-2 border border-border-strong p-6 rounded-lg text-sm shadow-[0_8px_24px_var(--shadow-color)] relative z-10">
              Popover/Dropdown (Shadow, strong border)
            </div>
            <div className="bg-surface-2 border border-border-strong p-6 rounded-[12px] text-sm shadow-[0_16px_48px_var(--shadow-color)] relative z-20">
              Modal (Larger shadow, 12px radius)
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
