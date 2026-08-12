import { ComponentLoader } from 'adminjs'
import path from 'node:path'

const componentLoader = new ComponentLoader()

const rootPath = process.cwd()

export const COMPONENTS = {
  // Dashboard: componentLoader.add('Dashboard', path.join(rootPath, 'app/admin/components/Dashboard.jsx')),
  // GenerateSignalComponent: componentLoader.add('GenerateSignalComponent', path.join(rootPath, 'app/admin/components/GenerateSignalComponent.jsx')),
  // ImageUploadComponent: componentLoader.add('ImageUploadComponent', path.join(rootPath, 'app/admin/components/ImageUploadComponent.jsx')),
  // ConsolidationReport: componentLoader.add('ConsolidationReport', path.join(rootPath, 'app/admin/components/ConsolidationReport.jsx')),
}

export default componentLoader
