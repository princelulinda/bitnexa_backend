import vine from '@vinejs/vine'

export const createMessageValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1).maxLength(500),
    parentId: vine.string().uuid().optional(), // Add optional parentId
  })
)
