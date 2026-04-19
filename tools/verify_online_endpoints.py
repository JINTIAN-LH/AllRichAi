from __future__ import annotations

import argparse
import json
import socket
import urllib.error
import urllib.request
from typing import Iterable


def _request(method: str, url: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], str]:
    req = urllib.request.Request(url=url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, dict(resp.headers.items()), body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return int(exc.code), dict(exc.headers.items()) if exc.headers else {}, body
    except urllib.error.URLError as exc:
        return -1, {}, f"urlerror: {exc.reason}"
    except TimeoutError:
        return -1, {}, "timeout: read operation timed out"
    except socket.timeout:
        return -1, {}, "timeout: socket timeout"


def _preview(text: str, max_len: int = 140) -> str:
    compact = text.replace("\r", " ").replace("\n", " ")
    return compact[:max_len]


def _check_paths(base_url: str, paths: Iterable[str]) -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    for path in paths:
        status, headers, body = _request(
            "GET",
            f"{base_url}{path}",
            headers={"User-Agent": "AllRichAI-Deploy-Check/1.0"},
        )
        server = headers.get("Server", "")
        ok = status == 200
        detail = f"status={status} server={server} preview={_preview(body)}"
        results.append((path, ok, detail))
    return results


def _check_cors(base_url: str, origin: str) -> tuple[bool, str]:
    status, headers, body = _request(
        "OPTIONS",
        f"{base_url}/api/viz/state",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type,Authorization",
            "User-Agent": "AllRichAI-Deploy-Check/1.0",
        },
    )
    acao = headers.get("Access-Control-Allow-Origin")
    acam = headers.get("Access-Control-Allow-Methods")
    ok = status in (200, 204) and acao in (origin, "*")
    detail = f"status={status} acao={acao} acam={acam} preview={_preview(body)}"
    return ok, detail


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify production endpoints for AllRichAI deployment")
    parser.add_argument("--base-url", required=True, help="Backend base URL, e.g. https://allrichai-farmgame-backend.onrender.com")
    parser.add_argument("--origin", default="", help="Frontend origin used for CORS preflight check")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    paths = ["/", "/viz", "/story-panel", "/balance", "/api/viz/state"]

    print(f"Base URL: {base_url}")
    print("\nRoute checks:")
    route_results = _check_paths(base_url, paths)
    all_ok = True
    for path, ok, detail in route_results:
        state = "PASS" if ok else "FAIL"
        if not ok:
            all_ok = False
        print(f"- [{state}] {path} -> {detail}")

    if args.origin:
        print("\nCORS check:")
        cors_ok, cors_detail = _check_cors(base_url, args.origin)
        if not cors_ok:
            all_ok = False
        state = "PASS" if cors_ok else "FAIL"
        print(f"- [{state}] OPTIONS /api/viz/state Origin={args.origin} -> {cors_detail}")

    summary = {
        "baseUrl": base_url,
        "allPassed": all_ok,
        "checkedPaths": paths,
        "origin": args.origin,
    }
    print("\nSummary:")
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
