import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, FolderSync, BrainCircuit, Users, Download, ShieldCheck, BoxSelect } from 'lucide-react'
import TypewriterWord from '@/components/TypewriterWord'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/projects')
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary font-body overflow-x-hidden selection:bg-accent-cyan-muted selection:text-accent-cyan">

      {/* Hero Section */}
      <section className="relative z-0 pt-20 pb-16 px-6 max-w-[1280px] mx-auto flex flex-col items-center text-center">
        
        {/* Hero Foreground Content */}
        <div className="relative z-10 flex flex-col items-center w-full">
          
          {/* Hero Headline Framed in Bounding Box Reticle */}
          <div className="relative p-6 sm:p-8 md:p-10 mb-8 max-w-[1020px] w-full flex items-center justify-center">
            {/* GPU-Accelerated Bounding Box Reticle Animation */}
            <div className="absolute inset-0 border-2 border-dashed border-accent-cyan/60 rounded-xl pointer-events-none animate-pulse bg-accent-cyan/[0.03]">
              {/* Target Corner Bracket Pins */}
              <div className="absolute -top-2.5 -left-2.5 w-5 h-5 border-t-2 border-l-2 border-accent-cyan" />
              <div className="absolute -top-2.5 -right-2.5 w-5 h-5 border-t-2 border-r-2 border-accent-cyan" />
              <div className="absolute -bottom-2.5 -left-2.5 w-5 h-5 border-b-2 border-l-2 border-accent-cyan" />
              <div className="absolute -bottom-2.5 -right-2.5 w-5 h-5 border-b-2 border-r-2 border-accent-cyan" />
              
              {/* Reticle Metadata Badges */}
              <div className="absolute -top-3 left-6 text-[11px] font-data text-accent-cyan font-semibold uppercase tracking-wider bg-surface px-2.5 py-0.5 rounded border border-accent-cyan/40 shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-ping" /> cot_guidelines: active [Chain_Of_Thought]
              </div>
              <div className="absolute -bottom-3 right-6 text-[10px] font-data text-text-tertiary uppercase tracking-wider bg-surface px-2 py-0.5 rounded border border-border hidden sm:block">
                bbox: 0.99 • 100% confidence
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-display font-bold tracking-tight leading-[1.2] text-center py-2 flex flex-col items-center gap-1">
              <TypewriterWord words={['ANNOTATE', 'ANYTATE']} />
              <span>Anything, with FCoT Reasoning.</span>
            </h1>
          </div>
          
          <p className="mb-10 text-base md:text-lg text-text-secondary max-w-[740px] leading-relaxed">
            Enforce step-by-step Chain-of-Thought guidelines, eliminate labeling ambiguities, and accelerate dataset creation. Sync directly with Google Drive and export ready-to-train datasets in YOLO, COCO, or JSON formats.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link 
              href="/login" 
              className="h-11 flex items-center gap-2 px-8 bg-accent-cyan text-bg rounded text-base font-display font-semibold hover:bg-accent-cyan-hover transition-colors duration-150 ease-out active:scale-[0.98]"
            >
              Get Started Free <ArrowRight size={18} strokeWidth={2} />
            </Link>
            <a 
              href="#features" 
              className="h-11 flex items-center px-8 bg-surface border border-border text-text-primary rounded text-base font-display font-medium hover:bg-surface-hover hover:border-accent-cyan transition-colors duration-150 ease-out"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-surface-2 border-y border-border">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">Built for Serious Workflows</h2>
            <p className="text-text-secondary max-w-[600px] mx-auto">Everything you need to manage annotation teams and produce high-quality datasets rapidly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-surface border border-border p-8 rounded-lg hover:border-accent-cyan transition-colors duration-150 ease-out group">
              <div className="w-12 h-12 rounded-lg bg-accent-cyan-muted flex items-center justify-center mb-6">
                <FolderSync size={24} className="text-accent-cyan" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Google Drive Sync</h3>
              <p className="text-text-secondary leading-relaxed">
                No more zipping and uploading thousands of images. Point AnyTate at a Drive folder and it seamlessly streams images directly to your canvas.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-surface border border-border p-8 rounded-lg hover:border-accent-magenta transition-colors duration-150 ease-out group">
              <div className="w-12 h-12 rounded-lg bg-accent-magenta/10 flex items-center justify-center mb-6">
                <BrainCircuit size={24} className="text-accent-magenta" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Classes &amp; CoTs</h3>
              <p className="text-text-secondary leading-relaxed">
                Guide your annotators with Few-Shot Chain-of-Thought reasoning. Attach strict guidelines and rules to every bounding box class to guarantee consistency.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-surface border border-border p-8 rounded-lg hover:border-accent-amber transition-colors duration-150 ease-out group">
              <div className="w-12 h-12 rounded-lg bg-accent-amber/10 flex items-center justify-center mb-6">
                <Users size={24} className="text-accent-amber" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Team Collaboration</h3>
              <p className="text-text-secondary leading-relaxed">
                Invite team members as Annotators, Reviewers, or Owners. Track everyone's progress and activity from a centralized dashboard.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-surface border border-border p-8 rounded-lg hover:border-accent-green transition-colors duration-150 ease-out group">
              <div className="w-12 h-12 rounded-lg bg-accent-green/10 flex items-center justify-center mb-6">
                <ShieldCheck size={24} className="text-accent-green" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Review Queue QA</h3>
              <p className="text-text-secondary leading-relaxed">
                Annotators submit images to a dedicated Review Queue. Reviewers can approve images or flag them with specific feedback for revision.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-surface border border-border p-8 rounded-lg hover:border-text-primary transition-colors duration-150 ease-out group">
              <div className="w-12 h-12 rounded-lg bg-surface-hover flex items-center justify-center mb-6">
                <BoxSelect size={24} className="text-text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Image Tags</h3>
              <p className="text-text-secondary leading-relaxed">
                Apply global metadata to images (like lighting conditions or weather). Build rich, multi-modal datasets without complex forms.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-surface border border-border p-8 rounded-lg hover:border-accent-cyan transition-colors duration-150 ease-out group">
              <div className="w-12 h-12 rounded-lg bg-accent-cyan-muted flex items-center justify-center mb-6">
                <Download size={24} className="text-accent-cyan" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Universal Exports</h3>
              <p className="text-text-secondary leading-relaxed">
                Export your finalized dataset directly to YOLO, COCO, or native AnyTate JSON formats. Coordinates are perfectly scaled and ready for ML training.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-magenta/10 rounded-full blur-[100px] -z-10"></div>
        <div className="max-w-[800px] mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-display font-bold">Ready to streamline your annotation pipeline?</h2>
          <p className="text-text-secondary text-lg">Join teams building the next generation of computer vision models with AnyTate's intelligent platform.</p>
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent-cyan text-bg rounded text-lg font-display font-semibold hover:bg-accent-cyan-hover transition-colors duration-150 ease-out active:scale-[0.98]"
          >
            Create Your First Project <ArrowRight size={20} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-12 px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center">
              <BoxSelect size={12} className="text-white" strokeWidth={2} />
            </div>
            <span className="font-display font-semibold tracking-tight">AnyTate</span>
          </div>
          <p className="text-sm font-data text-text-tertiary">
            © {new Date().getFullYear()} AnyTate. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
