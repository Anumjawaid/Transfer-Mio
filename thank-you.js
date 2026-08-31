import { session } from "wix-storage-frontend";

$w.onReady(function () {

    const savedBooking = session.getItem("Booking");

    // Nothing to display
    if (!savedBooking) {
        console.log("No booking data found in session.");
        return;
    }

    try {

        const booking = JSON.parse(savedBooking);

        console.log("Thank You Booking:", booking);

        // ==========================================
        // VEHICLE
        // ==========================================

        $w('#vehicleSummary').text =
            booking.vehicleName + String(booking.passenger || 0) + "PERSON" || "";

        // ==========================================
        // TOTAL PRICE
        // ==========================================

        $w('#totalPriceSummary').text =
            "$ " + Number(booking.TOTALPRICE || 0).toFixed(2);

        // ==========================================
        // ROUTE
        // ==========================================

        $w('#routeSummary').text =
            `${booking.pickup || ""} To ${booking.destination || ""}`;

        // ==========================================
        // EXTRAS
        // ==========================================

        const extras =
            booking.extrasData?.extras || [];

        if (extras.length > 0) {

            const extraText = extras.map(extra => {

                return `${extra.name} × ${extra.quantity}`;

            }).join(', ');

            $w('#extrasSummary').text = extraText;

            // $w('#extrasSummary').show();

        } else {

            $w('#extrasSummary').text = "No extras";

            // Or hide it if you don't want
            // "No extras" displayed
            // $w('#extrasSummary').hide();
        }

        // ==========================================
        // REMOVE SESSION DATA
        // ==========================================
        // Only remove AFTER successfully displaying
        // the booking information.

        session.removeItem("Booking");

        console.log("Booking removed from session.");

    } catch (error) {

        console.error(
            "Error loading booking from session:",
            error
        );

    }

});

$w('#copyReference').onClick((event) => {
    const text = "Copied text from wix";

    $w('#clipboardHTML').postMessage(text);
    $w('#copyReference').label = "Copied"
    setTimeout(() => {
        $w('#copyReference').label = "Copy Reference"
    }, 1000);
})
