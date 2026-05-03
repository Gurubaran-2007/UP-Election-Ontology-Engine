import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import './index.css';
import App from './App';
import AppLayout from './components/Layout/AppLayout';

const domain   = import.meta.env.VITE_AUTH0_DOMAIN   as string;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string;

// DEV MODE: if Auth0 credentials are not configured, skip auth entirely
const AUTH_READY = domain && domain !== 'your-tenant.auth0.com' && clientId && clientId !== 'your_auth0_client_id';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {AUTH_READY ? (
        <Auth0Provider
          domain={domain}
          clientId={clientId}
          authorizationParams={{ redirect_uri: window.location.origin }}
        >
          <App />
        </Auth0Provider>
      ) : (
        <AppLayout />
      )}
    </BrowserRouter>
  </StrictMode>,
);
