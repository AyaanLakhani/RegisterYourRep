import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivyProvider
      appId="cmlwst2sr00cy0bk4bgigcn3b"
      config={{
        loginMethods: ['email', 'google-oauth'],
        appearance: {
          theme: 'dark',
          accentColor: '#ff1e00',
        },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
