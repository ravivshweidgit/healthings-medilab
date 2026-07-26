/**
 * Clinic portal copy catalog (be-25 plumbing; locales filled by be-26).
 *
 * Language policy reversed 2026-07-26: the portal is localized, because clinics
 * are global. Locale is per clinician account and independent of the patient's
 * app language — a Hebrew patient may be treated by an English clinic.
 *
 * Shape mirrors `app/src/i18n/*Copy.ts`: one flat object per locale, English is
 * the fallback for any key a locale has not filled yet, so a partial locale
 * degrades to English per string instead of blanking the UI.
 *
 * Patient-authored text (emails, meal names, rules the patient wrote) is never
 * translated and must render with `dir="auto"`.
 */
(function (global) {
  const STORE_KEY = 'healthings_clinic_locale';

  /** The app's 10 languages (SUPPORTED_LANGUAGES), not the help site's 8. */
  const CLINIC_LOCALES = [
    { code: 'en', dir: 'ltr', label: 'EN', name: 'English', flag: '🇬🇧' },
    { code: 'he', dir: 'rtl', label: 'HE', name: 'עברית', flag: '🇮🇱' },
    { code: 'es', dir: 'ltr', label: 'ES', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', dir: 'ltr', label: 'FR', name: 'Français', flag: '🇫🇷' },
    { code: 'de', dir: 'ltr', label: 'DE', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ar', dir: 'rtl', label: 'AR', name: 'العربية', flag: '🇸🇦' },
    { code: 'ru', dir: 'ltr', label: 'RU', name: 'Русский', flag: '🇷🇺' },
    { code: 'pt', dir: 'ltr', label: 'PT', name: 'Português', flag: '🇧🇷' },
    { code: 'it', dir: 'ltr', label: 'IT', name: 'Italiano', flag: '🇮🇹' },
    { code: 'tr', dir: 'ltr', label: 'TR', name: 'Türkçe', flag: '🇹🇷' },
  ];

  /**
   * Always-English glossary, per language-policy: brand, units, acronyms.
   * "tokens" is the metered unit and stays as-is in every locale (be-22).
   */
  const EN = {
    brand: 'Healthings',
    brandSub: 'Clinic',

    // Login
    loginTitle: 'Clinic portal',
    loginLead: 'Sign in with your clinic account (email code).',
    emailLabel: 'Email',
    codeLabel: 'One-time code',
    sendCode: 'Send code',
    sendingCode: 'Sending…',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    changeEmail: 'Change email',
    codeSentTo: 'Code sent to',
    enterEmail: 'Enter your clinic email address.',
    enterEmailFirst: 'Enter your email first.',
    enterCode: 'Enter the 6-digit code from your email.',
    couldNotSendCode: 'Could not send code',
    invalidCode: 'Invalid code',
    unreachable: 'Could not reach server — try again',

    // Shell
    signOut: 'Sign out',
    sessionExpired: 'Session expired',
    couldNotLoadAccount: 'Could not load account',
    mentorOnly: 'This portal is for clinic accounts only',
    couldNotLoadPortal: 'Could not load clinic portal',
    couldNotLoadShares: 'Could not load patient shares',
    tokensUnit: 'tokens',

    // Invite
    inviteLabel: 'Invite patient',
    invitePlaceholder: 'patient@example.com',
    sendInvite: 'Send invite',
    sendingInvite: 'Sending…',
    inviteNote:
      'They get an email and must approve in the app before anything is shared. Use Sponsor AI on a linked patient to pay for their coach.',
    inviteNeedsEmail: 'Enter the patient email address.',
    inviteNotEmail: 'That does not look like an email address.',
    inviteFailed: 'Invite failed — try again.',
    inviteFailedNetwork: 'Invite failed — check your connection.',
    inviteSent:
      'Invite sent to {email}. They will get an email — nothing is shared until they approve in the app. It also appears under Outgoing.',
    inviteSavedNoEmail:
      'Invite saved for {email}, but the email could not be sent. Ask them to open the Healthings app and check pending clinic invites, or try again later.',

    // Worklist
    filterLabel: 'Patient list filter',
    filterLinked: 'Linked',
    filterPending: 'Pending',
    filterOutgoing: 'Outgoing',
    filterAll: 'All',
    searchPlaceholder: 'Search patients…',
    sortLabel: 'Sort patients',
    sortEmail: 'Email A–Z',
    sortSync: 'Last sync',
    sortSponsor: 'Sponsorship',
    colPatient: 'Patient',
    colSync: 'Sync',
    colSponsor: 'Sponsor',
    colActions: 'Actions',
    emptyLinked: 'No linked patients yet — invite someone above.',
    emptyPending: 'No pending requests.',
    emptyOutgoing: 'No outgoing invites.',
    emptyAll: 'No patients yet — invite someone above.',
    emptySearch: 'No patients match that search.',
    showingRange: 'Showing {from}–{to} of {total}',
    previous: 'Previous',
    next: 'Next',

    // Row status
    statusWaitingApproval: 'waiting for patient approval',
    statusPatientRequested: 'patient requested access',
    statusApproved: 'approved',
    statusRejected: 'rejected',
    statusRevoked: 'revoked',
    syncNever: 'Never',
    syncJustNow: 'Just now',
    syncMinutesAgo: '{n}m ago',
    syncHoursAgo: '{n}h ago',
    syncDaysAgo: '{n}d ago',

    // Actions
    openWorkspace: 'Open workspace',
    approve: 'Approve',
    approving: 'Approving…',
    reject: 'Reject',
    rejecting: 'Rejecting…',
    cancelInvite: 'Cancel invite',
    cancelling: 'Cancelling…',
    revokeAccess: 'Revoke access',
    revoking: 'Revoking…',
    working: 'Working…',
    cancel: 'Cancel',

    // Sponsorship
    sponsorAi: 'Sponsor AI',
    renewSponsorship: 'Renew AI sponsorship',
    stopSponsorship: 'Stop AI sponsorship',
    starting: 'Starting…',
    stopping: 'Stopping…',
    sponsorFor: 'Sponsor for',
    startSponsorship: 'Start sponsorship',
    daysOption: '{n} days',
    until: '· until {date}',
    notSponsored: 'AI not sponsored',
    sponsorshipExpired: 'AI sponsorship expired',
    sponsorshipEndedAgo: 'AI sponsorship ended {days} ago',
    sponsoredEndsToday: 'AI sponsored · ends today',
    sponsoredDaysLeft: 'AI sponsored · {days} left',
    endedOn: 'Ended {date}',
    untilDate: 'Until {date}',
    oneDay: '1 day',
    nDays: '{n} days',

    // Confirms + results
    confirmRevoke:
      'Revoke access for {email}? They will need to re-approve to share again.',
    confirmCancel: 'Cancel invite to {email}?',
    actionFailed: 'Action failed',
    done: 'Done.',
    resultApproved: 'Approved {email}. Their data is now available in your workspace.',
    resultRejected: 'Rejected the request from {email}.',
    resultCancelled: 'Invite to {email} cancelled.',
    resultRevoked:
      'Access revoked for {email}. Their snapshot is deleted unless another clinic still reads it.',
    resultSponsorOn: 'Sponsoring AI for {email} for {days} — until {date}.',
    resultSponsorOff:
      'AI sponsorship stopped for {email}. Their coach now bills to their own credits.',
    couldNotStartSponsorship: 'Could not start sponsorship',
    couldNotStopSponsorship: 'Could not stop sponsorship',

    // My clinic
    myClinicSummary: 'My clinic',
    myClinicHint: 'display name shown to patients',
    displayNameLabel: 'Clinic display name',
    displayNamePlaceholder: 'Dr. Cohen Nutrition',
    saveName: 'Save name',
    saving: 'Saving…',
    couldNotSaveName: 'Could not save the name.',
    nameSaved: 'Saved. Patients will see “{name}” on invites and in the app.',
    nameCleared: 'Display name cleared. Patients will see your email address instead.',
    languageLabel: 'Portal language',

    // Alpha (?dev=1)
    creditsTitle: 'AI credits (alpha)',
    creditsLead:
      'When balance runs low, your saved card is charged automatically and tokens reload.',
    balance: 'Balance:',
    paymentMethod: 'Payment method: {value}',
    pmCard: 'card on file',
    pmNone: 'none (auto-reload simulated in alpha)',
    pmUnknown: '—',
    attachCard: 'Attach test card (alpha)',
    attaching: 'Attaching…',
    manualPack: 'Manual token pack',
    adding: 'Adding…',
    couldNotAttachCard: 'Could not attach the card.',
    couldNotAddCredits: 'Could not add credits.',
    cardAttached:
      'Test card attached. Credits reload automatically when the balance runs low.',
    creditsAdded: 'Credits added. Balance is now {balance} tokens.',
    usageTitle: 'AI usage (alpha)',
    usageLead: 'Usage debits payer credits (Stripe later).',
    noUsage: 'No AI usage recorded yet.',
    usageTotal: 'Total tokens (all patients): ',
    usageRow: '{tokens} tokens · {events} events',
  };

  /** be-26 fills these. Missing keys fall back to English, per string. */
  const COPY = {
    en: EN,
    he: {},
    es: {},
    fr: {},
    de: {},
    ar: {},
    ru: {},
    pt: {},
    it: {},
    tr: {},
  };

  function normalize(code) {
    if (!code) return null;
    const base = String(code).toLowerCase().split('-')[0];
    return CLINIC_LOCALES.some((l) => l.code === base) ? base : null;
  }

  function detectLocale() {
    try {
      const saved = normalize(localStorage.getItem(STORE_KEY));
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    const langs = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const hit = normalize(l);
      if (hit) return hit;
    }
    return 'en';
  }

  let current = detectLocale();

  function localeMeta(code) {
    return CLINIC_LOCALES.find((l) => l.code === (code || current)) || CLINIC_LOCALES[0];
  }

  function setLocale(code) {
    const next = normalize(code) || 'en';
    current = next;
    try {
      localStorage.setItem(STORE_KEY, next);
    } catch {
      /* ignore */
    }
    applyDocumentLocale();
    return next;
  }

  /** `lang` + `dir` on <html> so RTL locales mirror the whole portal. */
  function applyDocumentLocale() {
    const meta = localeMeta(current);
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole,
    );
  }

  /** Per-string English fallback: a half-translated locale never blanks the UI. */
  function t(key, vars) {
    const table = COPY[current] || {};
    const value = table[key] != null ? table[key] : EN[key];
    if (value == null) return key;
    return interpolate(value, vars);
  }

  global.ClinicI18n = {
    CLINIC_LOCALES,
    COPY,
    t,
    setLocale,
    applyDocumentLocale,
    getLocale: () => current,
    localeMeta,
  };
})(window);
