import vine from '@vinejs/vine'

export const useSignalValidator = vine.compile(
  vine.object({
    code: vine.string().trim().fixedLength(6),
  })
)
