# VeilForms Roadmap

> Privacy-first encrypted forms for the enterprise.

---

## Current Status

**Version:** 2.0.0 (Next.js Migration)
**Tests:** 617 passing
**Coverage:** 80%+ target
**Enterprise Ready:** 68%

---

## Completed

### Foundation
- [x] Next.js 16 App Router architecture
- [x] Netlify Blobs multi-tenant storage
- [x] Client-side encryption (RSA-2048 + AES-256-GCM)
- [x] JWT authentication with OAuth (GitHub, Google)
- [x] Password reset flow
- [x] Rate limiting and account lockout
- [x] CSRF protection (double-submit cookie)
- [x] Comprehensive audit logging

### Form Builder
- [x] Drag-and-drop field ordering (@dnd-kit)
- [x] 15+ field types (text, email, select, file, etc.)
- [x] Conditional logic (show/hide fields)
- [x] Multi-page forms with page breaks
- [x] File uploads with encryption
- [x] Form preview modal
- [x] A/B testing framework

### API & Integrations
- [x] 65+ API endpoints
- [x] Webhook delivery with retry logic
- [x] Zapier integration (metadata payloads)
- [x] Custom domain support
- [x] API key management

### Billing
- [x] Stripe subscription integration
- [x] Plan tiers (Free, Pro, Team, Enterprise)
- [x] Usage limits per plan
- [x] Checkout session creation

### Security
- [x] XSS protection (DOMPurify)
- [x] Input validation
- [x] Idempotency keys
- [x] Token blocklist
- [x] Honeypot spam protection
- [x] reCAPTCHA v3 support

### Dashboard
- [x] Forms management
- [x] Submissions viewer with decryption
- [x] API keys page
- [x] Audit logs page
- [x] Settings page
- [x] Integrations page
- [x] Analytics page
- [x] Embed code generator

---

## In Progress (Q1 2026)

### Critical Path
- [ ] **Email Service** - Integrate Resend for transactional emails
- [ ] **Email Verification** - Complete signup flow
- [ ] **Stripe Webhooks** - Handle subscription events

### Team Collaboration
- [ ] Team creation API
- [ ] Member invitation flow
- [ ] Role-based permissions (owner, admin, editor, viewer)
- [ ] Team form sharing

---

## Next Up (Q2 2026)

### CRM Integrations
- [ ] HubSpot integration (contacts, deals)
- [ ] Salesforce integration (leads, contacts)
- [ ] Pipedrive integration (deals, persons)
- [ ] Background job queue (Bull + Redis)

### Compliance
- [ ] GDPR retention enforcement (auto-delete)
- [ ] Data export improvements
- [ ] API documentation (OpenAPI 3.0)
- [ ] Security audit

### Launch
- [ ] Production deployment
- [ ] Monitoring & alerting (Sentry)
- [ ] Load testing
- [ ] Beta program

---

## Future (Q3-Q4 2026)

### Enterprise Features
- [ ] SSO (SAML 2.0 / OIDC)
- [ ] Two-factor authentication (TOTP)
- [ ] SOC 2 Type II certification
- [ ] Custom data residency
- [ ] SLA guarantees

### Platform Expansion
- [ ] Slack notifications
- [ ] Google Analytics integration
- [ ] Advanced analytics dashboard
- [ ] White-label solution

### Self-Hosting
- [ ] Docker image
- [ ] Kubernetes Helm chart
- [ ] One-click deploys (Railway, Render)

---

## Backlog

- [ ] Rich text editor field
- [ ] Payment collection (Stripe Elements)
- [ ] Scheduling (open/close dates)
- [ ] Form versioning UI
- [ ] Mobile apps (React Native)
- [ ] Browser extension
- [ ] Internationalization (i18n)
- [ ] Accessibility audit (WCAG 2.1)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to first form | < 5 min |
| SDK integration | < 30 min |
| Submission success rate | > 99.5% |
| API response time (p95) | < 200ms |
| Test coverage | > 80% |
| Uptime | 99.9% |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | SCSS modules |
| State | Zustand |
| Forms | React Hook Form |
| Drag & Drop | @dnd-kit |
| API | Next.js App Router |
| Database | Netlify Blobs |
| Auth | JWT, OAuth 2.0 |
| Payments | Stripe |
| Email | Resend (pending) |
| Testing | Vitest, Playwright |

---

*Last Updated: December 2024*
