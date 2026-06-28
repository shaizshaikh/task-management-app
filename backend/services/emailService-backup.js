/**
* Email Service
* Handles sending emails for user notifications
*/

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      // Check if email configuration is provided
      const emailConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      // If no SMTP configuration, use a test account or disable emails
      if (!emailConfig.host || !emailConfig.auth.user) {
        console.log('Email service: No SMTP configuration found. Email notifications will be logged only.');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userInfo) {
    const { email, username, full_name, password, temporaryPassword } = userInfo;

    const subject = 'Welcome to Prismex';
    const htmlContent = this.generateWelcomeEmailTemplate({
      username,
      full_name: full_name || username,
      password,
      temporaryPassword,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:8080'
    });

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send bulk import completion notification
   */
  async sendImportCompletionEmail(adminEmail, importResults) {
    const { successful, failed, total, failedUsers = [] } = importResults;

    const subject = `User Import Completed - ${successful}/${total} users imported`;
    const htmlContent = this.generateImportCompletionTemplate({
      successful,
      failed: typeof failed === 'number' ? failed : (failedUsers?.length || 0),
      total,
      failedUsers: Array.isArray(failedUsers) ? failedUsers.slice(0, 10) : []
    });

    return await this.sendEmail({
      to: adminEmail,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send user deletion notification
   */
  async sendUserDeletionEmail(userInfo) {
    const { email, username, full_name } = userInfo;

    const subject = 'Account Deletion Notification';
    const htmlContent = this.generateUserDeletionTemplate({
      username,
      full_name: full_name || username
    });

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send user restoration notification
   */
  async sendUserRestorationEmail(userInfo) {
    const { email, username, full_name } = userInfo;

    const subject = 'Account Restored - Welcome Back!';
    const htmlContent = this.generateUserRestorationTemplate({
      username,
      full_name: full_name || username,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:8080'
    });

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentEmail(userInfo, taskInfo, assignedBy) {
    const { email, username, full_name } = userInfo;
    const { title, description, priority, due_date, team_name } = taskInfo;

    const subject = `New Task Assigned: ${title}`;
    const htmlContent = this.generateTaskAssignmentTemplate({
      username,
      full_name: full_name || username,
      taskTitle: title,
      taskDescription: description,
      priority,
      dueDate: due_date,
      teamName: team_name,
      assignedBy: assignedBy.full_name || assignedBy.username,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:8080'
    });

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send team change notification
   */
  async sendTeamChangeEmail(userInfo, teamInfo, changeType, changedBy) {
    const { email, username, full_name } = userInfo;
    const { name: teamName, role } = teamInfo;

    const subject = `Team ${changeType === 'added' ? 'Assignment' : 'Update'}: ${teamName}`;
    const htmlContent = this.generateTeamChangeTemplate({
      username,
      full_name: full_name || username,
      teamName,
      role,
      changeType,
      changedBy: changedBy.full_name || changedBy.username,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:8080'
    });

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send task status update notification to team leaders
   */
  async sendTaskStatusUpdateEmail(leaderInfo, taskInfo, updatedBy, attachments = []) {
    const { email, username, full_name } = leaderInfo;
    const { title, status, team_name, old_status } = taskInfo;

    const subject = `Task Status Update: ${title}`;
    const htmlContent = this.generateTaskStatusUpdateTemplate({
      leaderName: full_name || username,
      taskTitle: title,
      oldStatus: old_status,
      newStatus: status,
      teamName: team_name,
      updatedBy: updatedBy.full_name || updatedBy.username,
      attachments,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:8080'
    });

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent
    });
  }

  /**
   * Send generic email
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      if (!this.isConfigured) {
        // Log email instead of sending
        console.log('Email would be sent:');
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Content: ${text || 'HTML content'}`);
        return { success: true, messageId: 'logged-only', method: 'logged' };
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        method: 'smtp'
      };
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error.message);
      return {
        success: false,
        error: error.message,
        method: this.isConfigured ? 'smtp' : 'logged'
      };
    }
  }

  /**
   * Generate welcome email template
   */
  generateWelcomeEmailTemplate({ username, full_name, password, temporaryPassword, loginUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to Prismex</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .credentials { background: #fff; padding: 15px; border-left: 4px solid #4CAF50; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Prismex!</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${full_name}!</h2>
            
            <p>Your account has been created successfully. You can now access Prismex with the following credentials:</p>
            
            <div class="credentials">
                <strong>Username:</strong> ${username}<br>
                <strong>Password:</strong> ${password}<br>
                ${temporaryPassword ? '<em>Note: This is a temporary password. You will be required to change it on your first login.</em>' : ''}
            </div>
            
            <p>Click the button below to access the system:</p>
            
            <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Login to Task Management</a>
            </p>
            
            <h3>Getting Started:</h3>
            <ul>
                <li>View and manage your assigned tasks</li>
                <li>Collaborate with your team members</li>
                <li>Track your progress and productivity</li>
                <li>Comment and communicate on tasks</li>
            </ul>
            
            <p>If you have any questions or need assistance, please contact your system administrator.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate import completion email template
   */
  generateImportCompletionTemplate({ successful, failed, total, failedUsers = [] }) {
    // Ensure failedUsers is an array
    const failedUsersArray = Array.isArray(failedUsers) ? failedUsers : [];
    const failedCount = typeof failed === 'number' ? failed : failedUsersArray.length;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>User Import Completed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 15px; background: white; border-radius: 8px; }
        .stat-number { font-size: 24px; font-weight: bold; color: #4CAF50; }
        .failed-list { background: #fff; padding: 15px; border-left: 4px solid #f44336; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>User Import Completed</h1>
        </div>
        
        <div class="content">
            <h2>Import Summary</h2>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">${total}</div>
                    <div>Total Users</div>
                </div>
                <div class="stat">
                    <div class="stat-number" style="color: #4CAF50;">${successful}</div>
                    <div>Successful</div>
                </div>
                <div class="stat">
                    <div class="stat-number" style="color: #f44336;">${failedCount}</div>
                    <div>Failed</div>
                </div>
            </div>
            
            ${failedCount > 0 && failedUsersArray.length > 0 ? `
            <div class="failed-list">
                <h3>Failed Imports:</h3>
                <ul>
                    ${failedUsersArray.map(user => `
                        <li><strong>${user.username || user.email || 'Unknown User'}</strong>: ${user.error || 'Unknown error'}</li>
                    `).join('')}
                    ${failedCount > 10 ? `<li><em>... and ${failedCount - 10} more</em></li>` : ''}
                </ul>
            </div>
            ` : ''}
            
            <p>The user import process has been completed. ${successful > 0 ? `${successful} users have been successfully created and welcome emails have been sent.` : ''}</p>
            
            ${failedCount > 0 ? '<p>Please review the failed imports and correct any issues before re-importing those users.</p>' : ''}
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate user deletion email template
   */
  generateUserDeletionTemplate({ username, full_name }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Account Deletion Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Account Deletion Notice</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${full_name},</h2>
            
            <div class="warning">
                <strong>Important Notice:</strong> Your account has been deleted from Prismex.
            </div>
            
            <p>Your account with username <strong>${username}</strong> has been removed from the system. This means:</p>
            
            <ul>
                <li>You no longer have access to Prismex</li>
                <li>Your assigned tasks have been reassigned or unassigned</li>
                <li>You have been removed from all teams</li>
                <li>Your account data has been archived for compliance purposes</li>
            </ul>
            
            <p>If you believe this was done in error or if you have any questions, please contact your system administrator immediately.</p>
            
            <p>Thank you for your time with Prismex.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate user restoration email template
   */
  generateUserRestorationTemplate({ username, full_name, password, temporaryPassword, loginUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Account Restored - Welcome Back!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .credentials { background: #fff; padding: 15px; border-left: 4px solid #4CAF50; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome Back!</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${full_name},</h2>
            
            <div class="success">
                <strong>Great News:</strong> Your account has been restored and you now have access to Prismex again!
            </div>
            
            <p>Your account with username <strong>${username}</strong> has been successfully restored.</p>
            
            ${password ? `
            <div class="credentials">
                <h3>Your New Login Credentials:</h3>
                <strong>Username:</strong> ${username}<br>
                <strong>Password:</strong> ${password}<br>
                ${temporaryPassword ? '<em>Note: This is a temporary password. You will be required to change it on your first login for security.</em>' : ''}
            </div>
            ` : ''}
            
            <p>You can now:</p>
            
            <ul>
                <li>Access Prismex</li>
                <li>View and manage your tasks</li>
                <li>Collaborate with your team members</li>
                <li>Track your progress and productivity</li>
            </ul>
            
            <p>Click the button below to access the system:</p>
            
            <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Login to Prismex</a>
            </p>
            
            <p>If you have any questions or need assistance, please contact your system administrator.</p>
            
            <p>Welcome back to the team!</p>
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate task assignment email template
   */
  generateTaskAssignmentTemplate({ username, full_name, taskTitle, taskDescription, priority, dueDate, teamName, assignedBy, loginUrl }) {
    const priorityColors = {
      high: '#f44336',
      medium: '#ff9800',
      low: '#4caf50'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Task Assignment</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .task-details { background: #fff; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .priority { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-size: 12px; font-weight: bold; }
        .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Task Assignment</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${full_name},</h2>
            
            <p>You have been assigned a new task by <strong>${assignedBy}</strong>:</p>
            
            <div class="task-details">
                <h3>${taskTitle}</h3>
                ${taskDescription ? `<p><strong>Description:</strong> ${taskDescription}</p>` : ''}
                
                <div style="margin: 15px 0;">
                    <span class="priority" style="background-color: ${priorityColors[priority] || '#666'};">
                        ${priority?.toUpperCase()} PRIORITY
                    </span>
                    ${teamName ? `<span style="margin-left: 10px;">Team: <strong>${teamName}</strong></span>` : ''}
                </div>
                
                ${dueDate ? `<p>Due Date: <strong>${new Date(dueDate).toLocaleDateString()}</strong></p>` : ''}
            </div>
            
            <p>Click the button below to view the task and get started:</p>
            
            <p style="text-align: center;">
                <a href="${loginUrl}" class="button">View Task</a>
            </p>
            
            <p>If you have any questions about this task, please reach out to your team leader or the person who assigned it.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate team change email template
   */
  generateTeamChangeTemplate({ username, full_name, teamName, role, changeType, changedBy, loginUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Team ${changeType === 'added' ? 'Assignment' : 'Update'}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #9c27b0; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .team-info { background: #fff; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #9c27b0; }
        .button { display: inline-block; padding: 12px 24px; background: #9c27b0; color: white; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Team ${changeType === 'added' ? 'Assignment' : 'Update'}</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${full_name},</h2>
            
            <p>Your team membership has been updated by <strong>${changedBy}</strong>:</p>
            
            <div class="team-info">
                <h3>${teamName}</h3>
                <p><strong>Your Role:</strong> ${role?.charAt(0).toUpperCase() + role?.slice(1)}</p>
                
                ${changeType === 'added' ? `
                <p>You have been <strong>added</strong> to this team. You now have access to:</p>
                <ul>
                    <li>Team tasks and projects</li>
                    <li>Team member collaboration</li>
                    <li>Team performance metrics</li>
                </ul>
                ` : `
                <p>Your team membership has been <strong>updated</strong>. Please review your new permissions and responsibilities.</p>
                `}
            </div>
            
            <p>Click the button below to access your team dashboard:</p>
            
            <p style="text-align: center;">
                <a href="${loginUrl}" class="button">View Team</a>
            </p>
            
            <p>If you have any questions about your team assignment or role, please contact your team leader.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate task status update email template for team leaders
   */
  generateTaskStatusUpdateTemplate({ leaderName, taskTitle, oldStatus, newStatus, teamName, updatedBy, attachments, loginUrl }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Task Status Update</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .status-update { background: #fff; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; color: white; font-size: 12px; font-weight: bold; margin: 0 5px; }
        .attachments { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #ff9800; color: white; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Task Status Update</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${leaderName},</h2>
            
            <p>A task in your team <strong>${teamName}</strong> has been updated by <strong>${updatedBy}</strong>:</p>
            
            <div class="status-update">
                <h3>${taskTitle}</h3>
                
                <div style="margin: 15px 0;">
                    <span class="status-badge" style="background-color: #666;">${oldStatus?.toUpperCase().replace('-', ' ')}</span>
                    <span style="font-size: 18px;">→</span>
                    <span class="status-badge" style="background-color: ${newStatus === 'done' ? '#4caf50' : newStatus === 'in-progress' ? '#ff9800' : '#2196f3'};">
                        ${newStatus?.toUpperCase().replace('-', ' ')}
                    </span>
                </div>
                
                <p><strong>Updated by:</strong> ${updatedBy}</p>
                <p><strong>Team:</strong> ${teamName}</p>
            </div>
            
            ${attachments && attachments.length > 0 ? `
            <div class="attachments">
                <h4>New Attachments (${attachments.length}):</h4>
                <ul>
                    ${attachments.map(attachment => `
                        <li>${attachment.original_name} (${(attachment.file_size / 1024).toFixed(1)} KB)</li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            
            <p>Click the button below to view the task details:</p>
            
            <p style="text-align: center;">
                <a href="${loginUrl}" class="button">View Task</a>
            </p>
            
            <p>This notification is sent to all leaders of the <strong>${teamName}</strong> team.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent automatically by Prismex.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Strip HTML tags from content
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          message: 'Email service not configured - SMTP settings missing'
        };
      }

      await this.transporter.verify();
      return {
        success: true,
        message: 'Email service connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: `Email service connection failed: ${error.message}`
      };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();