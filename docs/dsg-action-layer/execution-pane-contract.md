# Execution Pane Contract

## Purpose

The execution pane is the user-facing live operations view after the user approves a plan.

It should answer:

1. what is running now,
2. what already finished,
3. what is blocked or failed,
4. what the user needs to do next.

## Rendering order

Always render in this order:

1. `run_status`
2. `current_goal`
3. `current_stage`
4. `stage_list`
5. `evidence`
6. `checkpoints`
7. `next_action`

## JSON shape

```json
{
  "execution_pane": {
    "run_status": {
      "state": "draft | ready for approval | approved | running | blocked | completed | failed | canceled",
      "summary": "string"
    },
    "current_goal": {
      "text": "string"
    },
    "current_stage": {
      "id": "string",
      "title": "string",
      "state": "pending | running | completed | blocked | failed | skipped",
      "summary": "string"
    },
    "stage_list": [
      {
        "id": "string",
        "title": "string",
        "state": "pending | running | completed | blocked | failed | skipped",
        "evidence_hint": "string"
      }
    ],
    "evidence": [
      {
        "type": "screenshot | page_state | status_label | confirmation | artifact | log_excerpt",
        "title": "string",
        "detail": "string"
      }
    ],
    "checkpoints": [
      {
        "type": "external app | login | consent | takeover | privileged action",
        "state": "pending | active | resolved",
        "instruction": "string"
      }
    ],
    "next_action": {
      "owner": "studio | user",
      "instruction": "string"
    }
  }
}
```

## Rules

- Update `current_stage` first when execution moves.
- Then update the matching item in `stage_list`.
- Add evidence only when it is visible and user-relevant.
- Create checkpoints only for real user-facing blockers.
- `blocked` returns to `running` only after the blocker is resolved.
