'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type BBox = [number, number, number, number] // ymin, xmin, ymax, xmax (0-1000)

interface PendingBox {
  bbox: BBox
  px: number
  py: number
  pw: number
  ph: number
}

interface BoxWithClass extends PendingBox {
  class_key: string
  label: string
  color: string
  fcot?: any
}
export default function AnnotationCanvas({ 
  imgSrc, 
  classes, 
  onSave, 
  onSkip,
  initialBoxes,
  imageId,
  onUndo,
  fileName
}: { 
  imgSrc: string
  classes: any[]
  onSave: (boxes: any[]) => void
  onSkip: () => void
  initialBoxes?: any[]
  imageId?: string
  onUndo?: (action: string, data: any) => void
  fileName?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  
  const [boxes, setBoxes] = useState<BoxWithClass[]>([])
  const [past, setPast] = useState<BoxWithClass[][]>([])
  const [future, setFuture] = useState<BoxWithClass[][]>([])
  const [showUnannotateModal, setShowUnannotateModal] = useState(false)
  const [unannotating, setUnannotating] = useState(false)

  const setBoxesWithHistory = (newBoxes: BoxWithClass[] | ((prev: BoxWithClass[]) => BoxWithClass[])) => {
    setBoxes(prevBoxes => {
      const resolved = typeof newBoxes === 'function' ? newBoxes(prevBoxes) : newBoxes
      setPast(p => [...p, prevBoxes])
      setFuture([])
      return resolved
    })
  }
  const [pendingBox, setPendingBox] = useState<PendingBox | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 })
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null)
  
  const [lastClass, setLastClass] = useState<string | null>(null)
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 })
  const hasHydrated = useRef<string | null>(null)

  // Hydrate from initialBoxes
  useEffect(() => {
    if (!initialBoxes || !classes.length || canvasDims.w === 0 || canvasDims.h === 0) return
    if (hasHydrated.current === imageId) return
    
    const H = canvasDims.h
    const W = canvasDims.w

    const hydrated: BoxWithClass[] = initialBoxes.map(ib => {
      const cls = classes.find(c => c.class_key === ib.class_key)
      const py = (ib.ymin / 1000) * H
      const px = (ib.xmin / 1000) * W
      const ph = ((ib.ymax - ib.ymin) / 1000) * H
      const pw = ((ib.xmax - ib.xmin) / 1000) * W
      
      return {
        bbox: [ib.ymin, ib.xmin, ib.ymax, ib.xmax],
        px, py, pw, ph,
        class_key: ib.class_key,
        label: cls?.display_name || ib.class_key,
        color: cls?.color || '#ffffff',
        fcot: ib.fcot || cls?.fcot || {} // hydrate fcot from DB or fallback to current taxonomy class fcot
      }
    })
    setBoxes(hydrated)
    hasHydrated.current = imageId || null
  }, [initialBoxes, classes, canvasDims, imageId])

  // Reset hydration when image changes
  useEffect(() => {
    if (imageId !== hasHydrated.current) {
       hasHydrated.current = null
    }
  }, [imageId])

  // Load image
  useEffect(() => {
    if (!imgSrc || !canvasRef.current || !containerRef.current) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imgSrc
    img.onload = () => {
      // Scale to fit container while maintaining aspect ratio
      const container = containerRef.current!
      const maxWidth = container.clientWidth
      const maxHeight = container.clientHeight
      
      let w = img.width
      let h = img.height
      
      const ratio = Math.min(maxWidth / w, maxHeight / h)
      w = w * ratio
      h = h * ratio
      
      const canvas = canvasRef.current!
      canvas.width = w
      canvas.height = h
      
      imgRef.current = img
      setCanvasDims({ w, h }) // Trigger hydration and redraw
      redraw()
    }
  }, [imgSrc])

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas || !imgRef.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height)
    
    // Draw committed boxes
    boxes.forEach((b, i) => {
      ctx.strokeStyle = b.color
      ctx.lineWidth = i === selectedBoxIndex ? 2.5 : 1.5
      ctx.strokeRect(b.px, b.py, b.pw, b.ph)
      
      if (i === selectedBoxIndex) {
        ctx.fillStyle = b.color + '26' // 15% opacity
        ctx.fillRect(b.px, b.py, b.pw, b.ph)
        // Draw 4 resize handles
        const handles = [
          [b.px, b.py], [b.px + b.pw, b.py], [b.px, b.py + b.ph], [b.px + b.pw, b.py + b.ph]
        ]
        handles.forEach(([hx, hy]) => {
          ctx.fillStyle = b.color
          ctx.strokeStyle = 'var(--bg, #0A0C10)'
          ctx.lineWidth = 1
          ctx.fillRect(hx - 3, hy - 3, 6, 6)
          ctx.strokeRect(hx - 3, hy - 3, 6, 6)
        })
      } else {
        ctx.fillStyle = b.color + '00' // 0% opacity by default
        ctx.fillRect(b.px, b.py, b.pw, b.ph)
      }
      
      // Label
      ctx.font = '600 11px "JetBrains Mono", monospace'
      const tw = ctx.measureText(`#${i+1} ${b.label}`).width
      ctx.fillStyle = 'var(--bg, #0A0C10)'
      ctx.fillRect(b.px, b.py - 18, tw + 8, 18)
      ctx.fillStyle = b.color
      ctx.fillText(`#${i+1} ${b.label}`, b.px + 4, b.py - 5)
    })
    
    // Draw pending box
    if (pendingBox && !pickerOpen) {
       // Wait, pendingBox is already converted to px, py... wait if drawing, we use startPos/currentPos
    }

    if (drawing) {
      const px = Math.min(startPos.x, currentPos.x)
      const py = Math.min(startPos.y, currentPos.y)
      const pw = Math.abs(currentPos.x - startPos.x)
      const ph = Math.abs(currentPos.y - startPos.y)
      
      const col = lastClass ? classes.find(c => c.class_key === lastClass)?.color || '#00e5ff' : '#00e5ff'
      
      ctx.strokeStyle = col
      ctx.lineWidth = 1.5
      ctx.strokeRect(px, py, pw, ph)
      ctx.fillStyle = col + '14' // 8% opacity
      ctx.fillRect(px, py, pw, ph)

      // Live coordinate readout
      ctx.font = '12px "IBM Plex Mono", monospace'
      const txt = `${Math.round(currentPos.x)}, ${Math.round(currentPos.y)}`
      const tw2 = ctx.measureText(txt).width
      ctx.fillStyle = 'var(--bg, rgba(10, 12, 16, 0.85))'
      ctx.fillRect(currentPos.x + 12, currentPos.y + 12, tw2 + 8, 20)
      ctx.fillStyle = 'var(--text-primary, #E6E8F0)'
      ctx.fillText(txt, currentPos.x + 16, currentPos.y + 26)
    }
    
    if (pendingBox && pickerOpen) {
      ctx.strokeStyle = '#ffffffaa'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.strokeRect(pendingBox.px, pendingBox.py, pendingBox.pw, pendingBox.ph)
      ctx.setLineDash([])
    }
  }

  useEffect(() => { redraw() }, [boxes, drawing, currentPos, pendingBox, pickerOpen, selectedBoxIndex])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (pickerOpen) return
    e.preventDefault()
    const r = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top

    // Check if clicking existing box (reverse order to pick top-most)
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i]
      if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph) {
        setSelectedBoxIndex(i)
        return
      }
    }

    setSelectedBoxIndex(null)
    setStartPos({ x: mx, y: my })
    setCurrentPos({ x: mx, y: my })
    setDrawing(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || pickerOpen) return
    e.preventDefault()
    const r = canvasRef.current!.getBoundingClientRect()
    setCurrentPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawing || pickerOpen) return
    e.preventDefault()
    setDrawing(false)
    
    const r = canvasRef.current!.getBoundingClientRect()
    const ex = e.clientX - r.left
    const ey = e.clientY - r.top
    const sx = startPos.x
    const sy = startPos.y
    
    if (Math.abs(ex - sx) < 10 || Math.abs(ey - sy) < 10) return // too small
    
    const H = canvasRef.current!.height
    const W = canvasRef.current!.width
    
    const clamp = (val: number) => Math.max(0, Math.min(1000, val))
    
    const ymin = clamp(Math.round(Math.min(sy, ey) / H * 1000))
    const xmin = clamp(Math.round(Math.min(sx, ex) / W * 1000))
    const ymax = clamp(Math.round(Math.max(sy, ey) / H * 1000))
    const xmax = clamp(Math.round(Math.max(sx, ex) / W * 1000))
    
    const pBox: PendingBox = {
      bbox: [ymin, xmin, ymax, xmax],
      px: Math.min(sx, ex),
      py: Math.min(sy, ey),
      pw: Math.abs(ex - sx),
      ph: Math.abs(ey - sy)
    }
    
    setPendingBox(pBox)
    
    if (e.shiftKey && lastClass) {
      commitBox(pBox, lastClass)
    } else {
      setPickerPos({ x: e.clientX, y: e.clientY })
      setPickerOpen(true)
    }
  }

  const commitBox = (box: PendingBox, classKey: string) => {
    const cls = classes.find(c => c.class_key === classKey)
    if (!cls) return
    setBoxesWithHistory([...boxes, { ...box, class_key: classKey, label: cls.display_name, color: cls.color, fcot: cls.fcot }])
    setLastClass(classKey)
    setPendingBox(null)
    setPickerOpen(false)
  }

  const cancelPicker = () => {
    setPendingBox(null)
    setPickerOpen(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Redo (Ctrl+Shift+Z or Ctrl+Y)
      if ((e.key.toLowerCase() === 'z' && e.shiftKey && (e.ctrlKey || e.metaKey)) || (e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        if (pickerOpen) return
        setFuture(f => {
          if (f.length === 0) return f
          const nextState = f[f.length - 1]
          setBoxes(prev => {
            setPast(p => [...p, prev])
            return nextState
          })
          return f.slice(0, -1)
        })
        return
      }

      // Undo (Ctrl+Z)
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        if (pickerOpen) return
        setPast(p => {
          if (p.length === 0) return p
          const prevState = p[p.length - 1]
          setBoxes(prev => {
            setFuture(fut => [...fut, prev])
            return prevState
          })
          return p.slice(0, -1)
        })
        return
      }
      
      // Delete selected
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedBoxIndex !== null) {
        setBoxesWithHistory(b => b.filter((_, idx) => idx !== selectedBoxIndex))
        setSelectedBoxIndex(null)
        return
      }
      
      if (!pickerOpen) return
      
      if (e.key === 'Escape') {
        cancelPicker()
        return
      }
      
      const matchedCls = classes.find(c => c.shortcut_key === e.key.toLowerCase())
      if (matchedCls && pendingBox) {
        commitBox(pendingBox, matchedCls.class_key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pickerOpen, pendingBox, classes, selectedBoxIndex])

  // Autosave Drafts (Milestone 6)
  const lastSavedStateRef = useRef<string>('')
  const boxesRef = useRef(boxes)
  useEffect(() => { boxesRef.current = boxes }, [boxes])
  
  useEffect(() => {
    if (!imageId) return
    const interval = setInterval(async () => {
      const currentBoxes = boxesRef.current
      // Don't save if it hasn't changed or if empty initially
      if (currentBoxes.length === 0 && !lastSavedStateRef.current) return
      
      const currentState = JSON.stringify(currentBoxes.map(b => ({
        class_key: b.class_key,
        ymin: b.bbox[0],
        xmin: b.bbox[1],
        ymax: b.bbox[2],
        xmax: b.bbox[3],
        fcot: b.fcot
      })))
      
      if (currentState === lastSavedStateRef.current) return
      
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      await supabase.from('drafts').upsert({
        image_id: imageId,
        user_id: user.id,
        draft_state: { boxes: JSON.parse(currentState) },
        updated_at: new Date().toISOString()
      }, { onConflict: 'image_id, user_id' })
      
      lastSavedStateRef.current = currentState
      
    }, 3000)
    
    return () => clearInterval(interval)
  }, [imageId]) // stable — only restarts when the image changes, not on every box draw

  const handleUnannotate = async () => {
    if (!imageId) return
    setUnannotating(true)
    try {
      const res = await fetch('/api/annotations/unannotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowUnannotateModal(false)
      toast.success('Image marked as unannotated.')
      setBoxesWithHistory([]) // clear locally
      if (onUndo) {
        onUndo('deleted', data)
      } else {
        window.location.reload()
      }
    } catch(err: any) {
      toast.error('Unannotate failed: ' + err.message)
    } finally {
      setUnannotating(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-bg">

      {/* Unannotate confirmation modal */}
      {showUnannotateModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-lg p-6 w-[340px] flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col gap-1.5">
              <div className="text-base font-display font-semibold text-text-primary">Unannotate this image?</div>
              <div className="text-sm font-body text-text-secondary leading-relaxed">
                All bounding boxes, scene metadata, and annotation history for this image will be permanently deleted. The image will return to the pending queue.
              </div>
            </div>
            <div className="bg-accent-red/8 border border-accent-red/30 rounded px-3 py-2 text-[12px] font-body text-accent-red">
              This action cannot be undone.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUnannotateModal(false)}
                disabled={unannotating}
                className="h-9 px-4 bg-transparent border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded text-[13px] font-display font-medium transition-all duration-150 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleUnannotate}
                disabled={unannotating}
                className="h-9 px-4 bg-accent-red text-bg hover:bg-accent-red/80 rounded text-[13px] font-display font-medium transition-all duration-150 disabled:opacity-40 flex items-center gap-2"
              >
                {unannotating && <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>}
                {unannotating ? 'Removing...' : 'Yes, unannotate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex px-4 py-2 bg-surface border-b border-border items-center justify-between z-10 gap-4">
        <span className="text-sm font-data font-medium text-text-primary truncate min-w-0 flex-1" title={fileName}>{fileName || 'No image'}</span>
        <div className="flex items-center gap-2 shrink-0">
          {initialBoxes && initialBoxes.length > 0 && (
            <button
              onClick={() => setShowUnannotateModal(true)}
              className="h-9 px-4 flex items-center bg-transparent border border-accent-red/60 text-accent-red rounded text-[13px] font-display font-medium hover:bg-accent-red/10 hover:border-accent-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring transition-all duration-150"
            >
              Unannotate
            </button>
          )}
          <button onClick={onSkip} className="h-9 px-4 flex items-center bg-transparent border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded text-[13px] font-display font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">Skip</button>
          <div className="h-9 flex items-center gap-px">
            <button onClick={() => onSave(boxes)} className="h-9 px-4 flex items-center bg-accent-cyan text-bg border-none hover:bg-accent-cyan-hover rounded-l text-[13px] font-display font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
              Save & Next <span className="ml-2 px-1.5 py-0.5 bg-bg/20 text-bg/90 rounded-[2px] text-[11px] font-data font-semibold">[Enter]</span>
            </button>
            <div className="h-9 px-2.5 flex items-center bg-accent-cyan-hover text-bg rounded-r text-[12px] font-data font-semibold border-l border-bg/20" title="Bounding box count">
              {boxes.length}
            </div>
          </div>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-1 relative overflow-hidden select-none cursor-crosshair flex items-center justify-center p-4 bg-surface-2">
        {imgSrc ? (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="border border-border bg-bg shadow-sm"
          />
        ) : (
          <div className="animate-pulse w-full h-full bg-surface rounded max-w-4xl max-h-[80vh]"></div>
        )}
      </div>

      {pickerOpen && pendingBox && (
        <div 
          className="fixed z-50 bg-surface-2 border border-border-strong rounded-lg p-2 shadow-[0_8px_24px_var(--shadow-color)]"
          style={{ 
            left: Math.min(pickerPos.x + 15, typeof window !== 'undefined' ? window.innerWidth - 320 : 0),
            top: Math.min(pickerPos.y, typeof window !== 'undefined' ? window.innerHeight - (classes.length * 40 + 60) : 0),
            width: 300
          }}
        >
          <div className="text-[11px] font-display font-medium text-text-secondary mb-2 px-2 uppercase tracking-[0.03em]">Select Class</div>
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {classes.map(c => (
              <button
                key={c.class_key}
                onClick={() => commitBox(pendingBox, c.class_key)}
                className={`flex items-center justify-between p-2 rounded hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring ${c.class_key === lastClass ? 'ring-1 ring-accent-cyan bg-surface-hover' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></div>
                  <span className="text-sm font-body text-text-primary">{c.display_name}</span>
                </div>
                {c.shortcut_key && (
                  <span className="text-xs text-text-secondary bg-surface border border-border rounded-sm px-1.5 py-0.5 font-data">
                    {c.shortcut_key.toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border text-center">
            <button onClick={cancelPicker} className="text-xs text-text-tertiary hover:text-text-secondary font-display font-medium">Esc to Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
