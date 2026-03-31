# Security Policy

## Supported versions
Security fixes are applied to the latest `main` branch source release.

## Reporting a vulnerability
- Do not open public issues for suspected vulnerabilities.
- Report privately with:
  - impact summary
  - reproduction steps
  - affected files/areas
  - suggested mitigation (optional)

Maintainers will acknowledge reports as soon as possible and coordinate remediation.

## Secret handling
- Never commit credentials or tokens.
- Use environment variables for local secrets.
- Rotate compromised credentials immediately.

## Dependency hygiene
- Run `npm audit` regularly.
- Keep dependencies current and review changelogs for security-impacting updates.
