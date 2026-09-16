---
# ⚠️: Internal use only. To onboard, follow instructions at __ZYRAXKEEP__0_
agent: agent
model: Claude Sonnet 4.5 (copilot)
argument-hint: Describe your issue. Include relevant keywords or phrases.
description: Search for an existing ZYRAXON Code GitHub issue
tools:
  - github/*
  - agent/runSubagent
---

## Your Task
1. Get the file contents of the prompt file __ZYRAXKEEP__1_
2. Follow those instructions PRECISELY to find issues related to the issue description provided. Perform your search in the `zyraxoncode` repository.
