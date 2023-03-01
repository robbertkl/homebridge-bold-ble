import { FunctionComponent, useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';

const WEBSOCKET_URL = 'wss://bold-ws.nienhuisdevelopment.com';
const CALLBACK_URL = 'https://bold.nienhuisdevelopment.com/oauth/callback';
const AUTHORIZE_URL = 'https://auth.boldsmartlock.com';

type OAuthMessage =
  | {
      action: 'oauthBegin';
      payload: {
        callbackId: number;
      };
    }
  | {
      action: 'oauthCallback';
      payload: {
        accessToken: string;
        refreshToken: string;
      };
    };

export const App: FunctionComponent = () => {
  const [haveConfig, setHaveConfig] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>();
  const [isAuthenticating, setAuthenticating] = useState<boolean>(false);
  const [url, setUrl] = useState<string | undefined>();

  const { sendJsonMessage, lastJsonMessage } = useWebSocket(isAuthenticating ? WEBSOCKET_URL : null, {
    onError() {
      setError(new Error('Could not connect WebSocket'));
    },
  });

  useEffect(() => {
    (async () => {
      const config = await homebridge.getPluginConfig();
      if (config && config.length > 0 && config[0].accessToken && config[0].refreshToken) {
        setHaveConfig(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (haveConfig) {
      homebridge.showSchemaForm();
    } else {
      homebridge.hideSchemaForm();
    }
  }, [haveConfig]);

  useEffect(() => {
    if (error) {
      setAuthenticating(false);
      setUrl(undefined);
    }
  }, [error]);

  useEffect(() => {
    if (!lastJsonMessage || !('action' in lastJsonMessage)) {
      return;
    }

    const message = lastJsonMessage as OAuthMessage;
    if (message.action === 'oauthBegin') {
      const callbackId = message.payload.callbackId;
      setUrl(
        `${AUTHORIZE_URL}?response_type=code&client_id=HomeBridge&redirect_uri=${encodeURIComponent(
          CALLBACK_URL
        )}&state=${encodeURIComponent(callbackId)}`
      );
    } else if (message.action === 'oauthCallback') {
      (async () => {
        let config = await homebridge.getPluginConfig();
        if (!config || config.length == 0) {
          config = [{ platform: 'BoldBLE' }];
        }

        config[0].accessToken = message.payload.accessToken;
        config[0].refreshToken = message.payload.refreshToken;
        config[0].legacyAuthentication = false;
        delete config[0].refreshURL;

        await homebridge.updatePluginConfig(config);

        setAuthenticating(false);
        setHaveConfig(true);
      })();
    }
  }, [lastJsonMessage]);

  let info = '';
  let caption = '';
  let isLoading = false;
  let action: (() => void) | undefined;

  if (!isAuthenticating) {
    if (error) {
      info = 'Click the button below to retry the authentication process.';
      caption = 'Retry Authentication';
    } else if (haveConfig) {
      info = 'Plugin configured!\nClick the button below if you wish to redo the authentication process.';
      caption = 'Re-Authenticate';
    } else {
      info = 'Click the button below to start the process of authenticating your Bold account.';
      caption = 'Authenticate';
    }

    action = () => {
      setError(undefined);
      setAuthenticating(true);
      setUrl(undefined);
      sendJsonMessage({ action: 'oauthBegin' });
    };
  } else if (url) {
    info = 'Click the button below to sign into your Bold account in a new tab.';
    caption = 'Sign in at Bold';
    action = () => {
      window.open(url);
    };
  } else {
    isLoading = true;
    caption = 'Initializing...';
  }

  return (
    <div className="d-flex flex-column align-items-center text-center">
      {error && (
        <div className="alert alert-danger align-self-stretch" role="alert">
          <b>Error:</b> {error.message}
        </div>
      )}
      {info && info.split('\n').map(line => <div className="mb-2">{line}</div>)}
      <button className="btn btn-primary" type="button" disabled={isLoading} onClick={action}>
        {isLoading && <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>}
        {caption}
      </button>
      {!isAuthenticating && (
        <div className="mt-2">
          Click{' '}
          <a href="https://github.com/robbertkl/homebridge-bold-ble#configuration" target="_blank">
            here
          </a>{' '}
          for more info on the plugin configuration.
        </div>
      )}
    </div>
  );
};
