import { webMethod, Permissions } from 'wix-web-module';
import wixPayBackend from 'wix-pay-backend';

export const PaymentInitiate = webMethod(
    Permissions.Anyone,
    async (bookingObj) => {

        console.log(bookingObj, "bookingObj");

        // ==========================================
        // PAYMENT ITEMS
        // ==========================================

        const items = [];

        // Vehicle / Base Price
        const basePrice = Number(bookingObj.BASEPRICE) || 0;

        if (basePrice > 0) {
            items.push({
                name: bookingObj.vehicleName || 'Vehicle Booking',
                price: basePrice,
                quantity: 1
            });
        }

        // ==========================================
        // CUSTOMER NAME
        // ==========================================

        const nameParts = (bookingObj.nameSurname || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        const firstName = nameParts.shift() || '';
        const lastName = nameParts.join(" ") || '';

        // ==========================================
        // EXTRAS
        // ==========================================

        const extras = bookingObj.extrasData?.extras || [];

        extras.forEach(extra => {

            const price = Number(extra.price) || 0;
            const quantity = Number(extra.quantity) || 1;

            /*
             * Wix Pay does NOT allow price = 0.
             *
             * Therefore:
             * - Paid extras go into the payment
             * - Free extras such as Pets stay in bookingObj
             *   but are NOT sent to Wix Pay
             */

            if (price > 0) {

                items.push({
                    name: extra.name,
                    price: price,
                    quantity: quantity
                });

            }

        });

        // ==========================================
        // CALCULATE PAYMENT AMOUNT
        // ==========================================

        const amount = items.reduce(
            (total, item) => {
                return total + (item.price * item.quantity);
            },
            0
        );

        console.log("Payment items:", items);
        console.log("Payment amount:", amount);

        // ==========================================
        // CREATE WIX PAYMENT
        // ==========================================

        return wixPayBackend.createPayment({

            amount,

            items,
            currency:bookingObj.currency,
            // currency: "EUR",

            // currency: "USD",

            // ======================================
            // CUSTOMER INFORMATION
            // ======================================

            userInfo: {

                firstName,

                lastName,

                email: bookingObj.email,

                countryCode: "",

                phone: bookingObj.phone

            }

        });

    }
);



export const PaymentBookingDifference = webMethod(
    Permissions.SiteMember,
    async ({
        amount,
        orderNumber,
        nameSurname,
        email,
        phone
    }) => {

        try {

            const difference =
                Math.round(Number(amount) * 100) / 100;

            if (
                !Number.isFinite(difference) ||
                difference <= 0
            ) {
                return {
                    status: "Failure",
                    message: "Invalid additional payment amount."
                };
            }

            const nameParts = String(nameSurname || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

            const payment = await wixPayBackend.createPayment({

                amount: difference,
                currency: "USD",

                items: [{
                    name: `Additional Payment - ${orderNumber}`,
                    price: difference,
                    quantity: 1
                }],

                userInfo: {
                    firstName: nameParts.shift() || "",
                    lastName: nameParts.join(" "),
                    email: email || "",
                    phone: phone || "",
                    countryCode: ""
                }
            });

            return {
                status: "Success",
                paymentId: payment.id,
                amount: difference
            };

        } catch (error) {

            console.error(
                "PaymentBookingDifference error:",
                error
            );

            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);


export const CreateAdditionalPayment = webMethod(
    Permissions.SiteMember,
    async (amount, orderNumber) => {

        try {
            // IMPORTANT:
            // Before production, calculate the amount
            // from trusted CMS pricing, not frontend input.

            const paymentAmount =
                Math.round(Number(amount) * 100) / 100;

            if (
                !Number.isFinite(paymentAmount) ||
                paymentAmount <= 0
            ) {
                throw new Error("Invalid additional payment amount.");
            }

            const payment = await wixPayBackend.createPayment({
                items: [{
                    name: `Additional Charge - ${orderNumber}`,
                    price: paymentAmount,
                    quantity: 1
                }],
                amount: paymentAmount
            });

            return {
                status: "Success",
                paymentId: payment.id
            };

        } catch (error) {
            return {
                status: "Failure",
                message: error.message
            };
        }
    }
);
