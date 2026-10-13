import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails, contacts } from "wix-crm-backend";

const ACCOUNT_CREDENTIALS = "VU4oxFW";
const BOOKING_ADMIN = "VU4lXTJ";
const BOOKING_CLIENT = "VU4UpbI";

const AGENT_ADMIN = "VUnWDRP";
const AGENT_EMAIL_APPLICATION = "VUnYFUf";
const AGENT_ACCOUNT_CREDENTIALS = "VUnZX26";

const SITE_URL = "https://www.transfermio.com/";


// =========================================================
// GET / CREATE CONTACT
// =========================================================

async function getContact(obj) {

    try {

        const email = String(obj.Email || "")
            .trim()
            .toLowerCase();

        if (!email) {
            throw new Error("Email is required");
        }

        // Search existing contact
        const result = await contacts.queryContacts()
            .eq("info.emails.email", email)
            .limit(1)
            .find({
                suppressAuth: true
            });

        if (result.items.length > 0) {
            return result.items[0]._id;
        }

        // Create contact
        const contact = await contacts.createContact(
            {
                name: {
                    first: obj.name || ""
                },
                emails: [
                    {
                        email: email
                    }
                ]
            },
            {
                suppressAuth: true
            }
        );

        return contact._id;

    } catch (error) {

        console.error(
            "getContact error:",
            error
        );

        throw error;
    }
}


// =========================================================
// ACCOUNT CREDENTIALS
// Used by Customer + Agent registration
// =========================================================

export const sendAccountCredentials = webMethod(
    Permissions.Anyone,
    async (obj) => {

        try {

            console.log(
                "Sending account credentials:",
                obj
            );

            const contactId = await getContact({
                Email: obj.email,
                name: obj.name
            });

            const options = {
                variables: {

                    name: String(
                        obj.name || ""
                    ),

                    email: String(
                        obj.email || ""
                    ),

                    password: String(
                        obj.password || ""
                    ),

                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                ACCOUNT_CREDENTIALS,
                contactId,
                options
            );

            console.log(
                "Account credentials email sent"
            );

            return {
                status: "Success"
            };

        } catch (error) {

            console.error(
                "sendAccountCredentials error:",
                error
            );

            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);


// =========================================================
// BOOKING EMAILS
// CLIENT + ADMIN
// =========================================================

export const sendBookingEmails = webMethod(
    Permissions.Anyone,
    async (obj) => {

        try {

            console.log(
                "Sending booking emails:",
                obj
            );


            // -------------------------------------------------
            // CLIENT BOOKING EMAIL
            // -------------------------------------------------

            const clientContactId = await getContact({
                Email: obj.email,
                name: obj.Name
            });

            const clientOptions = {
                variables: {

                    Name: String(
                        obj.Name || ""
                    ),

                    orderNumber: String(
                        obj.orderNumber || ""
                    ),

                    Route: String(
                        obj.Route || ""
                    ),

                    DateTime: String(
                        obj.DateTime || ""
                    ),

                    Vehicle: String(
                        obj.Vehicle || ""
                    ),

                    Passenger: String(
                        obj.Passenger || ""
                    ),

                    Extras: String(
                        obj.Extras || ""
                    ),

                    totalPaid: String(
                        obj.totalPaid || ""
                    ),

                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                BOOKING_CLIENT,
                clientContactId,
                clientOptions
            );

            console.log(
                "Client booking email sent"
            );


            // -------------------------------------------------
            // ADMIN BOOKING EMAIL
            // -------------------------------------------------

            const adminEmail =
                "support@transfermio.com";

            const adminContactId =
                await getContact({
                    Email: adminEmail,
                    name: "Admin"
                });

            const adminOptions = {
                variables: {

                    OrderNumber: String(
                        obj.orderNumber || ""
                    ),

                    CustomerName: String(
                        obj.Name || ""
                    ),

                    Route: String(
                        obj.Route || ""
                    ),

                    DateTime: String(
                        obj.DateTime || ""
                    ),

                    Vehicle: String(
                        obj.Vehicle || ""
                    ),

                    Passenger: String(
                        obj.Passenger || ""
                    ),

                    Extras: String(
                        obj.Extras || ""
                    ),

                    bookedBy: String(
                        obj.bookedBy || ""
                    ),

                    totalPaid: String(
                        obj.totalPaid || ""
                    ),

                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                BOOKING_ADMIN,
                adminContactId,
                adminOptions
            );

            console.log(
                "Admin booking email sent"
            );


            return {
                status: "Success"
            };

        } catch (error) {

            console.error(
                "sendBookingEmails error:",
                error
            );

            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);


// =========================================================
// AGENT ADMIN EMAIL
// Template: VUnWDRP
//
// Variables:
// agentName
// agentEmail
// phone
// SITE_URL
// =========================================================
export const sendAgentAdminEmail = webMethod(
    Permissions.Anyone,
    async (obj) => {
        try {
            const adminEmail = "support@transfermio.com";

            const contactId = await getContact({
                Email: adminEmail,
                name: "TransferMio Admin"
            });

            if (!contactId) {
                throw new Error(
                    "Could not find or create admin contact."
                );
            }

            const options = {
                variables: {
                    agentName: String(obj.Name || ""),
                    agentEmail: String(obj.Email || ""),
                    phone: String(obj.Phone || ""),
                    SITE_URL: SITE_URL
                }
            };

            const emailResult =
                await triggeredEmails.emailContact(
                    AGENT_ADMIN,
                    contactId,
                    options
                );

            console.log(
                "Admin email sent:",
                emailResult
            );

            return {
                status: "Success",
                emailResult
            };

        } catch (error) {
            console.error(
                "sendAgentAdminEmail error:",
                error
            );

            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);

// =========================================================
// AGENT APPLICATION EMAIL
// Template: VUnYFUf
//
// Variables:
// agentname
// SITE_URL
//
// This goes to the agent after application submission.
// =========================================================


export const sendAgentApplicationEmail = webMethod(
    Permissions.Anyone,
    async (obj) => {
        try {
            if (!obj?.Email) {
                throw new Error("Agent email is required.");
            }

            // -----------------------------------
            // 1. Send email to agent
            // -----------------------------------

            const contactId = await getContact({
                Email: obj.Email,
                name: obj.Name
            });

            if (!contactId) {
                throw new Error(
                    "Could not find or create agent contact."
                );
            }

            const agentOptions = {
                variables: {
                    agentname: String(obj.Name || ""),
                    SITE_URL: SITE_URL
                }
            };

            const agentEmailResult =
                await triggeredEmails.emailContact(
                    AGENT_EMAIL_APPLICATION,
                    contactId,
                    agentOptions
                );

            console.log(
                "Agent application email sent:",
                agentEmailResult
            );

            // -----------------------------------
            // 2. Only after agent email succeeds
            //    send admin email
            // -----------------------------------

            const adminEmailResult =
                await sendAgentAdminEmail(obj);

            if (adminEmailResult?.status !== "Success") {
                console.error(
                    "Agent email sent, but admin email failed:",
                    adminEmailResult
                );

                return {
                    status: "Failure",
                    stage: "ADMIN_EMAIL",
                    message:
                        adminEmailResult?.message ||
                        "Admin email failed.",
                    agentEmail: "Success",
                    adminEmail: "Failure"
                };
            }

            console.log(
                "Agent application and admin emails sent successfully."
            );

            return {
                status: "Success",
                agentEmail: "Success",
                adminEmail: "Success"
            };

        } catch (error) {
            console.error(
                "sendAgentApplicationEmail error:",
                error
            );

            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);




// =========================================================
// AGENT ACCOUNT CREDENTIALS
// Template: VUnZX26
//
// Variables:
// agentname
// email
// password
// SITE_URL
//
// This goes to the agent after approval.
// =========================================================

export const sendAgentAccountCredentials = webMethod(
    Permissions.Anyone,
    async (obj) => {

        try {

            console.log(
                "Sending agent account credentials:",
                obj
            );

            const contactId = await getContact({
                Email: obj.email,
                name: obj.agentname
            });

            const options = {
                variables: {

                    agentname: String(
                        obj.agentname || ""
                    ),

                    email: String(
                        obj.email || ""
                    ),

                    password: String(
                        obj.password || ""
                    ),

                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                AGENT_ACCOUNT_CREDENTIALS,
                contactId,
                options
            );

            console.log(
                "Agent account credentials email sent"
            );

            return {
                status: "Success"
            };

        } catch (error) {

            console.error(
                "sendAgentAccountCredentials error:",
                error
            );

            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);
