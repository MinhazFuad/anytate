'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { taxonomyImportSchema } from '@/lib/zodSchemas'

export default function TaxonomyBuilderPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadActiveTaxonomy() {
      // Get active version
      const { data: versionData } = await supabase
        .from('taxonomy_versions')
        .select('id, version_number')
        .eq('project_id', id)
        .eq('is_active', true)
        .single()
        
      if (versionData) {
        // Get classes for this version
        const { data: classesData } = await supabase
          .from('taxonomy_classes')
          .select('*')
          .eq('taxonomy_version_id', versionData.id)
          .order('sort_order')
          
        if (classesData) {
          setClasses(classesData)
          
          // Reconstruct JSON for import/export area
          const reconstructedJson: Record<string, any> = {}
          classesData.forEach(c => {
            reconstructedJson[c.class_key] = {
              display: c.display_name,
              fcot: c.fcot
            }
          })
          setJsonInput(JSON.stringify(reconstructedJson, null, 2))
        }
      }
      setLoading(false)
    }
    loadActiveTaxonomy()
  }, [id, supabase])

  const handleJsonImport = () => {
    setError('')
    try {
      const parsed = JSON.parse(jsonInput)
      const validated = taxonomyImportSchema.parse(parsed)
      
      const newClasses = Object.entries(validated).map(([key, val], index) => ({
        class_key: key,
        display_name: val.display,
        color: '#00e5ff', // default or extract if available
        shortcut_key: index < 9 ? String(index + 1) : 'o',
        fcot: val.fcot,
        sort_order: index
      }))
      
      setClasses(newClasses)
      alert("JSON Validated! Click 'Publish New Version' to save.")
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format')
    }
  }

  const handlePublish = async () => {
    setLoading(true)
    try {
      // 1. Get current max version
      const { data: versions } = await supabase
        .from('taxonomy_versions')
        .select('version_number, id')
        .eq('project_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        
      const nextVersionNum = versions && versions.length > 0 ? versions[0].version_number + 1 : 1

      // 2. Insert new version
      const { data: newVersion, error: versionErr } = await supabase
        .from('taxonomy_versions')
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
        .from('taxonomy_versions')
        .update({ is_active: false })
        .eq('project_id', id)
        .neq('id', newVersion.id)

      // 4. Insert classes mapped to new version
      const insertData = classes.map(c => ({
        taxonomy_version_id: newVersion.id,
        class_key: c.class_key,
        display_name: c.display_name,
        color: c.color || '#ffffff',
        shortcut_key: c.shortcut_key,
        fcot: c.fcot,
        sort_order: c.sort_order
      }))
      
      const { error: classErr } = await supabase.from('taxonomy_classes').insert(insertData)
      if (classErr) throw classErr
      
      alert(`Published version ${nextVersionNum}!`)
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
        <h1 className="mb-8 text-3xl font-bold">Taxonomy Builder</h1>
        
        <div className="mb-8 rounded-xl border border-white/10 bg-surface/50 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold">JSON Import</h2>
          <p className="mb-4 text-sm text-muted">
            Paste your taxonomy JSON here to validate and import. This creates a new version; existing annotations will remain on their original version.
          </p>
          <textarea
            className="h-64 w-full rounded-lg border border-white/10 bg-background p-4 font-mono text-sm focus:border-accent focus:outline-none"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
          <div className="mt-4 flex gap-4">
            <button
              onClick={handleJsonImport}
              className="rounded-lg bg-surface px-4 py-2 text-sm font-semibold border border-white/10 hover:bg-white/5"
            >
              Validate JSON
            </button>
            <button
              onClick={handlePublish}
              disabled={loading || classes.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Publish New Version'}
            </button>
          </div>
          {error && <div className="mt-4 text-warn text-sm">{error}</div>}
        </div>
        
        <div className="rounded-xl border border-white/10 bg-surface p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold">Current Classes ({classes.length})</h2>
          <div className="flex flex-col gap-2">
            {classes.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color || '#fff' }} />
                  <span className="font-semibold">{c.display_name}</span>
                  <span className="rounded bg-accent/20 px-2 py-1 text-xs text-accent">Key: {c.class_key}</span>
                </div>
                <div className="text-xs text-muted">
                  Shortcut: <b>{c.shortcut_key}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
