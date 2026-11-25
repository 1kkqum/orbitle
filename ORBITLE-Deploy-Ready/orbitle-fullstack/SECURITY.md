# Security and privacy launch checklist

This repository is a learning-stage MVP foundation. Before any public deployment, review each item with an experienced developer.

- [ ] Use HTTPS and set `NODE_ENV=production`.
- [ ] Set a unique, strong `JWT_SECRET` using the host's secret manager; never commit `.env`.
- [ ] Set `CLIENT_ORIGIN` to the exact deployed origin.
- [ ] Add automated tests for authorization, validation, rate limiting, and session handling.
- [ ] Add explicit CSRF token protection for authenticated state-changing routes.
- [ ] Add email verification and secure password reset flows.
- [ ] Add account deletion, data export, and privacy settings.
- [ ] Add reporting, blocking, moderation queue, escalation process, and abuse monitoring before enabling direct messaging or broad user discovery.
- [ ] Publish a privacy notice, terms, community standards, and an accessible contact/reporting route.
- [ ] Establish age-appropriate defaults and data minimization for teen users; avoid exposing email addresses publicly.
- [ ] Verify each opportunity from a trusted source, track expiry, and remove stale listings.
- [ ] Back up the database, test restores, and use managed database infrastructure for multi-instance deployment.
- [ ] Add structured logging, monitoring, database migrations, dependency scanning, and regular security updates.
- [ ] Review data retention and the applicable laws and requirements for every country where users will be served.

The seeded listings and project examples are demonstration content. They must not be represented as real, verified opportunities.
