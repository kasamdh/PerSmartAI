import { parseCaptchaMessage, turnstileHtml } from '../captcha';

describe('turnstileHtml', () => {
  it('renders Turnstile with the site key, quietly unless a click is needed', () => {
    const html = turnstileHtml('0x4AAA-key');
    expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(html).toContain('sitekey:"0x4AAA-key"');
    expect(html).toContain("appearance:'interaction-only'");
  });

  it('escapes the key so it can’t break out of the script', () => {
    const html = turnstileHtml('x"</script><script>alert(1)');
    expect(html).not.toContain('</script><script>alert');
    expect(html).toContain('sitekey:"x\\"\\u003c/script>\\u003cscript>alert(1)"');
  });
});

describe('parseCaptchaMessage', () => {
  it('reads tokens, expiry and errors from the page', () => {
    expect(parseCaptchaMessage('{"type":"token","token":"abc"}')).toEqual({
      type: 'token',
      token: 'abc',
    });
    expect(parseCaptchaMessage('{"type":"expired"}')).toEqual({ type: 'expired' });
    expect(parseCaptchaMessage('{"type":"error"}')).toEqual({ type: 'error' });
  });

  it('ignores anything else', () => {
    expect(parseCaptchaMessage('not json')).toBeNull();
    expect(parseCaptchaMessage('{"type":"token","token":""}')).toBeNull();
    expect(parseCaptchaMessage('{"type":"other"}')).toBeNull();
  });
});
