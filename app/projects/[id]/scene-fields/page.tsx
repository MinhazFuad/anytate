'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

export default function SceneFieldsBuilderPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [fields, setFields] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadActiveFields() {
      // Get active version
      const { data: versionData } = await supabase
        .from('scene_metadata_field_sets')
        .select('id, version_number')
        .eq('project_id', id)
        .eq('is_active', true)
        .single()
        
      if (versionData) {
        // Get fields for this version
        const { data: fieldsData } = await supabase
          .from('scene_metadata_fields')
          .select('*')
          .eq('field_set_id', versionData.id)
          .order('sort_order')
          
        if (fieldsData) setFields(fieldsData)
      }
      setLoading(false)
    }
    loadActiveFields()
  }, [id, supabase])

  const handleAddField = () => {
    setFields([...fields, {
      field_key: `field_${fields.length + 1}`,
      label: `New Field ${fields.length + 1}`,
      field_type: 'text',
      options: null,
      persists_across_images: true,
      sort_order: fields.length
    }])
  }

  const updateField = (index: number, key: string, value: any) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], [key]: value }
    setFields(newFields)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handlePublish = async () => {
    setLoading(true)
    setError('')
    try {
      // 1. Get current max version
      const { data: versions } = await supabase
        .from('scene_metadata_field_sets')
        .select('version_number, id')
        .eq('project_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        
      const nextVersionNum = versions && versions.length > 0 ? versions[0].version_number + 1 : 1

      // 2. Insert new version
      const { data: newVersion, error: versionErr } = await supabase
        .from('scene_metadata_field_sets')
        .insert({
          project_id: id as string,
          version_number: nextVersionNum,
          is_active: true
        })
        .select()
        .single()
        
      if (versionErr) throw versionErr

      // 3. Deactivate old versions
      await supabase
        .from('scene_metadata_field_sets')
        .update({ is_active: false })
        .eq('project_id', id)
        .neq('id', newVersion.id)

      // 4. Insert fields mapped to new version
      const insertData = fields.map((f, i) => ({
        field_set_id: newVersion.id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        options: f.field_type === 'select' || f.field_type === 'slider' ? f.options : null,
        persists_across_images: f.persists_across_images,
        sort_order: i
      }))
      
      const { error: fieldErr } = await supabase.from('scene_metadata_fields').insert(insertData)
      if (fieldErr) throw fieldErr
      
      alert(`Published scene metadata version ${nextVersionNum}!`)
      router.push(`/projects/${id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8 text-text">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">Scene Metadata Builder</h1>
        
        <div className="mb-8 flex gap-4">
          <button onClick={handleAddField} className="rounded-lg border border-white/10 bg-surface px-4 py-2 font-semibold hover:bg-white/5">
            + Add Field
          </button>
          <button onClick={handlePublish} disabled={loading} className="rounded-lg bg-accent px-4 py-2 font-semibold text-background hover:opacity-90">
            {loading ? 'Publishing...' : 'Publish New Version'}
          </button>
        </div>

        {error && <div className="mb-8 text-warn">{error}</div>}

        <div className="flex flex-col gap-4">
          {fields.map((f, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-surface/50 p-6 shadow-lg backdrop-blur-xl">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">Field {i + 1}</h3>
                <button onClick={() => removeField(i)} className="text-warn hover:opacity-80 text-sm font-semibold">✕ Remove</button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-muted">Field Key (JSON key)</label>
                  <input type="text" value={f.field_key} onChange={e => updateField(i, 'field_key', e.target.value)} className="w-full rounded bg-background p-2 text-sm focus:border-accent" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Display Label</label>
                  <input type="text" value={f.label} onChange={e => updateField(i, 'label', e.target.value)} className="w-full rounded bg-background p-2 text-sm focus:border-accent" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Type</label>
                  <select value={f.field_type} onChange={e => updateField(i, 'field_type', e.target.value)} className="w-full rounded bg-background p-2 text-sm focus:border-accent">
                    <option value="text">Text (Single Line)</option>
                    <option value="textarea">Textarea (Multi-line)</option>
                    <option value="number">Number</option>
                    <option value="select">Select (Dropdown)</option>
                    <option value="slider">Slider (Range)</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                    <input type="checkbox" checked={f.persists_across_images} onChange={e => updateField(i, 'persists_across_images', e.target.checked)} className="accent-accent" />
                    Persists across images
                  </label>
                </div>
              </div>
              
              {(f.field_type === 'select' || f.field_type === 'slider') && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <label className="mb-1 block text-sm text-muted">Options (JSON format)</label>
                  <textarea 
                    value={typeof f.options === 'string' ? f.options : JSON.stringify(f.options, null, 2) || ''} 
                    onChange={e => updateField(i, 'options', e.target.value)}
                    className="w-full h-24 rounded bg-background p-2 font-mono text-sm focus:border-accent"
                    placeholder={f.field_type === 'select' ? '[{"value":"yes","label":"Yes"}]' : '{"min":1,"max":10,"step":1}'}
                  />
                </div>
              )}
            </div>
          ))}
          {fields.length === 0 && (
            <div className="text-center p-8 text-muted border border-dashed border-white/10 rounded-xl">
              No scene metadata fields defined yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
