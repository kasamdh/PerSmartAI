import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Cloudflare Turnstile in a small web view, for the auth requests Supabase
// protects with CAPTCHA (password sign-in, sign-up, emailed codes, password
// reset). It's usually invisible; people only see it when Cloudflare wants a
// click. Off when EXPO_PUBLIC_TURNSTILE_SITE_KEY isn't set (local development).

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
// Turnstile checks the page's hostname against the site key's allowed domains.
const BASE_URL = process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL ?? process.env.EXPO_PUBLIC_LEGAL_URL;

export const captchaEnabled = !!SITE_KEY && !!BASE_URL;

type Message = { type: 'token'; token: string } | { type: 'expired' } | { type: 'error' };

/** The page the web view loads: renders the widget and posts the token back. */
export function turnstileHtml(siteKey: string): string {
  // JSON-encode, and escape '<' so the value can never close the <script> tag.
  const key = JSON.stringify(siteKey).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=start&render=explicit" async defer></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style></head>
<body><div id="w"></div><script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function start(){turnstile.render('#w',{sitekey:${key},appearance:'interaction-only',
callback:function(t){send({type:'token',token:t})},
'expired-callback':function(){send({type:'expired'})},
'error-callback':function(){send({type:'error'})}})}
</script></body></html>`;
}

export function parseCaptchaMessage(data: string): Message | null {
  try {
    const m = JSON.parse(data) as Partial<Message> & { token?: unknown };
    if (m.type === 'token' && typeof m.token === 'string' && m.token)
      return { type: 'token', token: m.token };
    if (m.type === 'expired' || m.type === 'error') return { type: m.type };
  } catch {
    // ignore anything else the page posts
  }
  return null;
}

/**
 * A CAPTCHA for one form. `token` is single-use: call `reset()` after each request
 * (successful or not) to get a fresh one.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setFailed(false);
    setRound((r) => r + 1);
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseCaptchaMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'token') {
      setToken(message.token);
      setFailed(false);
    } else {
      setToken(null);
      setFailed(message.type === 'error');
    }
  }, []);

  const view =
    captchaEnabled && SITE_KEY && BASE_URL ? (
      <View style={styles.box} accessibilityLabel="Security check">
        <WebView
          key={round}
          originWhitelist={['*']}
          source={{ html: turnstileHtml(SITE_KEY), baseUrl: BASE_URL }}
          onMessage={onMessage}
          javaScriptEnabled
          scrollEnabled={false}
          style={styles.webview}
        />
      </View>
    ) : null;

  return {
    /** Pass to Supabase as `captchaToken` (undefined when CAPTCHA is off). */
    token: token ?? undefined,
    /** Whether the form may be sent now. */
    ready: !captchaEnabled || !!token,
    failed,
    view,
    reset,
  };
}

const styles = StyleSheet.create({
  box: { height: 70, alignSelf: 'stretch' },
  webview: { backgroundColor: 'transparent' },
});
