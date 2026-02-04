import type { HttpContext } from '@adonisjs/core/http'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'

export default class UploadsController {
  /**
   * Reusable upload method
   * Accepts 'image' file and optional 'folder' query parameter
   */
  async upload({ request, response }: HttpContext) {
    const image = request.file('image', {
      size: '5mb',
      extnames: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    })

    if (!image) {
      return response.badRequest({ message: 'No image uploaded' })
    }

    if (!image.isValid) {
      return response.badRequest({ message: image.errors })
    }

    // Determine folder (default to 'general' if not provided)
    const folder = request.input('folder', 'general')
    
    // Sanitize folder name to prevent directory traversal
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    
    const imageName = `${cuid()}.${image.extname}`
    const relativePath = `uploads/${safeFolder}`

    await image.move(app.publicPath(relativePath), { 
      name: imageName,
      overwrite: true 
    })

    const protocol = request.protocol()
    const host = request.header('host')
    const fullImageUrl = `${protocol}://${host}/${relativePath}/${imageName}`

    return response.ok({ 
      url: fullImageUrl,
      path: `${relativePath}/${imageName}`,
      fileName: imageName
    })
  }
}
