# TC-REV · Analyst Workflow (E11, P1)

Refs: FR-190…FR-196

| ID         | Title                                | Pre                             | Steps                                           | Expected                                                                  | Refs           | Pri | Type |
| ---------- | ------------------------------------ | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | -------------- | --- | ---- |
| TC-REV-001 | Create override                      | analyst                         | override sentiment negative→neutral with reason | 201; detail shows Analyst badge, AI value struck-through                  | FR-191, FR-194 | P1  | A+M  |
| TC-REV-002 | Effective value in analytics         | after 001                       | overview                                        | negative numerator −1                                                     | FR-192         | P1  | A+M  |
| TC-REV-003 | Effective value in list              | after 001                       | list filter sentiment=neutral                   | post appears; `hasOverride=true`                                          | FR-192         | P1  | A    |
| TC-REV-004 | Revoke override                      | —                               | DELETE                                          | 204; history kept with revoked_at; analytics revert                       | FR-193         | P1  | A    |
| TC-REV-005 | Override intents/topics              | —                               | set intents [complaint]                         | label set replaced for effective; original in history                     | FR-191         | P1  | A    |
| TC-REV-006 | Viewer cannot override               | viewer                          | POST                                            | 403                                                                       | FR-191         | P1  | A    |
| TC-REV-007 | Review queue contents                | uncertain/low-confidence/failed | open `/reviews`                                 | listed by reason; mark reviewed removes                                   | FR-195         | P1  | M    |
| TC-REV-008 | Bulk re-analysis dry run             | admin                           | POST dryRun                                     | matched count; nothing enqueued                                           | FR-196         | P1  | A    |
| TC-REV-009 | Bulk cap & throttle                  | admin                           | matched > cap; two calls in 5 min               | cap enforced; second `429`; audit                                         | FR-196         | P1  | A    |
| TC-REV-010 | Analysis settings new policy version | admin                           | change thresholds                               | `safety-policy-v2` recorded; new runs use it; optional re-analysis prompt | FR-190         | P1  | A+M  |
| TC-REV-011 | Backfill UI                          | admin                           | request window; watch progress                  | job progresses; no duplicates                                             | FR-063         | P1  | M    |
