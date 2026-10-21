#!/usr/bin/env python3
"""DSG ONE owner-only Kaggle GitHub dispatch bridge.

Server process only. Read one SSM SecureString through the EXISTING EC2
instance role; never send the token over Node stdout/stderr, HTTP responses,
Compose env, browser storage or logs. The Next.js route validates the owner
workspace+signed Auth0 subject before invoking --launch. This script never
starts AWS GPU or executes a model/provider.
"""
from __future__ import annotations

import fcntl
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PARAMETER = "/dsg/one/prod/kaggle-owner-dispatch-token"
OWNER = "tdealer01-crypto"
REPO = OWNER + "/DSG-Private-Production-Runtime"
API = "https://api.github.com/repos/" + REPO
LAUNCH_WORKFLOW = "launch-kaggle-brain-oidc.yml"
WORKFLOWS = (
    (LAUNCH_WORKFLOW, "OWNER_LAUNCH"),
    ("kaggle-brain-one-shot-e2e.yml", "GOVERNED_E2E"),
    ("kaggle-worker-shutdown-readonly.yml", "STOP_PROOF"),
)
COOLDOWN = 600
LOCK_PATH = "/tmp/dsg-kaggle-owner-dispatch.lock"
MAX_RESPONSE_BYTES = 140_000


class DispatchBlocked(Exception):
    pass


def result(**kwargs):
    # Only audited constant-status results; never print subprocess arguments,
    # tokens, boto3 responses or GitHub exception text.
    print(json.dumps(kwargs, sort_keys=True, separators=(",", ":")), flush=True)


def get_token():
    import boto3
    try:
        value = boto3.client("ssm", region_name="us-east-1").get_parameter(
            Name=PARAMETER, WithDecryption=True
        )["Parameter"]["Value"]
    except Exception as exc:
        code = getattr(getattr(exc, "response", {}).get("Error", {}), "get", lambda *_: "")("Code")
        if code == "ParameterNotFound":
            raise DispatchBlocked("KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED") from None
        raise DispatchBlocked("KAGGLE_SSM_CREDENTIAL_READ_DENIED") from None
    if not isinstance(value, str) or not 30 <= len(value) <= 512 or "\n" in value or "\r" in value:
        raise DispatchBlocked("KAGGLE_OWNER_CREDENTIAL_INVALID")
    return value


def api_call(path, token, *, body=None):
    assert path.startswith("https://api.github.com/") and len(path) < 300
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    req = Request(
        path, data=data,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "DSG-ONE-Owner-Kaggle-Dispatch",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
        method="POST" if data is not None else "GET",
    )
    try:
        with urlopen(req, timeout=9) as response:
            if body is not None:
                if response.status != 204:
                    raise DispatchBlocked("KAGGLE_WORKFLOW_DISPATCH_NOT_ACCEPTED")
                return {}
            if response.status != 200:
                raise DispatchBlocked("KAGGLE_GITHUB_READ_FAILED")
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise DispatchBlocked("KAGGLE_GITHUB_RESPONSE_TOO_LARGE")
            return json.loads(raw)
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        raise DispatchBlocked("KAGGLE_GITHUB_REQUEST_UNAVAILABLE") from None


def owner_token(token):
    user = api_call("https://api.github.com/user", token)
    if not isinstance(user, dict) or user.get("login") != OWNER:
        raise DispatchBlocked("KAGGLE_GITHUB_OWNER_IDENTITY_MISMATCH")


def workflow_snapshot(token, filename, name, limit=1):
    data = api_call(API + "/actions/workflows/" + filename +
                    "/runs?event=workflow_dispatch&per_page=" + str(limit), token)
    runs = data.get("workflow_runs") if isinstance(data, dict) else None
    if not isinstance(runs, list):
        raise DispatchBlocked("KAGGLE_RUNS_RESPONSE_INVALID")
    output = []
    for row in runs:
        if not isinstance(row, dict):
            raise DispatchBlocked("KAGGLE_RUNS_RESPONSE_INVALID")
        state = row.get("status")
        conclusion = row.get("conclusion")
        number = row.get("id")
        created = row.get("created_at")
        updated = row.get("updated_at")
        if (not isinstance(number, int) or not isinstance(created, str) or
                not isinstance(updated, str)):
            raise DispatchBlocked("KAGGLE_RUNS_RESPONSE_INVALID")
        if state in ("queued", "waiting", "pending", "requested"):
            classification = "QUEUED"
        elif state == "in_progress":
            classification = "IN_PROGRESS"
        elif state == "completed" and conclusion == "success":
            classification = "SUCCESS"
        elif state == "completed":
            classification = "FAILED"
        else:
            classification = "UNKNOWN"
        output.append({
            "name": name, "runId": number, "state": classification,
            "createdAt": created, "updatedAt": updated,
        })
    return output


def read_state(token):
    snapshots = []
    for filename, name in WORKFLOWS:
        row = workflow_snapshot(token, filename, name)
        if row:
            item = row[0]
            snapshots.append({
                "name": item["name"], "state": item["state"],
                "runId": item["runId"], "updatedAt": item["updatedAt"],
            })
    return {
        "ok": True, "connected": True, "source": "AWS_SSM_GITHUB_ACTIONS_READ_ONLY",
        "dispatchConfigured": True,
        "gpuState": "UNVERIFIED",
        "workflows": snapshots,
    }


def launch(token):
    now = time.time()
    # Single current-host process lock. NOT a cross-region durable lease.
    # The existing Github concurrency and Kaggle active-kernel/quota checks
    # still gate the provider. Never trigger automatically on chat retries.
    with Path(LOCK_PATH).open("a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DispatchBlocked("KAGGLE_OWNER_DISPATCH_LOCKED") from None
        for filename, name in WORKFLOWS[:2]:
            for row in workflow_snapshot(token, filename, name, limit=8):
                if row["state"] in ("QUEUED", "IN_PROGRESS"):
                    raise DispatchBlocked("KAGGLE_GPU_JOB_ALREADY_IN_PROGRESS")
                try:
                    from datetime import datetime, timezone
                    created = datetime.fromisoformat(
                        row["createdAt"].replace("Z", "+00:00")
                    ).astimezone(timezone.utc).timestamp()
                except ValueError:
                    raise DispatchBlocked("KAGGLE_RUN_DATE_UNVERIFIED") from None
                if created > now + 300:
                    raise DispatchBlocked("KAGGLE_RUN_CLOCK_INVALID")
                if 0 <= now - created < COOLDOWN:
                    raise DispatchBlocked("KAGGLE_RECENT_LAUNCH_COOLDOWN")
        api_call(API + "/actions/workflows/" + LAUNCH_WORKFLOW + "/dispatches",
                 token, body={
                     "ref": "main",
                     "inputs": {
                         "confirm": "LAUNCH_DSG_KAGGLE_BRAIN",
                         "execution_runner": "github-hosted",
                     },
                 })
    return {
        "ok": True, "status": "OWNER_DISPATCH_ACCEPTED",
        "gpuState": "UNVERIFIED",
    }


def main(args):
    if args not in (["--status"], ["--launch"]):
        result(ok=False, error="INVALID_MODE")
        return 42
    try:
        token = get_token()
        owner_token(token)
        output = read_state(token) if args == ["--status"] else launch(token)
        result(**output)
        return 0
    except DispatchBlocked as exc:
        if str(exc) == "KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED" and args == ["--status"]:
            result(ok=True, connected=False, dispatchConfigured=False,
                   gpuState="UNVERIFIED", source="NOT_CONFIGURED",
                   message="KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED", workflows=[])
            return 0
        result(ok=False, error=str(exc), gpuState="UNVERIFIED")
        return 42
    except Exception:
        result(ok=False, error="KAGGLE_OWNER_BRIDGE_UNAVAILABLE", gpuState="UNVERIFIED")
        return 42


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
