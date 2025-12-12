import { Inngest } from "inngest";
import prisma from "../configs/prisma.js"
import sendEmail from "../configs/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "GoFlow" });

//Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk'},
     {event: 'clerk/user.created'},
    async ( {event} ) => {
        const {data} = event
        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

//Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-with-clerk'},
    {event: 'clerk/user.deleted'},
    async ( {event} ) => {
        const {data} = event

        // Check if user exists before deleting
        const existingUser = await prisma.user.findUnique({
            where: {
                id: data.id
            }
        })

        if (existingUser) {
            await prisma.user.delete({
                where: {
                    id: data.id,
                }
            })
        } else {
            console.log(`User ${data.id} not found in database, skipping deletion`)
        }
    }
)

//Inngest function to update user from database
const syncUserUpdation = inngest.createFunction(
    {id: 'update-user-from-clerk'},
    {event: 'clerk/user.updated'},
    async ( {event} ) => {
        const {data} = event
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

//Inngest function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
    {id: 'sync-workspace-from-clerk'},
    {event: 'clerk/organization.created'},
    async ( {event} ) => {
        const {data} = event;
        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            }
        })

        //Add creator as ADMIN member
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: "ADMIN"
            }
        })
    }
)

//Inngest function to update workspace data in database
const syncWorkspaceUpdation = inngest.createFunction(
    {id: 'update-workspace-from-clerk'},
    {event: 'clerk/organization.updated'},
    async ( {event} ) => {
        const {data} = event;
        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

//Inngest function to delete workspace data in database
const syncWorkspaceDeletion = inngest.createFunction(
    {id: 'delete-workspace-with-clerk'},
    {event: 'clerk/organization.deleted'},
    async ( {event} ) => {
        const {data} = event;
        await prisma.workspace.delete({
            where: {
                id: data.id,
            }
        })
    }
)

//Inngest function to save workspace member data to a database
const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: 'sync-workspace-member-from-clerk'},
    {event: 'clerk/organizationInvitation.accepted'},
    async ( {event} ) => {
        const {data} = event;
        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        })
    }
)

//Inngest function to send email on task creation
const sendTaskAssignmentEmail = inngest.createFunction(
    {id: "send-task-assignment-mail"},
    {event: "app/task.assigned"},
    async ( {event, step} ) => {
        const {taskId, origin} = event.data;

        const task = await prisma.task.findUnique({
            where: {id: taskId},
            include: {assignee: true, project: true}
        })

        await sendEmail({
            to: task.assignee.email,
            subject: `New Task Assignment in ${task.project.name}`,

            body: `
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>New Task Assignment</title>
        </head>
        <body class="bg-gray-100" style="margin:0;padding:0;background-color:#f3f4f6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:24px 0;">
            <tr>
            <td align="center">
                <table width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:0.75rem;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background-color:#0f172a;padding:20px 24px;color:#e5e7eb;">
                      <h1 style="margin:0;font-size:20px;font-weight:600;display:flex;align-items:center;">
                        <span style="margin-right:8px;">✅</span>
                        New Task Assigned in ${task.project.name}
                      </h1>
                    </td>
                  </tr>
                   <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 12px 0;font-size:16px;color:#111827;">
                        Hi ${task.assignee.name},
                      </p>
                      <p style="margin:0 0 16px 0;font-size:14px;color:#4b5563;line-height:1.6;">
                        You have been assigned a new task in <strong>${task.project.name}</strong>.  
                        Please review the details below and take the necessary action.
                      </p>

                       <div style="margin:16px 0;padding:16px;border-radius:0.75rem;background-color:#f9fafb;border:1px solid #e5e7eb;">
                        <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
                          Task Summary
                        </p>
                        <h2 style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:#111827;display:flex;align-items:center;">
                          <span style="margin-right:6px;">📝</span>${task.title}
                        </h2>
                        <p style="margin:0 0 12px 0;font-size:14px;color:#4b5563;line-height:1.6;">
                          ${task.description || "No description provided."}
                        </p>
                        <p style="margin:0;font-size:14px;color:#374151;">
                          <strong>Due date:</strong>
                          <span style="margin-left:4px;">📅 ${new Date(task.due_date).toLocaleDateString()}</span>
                        </p>
                      </div>

                        <div style="text-align:center;margin:24px 0 8px 0;">
                        <a href="${origin}"
                           style="
                             display:inline-block;
                             padding:10px 20px;
                             border-radius:9999px;
                             background-color:#2563eb;
                             color:#ffffff;
                             text-decoration:none;
                             font-size:14px;
                             font-weight:600;
                             letter-spacing:0.03em;
                           ">
                          🔗 View Task
                        </a>
                      </div>

                        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                        If the button doesn’t work, copy and paste this link into your browser:  
                        <span style="word-break:break-all;color:#6b7280;">${origin}</span>
                      </p>

                        <p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">
                        Best regards,<br/>
                        The ${task.project.name} Team
                      </p>
                    </td>
                  </tr>

                    <tr>
                    <td style="padding:12px 24px;background-color:#f9fafb;text-align:center;font-size:11px;color:#9ca3af;">
                      This is an automated message about your task assignment. ✨
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>`
        })

        if(new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()) {
            await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

            await step.run('check-if-task-is-completed', async () => {
                const task = await prisma.task.findUnique({
                    where: {id: taskId},
                    include: {assignee: true, project: true}
                })

                if(!task) return null;

                if(task.status !== "DONE") {
                    await step.run('send-task-reminder-mail', async () => {
                        await sendEmail({
                            to: task.assignee.email,
                            subject: `Reminder for ${task.project.name}`,
                            body: `
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Task Reminder</title>
          </head>
          <body style="margin:0;padding:0;background-color:#f3f4f6;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:24px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:0.75rem;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1);">
                    <tr>
                     <td style="background-color:#0f172a;padding:20px 24px;color:#e5e7eb;">
                        <h1 style="margin:0;font-size:20px;font-weight:600;display:flex;align-items:center;">
                          <span style="margin-right:8px;">⏰</span>
                          Task Reminder \- ${task.project.name}
                        </h1>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:24px;">
                        <p style="margin:0 0 12px 0;font-size:16px;color:#111827;">
                          Hi ${task.assignee.name},
                        </p>
                        <p style="margin:0 0 16px 0;font-size:14px;color:#4b5563;line-height:1.6;">
                          This is a friendly reminder that you still have a pending task in <strong>${task.project.name}</strong> 🔔  
                          Please review the details below and update the status when you\'re done.
                        </p>

                        <div style="margin:16px 0;padding:16px;border-radius:0.75rem;background-color:#f9fafb;border:1px solid #e5e7eb;">
                          <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
                            Task Details
                          </p>
                         <h2 style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:#111827;display:flex;align-items:center;">
                            <span style="margin-right:6px;">📝</span>${task.title}
                          </h2>
                          <p style="margin:0 0 12px 0;font-size:14px;color:#4b5563;line-height:1.6;">
                            ${task.description || "No description provided."}
                          </p>
                          <p style="margin:0;font-size:14px;color:#374151;">
                            <strong>Due date:</strong>
                            <span style="margin-left:4px;">📅 ${new Date(task.due_date).toLocaleDateString()}</span>
                          </p>
                          <p style="margin:8px 0 0 0;font-size:13px;color:#ef4444;">
                            Status: <strong>Pending ⌛</strong>
                          </p>
                        </div>

                        <div style="text-align:center;margin:24px 0 8px 0;">
                          <a href="${origin}"
                             style="
                               display:inline-block;
                               padding:10px 20px;
                               border-radius:9999px;
                               background-color:#2563eb;
                               color:#ffffff;
                               text-decoration:none;
                               font-size:14px;
                               font-weight:600;
                               letter-spacing:0.03em;
                             ">
                            ✅ View & Update Task
                          </a>
                        </div>

                        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                          If the button doesn’t work, copy and paste this link into your browser:<br/>
                          <span style="word-break:break-all;color:#6b7280;">${origin}</span>
                        </p>

                        <p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">
                          Thank you for keeping your tasks up to date 🙌<br/>
                          The ${task.project.name} Team
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:12px 24px;background-color:#f9fafb;text-align:center;font-size:11px;color:#9ca3af;">
                        This is an automated reminder about your pending task.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>`
                        })
                    })
                }
            })
        }
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
    sendTaskAssignmentEmail
];