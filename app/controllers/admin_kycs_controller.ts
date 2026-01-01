import type { HttpContext } from '@adonisjs/core/http'
import KycSubmission from '#models/kyc_submission'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class AdminKycsController {
  
    /**
     * Get all pending KYC submissions
     */
    public async index({ response }: HttpContext) {
        const submissions = await KycSubmission.query()
            .where('status', 'pending')
            .preload('user', (query) => {
                query.select('id', 'fullName', 'email', 'kycStatus')
            })
            .orderBy('createdAt', 'asc')

        return response.ok(submissions)
    }

    /**
     * Get details of a specific submission
     */
    public async show({ params, response }: HttpContext) {
        const submission = await KycSubmission.findOrFail(params.id)
        await submission.load('user')
        
        return response.ok(submission)
    }

    /**
     * Approve a KYC submission
     */
    public async approve({ params, response }: HttpContext) {
        const submission = await KycSubmission.findOrFail(params.id)
        
        if (submission.status !== 'pending') {
            return response.badRequest({ message: 'Cette demande a déjà été traitée.' })
        }

        const user = await User.findOrFail(submission.userId)

        submission.status = 'approved'
        submission.reviewedAt = DateTime.now()
        await submission.save()

        user.kycStatus = 'verified'
        await user.save()

        // TODO: Send email notification to user

        return response.ok({ message: 'KYC approuvé avec succès.' })
    }

    /**
     * Reject a KYC submission
     */
    public async reject({ params, request, response }: HttpContext) {
        const submission = await KycSubmission.findOrFail(params.id)
        const { reason } = request.only(['reason'])

        if (submission.status !== 'pending') {
            return response.badRequest({ message: 'Cette demande a déjà été traitée.' })
        }
        
        if (!reason) {
            return response.badRequest({ message: 'Une raison de rejet est requise.' })
        }

        const user = await User.findOrFail(submission.userId)

        submission.status = 'rejected'
        submission.rejectionReason = reason
        submission.reviewedAt = DateTime.now()
        await submission.save()

        user.kycStatus = 'rejected'
        await user.save()

        // TODO: Send email notification to user with reason

        return response.ok({ message: 'KYC rejeté.' })
    }
}
