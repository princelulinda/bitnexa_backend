import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'

export const registerValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3),
    email: vine.string().trim().email(),
    password: vine.string().minLength(8),
    referralCode: vine.string().trim().nullable(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().minLength(8),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).optional(),
    email: vine
      .string()
      .trim()
      .email()
      .unique(async (query, field) => {
        const user = await db.from('users').where('email', field).first()
        return !user
      })
      .optional(),
    password: vine.string().minLength(8).confirmed().optional(),
  })
)
