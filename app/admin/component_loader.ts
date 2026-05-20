import { ComponentLoader } from 'adminjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const componentLoader = new ComponentLoader()

export const COMPONENTS = {
  Dashboard: componentLoader.add('Dashboard', path.join(__dirname, './components/Dashboard.jsx')),
  GenerateSignalComponent: componentLoader.add('GenerateSignalComponent', path.join(__dirname, './components/GenerateSignalComponent.jsx')),
  ImageUploadComponent: componentLoader.add('ImageUploadComponent', path.join(__dirname, './components/ImageUploadComponent.jsx')),
  ConsolidationReport: componentLoader.add('ConsolidationReport', path.join(__dirname, './components/ConsolidationReport.jsx')),
}

export default componentLoader
