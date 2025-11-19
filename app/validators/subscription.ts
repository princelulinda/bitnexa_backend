import vine from '@vinejs/vine'

export const subscriptionValidator = vine.compile(
  vine.object({
    amount: vine.number().positive(),
  })
)

export const upgradePlanValidator = vine.compile(
  vine.object({
    targetPlanId: vine.string().uuid(),
  })
)
