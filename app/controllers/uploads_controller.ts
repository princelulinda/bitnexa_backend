import type { HttpContext } from '@adonisjs/core/http'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import path from 'node:path'

export default class UploadsController {
  /**
   * Reusable upload method
   * Accepts 'image' in base64 format and optional 'folder' parameter
   */
  async upload({ request, response }: HttpContext) {
    const { image, folder = 'general' } = request.only(['image', 'folder'])

    if (!image) {
      return response.badRequest({ message: 'No image data provided' })
    }

    // Expecting base64 format: data:image/png;base64,iVBORw...
    const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/)

    if (!matches || matches.length !== 3) {
      return response.badRequest({ message: 'Invalid base64 image format. Expected data:image/xxx;base64,...' })
    }

    const extension = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase()
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Check size (5MB = 5 * 1024 * 1024 bytes)
    if (buffer.length > 5 * 1024 * 1024) {
      return response.badRequest({ message: 'Image size exceeds 5MB limit' })
    }

    const allowedExtensions = ['jpg', 'png', 'jpeg', 'gif', 'webp']
    if (!allowedExtensions.includes(extension)) {
      return response.badRequest({ message: `Invalid file extension: ${extension}. Allowed: ${allowedExtensions.join(', ')}` })
    }

    // Determine folder and sanitize
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    
    const imageName = `${cuid()}.${extension}`
    const relativePath = `uploads/${safeFolder}`
    const absoluteDirPath = app.publicPath(relativePath)

    // Ensure directory exists
    await fs.mkdir(absoluteDirPath, { recursive: true })

    const absoluteFilePath = path.join(absoluteDirPath, imageName)
    await fs.writeFile(absoluteFilePath, buffer)

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
