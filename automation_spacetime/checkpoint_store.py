from __future__ import annotations

import asyncio
import hashlib
import json
import os
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from agent_framework import WorkflowCheckpoint, WorkflowCheckpointException
from agent_framework._workflows._checkpoint_encoding import (
    decode_checkpoint_value,
    encode_checkpoint_value,
)


class SupabaseCheckpointStorage:
    """Agent Framework CheckpointStorage backed by DSG Automation Spacetime SQL."""

    def __init__(self, *, run_id: str, base_url: str | None = None, service_role_key: str | None = None) -> None:
        self.run_id = run_id
        self.base_url = (base_url or os.environ.get("DSG_ONE_V1_SUPABASE_URL") or "").rstrip("/")
        self.service_role_key = service_role_key or os.environ.get("DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY") or ""
        if not self.run_id:
            raise ValueError("AUTOMATION_RUN_ID_REQUIRED")
        if not self.base_url or not self.service_role_key:
            raise ValueError("AUTOMATION_SUPABASE_SERVER_ENV_REQUIRED")

    def _request(self, method: str, path: str, *, body: dict[str, Any] | None = None) -> Any:
        data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
        req = Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(req, timeout=15) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise WorkflowCheckpointException(f"AUTOMATION_SQL_HTTP_{exc.code}:{detail}") from exc
        except Exception as exc:
            raise WorkflowCheckpointException("AUTOMATION_SQL_UNREACHABLE") from exc
        return json.loads(raw) if raw else None

    async def save(self, checkpoint: WorkflowCheckpoint) -> str:
        encoded = encode_checkpoint_value(checkpoint.to_dict())
        canonical = json.dumps(encoded, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        payload_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        await asyncio.to_thread(
            self._request,
            "POST",
            "/rest/v1/rpc/dsg_automation_save_checkpoint",
            body={
                "p_run_id": self.run_id,
                "p_checkpoint_id": checkpoint.checkpoint_id,
                "p_previous_checkpoint_id": checkpoint.previous_checkpoint_id,
                "p_workflow_name": checkpoint.workflow_name,
                "p_graph_signature_hash": checkpoint.graph_signature_hash,
                "p_iteration_count": checkpoint.iteration_count,
                "p_encoded_checkpoint": encoded,
                "p_payload_hash": payload_hash,
                "p_created_at": checkpoint.timestamp,
            },
        )
        return checkpoint.checkpoint_id

    async def load(self, checkpoint_id: str) -> WorkflowCheckpoint:
        params = urlencode({
            "checkpoint_id": f"eq.{checkpoint_id}",
            "run_id": f"eq.{self.run_id}",
            "select": "encoded_checkpoint",
            "limit": "1",
        })
        rows = await asyncio.to_thread(self._request, "GET", f"/rest/v1/dsg_automation_checkpoints?{params}")
        if not rows:
            raise WorkflowCheckpointException(f"No checkpoint found with ID {checkpoint_id}")
        decoded = decode_checkpoint_value(rows[0]["encoded_checkpoint"], allowed_types=frozenset())
        return WorkflowCheckpoint.from_dict(decoded)

    async def list_checkpoints(self, *, workflow_name: str) -> list[WorkflowCheckpoint]:
        params = urlencode({
            "run_id": f"eq.{self.run_id}",
            "workflow_name": f"eq.{workflow_name}",
            "select": "encoded_checkpoint",
            "order": "created_at.asc",
        })
        rows = await asyncio.to_thread(self._request, "GET", f"/rest/v1/dsg_automation_checkpoints?{params}") or []
        return [
            WorkflowCheckpoint.from_dict(
                decode_checkpoint_value(row["encoded_checkpoint"], allowed_types=frozenset())
            )
            for row in rows
        ]

    async def delete(self, checkpoint_id: str) -> bool:
        exists_params = urlencode({
            "checkpoint_id": f"eq.{checkpoint_id}",
            "run_id": f"eq.{self.run_id}",
            "select": "checkpoint_id",
            "limit": "1",
        })
        rows = await asyncio.to_thread(self._request, "GET", f"/rest/v1/dsg_automation_checkpoints?{exists_params}")
        if not rows:
            return False
        delete_params = urlencode({"checkpoint_id": f"eq.{checkpoint_id}", "run_id": f"eq.{self.run_id}"})
        await asyncio.to_thread(self._request, "DELETE", f"/rest/v1/dsg_automation_checkpoints?{delete_params}")
        return True

    async def get_latest(self, *, workflow_name: str) -> WorkflowCheckpoint | None:
        params = urlencode({
            "run_id": f"eq.{self.run_id}",
            "workflow_name": f"eq.{workflow_name}",
            "select": "encoded_checkpoint",
            "order": "created_at.desc",
            "limit": "1",
        })
        rows = await asyncio.to_thread(self._request, "GET", f"/rest/v1/dsg_automation_checkpoints?{params}")
        if not rows:
            return None
        decoded = decode_checkpoint_value(rows[0]["encoded_checkpoint"], allowed_types=frozenset())
        return WorkflowCheckpoint.from_dict(decoded)

    async def list_checkpoint_ids(self, *, workflow_name: str) -> list[str]:
        params = urlencode({
            "run_id": f"eq.{self.run_id}",
            "workflow_name": f"eq.{workflow_name}",
            "select": "checkpoint_id",
            "order": "created_at.asc",
        })
        rows = await asyncio.to_thread(self._request, "GET", f"/rest/v1/dsg_automation_checkpoints?{params}") or []
        return [str(row["checkpoint_id"]) for row in rows]
