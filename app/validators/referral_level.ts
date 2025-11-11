import vine from '@vinejs/vine'

export const referralLevelValidator = vine.compile(
  vine.object({
    level: vine.number().withoutDecimals().min(0),
    name: vine.string().trim().minLength(1),
    minReferrals: vine.number().withoutDecimals().min(0),
    weeklySalary: vine.number().min(0),
  })
)
