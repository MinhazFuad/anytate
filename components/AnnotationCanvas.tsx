'use client'

import { useEffect, useRef, useState } from 'react'

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
}

export default function AnnotationCanvas({ 
  imgSrc, 
  classes, 
  onSave, 
  onSkip
}: { 
  imgSrc: string
  classes: any[]
  onSave: (boxes: any[]) => void
  onSkip: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  
  const [boxes, setBoxes] = useState<BoxWithClass[]>([])
  const [pendingBox, setPendingBox] = useState<PendingBox | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 })
  
  const [lastClass, setLastClass] = useState<string | null>(null)

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
      ctx.lineWidth = 2
      ctx.strokeRect(b.px, b.py, b.pw, b.ph)
      ctx.fillStyle = b.color + '1f'
      ctx.fillRect(b.px, b.py, b.pw, b.ph)
      
      // Label
      ctx.font = 'bold 13px sans-serif'
      const tw = ctx.measureText(`#${i+1} ${b.label}`).width
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.fillRect(b.px, b.py - 16, tw + 8, 21)
      ctx.fillStyle = b.color
      ctx.fillText(`#${i+1} ${b.label}`, b.px + 4, b.py + 3)
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
      ctx.lineWidth = 2
      ctx.strokeRect(px, py, pw, ph)
      ctx.fillStyle = col + '1a'
      ctx.fillRect(px, py, pw, ph)
    }
    
    if (pendingBox && pickerOpen) {
      ctx.strokeStyle = '#ffffffaa'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.strokeRect(pendingBox.px, pendingBox.py, pendingBox.pw, pendingBox.ph)
      ctx.setLineDash([])
    }
  }

  useEffect(() => { redraw() }, [boxes, drawing, currentPos, pendingBox, pickerOpen])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (pickerOpen) return
    e.preventDefault()
    const r = canvasRef.current!.getBoundingClientRect()
    setStartPos({ x: e.clientX - r.left, y: e.clientY - r.top })
    setCurrentPos({ x: e.clientX - r.left, y: e.clientY - r.top })
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
    
    const ymin = Math.round(Math.min(sy, ey) / H * 1000)
    const xmin = Math.round(Math.min(sx, ex) / W * 1000)
    const ymax = Math.round(Math.max(sy, ey) / H * 1000)
    const xmax = Math.round(Math.max(sx, ex) / W * 1000)
    
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
    setBoxes([...boxes, { ...box, class_key: classKey, label: cls.display_name, color: cls.color }])
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
      // Undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (pickerOpen) return
        setBoxes(b => b.slice(0, -1))
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
  }, [pickerOpen, pendingBox, classes])

  return (
    <div className="relative flex h-full w-full flex-col bg-zinc-950">
      <div className="flex p-4 bg-zinc-900 border-b border-white/10 items-center justify-between z-10">
        <div className="text-sm font-semibold">Annotations: {boxes.length}</div>
        <div className="flex gap-4">
          <button onClick={() => onSave(boxes)} className="px-4 py-2 bg-accent text-background rounded font-semibold hover:opacity-90">Save Image</button>
          <button onClick={onSkip} className="px-4 py-2 bg-white/10 text-white rounded font-semibold hover:bg-white/20">Skip Image</button>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-1 relative overflow-hidden select-none cursor-crosshair flex items-center justify-center p-8">
        {imgSrc ? (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="shadow-2xl"
          />
        ) : (
          <div className="animate-pulse w-full h-full bg-white/5 rounded-xl"></div>
        )}
      </div>

      {pickerOpen && pendingBox && (
        <div 
          className="absolute z-50 bg-surface border border-white/20 rounded-xl p-2 shadow-2xl backdrop-blur-xl"
          style={{ 
            left: Math.min(pickerPos.x + 15, typeof window !== 'undefined' ? window.innerWidth - 320 : 0),
            top: Math.min(pickerPos.y, typeof window !== 'undefined' ? window.innerHeight - (classes.length * 40 + 60) : 0),
            width: 300
          }}
        >
          <div className="text-xs font-semibold text-muted mb-2 px-2 uppercase">Select Class</div>
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {classes.map(c => (
              <button
                key={c.class_key}
                onClick={() => commitBox(pendingBox, c.class_key)}
                className={`flex items-center justify-between p-2 rounded hover:bg-white/10 transition-colors ${c.class_key === lastClass ? 'bg-white/5' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></div>
                  <span className="text-sm">{c.display_name}</span>
                </div>
                {c.shortcut_key && (
                  <span className="text-xs text-muted border border-white/10 rounded px-1.5 py-0.5 bg-background font-mono">
                    {c.shortcut_key.toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-center">
            <button onClick={cancelPicker} className="text-xs text-muted hover:text-white">Esc to Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
