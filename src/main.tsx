import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { device, isIOS } from './utils/device'

// Stamp device class on <html> so CSS can target it
document.documentElement.dataset.device = device
if (isIOS) document.documentElement.classList.add('ios')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
