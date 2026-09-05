# TC-PROJ · Monitoring Project & Members (E02)

Refs: FR-030…FR-036

| ID          | Title                         | Pre                  | Steps                                           | Expected                                                                            | Refs           | Pri | Type |
| ----------- | ----------------------------- | -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- | --- | ---- |
| TC-PROJ-001 | Seed project exists           | fresh DB + seed      | `GET /projects` as admin                        | `1Zone / Eventista Social Listening`, slug `1zone-eventista`, tz `Asia/Ho_Chi_Minh` | FR-030         | P0  | A+M  |
| TC-PROJ-002 | Seed idempotent               | seeded               | Run seed again                                  | No duplicates (1 project, 4 queries, 1 admin membership)                            | FR-030         | P0  | A    |
| TC-PROJ-003 | List only my projects         | analyst of P1 only   | `GET /projects`                                 | Only P1 with role analyst                                                           | FR-031         | P0  | A    |
| TC-PROJ-004 | Update timezone valid         | admin                | `PATCH {timezone:"Asia/Bangkok"}`               | 200; overview default tz changes; audit `project.updated`                           | FR-032, FR-200 | P0  | A+M  |
| TC-PROJ-005 | Update timezone invalid       | admin                | `PATCH {timezone:"Mars/Olympus"}`               | `400 VALIDATION_ERROR`                                                              | FR-032         | P0  | A    |
| TC-PROJ-006 | Toggle settings               | admin                | `PATCH {settings:{allowViewerExport:true}}`     | 200; `/me` reflects; viewer export allowed (P1)                                     | FR-032         | P0  | A    |
| TC-PROJ-007 | Add member by email           | admin                | `POST /members {email, role:"analyst"}`         | 201; membership exists; audit `member.added`                                        | FR-033         | P0  | A+M  |
| TC-PROJ-008 | Member first login reconciles | invited before login | Invitee logs in                                 | Profile linked; role effective                                                      | FR-033         | P0  | M    |
| TC-PROJ-009 | Change role                   | admin                | `PATCH /members/:uid {role:"viewer"}`           | Immediate effect on next request (403 on analyst actions)                           | FR-034         | P0  | A    |
| TC-PROJ-010 | Remove member                 | admin                | `DELETE /members/:uid`                          | 204; next request `403 FORBIDDEN_PROJECT`                                           | FR-034         | P0  | A    |
| TC-PROJ-011 | Last admin protection         | single admin         | Downgrade/remove self                           | `409 LAST_ADMIN`                                                                    | FR-035         | P0  | A    |
| TC-PROJ-012 | Switcher hidden               | one project          | Load app                                        | No project switcher                                                                 | FR-036         | P0  | M    |
| TC-PROJ-013 | Switcher shown                | two projects         | Load app                                        | Switcher visible; switching changes data scope                                      | FR-036         | P1  | M    |
| TC-PROJ-014 | Members UI                    | admin                | Settings → Members: invite, change role, remove | Table updates; confirmations; errors surfaced                                       | FR-033…035     | P0  | M    |
