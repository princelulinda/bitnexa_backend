import vine from '@vinejs/vine'

export const generateDepositAddressValidator = vine.compile(
  vine.object({
    currency: vine.string().trim().in(['USDT']), // Limiting to USDT for now
    network: vine.enum(['ERC20', 'TRC20', 'BEP20']), // Specific networks for USDT
  })
)

export const withdrawValidator = vine.compile(
  vine.object({
    amount: vine.number().positive(),
    cryptoAddress: vine.string().trim().minLength(10), // Basic validation for address length
    network: vine.enum(['ERC20', 'TRC20', 'BEP20']), // Specific networks for USDT
    otp: vine.string().trim().minLength(6).maxLength(6).optional(),
  })
)

export const claimGainsValidator = vine.compile(
  vine.object({
    amount: vine.number().positive(),
  })
)

export const investValidator = vine.compile(
  vine.object({
    amount: vine.number().positive(),
  })
)

export const verifyDepositValidator = vine.compile(
  vine.object({
    userId: vine.number().positive(),
    currency: vine.string().trim().in(['USDT']), // Limiting to USDT for now
    network: vine.enum(['ERC20', 'TRC20', 'BEP20']), // Specific networks for USDT
  })
)

export const adminWithdrawConfirmValidator = vine.compile(
  vine.object({
    txid: vine.string().trim().minLength(10),
  })
)

export const adminWithdrawRejectValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(5),
  })
)
