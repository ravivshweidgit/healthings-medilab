/**
 * RULES strip chrome — coach language, 7 locales.
 */

export type RulesStripCopy = {
  emptySubtitle: string;
  emptyBody: string;
  addRules: string;
  editRules: string;
  yourRules: string;
  showMore: string;
  showLess: string;
  pastVersions: (n: number) => string;
  save: string;
  cancel: string;
  editTitle: string;
  placeholder: string;
  discardTitle: string;
  discardMessage: string;
  discardConfirm: string;
  restoreTitle: string;
  restoreMessage: string;
  restoreConfirm: string;
  restoreAsActive: string;
  close: string;
  saving: string;
};

const EN: RulesStripCopy = {
  emptySubtitle: 'Tap to add rules',
  emptyBody: 'Write dietary or lifestyle rules mentors should follow.',
  addRules: 'Add rules',
  editRules: 'Edit',
  yourRules: 'Your rules',
  showMore: 'Show more',
  showLess: 'Show less',
  pastVersions: (n) => `Past versions (${n})`,
  save: 'Save',
  cancel: 'Cancel',
  editTitle: 'Edit rules',
  placeholder: 'e.g. high cholesterol, IF 16:8, avoid red meat, kidney protein limit',
  discardTitle: 'Discard changes?',
  discardMessage: 'Your edits will be lost.',
  discardConfirm: 'Discard',
  restoreTitle: 'Restore this version?',
  restoreMessage: 'Your current rules will be saved to history and this version will become active.',
  restoreConfirm: 'Restore',
  restoreAsActive: 'Restore as active rules',
  close: 'Close',
  saving: 'Saving…',
};

const HE: RulesStripCopy = {
  emptySubtitle: 'הקש להוספת כללים',
  emptyBody: 'כתבו כללי תזונה או אורח חיים שהמנטורים צריכים לעקוב אחריהם.',
  addRules: 'הוסף כללים',
  editRules: 'עריכה',
  yourRules: 'הכללים שלך',
  showMore: 'הצג עוד',
  showLess: 'הצג פחות',
  pastVersions: (n) => `גרסאות קודמות (${n})`,
  save: 'שמור',
  cancel: 'ביטול',
  editTitle: 'עריכת כללים',
  placeholder: 'למשל כולסטרול גבוה, צום 16:8, הימנעות מבשר אדום',
  discardTitle: 'לבטל שינויים?',
  discardMessage: 'העריכות יאבדו.',
  discardConfirm: 'בטל',
  restoreTitle: 'לשחזר גרסה זו?',
  restoreMessage: 'הכללים הנוכחיים יישמרו בהיסטוריה וגרסה זו תהפוך לפעילה.',
  restoreConfirm: 'שחזר',
  restoreAsActive: 'שחזר ככללים פעילים',
  close: 'סגור',
  saving: 'שומר…',
};

const ES: RulesStripCopy = {
  emptySubtitle: 'Toca para añadir reglas',
  emptyBody: 'Escribe reglas dietéticas o de estilo de vida que los mentores deben seguir.',
  addRules: 'Añadir reglas',
  editRules: 'Editar',
  yourRules: 'Tus reglas',
  showMore: 'Ver más',
  showLess: 'Ver menos',
  pastVersions: (n) => `Versiones anteriores (${n})`,
  save: 'Guardar',
  cancel: 'Cancelar',
  editTitle: 'Editar reglas',
  placeholder: 'p. ej. colesterol alto, ayuno 16:8, evitar carne roja',
  discardTitle: '¿Descartar cambios?',
  discardMessage: 'Se perderán tus ediciones.',
  discardConfirm: 'Descartar',
  restoreTitle: '¿Restaurar esta versión?',
  restoreMessage: 'Las reglas actuales se guardarán en el historial y esta versión será la activa.',
  restoreConfirm: 'Restaurar',
  restoreAsActive: 'Restaurar como reglas activas',
  close: 'Cerrar',
  saving: 'Guardando…',
};

const FR: RulesStripCopy = {
  emptySubtitle: 'Appuyer pour ajouter des règles',
  emptyBody: 'Écrivez des règles alimentaires ou de mode de vie que les mentors doivent suivre.',
  addRules: 'Ajouter des règles',
  editRules: 'Modifier',
  yourRules: 'Vos règles',
  showMore: 'Afficher plus',
  showLess: 'Afficher moins',
  pastVersions: (n) => `Versions précédentes (${n})`,
  save: 'Enregistrer',
  cancel: 'Annuler',
  editTitle: 'Modifier les règles',
  placeholder: 'ex. cholestérol élevé, jeûne 16:8, éviter la viande rouge',
  discardTitle: 'Abandonner les modifications ?',
  discardMessage: 'Vos modifications seront perdues.',
  discardConfirm: 'Abandonner',
  restoreTitle: 'Restaurer cette version ?',
  restoreMessage: 'Les règles actuelles seront archivées et cette version devient active.',
  restoreConfirm: 'Restaurer',
  restoreAsActive: 'Restaurer comme règles actives',
  close: 'Fermer',
  saving: 'Enregistrement…',
};

const DE: RulesStripCopy = {
  emptySubtitle: 'Tippen, um Regeln hinzuzufügen',
  emptyBody: 'Schreibe Ernährungs- oder Lebensstilregeln, denen Mentoren folgen sollen.',
  addRules: 'Regeln hinzufügen',
  editRules: 'Bearbeiten',
  yourRules: 'Deine Regeln',
  showMore: 'Mehr anzeigen',
  showLess: 'Weniger anzeigen',
  pastVersions: (n) => `Frühere Versionen (${n})`,
  save: 'Speichern',
  cancel: 'Abbrechen',
  editTitle: 'Regeln bearbeiten',
  placeholder: 'z. B. hoher Cholesterinwert, IF 16:8, kein rotes Fleisch',
  discardTitle: 'Änderungen verwerfen?',
  discardMessage: 'Deine Bearbeitungen gehen verloren.',
  discardConfirm: 'Verwerfen',
  restoreTitle: 'Diese Version wiederherstellen?',
  restoreMessage: 'Aktuelle Regeln werden in der Historie gespeichert; diese Version wird aktiv.',
  restoreConfirm: 'Wiederherstellen',
  restoreAsActive: 'Als aktive Regeln wiederherstellen',
  close: 'Schließen',
  saving: 'Speichern…',
};

const AR: RulesStripCopy = {
  emptySubtitle: 'اضغط لإضافة قواعد',
  emptyBody: 'اكتب قواعد غذائية أو لأسلوب الحياة يجب أن يتبعها المرشدون.',
  addRules: 'إضافة قواعد',
  editRules: 'تعديل',
  yourRules: 'قواعدك',
  showMore: 'عرض المزيد',
  showLess: 'عرض أقل',
  pastVersions: (n) => `إصدارات سابقة (${n})`,
  save: 'حفظ',
  cancel: 'إلغاء',
  editTitle: 'تعديل القواعد',
  placeholder: 'مثل ارتفاع الكوليسترول، صيام 16:8، تجنب اللحم الأحمر',
  discardTitle: 'تجاهل التغييرات؟',
  discardMessage: 'ستُفقد تعديلاتك.',
  discardConfirm: 'تجاهل',
  restoreTitle: 'استعادة هذا الإصدار؟',
  restoreMessage: 'ستُحفظ القواعد الحالية في السجل ويصبح هذا الإصدار نشطًا.',
  restoreConfirm: 'استعادة',
  restoreAsActive: 'استعادة كقواعد نشطة',
  close: 'إغلاق',
  saving: 'جارٍ الحفظ…',
};

const RU: RulesStripCopy = {
  emptySubtitle: 'Нажмите, чтобы добавить правила',
  emptyBody: 'Напишите правила питания или образа жизни, которым должны следовать наставники.',
  addRules: 'Добавить правила',
  editRules: 'Изменить',
  yourRules: 'Ваши правила',
  showMore: 'Показать ещё',
  showLess: 'Свернуть',
  pastVersions: (n) => `Прошлые версии (${n})`,
  save: 'Сохранить',
  cancel: 'Отмена',
  editTitle: 'Изменить правила',
  placeholder: 'напр. высокий холестерин, голодание 16:8, без красного мяса',
  discardTitle: 'Отменить изменения?',
  discardMessage: 'Ваши правки будут потеряны.',
  discardConfirm: 'Отменить',
  restoreTitle: 'Восстановить эту версию?',
  restoreMessage: 'Текущие правила сохранятся в истории, эта версия станет активной.',
  restoreConfirm: 'Восстановить',
  restoreAsActive: 'Восстановить как активные правила',
  close: 'Закрыть',
  saving: 'Сохранение…',
};

const BY_CODE: Record<string, RulesStripCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
};

export function getRulesStripCopy(langCode?: string | null): RulesStripCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}

/** Collapsed RULES subtitle from rawText first line. */
export function rulesSubtitleFromRaw(raw: string | null | undefined, empty: string, maxLen = 60): string {
  const line = (raw ?? '').trim().split(/\r?\n/)[0]?.trim() ?? '';
  if (!line) return empty;
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}
