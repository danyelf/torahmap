---
id: tm-9xf
status: closed
priority: 2
type: task
created: 2026-01-12
closed: 2026-01-12
---

# Add pre-commit hook to run tests before commit

Add a pre-commit hook that runs 'npm test' before allowing commits. This ensures all 831 tests pass before code is committed, preventing broken commits from entering the repository. The hook should be fast and provide clear feedback on test failures.
