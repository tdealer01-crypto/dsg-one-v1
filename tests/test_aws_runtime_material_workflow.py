from pathlib import Path

WORKFLOW = Path(".github/workflows/prepare-aws-runtime-material.yml").read_text(encoding="utf-8")


def test_runtime_material_workflow_is_manual_and_cost_safe():
    assert "workflow_dispatch:" in WORKFLOW
    assert "ec2 start-instances" not in WORKFLOW
    assert "docker compose up" not in WORKFLOW
    assert "Runtime compute was not started." in WORKFLOW


def test_runtime_material_workflow_uses_oidc_and_scoped_ssm_paths():
    assert "aws-actions/configure-aws-credentials@v4" in WORKFLOW
    assert "dsg-one-v1-github-deploy" in WORKFLOW
    assert "/dsg/one/prod/supabase-url" in WORKFLOW
    assert "/dsg/one/prod/supabase-service-role-key" in WORKFLOW
    assert "/dsg/one/prod/prepared-source-sha" in WORKFLOW
    assert "--type SecureString" in WORKFLOW


def test_runtime_material_workflow_never_prints_service_role_value():
    assert 'echo "$DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY"' not in WORKFLOW
    assert "cat <<EOF" not in WORKFLOW


def test_runtime_material_requires_modern_server_secret_key():
    assert '== sb_secret_*' in WORKFLOW
    assert "must be a modern Supabase sb_secret_ key" in WORKFLOW
    assert "service_role_kind=secret_api_key" in WORKFLOW
