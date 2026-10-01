import wixData from 'wix-data';
import { Permissions, webMethod } from "wix-web-module";
import { sendBookingEmails } from 'backend/Email.web.js';
import { formatDate } from 'public/universal.js'
let DB_NAME = "TransferMioBookings"

export const SaveBooking = webMethod(
    Permissions.Anyone,
    async (obj) => {

        try {

            // -----------------------------------------------
            // SAVE BOOKING
            // -----------------------------------------------

            obj.status = "CREATED";

            const data = await wixData.insert(
                DB_NAME,
                obj
            );

            if (!data._id) {

                return {
                    status: "Failure-400",
                    payload: []
                };
            }


            // -----------------------------------------------
            // PREPARE EMAIL DATA
            // -----------------------------------------------

            const extras = obj.extrasData?.extras || [];

            const extrasText = extras.length > 0
                ? extras
                    .map(extra =>
                        `${extra.name} × ${extra.quantity}`
                    )
                    .join(", ")
                : "None";


            const route =
                `${obj.pickup || ""} → ${obj.destination || ""}`;


            const dateTime =
                formatBookingDateTime(
                    obj.arrivaldate,
                    obj.arrivaltime
                );


            const emailData = {

                // Client
                email: obj.email,
                Name: obj.nameSurname,

                // Booking
                orderNumber: obj.orderNumber,
                Route: route,
                DateTime: dateTime,
                Vehicle: obj.vehicleName,
                Passenger: obj.passenger,
                Extras: extrasText,
                bookedBy: obj.bookedBy,

                // Price
                totalPaid: Number(
                    obj.TOTALPRICE || 0
                ).toFixed(2)
            };


            // -----------------------------------------------
            // SEND ADMIN + CLIENT EMAILS
            // -----------------------------------------------

            const emailResult =
                await sendBookingEmails(emailData);

            console.log(
                "Booking emails result:",
                emailResult
            );


            // -----------------------------------------------
            // RETURN
            // -----------------------------------------------

            return {
                status: "Success",
                payload: data,
                emailResult
            };

        } catch (E) {

            console.error(
                "SaveBooking error:",
                E
            );

            return {
                status: "Failure-500",
                payload: [E]
            };
        }
    }
);

function formatBookingDateTime(dateValue, timeValue) {

    if (!dateValue || !timeValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "";
    }

    const day = date.getDate();

    const month = date.toLocaleString(
        "en-US",
        {
            month: "short"
        }
    );

    const year = date.getFullYear();

    const timeParts = timeValue.split(":");

    let hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);

    const ampm = hours >= 12
        ? "PM"
        : "AM";

    hours = hours % 12 || 12;

    const formattedTime =
        `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;

    return `${day} ${month} ${year}, ${formattedTime}`;
}

export const GetAllBookings = webMethod(
    Permissions.Anyone,
    async (obj) => {
        try {
            let data = await wixData.query(DB_NAME).find()
            return data.items.length != 0 ? { status: "Success", payload: data.items } : { status: "Failure-400", payload: [] }

        } catch (E) {
            return { status: "Failure-500", payload: [E] }
        }
    }
)

// Get My Bookings for Customer's to get Bookings by Email

export const GetMyBookings = webMethod(
    Permissions.Anyone,
    async ({
        email,
        page = 1,
        pageSize = 7
    } = {}) => {

        try {

            if (!email) {
                return {
                    status: "Failure-400",
                    message: "Email is required.",
                    payload: []
                };
            }

            page = Math.max(1, Number(page));
            pageSize = Number(pageSize) || 7;

            const query = wixData
                .query(DB_NAME)
                .eq("email", email.trim().toLowerCase());

            // ------------------------------------------
            // TOTAL BOOKINGS
            // ------------------------------------------

            const totalBookings = await query.count();

            // ------------------------------------------
            // PAGINATED BOOKINGS
            // ------------------------------------------

            const result = await query
                .descending("_createdDate")
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .find();

            const totalPages =
                Math.ceil(totalBookings / pageSize);

            return {
                status: "Success",
                payload: {
                    bookings: result.items,
                    totalBookings,
                    currentPage: page,
                    pageSize,
                    totalPages
                }
            };

        } catch (error) {

            console.error(
                "GetMyBookings error:",
                error
            );

            return {
                status: "Failure-500",
                payload: [error]
            };
        }
    }
);

export const GetBookingById = webMethod(
    Permissions.Anyone,
    async (obj) => {
        try {
            let data = await wixData.query(DB_NAME).eq("_id", obj).find()
            return data.items.length != 0 ? { status: "Success", payload: data.items } : { status: "Failure-400", payload: [] }

        } catch (E) {
            return { status: "Failure-500", payload: [E] }
        }
    }

)

export const GetDashboardStats = webMethod(
    Permissions.Anyone,
    async () => {

        try {

            const now = new Date();

            // Today: 00:00 -> tomorrow 00:00
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);


            // Yesterday
            const yesterdayStart = new Date(todayStart);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);


            // ==============================
            // TODAY'S BOOKINGS
            // ==============================

            const todayResult = await wixData
                .query(DB_NAME)
                .ge("DateTime", todayStart)
                .lt("DateTime", tomorrowStart)
                .find();


            // ==============================
            // YESTERDAY'S BOOKINGS
            // ==============================

            const yesterdayResult = await wixData
                .query(DB_NAME)
                .ge("DateTime", yesterdayStart)
                .lt("DateTime", todayStart)
                .find();


            const todayBookings = todayResult.items.length;

            const yesterdayBookings = yesterdayResult.items.length;


            // ==============================
            // TODAY'S REVENUE
            // ==============================

            const todayRevenue = todayResult.items.reduce(
                (total, booking) => {

                    return total + Number(booking.Amount || 0);

                },
                0
            );


            // ==============================
            // YESTERDAY'S REVENUE
            // ==============================

            const yesterdayRevenue = yesterdayResult.items.reduce(
                (total, booking) => {

                    return total + Number(booking.Amount || 0);

                },
                0
            );


            // ==============================
            // BOOKING CHANGE
            // ==============================

            let bookingChange = 0;

            if (yesterdayBookings > 0) {

                bookingChange =
                    ((todayBookings - yesterdayBookings) /
                        yesterdayBookings) * 100;

            } else if (todayBookings > 0) {

                bookingChange = 100;

            }


            // ==============================
            // REVENUE CHANGE
            // ==============================

            let revenueChange = 0;

            if (yesterdayRevenue > 0) {

                revenueChange =
                    ((todayRevenue - yesterdayRevenue) /
                        yesterdayRevenue) * 100;

            } else if (todayRevenue > 0) {

                revenueChange = 100;

            }


            return {
                status: "Success",

                payload: {

                    todayBookings,

                    yesterdayBookings,

                    bookingChange:
                        Number(bookingChange.toFixed(1)),

                    todayRevenue:
                        Number(todayRevenue.toFixed(2)),

                    yesterdayRevenue:
                        Number(yesterdayRevenue.toFixed(2)),

                    revenueChange:
                        Number(revenueChange.toFixed(1))

                }
            };


        } catch (error) {

            console.error(
                "GetDashboardStats error:",
                error
            );

            return {
                status: "Failure-500",
                payload: [error]
            };

        }

    }
);


export const GetBookingsPage = webMethod(
    Permissions.Anyone,
    async ({
        page = 1,
        pageSize = 7,
        bookedBy = "ALL",
        search = "",
        status = "ALL"
    } = {}) => {

        try {

            page = Math.max(1, Number(page));
            pageSize = Number(pageSize) || 7;

            search = String(search).trim();
            status = String(status).trim().toUpperCase();

            let query = wixData.query(DB_NAME);

            // -------------------------
            // BOOKED BY FILTER
            // -------------------------
            if (bookedBy !== "ALL") {
                query = query.eq("bookedBy", bookedBy);
            }

            // -------------------------
            // STATUS FILTER
            // -------------------------
            if (status !== "ALL") {
                query = query.eq("status", status);
            }

            // -------------------------
            // SEARCH FILTER
            // Route / Order Number / Name
            // -------------------------
            if (search) {

                const routeSearch = wixData
                    .query(DB_NAME)
                    .contains("pickup", search)
                    .or(
                        wixData
                            .query(DB_NAME)
                            .contains("destination", search)
                    )
                    .or(
                        wixData
                            .query(DB_NAME)
                            .contains("orderNumber", search)
                    )
                    .or(
                        wixData
                            .query(DB_NAME)
                            .contains("nameSurname", search)
                    );

                // Combine search query with the other filters
                query = query.and(routeSearch);
            }

            // -------------------------
            // TOTAL
            // -------------------------
            const totalBookings = await query.count();

            // -------------------------
            // BOOKINGS
            // -------------------------
            const result = await query
                .descending("_createdDate")
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .find();

            const totalPages = Math.ceil(totalBookings / pageSize);

            return {
                status: "Success",
                payload: {
                    bookings: result.items,
                    totalBookings,
                    currentPage: page,
                    pageSize,
                    totalPages
                }
            };

        } catch (error) {

            console.error("GetBookingsPage error:", error);

            return {
                status: "Failure-500",
                payload: [error]
            };
        }
    }
);

export const GenerateUniqueOrderNumber = webMethod(
    Permissions.Anyone,
    async () => {

        try {

            // There are only 9000 possible 4-digit numbers (1000-9999)
            const MAX_ATTEMPTS = 50;

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {

                const randomNumber =
                    Math.floor(1000 + Math.random() * 9000);

                const orderNumber = `TM ${randomNumber}`;

                const existing = await wixData
                    .query("TransferMioBookings")
                    .eq("orderNumber", orderNumber)
                    .limit(1)
                    .find();

                if (existing.items.length === 0) {

                    return {
                        status: "Success",
                        orderNumber
                    };
                }
            }

            return {
                status: "Failure-500",
                message: "Could not generate a unique order number."
            };

        } catch (error) {

            console.error(
                "GenerateUniqueOrderNumber error:",
                error
            );

            return {
                status: "Failure-500",
                message: error.message
            };
        }
    }
);

// Fetch Bookings By Agent Email 
export const GetAgentBookingsPage = webMethod(
    Permissions.Anyone,
    async ({
        email,
        page = 1,
        pageSize = 7
    } = {}) => {

        try {

            if (!email) {
                return {
                    status: "Failure-400",
                    message: "Agent email is required.",
                    payload: []
                };
            }

            page = Math.max(1, Number(page));
            pageSize = Number(pageSize) || 7;

            const agentEmail =
                email.trim().toLowerCase();

            const query = wixData
                .query(DB_NAME)
                .eq("agentemail", agentEmail)
                .eq("bookedBy", "AGENT");

            // ------------------------------------------
            // TOTAL AGENT BOOKINGS
            // ------------------------------------------

            const totalBookings = await query.count();

            // ------------------------------------------
            // PAGINATED BOOKINGS
            // ------------------------------------------

            const result = await query
                .descending("_createdDate")
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .find();

            const totalPages =
                Math.ceil(totalBookings / pageSize);

            return {
                status: "Success",
                payload: {
                    bookings: result.items,
                    totalBookings,
                    currentPage: page,
                    pageSize,
                    totalPages
                }
            };

        } catch (error) {

            console.error(
                "GetAgentBookingsPage error:",
                error
            );

            return {
                status: "Failure-500",
                payload: [error]
            };
        }
    }
);
