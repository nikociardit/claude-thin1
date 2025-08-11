import { Router } from 'express'
import { thinClientController } from '../controllers/thin-client.controller'

export const thinClientRoutes = Router()

// Device Management
thinClientRoutes.post('/devices', thinClientController.registerDevice)
thinClientRoutes.get('/devices', thinClientController.listDevices)
thinClientRoutes.get('/devices/:deviceId', thinClientController.getDevice)
thinClientRoutes.put('/devices/:deviceId', thinClientController.updateDevice)
thinClientRoutes.delete('/devices/:deviceId', thinClientController.deleteDevice)

// Image Management
thinClientRoutes.post('/images', thinClientController.createImage)
thinClientRoutes.get('/images', thinClientController.listImages)
thinClientRoutes.get('/images/:imageId', thinClientController.getImage)
thinClientRoutes.delete('/images/:imageId', thinClientController.deleteImage)

// Deployment Management
thinClientRoutes.post('/deployments', thinClientController.deployImage)
thinClientRoutes.get('/deployments', thinClientController.listDeployments)
thinClientRoutes.get('/deployments/:deploymentId', thinClientController.getDeployment)

// Device Monitoring
thinClientRoutes.post('/devices/:deviceId/heartbeat', thinClientController.deviceHeartbeat)
thinClientRoutes.post('/devices/:deviceId/commands', thinClientController.sendCommand)
thinClientRoutes.get('/devices/:deviceId/logs', thinClientController.getDeviceLogs)