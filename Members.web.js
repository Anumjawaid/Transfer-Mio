import { Permissions, webMethod } from "wix-web-module";
import { authentication, authorization } from "wix-members-backend";
import { sendAccountCredentials, sendAgentAccountCredentials } from 'backend/Email.web.js';

const CUSTOMER_ROLE_ID = "b405ef8d-e944-4f03-97a0-33ff66ba14ef"
const AGENT_ROLE_ID = "83eaa9ff-9ddf-414e-9e75-02e0adc62c7b"

export const RegisterCustomer = webMethod(
    Permissions.Anyone,
    async ({ email, name }) => {

        try {

            if (!email) {
                return {
                    status: "Failure-400",
                    message: "Email is required."
                };
            }

            email = email.trim().toLowerCase();

            const password = generateRandomPassword();

            const registration =
                await authentication.register(
                    email,
                    password
                );

            const memberId =
                registration.member?._id ||
                registration.member?.id;

            if (!memberId) {
                return {
                    status: "Failure-500",
                    message: "Member ID was not returned."
                };
            }

            // Assign CUSTOMER role
            await authorization.assignRole(
                CUSTOMER_ROLE_ID,
                memberId, {
                    suppressAuth: true
                }
            );

            // -----------------------------------------------
            // SEND ACCOUNT CREDENTIALS EMAIL
            // -----------------------------------------------

            const emailResult = await sendAccountCredentials({
                name: name || "",
                email: email,
                password: password
            });

            console.log(
                "Account credentials email:",
                emailResult
            );

            return {
                status: "Success",
                email,
                password,
                memberId,
                emailResult
            };

        } catch (error) {

            console.error(
                "RegisterCustomer error:",
                error
            );

            return {
                status: "Failure-500",
                message: error.message
            };
        }
    }
);

function generateRandomPassword() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";

    let password = "";

    for (let i = 0; i < 12; i++) {

        const index =
            Math.floor(Math.random() * characters.length);

        password += characters[index];
    }

    return password;
}

export const RegisterAgent = webMethod(
    Permissions.Anyone,
    async ({ email, name }) => {

        try {

            if (!email) {
                return {
                    status: "Failure-400",
                    message: "Email is required."
                };
            }

            email = email.trim().toLowerCase();

            const password = generateRandomPassword();

            const registration =
                await authentication.register(
                    email,
                    password
                );

            const memberId =
                registration.member?._id ||
                registration.member?.id;

            if (!memberId) {
                return {
                    status: "Failure-500",
                    message: "Member ID was not returned."
                };
            }

            // Assign CUSTOMER role
            await authorization.assignRole(
                AGENT_ROLE_ID,
                memberId, {
                    suppressAuth: true
                }
            );

            // -----------------------------------------------
            // SEND ACCOUNT CREDENTIALS EMAIL
            // -----------------------------------------------

            const emailResult = await sendAgentAccountCredentials({
                agentname: name || "",
                email: email,
                password: password
            });

            console.log(
                "Account credentials email:",
                emailResult
            );

            if (
                !emailResult ||
                emailResult.status !== "Success"
            ) {
                return {
                    status: "Failure-500",
                    message: emailResult?.message ||
                        "Agent was registered, but credentials email failed."
                };
            }
            return {
                status: "Success",
                email,
                password,
                memberId,
                emailResult
            };

        } catch (error) {

            console.error(
                "RegisterCustomer error:",
                error
            );

            return {
                status: "Failure-500",
                message: error.message
            };
        }
    }
);
