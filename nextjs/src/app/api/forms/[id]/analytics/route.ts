import { NextRequest, NextResponse } from 'next/server';
import { authRoute } from '@/lib/route-handler';
import { verifyFormOwnership } from '@/lib/form-helpers';
import { getFormAnalyticsRange, aggregateAnalytics } from '@/lib/analytics';
import { isValidFormId } from '@/lib/validation';

type RouteParams = { params: Promise<{ id: string }> };

export const GET = authRoute<RouteParams>(async (req: NextRequest, { user }, routeCtx) => {
  const { id: formId } = await routeCtx!.params;

  if (!isValidFormId(formId)) {
    return NextResponse.json({ error: 'Invalid form ID' }, { status: 400 });
  }

  // Verify ownership
  const { form, error } = await verifyFormOwnership(formId, user.userId);
  if (error) return error;

  // Get date range from query params
  const url = new URL(req.url);
  const startDate = url.searchParams.get('start') || getDefaultStartDate();
  const endDate = url.searchParams.get('end') || getDefaultEndDate();

  // Fetch analytics
  const analytics = await getFormAnalyticsRange(formId, startDate, endDate);
  const aggregated = aggregateAnalytics(analytics);

  return NextResponse.json({
    formId,
    period: { start: startDate, end: endDate },
    summary: aggregated,
    daily: analytics,
  });

}, { rateLimit: { keyPrefix: 'analytics', maxRequests: 30 } });

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}
