import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const waterDebrisTaxonomy = {
    "plastic_bottle": {
        "display": "🥤 Plastic Bottle",
        "fcot": {
            "Primary Cue": "Rigid curved body with a visible neck or cap, holding its 3D shape on the water surface.",
            "Observation": "Bottle-shaped floating object with smooth glossy surfaces and a consumer colour palette (transparent, white, blue, green, or brown). Label band may be intact, peeled, or absent. Body may be intact, crushed, or dented.",
            "Contrastive Rules": [
                "Unlike polythene, plastic_bottle holds a rigid 3D shape instead of draping flat.",
                "Unlike foam_waste, plastic_bottle has a glossy curved surface instead of a matte crumbly one.",
                "Unlike solid_waste, plastic_bottle is a single identifiable bottle, not a mixed cluster."
            ],
            "Static-Frame Disambiguation": "The bottle outline follows the object's curved body with a hard edge; a bright spot from sky reflection has a soft gradient that does not trace any object boundary.",
            "Decision Rule": "Assign plastic_bottle when a rigid curved body shows a neck taper or a cap, even if the label is missing.",
            "Fallback Rule": "If less than half visible, commit on any one of: visible cap, glossy curved edge segment, or cylindrical outline.",
            "Failure Mode": "Most often confused with polythene when the bottle is crushed flat — tiebreaker is any visible rigid curve or neck remnant.",
            "Instance Note": "",
            "Conclusion": "Class: plastic_bottle. Single-item consumer macroplastic with persistent floating behaviour."
        }
    },
    "polythene": {
        "display": "🛍️ Polythene",
        "fcot": {
            "Primary Cue": "Thin flexible translucent film that folds, wrinkles, or drapes directly along the water surface.",
            "Observation": "Flat or partially submerged sheet-like plastic with soft irregular edges and visible folds. Usually transparent, white, black, or printed. In dark or turbid water appears as a lighter translucent patch against the darker background.",
            "Contrastive Rules": [
                "Unlike plastic_bottle, polythene does not maintain a rigid 3D structure.",
                "Unlike fabric_waste, polythene has smooth stretched edges instead of soft frayed fibres.",
                "Unlike foam_waste, polythene is thin and flexible instead of thick and rigid."
            ],
            "Static-Frame Disambiguation": "The bag has folded edges and a translucent body with hard outline; a water glare patch has soft spreading edges and no folds.",
            "Decision Rule": "Assign polythene when a thin draping translucent film is visible with no weave pattern and no rigid form.",
            "Fallback Rule": "If folded into a narrow strip or nearly submerged, commit on translucency, drape conforming to water, and faint folded outline.",
            "Failure Mode": "Most often confused with fabric_waste under low resolution — tiebreaker is glossy translucent surface versus matte fibrous surface.",
            "Instance Note": "",
            "Conclusion": "Class: polythene. Flexible thin-film plastic debris with high entanglement risk."
        }
    },
    "__others__": {
        "display": "✏️ Others (custom)",
        "fcot": {
            "Primary Cue": "", "Observation": "",
            "Contrastive Rules": ["", "", ""],
            "Static-Frame Disambiguation": "", "Decision Rule": "",
            "Fallback Rule": "", "Failure Mode": "",
            "Instance Note": "", "Conclusion": ""
        }
    }
}

const CLASS_COLORS: Record<string, string> = {
    "plastic_bottle":  "#00e5ff",
    "polythene":       "#ff4081",
    "__others__":      "#b0bec5",
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Create Example Project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      owner_id: user.id,
      name: 'Water Surface Debris (Example)',
      drive_image_folder_id: '1a2b3c4d5e6f7g8h9i0j', // placeholder
    })
    .select()
    .single()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })

  // Insert into project_members
  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    role: 'owner'
  })

  // 2. Create Taxonomy Version 1
  const { data: taxVersion, error: taxError } = await supabase
    .from('taxonomy_versions')
    .insert({
      project_id: project.id,
      version_number: 1,
      is_active: true
    })
    .select()
    .single()

  if (taxError) return NextResponse.json({ error: taxError.message }, { status: 500 })

  // 3. Insert Taxonomy Classes
  let sortOrder = 0
  for (const [key, val] of Object.entries(waterDebrisTaxonomy)) {
    await supabase.from('taxonomy_classes').insert({
      taxonomy_version_id: taxVersion.id,
      class_key: key,
      display_name: val.display,
      color: CLASS_COLORS[key] || "#ffffff",
      shortcut_key: key === '__others__' ? 'o' : String(sortOrder + 1),
      fcot: val.fcot,
      sort_order: sortOrder++
    })
  }

  // 4. Create Scene Metadata Version 1
  const { data: metaVersion, error: metaError } = await supabase
    .from('scene_metadata_field_sets')
    .insert({
      project_id: project.id,
      version_number: 1,
      is_active: true
    })
    .select()
    .single()
    
  if (metaError) return NextResponse.json({ error: metaError.message }, { status: 500 })

  // 5. Insert Example Scene Fields
  const fields = [
    { key: 'lighting', label: 'Lighting Condition', type: 'select', opts: [{value: 'Overcast', label: '☁ Overcast'}, {value: 'Golden Hour', label: '🌅 Golden Hour'}], persists: true },
    { key: 'turbidity_score', label: 'Turbidity Score', type: 'slider', opts: { min: 1, max: 10, step: 1 }, persists: true }
  ]
  
  let metaSort = 0
  for (const f of fields) {
    await supabase.from('scene_metadata_fields').insert({
      field_set_id: metaVersion.id,
      field_key: f.key,
      label: f.label,
      field_type: f.type,
      options: f.opts,
      persists_across_images: f.persists,
      sort_order: metaSort++
    })
  }

  return NextResponse.json({ success: true, projectId: project.id })
}
