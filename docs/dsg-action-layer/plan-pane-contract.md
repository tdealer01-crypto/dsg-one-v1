# Plan Pane Contract

## Purpose

The plan pane is the visible, user-facing planning view before execution. It is not hidden reasoning.

The user should quickly understand:

1. the goal,
2. how the systems connect,
3. what stages will run,
4. what risks matter,
5. where permission or takeover may be required,
6. what success looks like.

## Rendering order

Always render in this order:

1. `goal`
2. `architecture`
3. `stages`
4. `risks`
5. `permissions`
6. `definition_of_success`

## JSON shape

```json
{
  "plan_pane": {
    "goal": {
      "text": "string",
      "constraints": ["string"]
    },
    "architecture": {
      "systems": [
        { "name": "string", "role": "string" }
      ],
      "flow_summary": ["string"]
    },
    "stages": [
      {
        "id": "string",
        "title": "string",
        "purpose": "string",
        "type": "inspect | decide | execute | verify",
        "external_boundary": true,
        "approval_required": false
      }
    ],
    "risks": [
      {
        "level": "low | medium | high",
        "title": "string",
        "impact": "string",
        "mitigation": "string"
      }
    ],
    "permissions": [
      {
        "target": "string",
        "decision": "allow | needs user takeover | deny",
        "reason": "string",
        "user_next_step": "string"
      }
    ],
    "definition_of_success": {
      "outcomes": ["string"],
      "evidence": ["string"]
    }
  }
}
```

## Rules

- Freeze the goal before expanding the plan.
- Keep stage IDs stable across revisions.
- Keep permissions focused on user-relevant checkpoints.
- Do not silently change success criteria after the user starts reviewing.
- Do not execute until the user explicitly approves the plan.
