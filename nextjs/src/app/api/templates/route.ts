/**
 * VeilForms - Templates API Endpoint
 * GET /api/templates - Get all form templates
 */

import { NextResponse } from 'next/server';
import { FORM_TEMPLATES } from '@/lib/form-templates';

export async function GET() {
  return NextResponse.json({ templates: FORM_TEMPLATES });
}
