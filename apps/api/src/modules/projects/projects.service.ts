import { Injectable } from "@nestjs/common";
import type { Project, ProjectSettings, UpdateProjectBody, UserRole } from "@how-about-me/contracts";
import { parseProjectSettings } from "../../common/auth/project-settings";
import { AppError } from "../../common/errors/app.error";
import { AuditService } from "../audit/audit.service";
import { toProject } from "./projects.mapper";
import { type ProjectUpdateData, ProjectsRepository } from "./projects.repository";

type Change = { from: unknown; to: unknown };

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string): Promise<Project[]> {
    const rows = await this.repo.listForUser(userId);
    return rows.map((r) => toProject(r.project, r.role));
  }

  async get(projectId: string, role: UserRole): Promise<Project> {
    const p = await this.repo.findById(projectId);
    if (!p) throw AppError.notFound("Project");
    return toProject(p, role);
  }

  /**
   * FR-032: admin edits name/timezone/settings (toggles + `phraseMinMentions` #251 + `landingTerms` #261). Settings are merged (unsent keys keep their value).
   * FR-200: `project.updated` is audited in the same transaction with only the changed fields; no-op → no audit.
   */
  update(
    projectId: string,
    body: UpdateProjectBody,
    actorUserId: string,
    role: UserRole,
    requestId: string | null,
  ): Promise<Project> {
    return this.repo.transaction(async (tx) => {
      const current = await this.repo.findById(projectId, tx);
      if (!current) throw AppError.notFound("Project");
      const currentSettings = parseProjectSettings(current.settings);
      const changes: Record<string, Change> = {};
      const data: ProjectUpdateData = {};

      if (body.name !== undefined && body.name !== current.name) {
        changes.name = { from: current.name, to: body.name };
        data.name = body.name;
      }
      if (body.timezone !== undefined && body.timezone !== current.timezone) {
        changes.timezone = { from: current.timezone, to: body.timezone };
        data.timezone = body.timezone;
      }
      if (body.settings) {
        // Keys mix booleans, numbers (#251) and string arrays (#261); values are already schema-validated per key.
        const merged: Record<keyof ProjectSettings, ProjectSettings[keyof ProjectSettings]> = { ...currentSettings };
        for (const key of Object.keys(body.settings) as (keyof ProjectSettings)[]) {
          const next = body.settings[key];
          if (next === undefined || sameSettingValue(next, currentSettings[key])) continue;
          merged[key] = next;
          changes[`settings.${key}`] = { from: currentSettings[key], to: next };
        }
        if (Object.keys(changes).some((k) => k.startsWith("settings."))) data.settings = merged as ProjectSettings;
      }

      if (Object.keys(changes).length === 0) return toProject(current, role);

      const updated = await this.repo.update(projectId, data, tx);
      await this.audit.record(
        {
          projectId,
          actorUserId,
          action: "project.updated",
          entityType: "project",
          entityId: projectId,
          metadata: { changes },
          requestId,
        },
        tx,
      );
      return toProject(updated, role);
    });
  }
}

/** Value equality for setting values — arrays (`landingTerms`, #261) compare element-wise; order is significant. */
export function sameSettingValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}
