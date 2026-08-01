import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Netlify OAuth popup callback: if we're the popup opened by connectNetlify,
// hand the token back to the opener and close — never render the editor here.
{
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const token = hash.get('access_token')
  if (token && window.opener) {
    window.opener.postMessage({ nfToken: token }, window.location.origin)
    window.close()
    throw new Error('oauth popup: closing')
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('no root element')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
