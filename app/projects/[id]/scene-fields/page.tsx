'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'

type FieldData = {
  id?: string;
  field_key: string;
  label: string;
  field_type: 'select' | 'text' | 'number' | 'slider' | 'textarea';
  options: any; // string[] for select, {min,max,step} for slider
  persists_across_images: boolean;
}

export default function SceneFieldsBuilderPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [fields, setFields] = useState<FieldData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState<number | null>(null)
  const [versionName, setVersionName] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [allVersions, setAllVersions] = useState<any[]>([])
  const [role, setRole] = useState<string>('annotator')

  useEffect(() => {
    async function loadFields() {
      // Fetch role
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', user.id).single()
        if (member) setRole(member.role)
      }

      // Fetch all versions
      const { data: allV } = await supabase
        .from('scene_metadata_field_sets')
        .select('id, version_number, is_active')
        .eq('project_id', id)
        .order('version_number', { ascending: false })
      
      if (allV) setAllVersions(allV)

      // Get active field set version
      const activeV = allV?.find(v => v.is_active)
        
      if (activeV) {
        setVersion(activeV.version_number)
        const { data: fData } = await supabase
          .from('scene_metadata_fields')
          .select('*')
          .eq('field_set_id', activeV.id)
          .order('sort_order')
          
        if (fData) setFields(fData as FieldData[])
      } else {
        setVersion(0)
      }
      setLoading(false)
    }
    loadFields()
  }, [id, supabase])

  const setActiveVersion = async (versionId: string) => {
    setLoading(true)
    await supabase.from('scene_metadata_field_sets').update({ is_active: false }).eq('project_id', id)
    await supabase.from('scene_metadata_field_sets').update({ is_active: true }).eq('id', versionId)
    window.location.reload()
  }

  const addField = () => {
    setFields([...fields, {
      field_key: `field_${fields.length + 1}`,
      label: `New Field ${fields.length + 1}`,
      field_type: 'select',
      options: ['Option 1', 'Option 2'],
      persists_across_images: true
    }])
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const updateField = (index: number, key: keyof FieldData, value: any) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], [key]: value }
    setFields(newFields)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Create a new field set version
      const newVersionNum = (version || 0) + 1
      const { data: newVersion, error: vErr } = await supabase
        .from('scene_metadata_field_sets')
        .insert({
          project_id: id,
          version_number: newVersionNum,
          version_name: versionName || null,
          is_active: true
        })
        .select()
        .single()
        
      if (vErr) throw vErr

      // 2. Insert new fields
      if (fields.length > 0) {
        const insertData = fields.map((f, i) => ({
          field_set_id: newVersion.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          options: f.options,
          persists_across_images: f.persists_across_images,
          sort_order: i
        }))
        
        const { error: fErr } = await supabase.from('scene_metadata_fields').insert(insertData)
        if (fErr) throw fErr
      }

      // 3. Mark old versions inactive
      await supabase
        .from('scene_metadata_field_sets')
        .update({ is_active: false })
        .eq('project_id', id)
        .neq('id', newVersion.id)
        
      toast.success(`Scene metadata version ${newVersionNum} saved successfully!`)
      window.location.reload()
    } catch (e: any) {
      toast.error("Error saving: " + e.message)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-body animate-in fade-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan mb-4" />
        <div className="text-text-primary font-display font-medium text-lg">Loading Scene Fields...</div>
        <div className="text-text-secondary text-sm mt-2 max-w-[300px] text-center">
          Fetching metadata configurations...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary p-8 font-body">
      <div className="max-w-[1280px] mx-auto space-y-8">
        
        <div className="flex items-center justify-between mb-4">
           <Link href={`/projects/${id}/dashboard`} className="text-text-secondary hover:text-text-primary text-sm font-display font-medium transition-all duration-150 ease-out flex items-center gap-2 w-fit">
              <ArrowLeft size={18} strokeWidth={1.5} /> Back to Dashboard
           </Link>
           <ThemeToggle />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">Scene Fields Builder</h1>
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
              <input 
                type="text"
                value={versionName}
                onChange={e => setVersionName(e.target.value)}
                placeholder={`Version ${(version || 0) + 1} Name`}
                className="h-9 bg-surface border border-border rounded px-4 text-sm font-body text-text-primary placeholder:text-text-tertiary focus:border-accent-cyan focus:outline-none transition-colors duration-150 ease-out"
              />
              <button 
                onClick={handleSave}
                disabled={saving || fields.length === 0}
                className="h-9 px-6 bg-accent-cyan text-bg font-display font-medium rounded hover:bg-accent-cyan-hover disabled:bg-surface-2 disabled:text-text-tertiary transition-all duration-150 ease-out active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Publish New Version'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg p-6">
          <p className="text-sm text-text-secondary mb-6 font-body">
            Define project-wide scene metadata fields here (e.g. Lighting, Turbidity, Store Region). These values can persist across images.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {fields.map((field, i) => (
              <div key={i} className="border border-border rounded-lg bg-surface overflow-hidden">
                <div className="p-4 bg-surface-2 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-4 flex-1">
                    <input 
                      type="text" 
                      value={field.label} 
                      onChange={e => updateField(i, 'label', e.target.value)}
                      disabled={role !== 'owner'}
                      className="bg-surface border border-border rounded-md p-2 font-display font-medium text-base text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring max-w-sm w-full disabled:opacity-50"
                      placeholder="Field Label (e.g. Weather)"
                    />
                    <select
                      value={field.field_type}
                      onChange={e => updateField(i, 'field_type', e.target.value)}
                      disabled={role !== 'owner'}
                      className="bg-surface border border-border rounded-md p-2 text-sm font-display text-text-secondary focus:border-accent-cyan focus:outline-none disabled:opacity-50"
                    >
                      <option value="select">Select Dropdown</option>
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="number">Number Input</option>
                      <option value="slider">Range Slider</option>
                    </select>
                  </div>
                  {role === 'owner' && (
                    <button onClick={() => removeField(i)} className="text-accent-red hover:bg-accent-red/10 px-3 py-1.5 rounded-md font-display font-medium text-sm transition-all duration-150 ease-out">
                      Remove Field
                    </button>
                  )}
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="col-span-1 space-y-2">
                    <label className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em]">Field Key (Internal JSON Key)</label>
                    <input 
                      type="text" 
                      value={field.field_key} 
                      onChange={e => updateField(i, 'field_key', e.target.value)}
                      disabled={role !== 'owner'}
                      className="w-full bg-surface-2 border border-border rounded-md p-2 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                      placeholder="e.g. weather_condition"
                    />
                  </div>
                  
                  {field.field_type === 'select' && (
                    <div className="col-span-2 space-y-2 mt-2">
                      <label className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em]">Dropdown Options (one per line)</label>
                      <textarea
                        value={(field.options || []).join('\n')}
                        onChange={e => updateField(i, 'options', e.target.value.split('\n'))}
                        disabled={role !== 'owner'}
                        placeholder="sunny&#10;cloudy&#10;rainy&#10;snowy"
                        className="w-full h-24 bg-surface-2 border border-border rounded-md p-3 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                      />
                    </div>
                  )}

                  {field.field_type === 'slider' && (
                    <div className="col-span-2 space-y-2 mt-2">
                      <label className="text-[11px] text-text-secondary uppercase font-display font-medium tracking-[0.03em]">Slider Config (min, max, step)</label>
                      <div className="flex gap-4">
                         <input type="number" placeholder="Min" disabled={role !== 'owner'} value={field.options?.min || 0} onChange={e => updateField(i, 'options', {...field.options, min: Number(e.target.value)})} className="w-1/3 bg-surface-2 border border-border rounded-md p-2 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50" />
                         <input type="number" placeholder="Max" disabled={role !== 'owner'} value={field.options?.max || 10} onChange={e => updateField(i, 'options', {...field.options, max: Number(e.target.value)})} className="w-1/3 bg-surface-2 border border-border rounded-md p-2 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50" />
                         <input type="number" placeholder="Step" disabled={role !== 'owner'} value={field.options?.step || 1} onChange={e => updateField(i, 'options', {...field.options, step: Number(e.target.value)})} className="w-1/3 bg-surface-2 border border-border rounded-md p-2 text-sm font-data text-text-primary focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50" />
                      </div>
                    </div>
                  )}

                  <div className="col-span-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer mt-4">
                      <input 
                        type="checkbox" 
                        checked={field.persists_across_images}
                        onChange={e => updateField(i, 'persists_across_images', e.target.checked)}
                        disabled={role !== 'owner'}
                        className="w-4 h-4 rounded bg-surface border-border text-accent-cyan focus:ring-accent-cyan disabled:opacity-50"
                      />
                      <span className="text-sm font-display text-text-primary">Persist value across consecutive images</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
            
            {role === 'owner' && (
              <button onClick={addField} className="w-full py-4 border-2 border-dashed border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-hover font-display font-medium transition-all duration-150 ease-out flex items-center justify-center gap-2">
                <Plus size={18} strokeWidth={1.5} /> Add New Field
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
