import { NextRequest, NextResponse } from 'next/server';
import {
  getSiteEvaluations,
  createEvaluation,
} from '@/lib/services/evaluations.service';
import { CreateEvaluationRequest, ApiError } from '@/lib/types';

/**
 * Get evaluations for a site
 * GET /api/evaluations?siteId=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: siteId' },
        { status: 400 }
      );
    }

    const evaluations = await getSiteEvaluations(siteId);
    return NextResponse.json(
      { success: true, data: evaluations },
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
 * Create evaluation
 * POST /api/evaluations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      siteId,
      date,
      marketScore,
      qualityScore,
      seoScore,
      trafficScore,
      revenueScore,
      evaluator,
      notes,
      weights,
    } = body;

    // Validation
    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: siteId' },
        { status: 400 }
      );
    }

    const data: CreateEvaluationRequest = {
      siteId,
      date,
      marketScore,
      qualityScore,
      seoScore,
      trafficScore,
      revenueScore,
      evaluator,
      notes,
      weights,
    };

    const evaluation = await createEvaluation(data);
    return NextResponse.json(
      {
        success: true,
        data: evaluation,
        message: 'Evaluation created successfully',
      },
      { status: 201 }
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
