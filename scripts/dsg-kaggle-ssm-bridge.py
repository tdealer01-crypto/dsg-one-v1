#!/usr/bin/env python3
"""Owner Kaggle GitHub control using AWS EC2's own SSM SecureString access.

This child process never emits credentials, GitHub response bodies, AWS error
messages, or raw Kaggle logs. It cannot launch AWS GPU capacity. Parameters
are fixed by code, not supplied by the browser or command line.
"""
from __future__ import annotations

import datetime
import json
import sys
import urllib.error
import urllib.request

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

REGION = "us-east-1"
OWNER = "tdealer01-crypto"
REPO = "DSG-Private-Production-Runtime"
DISPATCH_PARAMETER = "/dsg/one/prod/kaggle-owner-dispatch-token"
READ_PARAMETER = "/dsg/one/prod/kaggle-workflow-read-token"
API_ROOT = "https://api.github.com/repos/" + OWNER + "/" + REPO
LAUNCH_WORKFLOW = "launch-kaggle-brain-oidc.yml"
WORKFLOWS = (
    ("launch-kaggle-brain-oidc.yml", "OWNER_LAUNCH"),
    ("kaggle-brain-one-shot-e2e.yml", "GOVERNED_E2E"),
    ("kaggle-worker-shutdown-readonly.yml", "STOP_PROOF"),
)
COOLDOWN_SECONDS = 600
STATES = {"queued", "waiting", "pending", "requested", "in_progress"}
CONFIG = Config(connect_timeout=2, read_timeout=4, retries={"max_attempts": 1})


def emit(status: int, **body: object) -> int:
    # Fixed error codes only; no exception string, policy ARN or raw replies.
    print(json.dumps({"httpStatus": status, **body}, separators=(",", ":")))
    return 0


def get_token(name: str) -> str | None:
    if name not in (DISPATCH_PARAMETER, READ_PARAMETER):
        raise ValueError("UNLISTED_PARAMETER")
    client = boto3.client("ssm", region_name=REGION, config=CONFIG)
    try:
        value = client.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code == "ParameterNotFound":
            return None
        raise
    if not isinstance(value, str) or not value.startswith("github_pat_"):
        raise ValueError("OWNER_GITHUB_TOKEN_FORMAT_INVALID")
    if not 40 <= len(value) <= 512 or any(ch.isspace() for ch in value):
        raise ValueError("OWNER_GITHUB_TOKEN_FORMAT_INVALID")
    return value


def github(token: str, path: str, *, method: str = "GET", payload: object = None):
    if method not in ("GET", "POST"):
        raise ValueError("METHOD_UNSUPPORTED")
    # Only fixed routes from internal code can reach this function.
    if path == "/user":
        url = "https://api.github.com/user"
    elif path.startswith("/actions/workflows/") and ".." not in path:
        url = API_ROOT + path
    else:
        raise ValueError("GITHUB_ROUTE_UNLISTED")
    data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "DSG-ONE-Owner-Kaggle-Control",
        },
    )
    with urllib.request.urlopen(req, timeout=8) as response:
        if method == "POST":
            return response.status == 204
        if response.status != 200:
            raise ValueError("GITHUB_REQUEST_FAILED")
        raw = response.read(400_001)
        if len(raw) > 400_000:
            raise ValueError("GITHUB_RESPONSE_TOO_LARGE")
        return json.loads(raw)


def snapshot(token: str, workflow: str, name: str):
    data = github(token, "/actions/workflows/" + workflow + "/runs?event=workflow_dispatch&per_page=1")
    if not isinstance(data, dict) or not isinstance(data.get("workflow_runs"), list):
        raise ValueError("GITHUB_RUN_LIST_INVALID")
    if not data["workflow_runs"]:
        return None
    run = data["workflow_runs"][0]
    if not isinstance(run, dict) or not isinstance(run.get("id"), int):
        raise ValueError("GITHUB_RUN_INVALID")
    status, conclusion = run.get("status"), run.get("conclusion")
    state = ("QUEUED" if status in {"queued", "waiting", "pending", "requested"}
             else "IN_PROGRESS" if status == "in_progress"
             else "SUCCESS" if status == "completed" and conclusion == "success"
             else "FAILED" if status == "completed" else "UNKNOWN")
    updated = run.get("updated_at")
    if not isinstance(updated, str) or len(updated) > 40:
        raise ValueError("GITHUB_RUN_INVALID")
    return {"name": name, "state": state, "runId": run["id"], "updatedAt": updated}


def status():
    owner_token = get_token(DISPATCH_PARAMETER)
    read_token = get_token(READ_PARAMETER)
    token = read_token or owner_token
    if token is None:
        return emit(
            200, ok=True, connected=False, dispatchConfigured=False,
            gpuState="UNVERIFIED", source="AWS_SSM_NOT_CONFIGURED", workflows=[],
        )
    snapshots = [snapshot(token, wf, name) for wf, name in WORKFLOWS]
    return emit(
        200, ok=True, connected=True, dispatchConfigured=bool(owner_token),
        gpuState="UNVERIFIED", source="AWS_SSM_GITHUB_ACTIONS_READ_ONLY",
        workflows=[run for run in snapshots if run is not None],
    )


def start():
    token = get_token(DISPATCH_PARAMETER)
    if token is None:
        return emit(503, ok=False, error="KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED")
    identity = github(token, "/user")
    if not isinstance(identity, dict) or identity.get("login") != OWNER:
        return emit(403, ok=False, error="KAGGLE_GITHUB_OWNER_IDENTITY_MISMATCH")

    runs = github(
        token, "/actions/workflows/" + LAUNCH_WORKFLOW
        + "/runs?event=workflow_dispatch&per_page=8",
    )
    if not isinstance(runs, dict) or not isinstance(runs.get("workflow_runs"), list):
        return emit(503, ok=False, error="KAGGLE_OWNER_RUN_LIST_UNVERIFIED")
    now = datetime.datetime.now(datetime.timezone.utc)
    for run in runs["workflow_runs"]:
        if not isinstance(run, dict) or not isinstance(run.get("status"), str):
            return emit(503, ok=False, error="KAGGLE_OWNER_RUN_LIST_UNVERIFIED")
        if run["status"] in STATES:
            return emit(409, ok=False, error="KAGGLE_LAUNCH_ALREADY_IN_PROGRESS")
        created_at = run.get("created_at")
        if not isinstance(created_at, str):
            return emit(503, ok=False, error="KAGGLE_OWNER_RUN_LIST_UNVERIFIED")
        try:
            created = datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            return emit(503, ok=False, error="KAGGLE_OWNER_RUN_LIST_UNVERIFIED")
        age = (now - created).total_seconds()
        if 0 <= age < COOLDOWN_SECONDS:
            return emit(429, ok=False, error="KAGGLE_RECENT_OWNER_LAUNCH_COOLDOWN")
        if age < 0:
            return emit(503, ok=False, error="KAGGLE_OWNER_RUN_TIMESTAMP_INVALID")

    accepted = github(
        token,
        "/actions/workflows/" + LAUNCH_WORKFLOW + "/dispatches",
        method="POST",
        payload={
            "ref": "main",
            "inputs": {
                "confirm": "LAUNCH_DSG_KAGGLE_BRAIN",
                "execution_runner": "github-hosted",
            },
        },
    )
    if accepted is not True:
        return emit(502, ok=False, error="KAGGLE_OWNER_WORKFLOW_DISPATCH_REJECTED")
    return emit(
        202, ok=True, status="OWNER_DISPATCH_ACCEPTED",
        gpuState="UNVERIFIED",
        details="Kaggle quota, owner worker health and binding remain pending",
    )


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("status", "start"):
        return emit(400, ok=False, error="KAGGLE_BRIDGE_ACTION_UNRECOGNIZED")
    try:
        return status() if sys.argv[1] == "status" else start()
    except (BotoCoreError, ClientError, ValueError, urllib.error.URLError,
            OSError, TimeoutError, KeyError, TypeError, json.JSONDecodeError):
        return emit(503, ok=False, error="KAGGLE_OWNER_SECURE_BRIDGE_UNAVAILABLE")
    except Exception:
        return emit(503, ok=False, error="KAGGLE_OWNER_SECURE_BRIDGE_UNAVAILABLE")


if __name__ == "__main__":
    raise SystemExit(main())
