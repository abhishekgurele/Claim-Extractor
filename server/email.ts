import { google } from 'googleapis';
import type { RequiredDocumentType } from '@shared/schema';
import { documentTypeLabels } from '@shared/schema';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function createEmailBody(to: string, subject: string, htmlContent: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlContent
  ];
  
  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64url');
}

export interface MissingDocumentsEmailParams {
  providerEmail: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  missingDocuments: RequiredDocumentType[];
  submissionId: string;
}

export async function sendMissingDocumentsEmail(params: MissingDocumentsEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const gmail = await getUncachableGmailClient();
    
    const missingDocsList = params.missingDocuments
      .map(type => `<li>${documentTypeLabels[type]}</li>`)
      .join('');
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .patient-info { background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .missing-docs { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
    .missing-docs h3 { color: #dc2626; margin-top: 0; }
    .missing-docs ul { margin: 10px 0; padding-left: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ClaimScan - Missing Documents Notification</h1>
    </div>
    <div class="content">
      <p>A claim submission requires additional documentation from the healthcare provider.</p>
      
      <div class="patient-info">
        <h3>Patient Information</h3>
        <p><strong>Name:</strong> ${params.patientName}</p>
        <p><strong>Email:</strong> ${params.patientEmail}</p>
        <p><strong>Phone:</strong> ${params.patientPhone}</p>
        <p><strong>Submission ID:</strong> ${params.submissionId}</p>
      </div>
      
      <div class="missing-docs">
        <h3>Missing Documents</h3>
        <p>The following documents are required to process this claim:</p>
        <ul>
          ${missingDocsList}
        </ul>
      </div>
      
      <p>Please provide the missing documents at your earliest convenience to allow the claim to be processed.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from ClaimScan Document Processing System.</p>
    </div>
  </div>
</body>
</html>
    `;
    
    const subject = `ClaimScan: Missing Documents for ${params.patientName} - Submission ${params.submissionId}`;
    const raw = createEmailBody(params.providerEmail, subject, htmlContent);
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}
