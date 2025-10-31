import type { HttpContext } from '@adonisjs/core/http'
import Announcement from '#models/announcement'
import { createAnnouncementValidator, updateAnnouncementValidator } from '#validators/announcement'
import fs from 'node:fs/promises'

export default class AnnouncementsController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return Announcement.query().orderBy('createdAt', 'desc').exec()
  }

  /**
   * Handle form submission for the creation action
   */
  async store({ request, response }: HttpContext) {
    const image = request.file('image', {
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg', 'gif'],
    })

    if (!image || !image.isValid) {
      return response.badRequest({ message: 'Image upload failed', errors: image?.errors })
    }

    const payload = await request.validateUsing(createAnnouncementValidator)

    const imageName = `${cuid()}.${image.extname}`
    await image.move(app.publicPath('uploads/announcements'), { name: imageName })

    const announcement = await Announcement.create({
      ...payload,
      imageUrl: `uploads/announcements/${imageName}`,
    })
    return response.created(announcement)
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return Announcement.findOrFail(params.id)
  }
  /**
   * Handle form submission for the update action
   */
  async update({ params, request }: HttpContext) {
    const announcement = await Announcement.findOrFail(params.id)
    const payload = await request.validateUsing(updateAnnouncementValidator)

    // If imageUrl is provided and different, delete old image
    if (payload.imageUrl && payload.imageUrl !== announcement.imageUrl) {
      if (announcement.imageUrl) {
        await fs.rm(app.publicPath(announcement.imageUrl))
      }
    } else if (payload.imageUrl === null && announcement.imageUrl) {
      // If imageUrl is explicitly set to null, delete old image
      await fs.rm(app.publicPath(announcement.imageUrl))
    }

    announcement.merge(payload)
    await announcement.save()
    return announcement
  }

  /**
   * Delete record
   */
  async destroy({ params, response }: HttpContext) {
    const announcement = await Announcement.findOrFail(params.id)

    // Delete associated image
    if (announcement.imageUrl) {
      await fs.rm(app.publicPath(announcement.imageUrl))
    }

    await announcement.delete()
    return response.noContent()
  }

  public async uploadImage({ request, response }: HttpContext) {
    const image = request.file('image', {
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg', 'gif'],
    })

    if (!image) {
      return response.badRequest({ message: 'No image uploaded' })
    }

    if (!image.isValid) {
      return response.badRequest({ message: image.errors })
    }

    const imageName = `${cuid()}.${image.extname}`

    // Déplace le fichier dans /public/uploads/announcements
    await image.move(app.publicPath('uploads/announcements'), { name: imageName })

    // Construire l'URL de base de façon sûre (protocol + host)
    const protocol = request.protocol() // 'http' | 'https'
    const host = request.header('host') || 'localhost:3333' // fallback si header manquant
    const fullImageUrl = `${protocol}://${host}/uploads/announcements/${imageName}`

    return response.ok({ imageUrl: fullImageUrl })
  }
}
