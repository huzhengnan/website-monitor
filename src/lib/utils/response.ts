import { NextResponse } from 'next/server';
import { ApiResponse, PaginatedResponse } from '@/lib/types';

/**
 * Send successful response
 */
export function sendSuccess<T>(
  data: T,
  statusCode: number = 200,
  message?: string
) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Send paginated response
 */
export function sendPaginated<T>(
  items: T[],
  total: number,
  page: number = 1,
  pageSize: number = 20,
  statusCode: number = 200
) {
  const totalPages = Math.ceil(total / pageSize);
  const response: ApiResponse<PaginatedResponse<T>> = {
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages,
    },
  };
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Send error response
 */
export function sendError(
  message: string,
  statusCode: number = 500,
  error?: any
) {
  const response: ApiResponse = {
    success: false,
    error: message,
  };
  if (process.env.NODE_ENV === 'development' && error) {
    response.message = error.message || String(error);
  }
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Send created response
 */
export function sendCreated<T>(data: T, message?: string) {
  return sendSuccess(data, 201, message);
}

/**
 * Send no content response
 */
export function sendNoContent() {
  return new NextResponse(null, { status: 204 });
}
