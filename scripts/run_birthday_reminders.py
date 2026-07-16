#!/usr/bin/env python3
"""Executa a rotina de tarefas de aniversário do ISP Consulte Dashboard."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_PROJECT_URL = "https://stubkeeuttixteqckshd.supabase.co"
MAX_ATTEMPTS = 3
TRANSIENT_HTTP_STATUSES = {429, 500, 502, 503, 504}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aciona a criação idempotente de tarefas de aniversário no Bitrix.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida usuários e tarefas sem criar nada no Bitrix.",
    )
    parser.add_argument("--target-month", type=int, choices=range(1, 13), metavar="1-12")
    parser.add_argument("--target-year", type=int)
    return parser.parse_args()


def invoke(payload: dict[str, object]) -> dict[str, object]:
    project_url = os.getenv("SUPABASE_PROJECT_URL", DEFAULT_PROJECT_URL).rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_role_key:
        raise RuntimeError("Defina SUPABASE_SERVICE_ROLE_KEY apenas no ambiente de execução.")

    request = Request(
        f"{project_url}/functions/v1/create-birthday-reminders",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            with urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            response_body = error.read().decode("utf-8", errors="replace")
            try:
                message = json.loads(response_body).get("error", f"HTTP {error.code}")
            except json.JSONDecodeError:
                message = f"HTTP {error.code}"
            last_error = RuntimeError(f"A rotina recusou a execução: {message}")
            if error.code not in TRANSIENT_HTTP_STATUSES or attempt == MAX_ATTEMPTS - 1:
                break
        except URLError as error:
            last_error = RuntimeError(f"Não foi possível acessar o Supabase: {error.reason}")
            if attempt == MAX_ATTEMPTS - 1:
                break
        time.sleep(2 ** attempt)
    raise RuntimeError(str(last_error or "A rotina não respondeu.")) from last_error


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    args = arguments()
    if (args.target_month is None) != (args.target_year is None):
        print("Informe --target-month e --target-year juntos.", file=sys.stderr)
        return 2

    payload: dict[str, object] = {"action": "scheduled", "dry_run": args.dry_run}
    if args.target_month is not None and args.target_year is not None:
        payload.update(target_month=args.target_month, target_year=args.target_year)

    try:
        result = invoke(payload)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    summary = {
        "ok": result.get("ok", False),
        "dry_run": result.get("dryRun", False),
        "status": result.get("status"),
        "periods": result.get("periods", []),
        "created": result.get("created", 0),
        "already_existing": result.get("skipped", 0),
        "errors": result.get("errors", 0),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
