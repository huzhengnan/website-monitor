import { ValidationError } from '@/lib/types';

/**
 * Validate UUID format
 */
export function validateUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate URL format
 */
export function validateUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate score (0-100)
 */
export function validateScore(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && num >= 0 && num <= 100;
}

/**
 * Validate email format
 */
export function validateEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate required field
 */
export function validateRequired(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * Validate string length
 */
export function validateStringLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * Validate integer
 */
export function validateInteger(value: any): boolean {
  return Number.isInteger(Number(value));
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDateFormat(value: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;

  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate page and pageSize query parameters
 */
export function validatePagination(page?: any, pageSize?: any) {
  if (page !== undefined) {
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      throw new ValidationError('Page must be a positive integer');
    }
  }

  if (pageSize !== undefined) {
    const pageSizeNum = Number(pageSize);
    if (!Number.isInteger(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new ValidationError('PageSize must be between 1 and 100');
    }
  }

  return {
    page: Math.max(1, Number(page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
  };
}

/**
 * Validate and normalize sort parameters
 */
export function validateSort(
  sortBy?: string,
  sortOrder?: string,
  allowedFields: string[] = []
) {
  let finalSortOrder: 'asc' | 'desc' = 'desc';

  if (sortOrder && ['asc', 'desc'].includes(sortOrder.toLowerCase())) {
    finalSortOrder = sortOrder.toLowerCase() as 'asc' | 'desc';
  }

  let finalSortBy = '';
  if (sortBy && allowedFields.length > 0 && allowedFields.includes(sortBy)) {
    finalSortBy = sortBy;
  }

  return {
    sortBy: finalSortBy,
    sortOrder: finalSortOrder,
  };
}
