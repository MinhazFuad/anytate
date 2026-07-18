import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, BoxSelect, FolderSync, BrainCircuit, Users, Download, ShieldCheck } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/projects')
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary font-body overflow-x-hidden selection:bg-accent-cyan-muted selection:text-accent-cyan">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center">
              <BoxSelect size={18} className="text-white" strokeWidth={2} />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">AnyTate</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link 
              href="/login" 
              className="px-5 py-2 text-sm font-display font-medium text-text-primary hover:text-accent-cyan transition-colors"
            >
              Log in
            </Link>
            <Link 
              href="/login" 
              className="px-5 py-2 text-sm font-display font-medium bg-text-primary text-bg rounded-full hover:bg-text-secondary transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 max-w-[1280px] mx-auto flex flex-col items-center text-center">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-cyan-muted rounded-full blur-[120px] -z-10 opacity-50"></div>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs font-display font-medium text-text-secondary mb-8">
          <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></span>
          Now supporting automatic Google Drive Sync
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight max-w-[900px] leading-[1.1] mb-6">
          Intelligent Image Annotation, <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">Without the Hassle.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-text-secondary max-w-[700px] mb-10 leading-relaxed">
          AnyTate syncs directly with your Google Drive, enforces taxonomy guidelines with Chain-of-Thought reasoning, and natively exports to JSON, YOLO, and COCO formats.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link 
            href="/login" 
            className="flex items-center gap-2 px-8 py-4 bg-accent-cyan text-bg rounded-full text-base font-display font-semibold hover:bg-accent-cyan-hover transition-transform hover:scale-105 active:scale-95"
          >
            Get Started Free <ArrowRight size={18} strokeWidth={2} />
          </Link>
          <a 
            href="#features" 
            className="px-8 py-4 bg-surface border border-border text-text-primary rounded-full text-base font-display font-medium hover:bg-surface-hover transition-colors"
          >
            Explore Features
          </a>
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
            <div className="bg-surface border border-border p-8 rounded-2xl hover:border-accent-cyan transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-accent-cyan-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FolderSync size={24} className="text-accent-cyan" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Google Drive Sync</h3>
              <p className="text-text-secondary leading-relaxed">
                No more zipping and uploading thousands of images. Point AnyTate at a Drive folder and it seamlessly streams images directly to your canvas.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-surface border border-border p-8 rounded-2xl hover:border-accent-magenta transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-accent-magenta/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BrainCircuit size={24} className="text-accent-magenta" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Classes &amp; CoTs</h3>
              <p className="text-text-secondary leading-relaxed">
                Guide your annotators with Few-Shot Chain-of-Thought reasoning. Attach strict guidelines and rules to every bounding box class to guarantee consistency.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-surface border border-border p-8 rounded-2xl hover:border-accent-amber transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-accent-amber/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={24} className="text-accent-amber" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Team Collaboration</h3>
              <p className="text-text-secondary leading-relaxed">
                Invite team members as Annotators, Reviewers, or Owners. Track everyone's progress and activity from a centralized dashboard.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-surface border border-border p-8 rounded-2xl hover:border-accent-green transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-accent-green/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={24} className="text-accent-green" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Review Queue QA</h3>
              <p className="text-text-secondary leading-relaxed">
                Annotators submit images to a dedicated Review Queue. Reviewers can approve images or flag them with specific feedback for revision.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-surface border border-border p-8 rounded-2xl hover:border-text-primary transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BoxSelect size={24} className="text-text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">Image Tags</h3>
              <p className="text-text-secondary leading-relaxed">
                Apply global metadata to images (like lighting conditions or weather). Build rich, multi-modal datasets without complex forms.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-surface border border-border p-8 rounded-2xl hover:border-accent-cyan transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-accent-cyan-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
            className="inline-flex items-center gap-2 px-8 py-4 bg-text-primary text-bg rounded-full text-lg font-display font-semibold hover:bg-text-secondary transition-transform hover:scale-105"
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
