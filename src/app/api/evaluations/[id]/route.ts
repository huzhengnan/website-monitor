import { NextRequest, NextResponse } from 'next/server';
import {
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
} from '@/lib/services/evaluations.service';
import { UpdateEvaluationRequest, ApiError } from '@/lib/types';

/**
 * Get evaluation by ID
 * GET /api/evaluations/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evaluation = await getEvaluationById(id);
    return NextResponse.json(
      { success: true, data: evaluation },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Update evaluation
 * PUT /api/evaluations/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      marketScore,
      qualityScore,
      seoScore,
      trafficScore,
      revenueScore,
      evaluator,
      notes,
      weights,
    } = body;

    const data: UpdateEvaluationRequest = {
      marketScore,
      qualityScore,
      seoScore,
      trafficScore,
      revenueScore,
      evaluator,
      notes,
      weights,
    };

    const evaluation = await updateEvaluation(id, data);
    return NextResponse.json(
      { success: true, data: evaluation, message: 'Evaluation updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Delete evaluation
 * DELETE /api/evaluations/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteEvaluation(id);
    return NextResponse.json(
      { success: true, message: 'Evaluation deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
