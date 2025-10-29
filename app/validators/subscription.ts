import vine from '@vinejs/vine'

export const subscriptionValidator = vine.compile(
  vine.object({
    planId: vine.number().positive(),
    amount: vine.number().positive(),
  })
)

export const upgradePlanValidator = vine.compile(
  vine.object({
    targetPlanId: vine.number().positive(),
  })
)
