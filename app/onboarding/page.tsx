'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowRight, User, Image as ImageIcon, Users, Rocket } from 'lucide-react'
import { toast } from 'sonner'

const STEPS = [
  {
    title: "Welcome to Anytate",
    description: "Your team's fast, flexible workspace for annotating images and managing computer vision datasets.",
    icon: <Rocket className="w-12 h-12 text-accent-cyan" />,
    content: "Anytate is designed to be ridiculously fast. It syncs directly with your Google Drive, meaning you don't have to upload massive datasets—just point and annotate."
  },
  {
    title: "How it Works",
    description: "A seamless workflow from raw images to approved datasets.",
    icon: <ImageIcon className="w-12 h-12 text-accent-cyan" />,
    content: (
      <ul className="text-sm text-text-secondary space-y-3 mt-4 text-left">
        <li className="flex gap-3"><Check size={18} className="text-accent-green shrink-0 mt-0.5"/> Annotate images using an intuitive bounding box editor.</li>
        <li className="flex gap-3"><Check size={18} className="text-accent-green shrink-0 mt-0.5"/> Drafts are auto-saved locally and to the cloud so you never lose work.</li>
        <li className="flex gap-3"><Check size={18} className="text-accent-green shrink-0 mt-0.5"/> Finished images go straight to a Review Queue for quality control.</li>
      </ul>
    )
  },
  {
    title: "Collaborate Seamlessly",
    description: "Work with your team or fly solo.",
    icon: <Users className="w-12 h-12 text-accent-cyan" />,
    content: (
      <ul className="text-sm text-text-secondary space-y-3 mt-4 text-left">
        <li className="flex gap-3"><span className="w-2 h-2 rounded-full bg-accent-cyan mt-1.5 shrink-0" /> <b>Role-based Access:</b> Invite members as Annotators or Reviewers.</li>
        <li className="flex gap-3"><span className="w-2 h-2 rounded-full bg-accent-cyan mt-1.5 shrink-0" /> <b>Solo Mode:</b> Working alone? Enable Solo Mode to bypass the review queue and instantly approve your work.</li>
      </ul>
    )
  },
  {
    title: "Claim your Username",
    description: "Set up a unique handle so your team knows who you are.",
    icon: <User className="w-12 h-12 text-accent-cyan" />,
    content: "Almost done! Let's get you set up."
  }
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    }
  }

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const regex = /^[a-zA-Z0-9_]{3,20}$/
    if (!regex.test(username)) {
      toast.error('Username must be 3-20 characters long and contain only letters, numbers, and underscores.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save username')
      
      toast.success("Welcome aboard!")
      // Drop them into the projects page with a special query param so we can highlight the "New Project" button
      router.push('/projects?onboarded=true')
    } catch (err: any) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  const currentStep = STEPS[step]

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      {/* Progress Dots */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div 
            key={i} 
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === step ? 'bg-accent-cyan scale-125' : i < step ? 'bg-accent-cyan/50' : 'bg-surface-2 border border-border'}`} 
          />
        ))}
      </div>

      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden relative">
        <div className="p-8 flex flex-col items-center text-center">
          
          <div className="mb-6 p-4 rounded-2xl bg-surface-2 border border-border inline-flex shadow-inner">
            {currentStep.icon}
          </div>
          
          <h1 className="text-2xl font-display font-semibold text-text-primary mb-2">
            {currentStep.title}
          </h1>
          <p className="text-sm text-text-secondary font-body mb-6">
            {currentStep.description}
          </p>

          <div className="w-full min-h-[120px] flex flex-col justify-center font-body text-text-primary text-sm leading-relaxed bg-surface-2/50 rounded-lg p-5 border border-border/50">
            {step === STEPS.length - 1 ? (
              <form onSubmit={handleFinish} className="w-full">
                <div className="relative flex items-center mb-4">
                  <span className="absolute left-3 text-text-tertiary font-display font-bold">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="w-full bg-surface border border-border rounded-lg py-2.5 pl-8 pr-4 text-sm font-data text-text-primary focus:border-accent-cyan outline-none transition-colors"
                    maxLength={20}
                    autoFocus
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={saving || username.length < 3}
                  className="w-full py-2.5 bg-accent-cyan text-bg font-display font-semibold text-sm rounded-lg hover:bg-accent-cyan-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? 'Setting up...' : "Let's Go!"}
                  {!saving && <ArrowRight size={16} />}
                </button>
              </form>
            ) : (
              <div>{currentStep.content}</div>
            )}
          </div>
          
        </div>

        {/* Footer actions for non-final steps */}
        {step < STEPS.length - 1 && (
          <div className="px-8 py-4 bg-surface-2 border-t border-border flex justify-end">
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-accent-cyan text-bg font-display font-semibold text-sm rounded-md hover:bg-accent-cyan-hover transition-colors flex items-center gap-2"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
