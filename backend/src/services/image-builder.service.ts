/**
 * Image Builder Service - Simplified Mock Implementation
 * Handles image building and management
 */

import { logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'

interface ImageSpec {
    name: string
    version: string
    description?: string
    baseImage?: string
    packages?: string[]
    drivers?: string[]
    systemConfig?: object
    vdiConfig?: object
}

interface BuildJob {
    build_id: string
    name: string
    version: string
    status: 'building' | 'completed' | 'failed'
    progress: number
    created_at: Date
    completed_at?: Date
    error_message?: string
}

export class ImageBuilderService {
    private buildJobs: BuildJob[] = []

    constructor() {
        this.initializeMockBuilds()
    }

    private initializeMockBuilds() {
        // Initialize with some completed builds
        this.buildJobs = [
            {
                build_id: 'build-1',
                name: 'Basic VDI Client',
                version: '1.0.0',
                status: 'completed',
                progress: 100,
                created_at: new Date(Date.now() - 3600000), // 1 hour ago
                completed_at: new Date(Date.now() - 3500000)
            },
            {
                build_id: 'build-2',
                name: 'Office Suite Client',
                version: '1.1.0',
                status: 'completed',
                progress: 100,
                created_at: new Date(Date.now() - 7200000), // 2 hours ago
                completed_at: new Date(Date.now() - 6800000)
            }
        ]
    }

    async createImage(imageSpec: ImageSpec) {
        try {
            const buildId = uuidv4()

            const buildJob: BuildJob = {
                build_id: buildId,
                name: imageSpec.name,
                version: imageSpec.version,
                status: 'building',
                progress: 0,
                created_at: new Date()
            }

            this.buildJobs.push(buildJob)

            logger.info(`Image build started: ${buildId}`, {
                buildId,
                name: imageSpec.name,
                version: imageSpec.version
            })

            // Simulate build process
            this.simulateBuild(buildId)

            return {
                success: true,
                build_id: buildId,
                status: 'building'
            }
        } catch (error) {
            logger.error('Failed to create image', { error, imageSpec })
            return {
                success: false,
                error: 'Failed to start image build'
            }
        }
    }

    async getBuildStatus(buildId: string) {
        try {
            const buildJob = this.buildJobs.find(b => b.build_id === buildId)
            
            if (!buildJob) {
                return {
                    success: false,
                    error: 'Build job not found'
                }
            }

            return {
                success: true,
                build_id: buildId,
                status: buildJob.status,
                progress: buildJob.progress,
                created_at: buildJob.created_at,
                completed_at: buildJob.completed_at,
                error_message: buildJob.error_message
            }
        } catch (error) {
            logger.error('Failed to get build status', { error, buildId })
            return {
                success: false,
                error: 'Failed to get build status'
            }
        }
    }

    async listBuilds(filters: { status?: string; limit?: number } = {}) {
        try {
            let builds = [...this.buildJobs]

            if (filters.status) {
                builds = builds.filter(b => b.status === filters.status)
            }

            if (filters.limit) {
                builds = builds.slice(0, filters.limit)
            }

            return builds.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        } catch (error) {
            logger.error('Failed to list builds', { error, filters })
            throw new Error('Failed to retrieve builds')
        }
    }

    async cancelBuild(buildId: string) {
        try {
            const buildJob = this.buildJobs.find(b => b.build_id === buildId)
            
            if (!buildJob) {
                return {
                    success: false,
                    error: 'Build job not found'
                }
            }

            if (buildJob.status !== 'building') {
                return {
                    success: false,
                    error: 'Build cannot be cancelled'
                }
            }

            buildJob.status = 'failed'
            buildJob.error_message = 'Build cancelled by user'
            buildJob.completed_at = new Date()

            logger.info(`Build cancelled: ${buildId}`)

            return {
                success: true,
                message: 'Build cancelled successfully'
            }
        } catch (error) {
            logger.error('Failed to cancel build', { error, buildId })
            return {
                success: false,
                error: 'Failed to cancel build'
            }
        }
    }

    private async simulateBuild(buildId: string) {
        const buildJob = this.buildJobs.find(b => b.build_id === buildId)
        if (!buildJob) return

        try {
            // Simulate build progress
            const progressSteps = [10, 25, 40, 60, 75, 90, 100]
            
            for (const progress of progressSteps) {
                await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
                
                buildJob.progress = progress
                
                logger.info(`Build progress: ${buildId} - ${progress}%`)
                
                if (buildJob.status !== 'building') {
                    // Build was cancelled
                    return
                }
            }

            // Complete the build
            buildJob.status = 'completed'
            buildJob.progress = 100
            buildJob.completed_at = new Date()

            logger.info(`Image build completed: ${buildId}`)

        } catch (error) {
            buildJob.status = 'failed'
            buildJob.error_message = error.message
            buildJob.completed_at = new Date()

            logger.error(`Image build failed: ${buildId}`, { error })
        }
    }
}