
import os, time, secrets, httpx
from msal import ConfidentialClientApplication
from fastapi import HTTPException, Request
from dotenv import load_dotenv

load_dotenv()

# ─── Config Azure AD ─────────────────────────────────────────
AZURE_CLIENT_ID     = os.getenv("AZURE_CLIENT_ID", "")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
AZURE_TENANT_ID     = os.getenv("AZURE_TENANT_ID", "")
AZURE_REDIRECT_URI  = os.getenv("AZURE_REDIRECT_URI", "https://comelitservices.fr/configvs/auth/callback")

AUTHORITY = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"
SCOPES    = ["User.Read"]

# SSO is only active if the Azure variables are set.
SSO_ENABLED = all([AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID])

# Allowed domains (from .env or by default)
ALLOWED_DOMAINS = os.getenv("ALLOWED_EMAIL_DOMAINS", "comelit.fr").split(",")


def get_msal_app() -> ConfidentialClientApplication:
    return ConfidentialClientApplication(
        AZURE_CLIENT_ID,
        authority=AUTHORITY,
        client_credential=AZURE_CLIENT_SECRET,
    )


def build_auth_url(state: str) -> str:
    """Generates the redirect URL to Microsoft."""
    msal_app = get_msal_app()
    return msal_app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=AZURE_REDIRECT_URI,
        state=state,
        response_type="code"
    )


def exchange_code(code: str) -> dict:
    """Exchange the OAuth2 code for a token."""
    msal_app = get_msal_app()
    result = msal_app.acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPES,
        redirect_uri=AZURE_REDIRECT_URI,
    )
    if "error" in result:
        raise HTTPException(
            status_code=401,
            detail=f"Azure AD error: {result.get('error_description', result['error'])}"
        )
    return result



def extract_user(token_result: dict) -> dict:
    """Extracts user information from token claims."""
    claims = token_result.get("id_token_claims", {})
    return {
        "name":         claims.get("name", "Inconnu"),
        "email":        claims.get("preferred_username", ""),
        "oid":          claims.get("oid", ""),          # Azure Unique ID
        "access_token": token_result.get("access_token", ""),
        "expires_at":   time.time() + token_result.get("expires_in", 3600),
    }


def require_sso(request: Request) -> dict:
    """
    FastAPI dependency: checks the SSO session.
    If SSO is disabled (no Azure configuration), allow it.   
    """

    if not SSO_ENABLED:
        return {"name": "Admin local", "email": "local", "oid": "local"}

    user = request.session.get("azure_user")
    if not user:
        raise HTTPException(status_code=401, detail="SSO required")

    # Check expiration date
    if user.get("expires_at", 0) < time.time():
        request.session.clear()
        raise HTTPException(status_code=401, detail="Session expired")

    # Filter by email domain
    email = user.get("email", "")
    domain = email.split("@")[-1].lower()
    if ALLOWED_DOMAINS and domain not in ALLOWED_DOMAINS:
        request.session.clear()
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: domain @{domain} is not authorized"
        )

    return user