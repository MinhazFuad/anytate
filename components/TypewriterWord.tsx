'use client'

import { useState, useEffect } from 'react'

interface TypewriterWordProps {
  words?: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  className?: string
}

export default function TypewriterWord({
  words = ['ANNOTATE', 'ANYTATE'],
  typingSpeed = 130,
  deletingSpeed = 70,
  pauseDuration = 2000,
  className = ''
}: TypewriterWordProps) {
  const [index, setIndex] = useState(0)
  const [subIndex, setSubIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [blink, setBlink] = useState(true)

  // Cursor blinking effect
  useEffect(() => {
    const timeout = setInterval(() => {
      setBlink((prev) => !prev)
    }, 450)
    return () => clearInterval(timeout)
  }, [])

  // Typewriter typing / erasing logic
  useEffect(() => {
    if (!words || words.length === 0) return

    const currentWord = words[index]

    if (!isDeleting && subIndex === currentWord.length) {
      const timeout = setTimeout(() => {
        setIsDeleting(true)
      }, pauseDuration)
      return () => clearTimeout(timeout)
    }

    if (isDeleting && subIndex === 0) {
      setIsDeleting(false)
      setIndex((prev) => (prev + 1) % words.length)
      return
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1))
    }, isDeleting ? deletingSpeed : typingSpeed)

    return () => clearTimeout(timeout)
  }, [subIndex, index, isDeleting, words, typingSpeed, deletingSpeed, pauseDuration])

  const currentWord = words[index] || ''
  const displayedText = currentWord.substring(0, subIndex)

  return (
    <span className={`inline-flex items-baseline align-baseline min-h-[1em] ${className}`}>
      <span className="text-accent-cyan py-0.5 leading-normal">
        {displayedText || '\u00A0'}
      </span>
      <span 
        className={`ml-[3px] inline-block w-[3px] h-[0.75em] bg-accent-cyan rounded-full transition-opacity duration-150 ${blink ? 'opacity-100' : 'opacity-0'}`} 
      />
    </span>
  )
}
