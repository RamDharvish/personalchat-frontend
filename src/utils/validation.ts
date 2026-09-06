/**
 * Input validation utilities for PersonalChat forms & data payloads
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue: string;
}

const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_INJECTION_REGEX = /javascript:|data:|vbscript:/i;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/g;

export const validateDisplayName = (input: string): ValidationResult => {
  if (typeof input !== 'string') {
    return {
      isValid: false,
      error: 'Invalid input format',
      sanitizedValue: '',
    };
  }

  const cleaned = input.replace(CONTROL_CHARS_REGEX, '').trim();

  if (!cleaned) {
    return {
      isValid: false,
      error: 'Name is required',
      sanitizedValue: '',
    };
  }

  if (cleaned.length < 2) {
    return {
      isValid: false,
      error: 'Name must be at least 2 characters',
      sanitizedValue: cleaned,
    };
  }

  if (cleaned.length > 24) {
    return {
      isValid: false,
      error: 'Name must be 24 characters or less',
      sanitizedValue: cleaned.slice(0, 24),
    };
  }

  if (HTML_TAG_REGEX.test(input) || SCRIPT_INJECTION_REGEX.test(input)) {
    return {
      isValid: false,
      error: 'HTML tags or script protocols are not allowed',
      sanitizedValue: cleaned.replace(HTML_TAG_REGEX, ''),
    };
  }

  return {
    isValid: true,
    sanitizedValue: cleaned,
  };
};

export const validateRoomCode = (input: string): ValidationResult => {
  if (typeof input !== 'string') {
    return {
      isValid: false,
      error: 'Invalid room code format',
      sanitizedValue: '',
    };
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Room code is required',
      sanitizedValue: '',
    };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Room code must contain numbers only',
      sanitizedValue: trimmed.replace(/\D/g, ''),
    };
  }

  if (trimmed.length !== 4) {
    return {
      isValid: false,
      error: 'Room code must be exactly 4 digits',
      sanitizedValue: trimmed,
    };
  }

  return {
    isValid: true,
    sanitizedValue: trimmed,
  };
};

export const sanitizeFileName = (name: string): string => {
  if (typeof name !== 'string') return 'attachment';
  // Strip path traversal characters, control characters, and null bytes
  return name.replace(/\.\./g, '').replace(/[/\\]/g, '_').replace(CONTROL_CHARS_REGEX, '').trim() || 'attachment';
};

export interface CapacityValidationResult {
  isValid: boolean;
  error?: string;
  capacity: number;
}

export const validateRoomCapacity = (
  input: string | number | null | undefined
): CapacityValidationResult => {
  if (input === '' || input === null || input === undefined) {
    return {
      isValid: false,
      error: 'Please enter the maximum number of members.',
      capacity: 2,
    };
  }

  const str = String(input).trim();
  if (!str) {
    return {
      isValid: false,
      error: 'Please enter the maximum number of members.',
      capacity: 2,
    };
  }

  const num = Number(str);
  if (isNaN(num)) {
    return {
      isValid: false,
      error: 'Please enter the maximum number of members.',
      capacity: 2,
    };
  }

  if (!Number.isInteger(num)) {
    return {
      isValid: false,
      error: 'Maximum members must be a whole number.',
      capacity: num,
    };
  }

  if (num < 2 || num > 20) {
    return {
      isValid: false,
      error: 'Room capacity must be between 2 and 20 members.',
      capacity: num,
    };
  }

  return {
    isValid: true,
    capacity: num,
  };
};
