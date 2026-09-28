from pathlib import Path

WORKFLOW = Path(".github/workflows/build-aws-dsg-one.yml").read_text(encoding="utf-8")


def test_aws_image_workflow_tracks_runtime_source_surfaces():
    for path in (
        '"app/**"',
        '"lib/**"',
        '"components/**"',
        '"store/**"',
        '"mcp/**"',
        '"public/**"',
        '"middleware.ts"',
        '"tsconfig.json"',
        '"automation_spacetime/**"',
    ):
        assert path in WORKFLOW


def test_aws_image_workflow_keeps_cost_safe_gate():
    assert "AWS_DSG_ONE_RUNTIME_DEPLOY=BLOCKED_BY_COST_GATE" in WORKFLOW
    assert "does not start EC2" in WORKFLOW


def test_aws_image_workflow_publishes_verified_identity_metadata():
    assert "/dsg/one/prod/image-source-sha" in WORKFLOW
    assert "/dsg/one/prod/image-digest" in WORKFLOW
    assert "AWS_DSG_ONE_IMAGE_IDENTITY_METADATA=PASS" in WORKFLOW
    assert 'steps.image.outputs.digest' in WORKFLOW
