import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails, contacts } from "wix-crm-backend"

const ACCOUNT_CREDENTIALS = "VU4oxFW"
const BOOKING_ADMIN = "VU4lXTJ"
const BOOKING_CLIENT = "VU4UpbI"
const AGENT_ADMIN='VUnWDRP'
const AGENT_EMAIL_APPLICATION='VUnYFUf'
const AGENT_ACCOUNT_CREDENTIALS='VUnZX26'
const SITE_URL = "https://www.transfermio.com/";

// ---------------------------------------------------------
// Get / create contact
// ---------------------------------------------------------

async function getContact(obj) {
    try {
        const email = String(obj.Email || "").trim().toLowerCase();

        if (!email) {
            throw new Error("Email is required");
        }

        // Search existing contact
        const result = await contacts.queryContacts()
            .eq("info.emails.email", email)
            .limit(1)
            .find({ suppressAuth: true });

        if (result.items.length > 0) {
            return result.items[0]._id;
        }

        // Create contact if it doesn't exist
        const contact = await contacts.createContact({
            name: {
                first: obj.name || ""
            },
            emails: [{
                email: email
            }]
        }, {
            suppressAuth: true
        });

        return contact._id;

    } catch (error) {
        console.error("getContact error:", error);
        throw error;
    }
}

// ---------------------------------------------------------
// ACCOUNT CREDENTIALS EMAIL
// ---------------------------------------------------------
export const sendAccountCredentials = webMethod(
    Permissions.Anyone,
    async (obj) => {

        try {

            console.log("Sending account credentials:", obj);

            const contactId = await getContact({
                Email: obj.email,
                Name: obj.name
            });

            const options = {
                variables: {
                    name: String(obj.name || ""),
                    email: String(obj.email || ""),
                    password: String(obj.password || ""),
                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                ACCOUNT_CREDENTIALS,
                contactId,
                options
            );

            console.log("Account credentials email sent");

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

// ---------------------------------------------------------
// BOOKING EMAILS - ADMIN + CLIENT
// ---------------------------------------------------------

export const sendBookingEmails = webMethod(
    Permissions.Anyone,
    async (obj) => {

        try {

            console.log("Sending booking emails:", obj);

            // -------------------------------------------------
            // CLIENT EMAIL
            // -------------------------------------------------

            const clientContactId = await getContact({
                Email: obj.email,
                Name: obj.Name
            });

            const clientOptions = {
                variables: {
                    Name: String(obj.Name || ""),
                    orderNumber: String(obj.orderNumber || ""),
                    Route: String(obj.Route || ""),
                    DateTime: String(obj.DateTime || ""),
                    Vehicle: String(obj.Vehicle || ""),
                    Passenger: String(obj.Passenger || ""),
                    Extras: String(obj.Extras || ""),
                    totalPaid: String(obj.totalPaid || ""),
                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                BOOKING_CLIENT,
                clientContactId,
                clientOptions
            );

            console.log("Client booking email sent");

            // -------------------------------------------------
            // ADMIN EMAIL
            // -------------------------------------------------

            const adminEmail = "support@transfermio.com";

            const adminContactId = await getContact({
                Email: adminEmail,
                Name: "Admin"
            });

            const adminOptions = {
                variables: {
                    OrderNumber: String(obj.orderNumber || ""),
                    CustomerName: String(obj.Name || ""),
                    Route: String(obj.Route || ""),
                    DateTime: String(obj.DateTime || ""),
                    Vehicle: String(obj.Vehicle || ""),
                    Passenger: String(obj.Passenger || ""),
                    Extras: String(obj.Extras || ""),
                    bookedBy: String(obj.bookedBy || ""),
                    totalPaid: String(obj.totalPaid || ""),
                    SITE_URL: SITE_URL
                }
            };

            await triggeredEmails.emailContact(
                BOOKING_ADMIN,
                adminContactId,
                adminOptions
            );

            console.log("Admin booking email sent");

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

// //...
// triggeredEmails.emailContact('VUnWDRP', <enter-contact-id-here>, {
//   variables: {
//         agentName: <enter-value-here>,
//         agentEmail: <enter-value-here>,
//         phone: <enter-value-here>,
//         SITE_URL: <enter-value-here>
//   }
// });

//...
// triggeredEmails.emailContact('VUnYFUf', <enter-contact-id-here>, {
//   variables: {
//         agentname: <enter-value-here>,
//         SITE_URL: <enter-value-here>
//   }
// });

//...
// triggeredEmails.emailContact('VUnZX26', <enter-contact-id-here>, {
//   variables: {
//         agentname: <enter-value-here>,
//         email: <enter-value-here>,
//         password: <enter-value-here>,
//         SITE_URL: <enter-value-here>
//   }
// });
