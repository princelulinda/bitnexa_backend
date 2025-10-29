import vine from '@vinejs/vine'

export const createExternalWalletAddressValidator = vine.compile(
  vine.object({
    address: vine.string().trim().minLength(10), // Basic validation for address length
    currency: vine.string().trim().in(['USDT', 'BTC', 'ETH']), // Example currencies
    network: vine.string().trim().minLength(2), // Example networks
    name: vine.string().trim().nullable(),
  })
)

export const updateExternalWalletAddressValidator = vine.compile(
  vine.object({
    address: vine.string().trim().minLength(10).optional(),
    currency: vine.string().trim().in(['USDT', 'BTC', 'ETH']).optional(),
    network: vine.string().trim().minLength(2).optional(),
    name: vine.string().trim().nullable().optional(),
  })
)
