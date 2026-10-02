# Secrets configuration

The API needs two secrets that are **not** stored in the repository:

| Setting | Environment variable | Required | Used for |
|---|---|---|---|
| `JwtSettings:Secret` | `JwtSettings__Secret` | Yes, the API refuses to start without it | Signing login tokens. Must be at least 32 bytes. |
| `OurSms:Token` | `OurSms__Token` | No, but SMS sending fails without it | OurSms API token. |

### First admin account

On an empty database the API creates one admin user. Set its password before the first start:

| Setting | Environment variable | Default |
|---|---|---|
| `InitialAdmin:Username` | `InitialAdmin__Username` | `admin` |
| `InitialAdmin:Password` | `InitialAdmin__Password` | none: a random password is generated and printed once in the API log |

These are only read when the `Users` table is empty, so they can be removed after the first start.

Non-secret settings (`JwtSettings:Issuer`, `JwtSettings:Audience`, `OurSms:ApiUrl`, `OurSms:Src`) stay in `appsettings.json`.

For local development without an OurSms token, set `Sms:Provider` to `Mock` (`Sms__Provider=Mock`): messages are written to the API log instead of being sent. Every attempt, sent or failed, is recorded in the SMS log page (admin only).

ASP.NET Core maps `__` (double underscore) in an environment variable name to `:` in configuration.

## Generate a JWT secret

```bash
openssl rand -base64 48
```

or in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Changing the secret logs out every user (existing tokens stop validating).

## Local development (user-secrets)

From the `api/` folder:

```bash
dotnet user-secrets set "JwtSettings:Secret" "<generated secret>"
dotnet user-secrets set "OurSms:Token" "<your OurSms token>"
dotnet user-secrets list
```

User secrets are stored outside the repo (`%APPDATA%\Microsoft\UserSecrets\alkara-api\` on Windows, `~/.microsoft/usersecrets/alkara-api/` on Linux/macOS) and are loaded automatically when `ASPNETCORE_ENVIRONMENT=Development`.

## Server / production (environment variables)

Windows (run as administrator, then restart the API / IIS app pool):

```powershell
setx JwtSettings__Secret "<generated secret>" /M
setx OurSms__Token "<your OurSms token>" /M
```

IIS: you can instead set them per site in `web.config`:

```xml
<aspNetCore processPath="dotnet" arguments=".\api.dll">
  <environmentVariables>
    <environmentVariable name="JwtSettings__Secret" value="..." />
    <environmentVariable name="OurSms__Token" value="..." />
  </environmentVariables>
</aspNetCore>
```

Keep that `web.config` on the server only; do not commit it with real values.

Linux (systemd unit):

```ini
[Service]
Environment=JwtSettings__Secret=<generated secret>
Environment=OurSms__Token=<your OurSms token>
```

## Rotating the old values

The previous JWT secret and OurSms token were committed to git history, so treat them as leaked:

1. Generate a new JWT secret and set it as above.
2. Create a new token in the OurSms dashboard, set it as above, then revoke the old one.
