import { PaymentMethod, PaymentTargetType } from '../types';

export interface PaymentReceiptSummaryParams {
  studentName: string;
  parentRelation?: string;
  date: string;
  amount: number;
  currencyLabel?: string;
  paymentType: PaymentTargetType;
  paymentMethod: PaymentMethod;
  serviceName?: string;
  serviceType?: 'group' | 'private';
  targetMonth?: number;
  targetYear?: number;
  sessionsCount?: number;
  remainingMonthAmount?: number;
  updatedSessionCredit?: number;
  receiptReference?: string;
  notes?: string;
  teacherName?: string;
  centerOrSchool?: string;
  isEn?: boolean;
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getMonthDisplayName(month1to12: number | undefined, isEn: boolean): string {
  if (!month1to12 || month1to12 < 1 || month1to12 > 12) return '';
  return isEn ? ENGLISH_MONTHS[month1to12 - 1] : ARABIC_MONTHS[month1to12 - 1];
}

/**
 * Normalizes local or international phone numbers into digits-only international format
 * suitable for `https://wa.me/<phone>`. Returns empty string when no digits exist.
 */
export function normalizeWhatsAppPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const trimmed = rawPhone.trim();
  if (!trimmed) return '';

  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';

  if (hasLeadingPlus) {
    return digitsOnly;
  }

  if (digitsOnly.startsWith('00') && digitsOnly.length > 4) {
    return digitsOnly.slice(2);
  }

  // Egyptian local mobile format: 010 / 011 / 012 / 015 + 8 digits (11 digits total)
  if (/^01[0125]\d{8}$/.test(digitsOnly)) {
    return `2${digitsOnly}`;
  }

  return digitsOnly;
}

export function getPaymentMethodDisplayLabel(method: PaymentMethod, isEn: boolean): string {
  switch (method) {
    case 'cash':
      return isEn ? 'Cash' : 'نقداً (كاش)';
    case 'vodafone_cash':
      return isEn ? 'Vodafone Cash / Wallet' : 'فودافون كاش / محفظة إلكترونية';
    case 'instapay':
      return isEn ? 'InstaPay' : 'إنستاباي (InstaPay)';
    case 'bank_transfer':
      return isEn ? 'Bank Transfer' : 'تحويل بنكي';
    case 'other':
    default:
      return isEn ? 'Other' : 'أخرى';
  }
}

export function formatShortReceiptRef(paymentId?: string, customRef?: string): string {
  const cleanCustom = (customRef || '').trim();
  if (cleanCustom) return cleanCustom;
  if (!paymentId) return '';
  const tail = paymentId.replace(/^pmt_/, '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return tail ? `#RCP-${tail}` : '';
}

/**
 * Dynamically constructs a clean, parent-friendly formatted receipt summary
 * containing student name, transaction date, amount, service, and allocation details.
 */
export function buildPaymentReceiptText(params: PaymentReceiptSummaryParams): string {
  const {
    studentName,
    date,
    amount,
    currencyLabel,
    paymentType,
    paymentMethod,
    serviceName,
    serviceType,
    targetMonth,
    targetYear,
    sessionsCount,
    remainingMonthAmount,
    updatedSessionCredit,
    receiptReference,
    notes,
    teacherName,
    centerOrSchool,
    isEn = false,
  } = params;

  const currency = currencyLabel || (isEn ? 'EGP' : 'ج.م');
  const formattedAmount = `${Number(amount || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} ${currency}`;
  const methodLabel = getPaymentMethodDisplayLabel(paymentMethod, isEn);

  const cleanTeacher = (teacherName || '').trim();
  const cleanCenter = (centerOrSchool || '').trim();

  let issuerLine = '';
  if (cleanTeacher && cleanCenter) {
    issuerLine = isEn ? `${cleanTeacher} · ${cleanCenter}` : `${cleanTeacher} · ${cleanCenter}`;
  } else if (cleanTeacher) {
    issuerLine = cleanTeacher;
  } else if (cleanCenter) {
    issuerLine = cleanCenter;
  }

  let purposeLine = '';
  if (paymentType === 'specific_month') {
    const mName = getMonthDisplayName(targetMonth, isEn);
    const yStr = targetYear ? ` ${targetYear}` : '';
    const basePurpose = isEn
      ? `${mName}${yStr} Subscription`.trim()
      : `اشتراك شهر ${mName}${yStr}`.trim();

    if (typeof remainingMonthAmount === 'number') {
      if (remainingMonthAmount <= 0) {
        purposeLine = isEn ? `${basePurpose} (Settled in full)` : `${basePurpose} (مسدد بالكامل)`;
      } else {
        purposeLine = isEn
          ? `${basePurpose} (Remaining: ${remainingMonthAmount} ${currency})`
          : `${basePurpose} (المتبقي للشهر: ${remainingMonthAmount} ${currency})`;
      }
    } else {
      purposeLine = basePurpose;
    }
  } else if (paymentType === 'single_session') {
    purposeLine = isEn ? 'Single Session (+1 session)' : 'سداد حصة واحدة (+1 حصة)';
  } else if (paymentType === 'session_count') {
    const count = sessionsCount && sessionsCount > 0 ? sessionsCount : 1;
    purposeLine = isEn
      ? `Session Package (+${count} ${count === 1 ? 'session' : 'sessions'})`
      : `سداد باقة / رصيد حصص (+${count} حصص)`;
  } else {
    if (sessionsCount && sessionsCount > 0) {
      purposeLine = isEn
        ? `Account Payment (Covers +${sessionsCount} ${sessionsCount === 1 ? 'session' : 'sessions'})`
        : `دفعة مالية تحت الحساب (تغطي +${sessionsCount} حصص)`;
    } else {
      purposeLine = isEn ? 'Tuition Payment' : 'دفعة مصروفات دراسية';
    }
  }

  const lines: string[] = [];

  if (isEn) {
    lines.push('*Payment Receipt*');
    if (issuerLine) lines.push(issuerLine);
    lines.push('────────────────────');
    lines.push(`• Student: ${studentName || '—'}`);
    if (serviceName) {
      const sLabel = serviceType === 'private' ? 'Private Lesson' : 'Group';
      lines.push(`• ${sLabel}: ${serviceName}`);
    }
    lines.push(`• Amount Paid: *${formattedAmount}*`);
    lines.push(`• Date: ${date || '—'}`);
    lines.push(`• Details: ${purposeLine}`);
    lines.push(`• Payment Method: ${methodLabel}`);
    if (typeof updatedSessionCredit === 'number' && paymentType !== 'specific_month') {
      lines.push(`• Session Credit Balance: ${updatedSessionCredit} sessions`);
    }
    if (receiptReference) {
      lines.push(`• Receipt Ref: ${receiptReference}`);
    }
    if (notes && notes.trim()) {
      lines.push(`• Notes: ${notes.trim()}`);
    }
    lines.push('────────────────────');
    lines.push('Thank you for your cooperation.');
  } else {
    lines.push('*إيصال سداد مصروفات دراسية*');
    if (issuerLine) lines.push(issuerLine);
    lines.push('────────────────────');
    lines.push(`• الطالب/ة: ${studentName || '—'}`);
    if (serviceName) {
      const sLabel = serviceType === 'private' ? 'الدرس الخاص' : 'المجموعة';
      lines.push(`• ${sLabel}: ${serviceName}`);
    }
    lines.push(`• المبلغ المدفوع: *${formattedAmount}*`);
    lines.push(`• تاريخ السداد: ${date || '—'}`);
    lines.push(`• بيان السداد: ${purposeLine}`);
    lines.push(`• طريقة الدفع: ${methodLabel}`);
    if (typeof updatedSessionCredit === 'number' && paymentType !== 'specific_month') {
      lines.push(`• رصيد الحصص الحالي: ${updatedSessionCredit} حصص`);
    }
    if (receiptReference) {
      lines.push(`• رقم الإيصال: ${receiptReference}`);
    }
    if (notes && notes.trim()) {
      lines.push(`• ملاحظات: ${notes.trim()}`);
    }
    lines.push('────────────────────');
    lines.push('شكراً لتعاونكم، مع خالص التمنيات بالتفوق الدائم.');
  }

  return lines.join('\n');
}

export function buildWhatsAppReceiptUrl(
  receiptText: string,
  recipientPhone?: string | null
): string {
  const normalizedPhone = normalizeWhatsAppPhone(recipientPhone);
  const encodedText = encodeURIComponent(receiptText);
  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
