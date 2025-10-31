import vine from '@vinejs/vine'

export const subscriptionValidator = vine.compile(
  vine.object({
    planId: vine.string().uuid(),
    amount: vine.number().positive(),
  })
)

export const upgradePlanValidator = vine.compile(
  vine.object({
    targetPlanId: vine.string().uuid(),
  })
)
