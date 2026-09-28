import nodemailer, { Transporter } from 'nodemailer';

let cachedTransport: Transporter | null = null;

/**
 * Lazily builds a Gmail SMTP transport from environment credentials.
 * Returns null (rather than throwing) when SMTP is not configured, so the
 * server still boots and the caller can fall back to logging the link.
 */
function getTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  cachedTransport = nodemailer.createTransport({
    // Default `service: 'gmail'` pins port 465 (implicit TLS), which some
    // sandboxed hosts (Render free tier included) cannot reach — the socket
    // then blocks until the TCP timeout. 587 + STARTTLS is the same provider
    // over a port those networks leave open.
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    // Without these the socket waits on the OS TCP timeout (~120s) when the
    // SMTP port is unreachable, which stalls the whole register /
    // forgot-password request. Fail fast instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  return cachedTransport;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

interface SendVerificationEmailArgs {
  to: string;
  name: string;
  verificationUrl: string;
}

/**
 * Sends the "confirm your email" message. Returns true when handed to Gmail.
 * Never throws — a failed send must not block account creation, and the
 * caller can always re-issue a link via the resend endpoint.
 */
export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
}: SendVerificationEmailArgs): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  const fromName = process.env.MAIL_FROM_NAME || 'CollabZ';
  const brand = fromName;

  try {
    await transport.sendMail({
      from: `"${brand}" <${process.env.SMTP_USER}>`,
      to,
      subject: `Confirm your email to finish setting up ${brand}`,
      text: [
        `Hi ${name},`,
        '',
        'Thanks for creating an account. Please confirm your email address to activate access:',
        '',
        verificationUrl,
        '',
        'This link expires in 24 hours.',
        'If you did not create this account, you can safely ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0b0b12;padding:32px 16px;">
          <div style="max-width:520px;margin:0 auto;background:#12121c;border:1px solid #26263a;border-radius:16px;padding:32px;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#f5f3ef;letter-spacing:-0.01em;">
              ${brand}
            </h1>
            <p style="margin:0 0 24px;font-size:13px;color:#8b8a99;">
              Confirm your email address
            </p>

            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#c9c7d1;">
              Hi ${escapeHtml(name)}, thanks for creating an account. Please confirm your
              email address to activate access to your workspace.
            </p>

            <a href="${verificationUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#818cf8);color:#ffffff;
                      text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:12px;">
              Verify my email
            </a>

            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6f6e7d;">
              This link expires in 24 hours. If you did not create this account,
              you can safely ignore this email.
            </p>

            <hr style="border:none;border-top:1px solid #26263a;margin:24px 0 16px;" />
            <p style="margin:0;font-size:11px;color:#56555f;word-break:break-all;">
              If the button does not work, paste this link into your browser:<br />
              ${verificationUrl}
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err: any) {
    console.error('Failed to send verification email:', err?.message || err);
    return false;
  }
}

interface SendPasswordResetEmailArgs {
  to: string;
  name: string;
  resetUrl: string;
}

/**
 * Sends the "reset your password" message. Returns true when handed to Gmail.
 * Never throws — a failed send must not block the reset endpoint, and the
 * caller can always surface the link directly as a fallback.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: SendPasswordResetEmailArgs): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  const fromName = process.env.MAIL_FROM_NAME || 'CollabZ';
  const brand = fromName;

  try {
    await transport.sendMail({
      from: `"${brand}" <${process.env.SMTP_USER}>`,
      to,
      subject: `Reset your ${brand} password`,
      text: [
        `Hi ${name},`,
        '',
        'We received a request to reset the password on your account. Choose a new password using the link below:',
        '',
        resetUrl,
        '',
        'This link expires in 1 hour.',
        'If you did not request a reset, you can safely ignore this email — your password will not change.',
      ].join('\n'),
      html: `
        <div style="font-family:-apple-system,BlinkMacFontFamily,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0b0b12;padding:32px 16px;">
          <div style="max-width:520px;margin:0 auto;background:#12121c;border:1px solid #26263a;border-radius:16px;padding:32px;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#f5f3ef;letter-spacing:-0.01em;">
              ${brand}
            </h1>
            <p style="margin:0 0 24px;font-size:13px;color:#8b8a99;">
              Password reset request
            </p>

            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#c9c7d1;">
              Hi ${escapeHtml(name)}, we received a request to reset the password on your account.
              Choose a new password using the link below.
            </p>

            <a href="${resetUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#818cf8);color:#ffffff;
                      text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:12px;">
              Reset my password
            </a>

            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6f6e7d;">
              This link expires in 1 hour. If you did not request a reset, you can
              safely ignore this email — your password will not change.
            </p>

            <hr style="border:none;border-top:1px solid #26263a;margin:24px 0 16px;" />
            <p style="margin:0;font-size:11px;color:#56555f;word-break:break-all;">
              If the button does not work, paste this link into your browser:<br />
              ${resetUrl}
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err: any) {
    console.error('Failed to send password reset email:', err?.message || err);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
