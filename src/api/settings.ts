import { apiClient } from "./client";

export type SmtpConfig = {
  provider: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_ssl: boolean;
};

export type SmtpConfigResponse = Omit<SmtpConfig, "password"> & {
  password_set: boolean;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  variables: string[];
};

export async function getSmtpConfig(): Promise<SmtpConfigResponse> {
  const { data } = await apiClient.get("/admin/settings/smtp");
  return data;
}

export async function saveSmtpConfig(config: SmtpConfig): Promise<void> {
  await apiClient.put("/admin/settings/smtp", config);
}

export async function testSmtp(toEmail: string): Promise<void> {
  await apiClient.post("/admin/settings/smtp/test", { to_email: toEmail });
}

export async function listTemplates(): Promise<Omit<EmailTemplate, "html_body">[]> {
  const { data } = await apiClient.get("/admin/settings/templates");
  return data;
}

export async function getTemplate(id: string): Promise<EmailTemplate> {
  const { data } = await apiClient.get(`/admin/settings/templates/${id}`);
  return data;
}

export async function saveTemplate(id: string, subject: string, html_body: string): Promise<void> {
  await apiClient.put(`/admin/settings/templates/${id}`, { subject, html_body });
}

export async function resetTemplate(id: string): Promise<void> {
  await apiClient.post(`/admin/settings/templates/${id}/reset`);
}
