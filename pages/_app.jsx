// pages/_app.jsx  ←  was: client/src/main.jsx
// In Pages Router, _app.jsx is the root wrapper — perfect place for PrivyProvider
import { PrivyProvider } from '@privy-io/react-auth'
import '@/styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google-oauth'],
        appearance: {
          theme: 'dark',
          accentColor: '#ff1e00',
        },
      }}
    >
      <Component {...pageProps} />
    </PrivyProvider>
  )
}
