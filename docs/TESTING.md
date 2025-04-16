# SCAE Testing Strategy

## Overview
Testing is a first-class concern in SCAE. Each major milestone and module includes explicit test requirements. Testing types include:
- **Unit tests:** For all core modules and services
- **Integration tests:** For API clients and workflow orchestration
- **End-to-end (E2E) tests:** For the full user workflow (content creation to WordPress post)
- **Manual QA:** For UI/UX and error edge cases

## Approach
- Use a modern test runner (e.g., Jest, Mocha, or similar)
- Mock external APIs for integration and E2E tests
- Validate both success and error/failure paths
- Ensure test coverage for all error handling and fallback logic
- Add regression tests for bug fixes

## Test Milestones
- Project setup: Linting and basic script tests
- After each module: Unit and integration tests
- After full workflow: E2E tests
- Before release: Manual QA and regression suite

## Continuous Improvement
- Add tests for new features and bug fixes
- Review test coverage regularly
