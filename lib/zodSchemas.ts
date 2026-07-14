import { z } from 'zod'

export const fcotSchema = z.object({
  'Primary Cue': z.string(),
  'Observation': z.string(),
  'Contrastive Rules': z.array(z.string()),
  'Static-Frame Disambiguation': z.string(),
  'Decision Rule': z.string(),
  'Fallback Rule': z.string(),
  'Failure Mode': z.string(),
  'Instance Note': z.string(),
  'Conclusion': z.string(),
})

export const taxonomyClassSchema = z.object({
  class_key: z.string().min(1, "Class key is required"),
  display_name: z.string().min(1, "Display name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  shortcut_key: z.string().optional(),
  fcot: fcotSchema,
})

export const taxonomyImportSchema = z.record(
  z.string(), // class_key
  z.object({
    display: z.string(),
    fcot: fcotSchema,
  })
)

export const sceneFieldSchema = z.object({
  field_key: z.string().min(1, "Field key is required"),
  label: z.string().min(1, "Label is required"),
  field_type: z.enum(['select', 'text', 'number', 'slider', 'textarea']),
  options: z.any().optional(), // Could be more strongly typed based on field_type
  persists_across_images: z.boolean().default(true),
})

export const sceneFieldSetSchema = z.array(sceneFieldSchema)

export const annotationSaveSchema = z.object({
  image_id: z.string().uuid(),
  project_id: z.string().uuid(),
  boxes: z.array(z.object({
    class_key: z.string(),
    ymin: z.number().min(0).max(1000),
    xmin: z.number().min(0).max(1000),
    ymax: z.number().min(0).max(1000),
    xmax: z.number().min(0).max(1000),
  })).refine(boxes => {
    // Valid coordinates checking (min < max)
    return boxes.every(b => b.ymin < b.ymax && b.xmin < b.xmax)
  }, { message: "Invalid box coordinates: min must be less than max" })
})
