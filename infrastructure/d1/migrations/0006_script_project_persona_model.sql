ALTER TABLE script_projects ADD COLUMN persona_model_id TEXT;

CREATE INDEX IF NOT EXISTS idx_script_projects_workspace_persona_model
  ON script_projects(workspace_id, persona_model_id);
