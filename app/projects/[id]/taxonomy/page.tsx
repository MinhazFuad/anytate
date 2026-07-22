'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'

type FCOT = {
  "Primary Cue": string;
  "Observation": string;
  "Contrastive Rules": string[];
  "Static-Frame Disambiguation": string;
  "Decision Rule": string;
  "Fallback Rule": string;
  "Failure Mode": string;
  "Instance Note": string;
  "Conclusion": string;
}

type ClassData = {
  id?: string;
  class_key: string;
  display_name: string;
  color: string;
  shortcut_key: string;
  fcot: FCOT;
}

const emptyFcot: FCOT = {
  "Primary Cue": "",
  "Observation": "",
  "Contrastive Rules": [""],
  "Static-Frame Disambiguation": "",
  "Decision Rule": "",
  "Fallback Rule": "",
  "Failure Mode": "",
  "Instance Note": "",
  "Conclusion": ""
}

export default function TaxonomyBuilderPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [classes, setClasses] = useState<ClassData[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [jsonInput, setJsonInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState<number | null>(null)
  const [versionName, setVersionName] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [allVersions, setAllVersions] = useState<any[]>([])
  const [role, setRole] = useState<string>('annotator')

  useEffect(() => {
    async function loadTaxonomy() {
      // Fetch role
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', user.id).single()
        if (member) setRole(member.role)
      }

      // Fetch all versions
      const { data: allV } = await supabase
        .from('taxonomy_versions')
        .select('id, version_number, is_active')
        .eq('project_id', id)
        .order('version_number', { ascending: false })
      
      if (allV) setAllVersions(allV)

      // Get active taxonomy version for this project
      const activeV = allV?.find(v => v.is_active)
        
      if (activeV) {
        setVersion(activeV.version_number)
        const { data: cData } = await supabase
          .from('taxonomy_classes')
          .select('*')
          .eq('taxonomy_version_id', activeV.id)
          .order('sort_order')
          
        if (cData) setClasses(cData as ClassData[])
      } else {
        setVersion(0)
      }
      setLoading(false)
    }
    loadTaxonomy()
  }, [id, supabase])

  const setActiveVersion = async (versionId: string) => {
    setLoading(true)
    await supabase.from('taxonomy_versions').update({ is_active: false }).eq('project_id', id)
    await supabase.from('taxonomy_versions').update({ is_active: true }).eq('id', versionId)
    window.location.reload()
  }

  const addClass = () => {
    setClasses([...classes, {
      class_key: `class_${classes.length + 1}`,
      display_name: `New Class ${classes.length + 1}`,
      color: '#00e5ff',
      shortcut_key: String((classes.length + 1) % 10), // 1-9, then 0
      fcot: { ...emptyFcot }
    }])
  }

  const removeClass = (index: number) => {
    setClasses(classes.filter((_, i) => i !== index))
  }

  const updateClass = (index: number, field: string, value: any) => {
    const newClasses = [...classes]
    newClasses[index] = { ...newClasses[index], [field]: value }
    setClasses(newClasses)
  }

  const updateFcot = (index: number, field: keyof FCOT, value: any) => {
    const newClasses = [...classes]
    newClasses[index] = { 
      ...newClasses[index], 
      fcot: { ...newClasses[index].fcot, [field]: value } 
    }
    setClasses(newClasses)
  }

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      const importedClasses: ClassData[] = []
      
      // Assume notebook TAXONOMY format: { "class_key": { "display": "...", "fcot": { ... } } }
      let i = 0
      for (const [key, value] of Object.entries(parsed)) {
        const val = value as any
        importedClasses.push({
          class_key: key,
          display_name: val.display || val.display_name || key,
          color: val.color || '#00e5ff',
          shortcut_key: val.shortcut_key || String((i + 1) % 10),
          fcot: val.fcot || { ...emptyFcot }
        })
        i++
      }
      
      setClasses(importedClasses)
      setMode('form')
    } catch(e: any) {
      toast.error("Invalid JSON: " + e.message)
    }
  }

  const handleSave = async () => {
    if (classes.length === 0) {
       toast.error("You must create at least one class before saving.")
       return
    }
    setSaving(true)
    try {
      // 1. Create a new taxonomy version
      const newVersionNum = (version || 0) + 1
      const { data: newVersion, error: vErr } = await supabase
        .from('taxonomy_versions')
        .insert({
          project_id: id,
          version_number: newVersionNum,
          is_active: true
        })
        .select()
        .single()
        
      if (vErr) throw vErr

      // 2. Insert new classes
      if (classes.length > 0) {
        const insertData = classes.map((c, i) => ({
          taxonomy_version_id: newVersion.id,
          class_key: c.class_key,
          display_name: c.display_name,
          color: c.color,
          shortcut_key: c.shortcut_key,
          fcot: c.fcot,
          sort_order: i
        }))
        
        const { error: cErr } = await supabase.from('taxonomy_classes').insert(insertData)
        if (cErr) throw cErr
      }

      // 3. Mark old versions inactive
      await supabase
        .from('taxonomy_versions')
        .update({ is_active: false })
        .eq('project_id', id)
        .neq('id', newVersion.id)
        
      toast.success(`Classes & CoTs version ${newVersionNum} saved successfully!`)
      if (version === 0) {
        router.push(`/projects/${id}/dashboard`)
      } else {
        window.location.reload()
      }
    } catch (e: any) {
      toast.error("Error saving: " + e.message)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-body animate-in fade-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan mb-4" />
        <div className="text-text-primary font-display font-medium text-lg">Loading Classes & CoTs...</div>
        <div className="text-text-secondary text-sm mt-2 max-w-[300px] text-center">
          Fetching schema versions...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-body">
      <div className="max-w-[1280px] mx-auto space-y-8">
        
        <div className="flex items-center justify-between mb-4">
           {version === 0 ? (
              <div className="text-text-secondary text-sm font-display font-medium">
                 Please create your initial Classes & CoTs.
              </div>
           ) : (
              <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
                 <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
              </Link>
           )}
           <ThemeToggle />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">Classes & CoTs Builder</h1>
            <div className="flex items-center gap-2 mt-1">
               <p className="text-sm text-text-secondary font-display">Active Version:</p>
               <select 
                 className="bg-surface border border-border rounded-md px-2 py-1 text-sm text-text-primary focus:border-accent-cyan outline-none"
                 value={allVersions.find(v => v.is_active)?.id || ''}
                 onChange={(e) => setActiveVersion(e.target.value)}
               >
                 <option value="" disabled>Select Version</option>
                 {allVersions.map(v => (
                   <option key={v.id} value={v.id}>v{v.version_number}</option>
                 ))}
               </select>
            </div>
          </div>
          
          {role === 'owner' && (
            <div className="flex items-center gap-4">
              <button 
                 onClick={() => setMode(mode === 'form' ? 'json' : 'form')}
                 className="h-9 px-4 bg-transparent border border-border rounded text-text-primary text-sm font-display font-medium hover:bg-surface-hover hover:border-accent-cyan transition-all duration-150 ease-out active:scale-[0.98]"
              >
                 {mode === 'form' ? 'Switch to JSON Import' : 'Switch to Form Builder'}
              </button>
              <input 
                type="text"
                value={versionName}
                onChange={e => setVersionName(e.target.value)}
                placeholder={`Version ${(version || 0) + 1} Name`}
                className="h-9 bg-surface border border-border rounded px-4 text-sm font-body text-text-primary placeholder:text-text-tertiary focus:border-accent-cyan focus:outline-none transition-colors duration-150 ease-out"
              />
              <button 
                onClick={mode === 'json' ? handleJsonImport : handleSave}
                disabled={saving || (mode === 'form' && classes.length === 0)}
                className="h-9 px-6 bg-accent-cyan text-bg font-display font-medium rounded hover:bg-accent-cyan-hover disabled:bg-surface-2 disabled:text-text-tertiary transition-all duration-150 ease-out active:scale-[0.98] disabled:active:scale-100"
              >
                {saving ? 'Saving...' : mode === 'json' ? 'Validate & Import JSON' : 'Publish New Version'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg p-6">
          <p className="text-sm text-text-secondary mb-6 font-body">
            Define your FCOT (Full Chain of Thought) schema here. When you publish, a new version is created. Existing annotations will retain their original version.
          </p>

          {mode === 'json' ? (
             <div className="space-y-4">
               <textarea 
                 className="w-full h-96 bg-surface-2 border border-border-strong rounded-md p-4 font-data text-sm text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring"
                 placeholder={'{\n  "plastic_bottle": {\n    "display": "🥤 Plastic Bottle",\n    "fcot": { ... }\n  }\n}'}
                 value={jsonInput}
                 onChange={e => setJsonInput(e.target.value)}
               />
               <button onClick={handleJsonImport} className="px-4 py-2 bg-transparent border border-border hover:bg-surface-hover text-text-primary font-display font-medium rounded-md">
                 Validate & Import JSON
               </button>
             </div>
          ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
               {classes.map((cls, i) => (
                 <div key={i} className="border border-border rounded-lg bg-surface overflow-hidden">
                   <div className="p-4 bg-surface-2 flex items-center justify-between border-b border-border">
                     <div className="flex items-center gap-4">
                       <input 
                         type="text" 
                         value={cls.display_name} 
                         onChange={e => updateClass(i, 'display_name', e.target.value)}
                         disabled={role !== 'owner'}
                         className="bg-surface border border-border rounded-md p-2 font-display font-medium text-base text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring flex-1 disabled:opacity-50"
                         placeholder="Display Name"
                       />
                       <input 
                         type="color" 
                         value={cls.color} 
                         onChange={e => updateClass(i, 'color', e.target.value)}
                         disabled={role !== 'owner'}
                         className="w-8 h-8 rounded-sm cursor-pointer border-0 p-0 disabled:opacity-50"
                       />
                     </div>
                     {role === 'owner' && (
                       <button onClick={() => removeClass(i)} className="text-accent-red hover:bg-accent-red/10 px-3 py-1.5 rounded-md font-display font-medium text-sm transition-all duration-150 ease-out">
                         Remove Class
                       </button>
                     )}
                   </div>
                   
                   <div className="p-4 grid grid-cols-2 gap-4">
                     <div className="col-span-1 space-y-2">
                       <label className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em]">Class Key (Internal)</label>
                       <input 
                         type="text" 
                         value={cls.class_key} 
                         onChange={e => updateClass(i, 'class_key', e.target.value)}
                         disabled={role !== 'owner'}
                         className="w-full bg-surface-2 border border-border rounded-md p-2 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                       />
                     </div>
                     <div className="col-span-1 space-y-2">
                       <label className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em]">Shortcut Key</label>
                       <input 
                         type="text" 
                         value={cls.shortcut_key} 
                         onChange={e => updateClass(i, 'shortcut_key', e.target.value)}
                         disabled={role !== 'owner'}
                         className="w-full bg-surface-2 border border-border rounded-md p-2 text-sm font-data text-text-primary uppercase focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                         maxLength={1}
                       />
                     </div>

                     <div className="col-span-2 mt-4 pt-4 border-t border-border space-y-4">
                        <div className="text-sm font-display font-medium text-accent-cyan">FCOT Schema Definition</div>
                        
                        {(Object.keys(emptyFcot) as Array<keyof FCOT>).map(fcotField => (
                          <div key={fcotField} className="space-y-1">
                            <label className="text-[11px] text-text-secondary font-display font-medium uppercase tracking-[0.03em]">{fcotField}</label>
                            {fcotField === 'Contrastive Rules' ? (
                               <textarea 
                                 value={(cls.fcot[fcotField] || []).join('\n')} 
                                 onChange={e => updateFcot(i, fcotField, e.target.value.split('\n'))}
                                 disabled={role !== 'owner'}
                                 className="w-full h-24 bg-surface-2 border border-border rounded-md p-3 text-[14px] leading-[1.6] font-body text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                                 placeholder="One rule per line..."
                               />
                            ) : (
                               <textarea 
                                 value={cls.fcot[fcotField] as string} 
                                 onChange={e => updateFcot(i, fcotField, e.target.value)}
                                 disabled={role !== 'owner'}
                                 className="w-full h-16 bg-surface-2 border border-border rounded-md p-3 text-[14px] leading-[1.6] font-body text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                               />
                            )}
                          </div>
                        ))}
                     </div>
                   </div>
                 </div>
               ))}
                              {role === 'owner' && (
                  <button onClick={addClass} className="w-full py-4 border-2 border-dashed border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-hover font-display font-medium transition-all duration-150 ease-out flex items-center justify-center gap-2">
                    <Plus size={18} strokeWidth={1.5} /> Add New Class
                  </button>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
