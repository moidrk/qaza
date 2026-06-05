import { createElement, type ComponentType } from "react"
import PasswordResetOtpEmail, {
  passwordResetOtpEmailSubject,
} from "../../emails/password-reset-otp"
import VerificationOtpEmail, {
  verificationOtpEmailSubject,
} from "../../emails/verification-otp"
import { getResendClient } from "@/lib/resend"

const OTP_EXPIRY_MINUTES = 15
const EMAIL_SEND_TIMEOUT_MS = 15_000

type OtpEmailInput = {
  email: string
  otp: string
}

type SendOtpEmailInput = OtpEmailInput & {
  subject: string
  textIntro: string
  textFooter: string
  templateId: string
  Template: ComponentType<{ otp: string }>
}

function getEmailConfig() {
  const from = process.env.EMAIL_FROM

  if (!from) {
    throw new Error("EMAIL_FROM is required to send transactional emails.")
  }

  return {
    from,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
  }
}

function shouldLogOtpEmail() {
  return process.env.NODE_ENV !== "production" && process.env.EMAIL_DELIVERY_MODE === "console"
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function buildOtpText(input: {
  intro: string
  otp: string
  footer: string
}) {
  return [
    "Qaza",
    "",
    input.intro,
    "",
    `Code: ${input.otp}`,
    `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    "",
    input.footer,
  ].join("\n")
}

async function sendOtpEmail({
  email,
  otp,
  subject,
  textIntro,
  textFooter,
  templateId,
  Template,
}: SendOtpEmailInput) {
  if (shouldLogOtpEmail()) {
    console.info(`[otp-email] template=${templateId} to=${email} otp=${otp}`)
    return
  }

  const resend = getResendClient()
  const { from, replyTo } = getEmailConfig()

  const { error } = await withTimeout(
    resend.emails.send({
      from,
      to: email,
      subject,
      react: createElement(Template, { otp }),
      text: buildOtpText({ intro: textIntro, otp, footer: textFooter }),
      replyTo,
      tags: [
        {
          name: "category",
          value: "auth",
        },
        {
          name: "template",
          value: templateId,
        },
      ],
    }),
    EMAIL_SEND_TIMEOUT_MS,
    `Resend timed out while sending ${subject}.`
  )

  if (error) {
    throw new Error(`Resend failed to send ${subject}: ${error.message}`)
  }
}

export function sendVerificationOtpEmail(input: OtpEmailInput) {
  return sendOtpEmail({
    ...input,
    subject: verificationOtpEmailSubject,
    textIntro: "Use this code to finish setting up your Qaza account.",
    textFooter: "If you did not create a Qaza account, you can ignore this email.",
    templateId: "verification-otp",
    Template: VerificationOtpEmail,
  })
}

export function sendPasswordResetOtpEmail(input: OtpEmailInput) {
  return sendOtpEmail({
    ...input,
    subject: passwordResetOtpEmailSubject,
    textIntro: "Use this code to choose a new password for your Qaza account.",
    textFooter: "If you did not request this, you can ignore this email.",
    templateId: "password-reset-otp",
    Template: PasswordResetOtpEmail,
  })
}
