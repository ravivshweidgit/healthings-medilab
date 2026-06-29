# Secret leak prevention (free — gitleaks + GitHub Actions)

No paid GitGuardian account needed. Public repos may still get **free** GitHub secret-scan alerts.

## One-time: local hook (optional)

```powershell
pip install pre-commit
.\scripts\install-secret-hooks.ps1
```

Runs **gitleaks** before each `git commit`. Manual scan:

```powershell
python -m pre_commit run gitleaks --all-files
```

## On every push

GitHub Actions workflow `.github/workflows/secret-scan.yml` scans the repo with gitleaks.

## Config

- `.gitleaks.toml` — allowlists deploy-doc placeholders in `server/scripts/` and `prompts/`
- `.gitignore` — blocks `.env`, `keystore.properties`, `whithins.txt`, keystores

## If GitHub emails you about a “GitGuardian” finding

That is often **GitHub’s built-in scanning** for public repos (free). Open the alert → mark false positive for doc placeholders, or rotate the credential if it was real.
