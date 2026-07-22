'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const toggle = () => {
    // Brief opacity fade on the root to smooth the variable swap
    document.documentElement.style.transition = 'opacity 80ms ease-out'
    document.documentElement.style.opacity = '0'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
        document.documentElement.style.opacity = '1'
        setTimeout(() => {
          document.documentElement.style.transition = ''
        }, 80)
      })
    })
  }

  if (!mounted) {
    return <div className="w-8 h-8" />
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      aria-label="Toggle theme"
    >
      <div className="relative flex items-center justify-center w-full h-full">
        <Sun className={`absolute w-[18px] h-[18px] transition-all duration-200 ease-out ${theme === 'dark' ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`} />
        <Moon className={`absolute w-[18px] h-[18px] transition-all duration-200 ease-out ${theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} />
      </div>
    </button>
  )
}
