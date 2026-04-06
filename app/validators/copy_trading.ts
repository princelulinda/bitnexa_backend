import vine from '@vinejs/vine'

export const copyTraderValidator = vine.compile(
  vine.object({
    traderId: vine.string().uuid(),
  })
)
