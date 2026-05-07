import './setupMonacoWorkers' // must be first — sets window.MonacoEnvironment before monaco loads
import { createRoot } from 'react-dom/client'
import { App, ErrorBoundary } from './App'

const root = createRoot(document.getElementById('root')!)
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
)
