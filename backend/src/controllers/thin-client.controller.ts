/**
 * Thin Client Device Management Controller
 * Simplified version for the backend API
 */

import { Request, Response, NextFunction } from 'express'
import { ThinClientService } from '../services/thin-client.service'
import { ImageBuilderService } from '../services/image-builder.service'
import { logger } from '../utils/logger'

class ThinClientController {
    private thinClientService: ThinClientService
    private imageBuilderService: ImageBuilderService

    constructor() {
        this.thinClientService = new ThinClientService()
        this.imageBuilderService = new ImageBuilderService()
    }

    /**
     * Device Management Endpoints
     */

    registerDevice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const deviceInfo = req.body
            const result = await this.thinClientService.registerDevice(deviceInfo)

            if (result.success) {
                logger.info(`Device registered: ${result.device_id}`, {
                    deviceId: result.device_id,
                    macAddress: deviceInfo.mac_address
                })

                res.status(201).json({
                    success: true,
                    data: result
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to register device', { error })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    listDevices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status, location, limit, offset } = req.query
            
            const devices = await this.thinClientService.listDevices({
                status: status as string,
                location: location as string,
                limit: limit ? parseInt(limit as string) : undefined,
                offset: offset ? parseInt(offset as string) : undefined
            })

            res.json({
                success: true,
                data: {
                    devices,
                    total: devices.length
                }
            })
        } catch (error) {
            logger.error('Failed to list devices', { error })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    getDevice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId } = req.params
            const device = await this.thinClientService.getDevice(deviceId)

            if (device) {
                res.json({
                    success: true,
                    data: device
                })
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Device not found'
                })
            }
        } catch (error) {
            logger.error('Failed to get device', { error, deviceId: req.params.deviceId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    updateDevice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId } = req.params
            const updates = req.body

            const result = await this.thinClientService.updateDevice(deviceId, updates)

            if (result.success) {
                logger.info(`Device updated: ${deviceId}`, {
                    deviceId,
                    updates: Object.keys(updates)
                })

                res.json({
                    success: true,
                    data: result
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to update device', { error, deviceId: req.params.deviceId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    deleteDevice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId } = req.params
            const result = await this.thinClientService.deleteDevice(deviceId)

            if (result.success) {
                logger.info(`Device deleted: ${deviceId}`, {
                    deviceId
                })

                res.json({
                    success: true,
                    message: 'Device deleted successfully'
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to delete device', { error, deviceId: req.params.deviceId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    /**
     * Image Management Endpoints
     */

    createImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const imageSpec = req.body
            const result = await this.imageBuilderService.createImage(imageSpec)

            if (result.success) {
                logger.info(`Image build started: ${result.build_id}`, {
                    buildId: result.build_id,
                    imageName: imageSpec.name
                })

                res.status(202).json({
                    success: true,
                    data: {
                        build_id: result.build_id,
                        status: 'building',
                        message: 'Image build started'
                    }
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to create image', { error })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    listImages = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { limit, offset } = req.query
            
            const images = await this.thinClientService.listImages({
                limit: limit ? parseInt(limit as string) : undefined,
                offset: offset ? parseInt(offset as string) : undefined
            })

            res.json({
                success: true,
                data: {
                    images,
                    total: images.length
                }
            })
        } catch (error) {
            logger.error('Failed to list images', { error })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    getImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { imageId } = req.params
            const image = await this.thinClientService.getImage(imageId)

            if (image) {
                res.json({
                    success: true,
                    data: image
                })
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Image not found'
                })
            }
        } catch (error) {
            logger.error('Failed to get image', { error, imageId: req.params.imageId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    deleteImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { imageId } = req.params
            const result = await this.thinClientService.deleteImage(imageId)

            if (result.success) {
                logger.info(`Image deleted: ${imageId}`, {
                    imageId
                })

                res.json({
                    success: true,
                    message: 'Image deleted successfully'
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to delete image', { error, imageId: req.params.imageId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    /**
     * Deployment Management Endpoints
     */

    deployImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { imageId, deviceIds, deploymentMethod, options } = req.body

            const result = await this.thinClientService.deployImage({
                imageId,
                deviceIds,
                method: deploymentMethod,
                options: options || {}
            })

            if (result.success) {
                logger.info(`Deployment started: ${result.deployment_id}`, {
                    deploymentId: result.deployment_id,
                    imageId,
                    deviceCount: deviceIds.length,
                    method: deploymentMethod
                })

                res.status(202).json({
                    success: true,
                    data: result
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to deploy image', { error })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    listDeployments = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId, status, limit, offset } = req.query
            
            const deployments = await this.thinClientService.listDeployments({
                deviceId: deviceId as string,
                status: status as string,
                limit: limit ? parseInt(limit as string) : undefined,
                offset: offset ? parseInt(offset as string) : undefined
            })

            res.json({
                success: true,
                data: {
                    deployments,
                    total: deployments.length
                }
            })
        } catch (error) {
            logger.error('Failed to list deployments', { error })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    getDeployment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deploymentId } = req.params
            const deployment = await this.thinClientService.getDeployment(deploymentId)

            if (deployment) {
                res.json({
                    success: true,
                    data: deployment
                })
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Deployment not found'
                })
            }
        } catch (error) {
            logger.error('Failed to get deployment', { error, deploymentId: req.params.deploymentId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    /**
     * Device Monitoring Endpoints
     */

    deviceHeartbeat = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId } = req.params
            const systemInfo = req.body

            const result = await this.thinClientService.processHeartbeat(deviceId, systemInfo)

            // Check for pending commands
            const pendingCommands = await this.thinClientService.getPendingCommands(deviceId)

            res.json({
                success: true,
                data: {
                    acknowledged: true,
                    commands: pendingCommands
                }
            })
        } catch (error) {
            logger.error('Failed to process heartbeat', { error, deviceId: req.params.deviceId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    sendCommand = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId } = req.params
            const { command, data } = req.body

            const result = await this.thinClientService.sendCommand(deviceId, {
                type: command,
                data: data || {},
                user_id: 'system' // TODO: Get from authenticated user
            })

            if (result.success) {
                logger.info(`Command sent to device: ${deviceId}`, {
                    deviceId,
                    command,
                    commandId: result.command_id
                })

                res.json({
                    success: true,
                    data: result
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            logger.error('Failed to send command', { error, deviceId: req.params.deviceId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    getDeviceLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { deviceId } = req.params
            const { lines, logType } = req.query

            const logs = await this.thinClientService.getDeviceLogs(deviceId, {
                lines: lines ? parseInt(lines as string) : 100,
                logType: logType as string
            })

            res.json({
                success: true,
                data: logs
            })
        } catch (error) {
            logger.error('Failed to get device logs', { error, deviceId: req.params.deviceId })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }
}

export const thinClientController = new ThinClientController()