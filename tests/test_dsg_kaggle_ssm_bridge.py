"""Unit contracts for DSG ONE SSM/GitHub owner bridge, with no external I/O."""
import contextlib
import importlib.util
import io
import json
import pathlib
import unittest
from unittest import mock

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts/dsg-kaggle-ssm-bridge.py"
SPEC = importlib.util.spec_from_file_location("dsg_kaggle_bridge", SCRIPT)
BRIDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BRIDGE)


def captured(call):
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink):
        returned = call()
    value = json.loads(sink.getvalue())
    assert returned == 0
    return value


class KaggleSsmBridgeTests(unittest.TestCase):
    def test_missing_parameter_never_enables_dispatch(self):
        with mock.patch.object(BRIDGE, "get_token", return_value=None):
            status = captured(BRIDGE.status)
            start = captured(BRIDGE.start)
        self.assertEqual(status["source"], "AWS_SSM_NOT_CONFIGURED")
        self.assertEqual(status["gpuState"], "UNVERIFIED")
        self.assertFalse(status["dispatchConfigured"])
        self.assertEqual(start["httpStatus"], 503)
        self.assertEqual(start["error"], "KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED")

    def test_owner_dispatch_success_is_not_gpu_ready(self):
        owner_token = "github_pat_" + "dummy" * 10
        responses = [
            {"login": "tdealer01-crypto"},
            {"workflow_runs": []},
            True,
        ]
        with mock.patch.object(BRIDGE, "get_token", return_value=owner_token), \
             mock.patch.object(BRIDGE, "github", side_effect=responses) as api:
            outcome = captured(BRIDGE.start)
        self.assertEqual(outcome["httpStatus"], 202)
        self.assertEqual(outcome["status"], "OWNER_DISPATCH_ACCEPTED")
        self.assertEqual(outcome["gpuState"], "UNVERIFIED")
        self.assertEqual(api.call_count, 3)
        args = api.call_args
        self.assertIn("launch-kaggle-brain-oidc.yml/dispatches", args.args[1])
        self.assertEqual(args.kwargs["method"], "POST")
        self.assertEqual(args.kwargs["payload"]["ref"], "main")
        self.assertEqual(args.kwargs["payload"]["inputs"]["execution_runner"], "github-hosted")
        self.assertNotIn(owner_token, json.dumps(outcome))

    def test_foreign_owner_blocks_before_dispatch(self):
        with mock.patch.object(BRIDGE, "get_token", return_value="dummy"), \
             mock.patch.object(BRIDGE, "github", return_value={"login": "different"}) as api:
            result = captured(BRIDGE.start)
        self.assertEqual(result["httpStatus"], 403)
        self.assertEqual(api.call_count, 1)

    def test_active_worker_workflow_blocks_repeated_launch(self):
        with mock.patch.object(BRIDGE, "get_token", return_value="dummy"), \
             mock.patch.object(BRIDGE, "github", side_effect=[
                 {"login": "tdealer01-crypto"},
                 {"workflow_runs": [
                     {"status": "in_progress", "created_at": "2026-10-21T09:00:00Z"}
                 ]},
             ]) as api:
            result = captured(BRIDGE.start)
        self.assertEqual(result["httpStatus"], 409)
        self.assertEqual(result["error"], "KAGGLE_LAUNCH_ALREADY_IN_PROGRESS")
        self.assertEqual(api.call_count, 2)

    def test_exception_never_leaks_provider_credentials(self):
        with mock.patch.object(BRIDGE.sys, "argv", ["script", "status"]):
            with mock.patch.object(BRIDGE, "get_token", side_effect=ValueError("secret-or-policy-details")):
                outcome = captured(BRIDGE.main)
        self.assertEqual(outcome["httpStatus"], 503)
        self.assertNotIn("secret-or-policy-details", json.dumps(outcome))


if __name__ == "__main__":
    unittest.main()
