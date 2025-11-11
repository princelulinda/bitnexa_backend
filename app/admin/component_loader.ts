import { ComponentLoader } from 'adminjs'

const componentLoader = new ComponentLoader()

componentLoader.add('ConsolidationReport', './components/ConsolidationReport.jsx')
componentLoader.add('Dashboard', './components/Dashboard.jsx')
componentLoader.add('ImageUploadComponent', './components/ImageUploadComponent.jsx')
componentLoader.add('GenerateSignalComponent', './components/GenerateSignalComponent.jsx')

export default componentLoader