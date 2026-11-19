import { env } from '../../config/env.js';
import type { EmailMessage } from '../../integrations/email/index.js';

const link = (path: string, token: string) => `${env.APP_URL}${path}?token=${encodeURIComponent(token)}`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#FAF8F5;font-family:Manrope,Arial,sans-serif;color:#202B27">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E5EAE6;border-radius:8px">
<tr><td style="padding:24px 32px;border-bottom:1px solid #E5EAE6;font-family:Georgia,serif;font-size:22px;color:#17332C">Alifya Academy</td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:20px;color:#17332C">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#17332C;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>
<p style="font-size:13px;color:#68756F">If the button does not work, copy this link into your browser:<br>${escapeHtml(href)}</p>`;

export function verifyEmail(to: string, name: string, token: string): EmailMessage {
  const href = link('/verify-email', token);
  return {
    to,
    subject: 'Verify your Alifya Academy account',
    text: `Hello ${name},\n\nPlease confirm your email address to activate your Alifya Academy account:\n${href}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.`,
    html: layout(
      'Confirm your email address',
      `<p>Hello ${escapeHtml(name)},</p><p>Please confirm your email address to activate your account.</p>${button(href, 'Verify email')}<p style="font-size:13px;color:#68756F">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>`,
    ),
  };
}

export function passwordReset(to: string, name: string, token: string): EmailMessage {
  const href = link('/reset-password', token);
  return {
    to,
    subject: 'Reset your Alifya Academy password',
    text: `Hello ${name},\n\nUse this link to choose a new password:\n${href}\n\nThe link expires in 1 hour and can be used once. If you did not request this, ignore this email — your password is unchanged.`,
    html: layout(
      'Reset your password',
      `<p>Hello ${escapeHtml(name)},</p><p>Use the button below to choose a new password.</p>${button(href, 'Choose a new password')}<p style="font-size:13px;color:#68756F">The link expires in 1 hour and can be used once. If you did not request this, ignore this email.</p>`,
    ),
  };
}

export function alreadyRegistered(to: string): EmailMessage {
  const href = `${env.APP_URL}/forgot-password`;
  return {
    to,
    subject: 'Alifya Academy sign-up attempt',
    text: `Someone tried to create an Alifya Academy account with this email address, which is already registered.\n\nIf this was you, sign in or reset your password: ${href}\nIf it was not you, no action is needed.`,
    html: layout(
      'You already have an account',
      `<p>Someone tried to create an account with this email address, which is already registered.</p>${button(href, 'Reset password')}<p style="font-size:13px;color:#68756F">If it was not you, no action is needed.</p>`,
    ),
  };
}
