# TC-EXP · CSV Export (E12, P1)

Refs: FR-180…FR-182

| ID         | Title           | Pre                               | Steps                | Expected                                           | Refs    | Pri | Type |
| ---------- | --------------- | --------------------------------- | -------------------- | -------------------------------------------------- | ------- | --- | ---- |
| TC-EXP-001 | Export filtered | analyst                           | filters → Export     | CSV UTF-8 BOM; columns per spec; rows = list total | FR-180  | P1  | A+M  |
| TC-EXP-002 | Cap exceeded    | > cap rows                        | Export               | `413 EXPORT_TOO_LARGE` with cap; UI message        | FR-181  | P1  | A+M  |
| TC-EXP-003 | Viewer gate     | `allowViewerExport=false/true`    | Export as viewer     | 403 then 200                                       | FR-180  | P1  | A    |
| TC-EXP-004 | Audit           | any export                        | inspect audit        | `mentions.exported` with filters & count           | FR-200  | P1  | A    |
| TC-EXP-005 | Encoding        | VI text, commas, quotes, newlines | open in Excel/Sheets | correct cells                                      | FR-180  | P1  | M    |
| TC-EXP-006 | Throttle        | 6 exports/min                     | —                    | 6th `429`                                          | NFR-017 | P1  | A    |
