import vine from '@vinejs/vine'

export const createAnnouncementValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(3),
    content: vine.string().trim().minLength(3),
    isActive: vine.boolean().optional(),
  })
)

export const updateAnnouncementValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(3).optional(),
    content: vine.string().trim().minLength(3).optional(),
    isActive: vine.boolean().optional(),
    imageUrl: vine.string().url().optional().nullable(), // Now expects an optional URL string
  })
)
