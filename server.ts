import { Application } from '@feathersjs/feathers'
import { Configuration, createApp } from '@hexafield/ir-simple-api/src/server'
import baseServices from '@hexafield/ir-simple-api/src/server/services'
import dotenv from 'dotenv'

const cwd = process.cwd()

dotenv.config({
  path: cwd + '/.env.local'
})

const config: Configuration = {
  clientHost: process.env['CLIENT_HOST'] || 'localhost',
  clientPort: Number(process.env['CLIENT_PORT']) || null,
  serverHost: process.env['SERVER_HOST'] || 'localhost',
  serverPort: Number(process.env['SERVER_PORT']) || 3030,
  certPath: process.env['CERT'] || null, 
  keyPath: process.env['KEY'] || null
}

const services = (app: Application) => {
  baseServices(app)
}

createApp(services, config)
