const DEFAULT_BLOCKED_EMAIL_DOMAINS = ["a7gi.ru"]

function getConfiguredBlockedEmailDomains() {
  return (process.env.BLOCKED_EMAIL_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
}

export function getEmailDomain(email: string) {
  const [, domain = ""] = email.toLowerCase().trim().split("@")
  return domain
}

export function isBlockedEmail(email: string) {
  const domain = getEmailDomain(email)
  if (!domain) return true

  const blockedDomains = new Set([
    ...DEFAULT_BLOCKED_EMAIL_DOMAINS,
    ...getConfiguredBlockedEmailDomains(),
  ])

  for (const blockedDomain of blockedDomains) {
    if (blockedDomain.startsWith("*.")) {
      const suffix = blockedDomain.slice(1)
      if (domain.endsWith(suffix)) return true
      continue
    }

    if (blockedDomain.startsWith(".")) {
      if (domain.endsWith(blockedDomain)) return true
      continue
    }

    if (domain === blockedDomain) return true
  }

  return false
}

export function isLikelyRandomName(name: string) {
  const compactName = name.trim().replace(/\s+/g, "")
  if (compactName.length < 12 || compactName.length !== name.trim().length) {
    return false
  }

  const hasLowercase = /[a-z]/.test(compactName)
  const hasUppercase = /[A-Z]/.test(compactName)
  const hasDigit = /\d/.test(compactName)

  if (hasDigit && hasLowercase && hasUppercase) {
    return true
  }

  let caseTransitions = 0
  for (let index = 1; index < compactName.length; index += 1) {
    const previous = compactName[index - 1]
    const current = compactName[index]
    if (
      (/[a-z]/.test(previous) && /[A-Z]/.test(current)) ||
      (/[A-Z]/.test(previous) && /[a-z]/.test(current))
    ) {
      caseTransitions += 1
    }
  }

  return hasLowercase && hasUppercase && compactName.length >= 14 && caseTransitions >= 4
}

export function isHoneypotFilled(formData: FormData) {
  return String(formData.get("companyWebsite") || "").trim().length > 0
}

export function isTooFastRegistration(formData: FormData, minimumMs = 1500) {
  const startedAt = Number(formData.get("startedAt"))
  return Number.isFinite(startedAt) && Date.now() - startedAt < minimumMs
}
