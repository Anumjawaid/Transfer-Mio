import { session } from "wix-storage-frontend"
import wixLocationFrontend from "wix-location-frontend"
import { formatDate, formatTime } from 'public/universal.js'
import wixPayFrontend from "wix-pay-frontend";
import { SaveBooking } from 'backend/CMS_Bookings.web.js'
import { PaymentInitiate } from 'backend/payment.web';

let PICKUP, DESTINATION, PASSENGERS, DATE, ARRIVALTIME, VEHICLENAME, VEHICLECAPACITY, BASEPRICE, TOTALPRICE, BOOKINGOBJ
const CHILD_SEAT_PRICE = 10;
const INFANT_SEAT_PRICE = 10;
const BOOSTER_SEAT_PRICE = 5;
const WAITING_PRICE = 14;
const STOP_PRICE = 14;
const WATER_PRICE = 3; // change this to your actual water price

$w.onReady(function () {

    PICKUP = session.getItem("Pickup");
    DESTINATION = session.getItem("Destination");
    DATE = session.getItem("Date");
    PASSENGERS = session.getItem("Passengers");
    VEHICLENAME = session.getItem("Vehicle");
    VEHICLECAPACITY = Number(session.getItem("Capacity"));
    BASEPRICE = Number(session.getItem("BASEPRICE"));
    TOTALPRICE = BASEPRICE;

    // Check if an unfinished booking already exists
    const savedBooking = session.getItem("Booking");

    if (savedBooking) {

        try {

            BOOKINGOBJ = JSON.parse(savedBooking);

            restoreBooking(BOOKINGOBJ);

        } catch (error) {

            console.error("Could not restore booking:", error);

            initializeNewBooking();
        }

    } else {

        initializeNewBooking();
    }

    OrderSummaryUpdate();
});

function initializeNewBooking() {

    $w('#arrivaldate').value = new Date(DATE);

    $w('#passenger').value = String(PASSENGERS);

}

function restoreBooking(booking) {

    // =========================
    // CUSTOMER INFORMATION
    // =========================

    $w('#name').value = booking.nameSurname || "";

    $w('#email').value = booking.email || "";

    $w('#phoneNumber').value = booking.phone || "";

    // =========================
    // BOOKING INFORMATION
    // =========================

    $w('#flightNumber').value =
        booking.flightNumber || "";

    $w('#destinationAddress').value =
        booking.destinationAddresshotel || "";

    $w('#Comments').value =
        booking.comments || "";

    $w('#promoCode').value =
        booking.promoCode || "";

    // =========================
    // DATE
    // =========================

    if (booking.arrivaldate) {

        $w('#arrivaldate').value =
            new Date(booking.arrivaldate);

    }
    if (booking.arrivaltime) {
        ARRIVALTIME=booking.arrivaltime
        $w('#arrivalTime').value =ARRIVALTIME;

    }

    // =========================
    // PASSENGERS
    // =========================

    $w('#passenger').value =
        String(booking.passenger || 0);

    PASSENGERS =
        Number(booking.passenger) || 0;

  

    // =========================
    // CHILD SEAT
    // =========================

    $w('#child-seat').value =
        String(booking.seat || 0);

    // Restore child seat checkbox group
    if (booking.childSeat) {

        // Replace "child-seat-option" with
        // the actual value of your checkbox option
        $w('#childSeat').value = ['Child seats'];

        $w('#childseatselection').expand();

    } else {

        $w('#childSeat').value = [];

        $w('#childseatselection').collapse();
    }

    // =========================
    // INFANT
    // =========================

    $w('#infant-seat').value =
        String(booking.infantSeat || 0);

    // =========================
    // BOOSTER
    // =========================

    $w('#booster-seat').value =
        String(booking.boosterSeat || 0);

    // =========================
    // DRINKING WATER
    // =========================

    $w('#drinkwater-input').value =
        String(booking.drinkingwater || 0);

    // =========================
    // WAITING
    // =========================

    if (booking.waitingcheckbox) {

        // Replace with your actual checkbox-group option value
        $w('#waitingcheckbox').value = ["Extra hour of waiting"];

    } else {

        $w('#waitingcheckbox').value = [];

    }

    // =========================
    // STOP
    // =========================

    if (booking.stopcheckbox) {

        // Replace with actual option value
        $w('#stopcheckbox').value = ["Stop on the way"];

        $w('#stopgroup').expand();

    } else {

        $w('#stopcheckbox').value = [];

        $w('#stopgroup').collapse();

    }

    $w('#stoplocation').value =
        booking.stopLocation || "";

    // =========================
    // PETS
    // =========================

    if (booking.petscheckbox) {

        // Replace with actual option value
        $w('#petscheckbox').value = ["I am travelling with pets"];

    } else {

        $w('#petscheckbox').value = [];

    }
}

function OrderSummaryUpdate() {

    const extrasData = getExtras();

    const totalPrice =
        Number(BASEPRICE) + extrasData.totalExtras;

    $w('#pickuplocation').text = PICKUP;
    $w('#destinationLocation').text = DESTINATION;
    $w('#arrivaldatetxt').text = formatDate(DATE);
    $w('#arrivaltime').text = ARRIVALTIME;
    $w('#vehicle').text = VEHICLENAME;
    $w('#passengers').text = PASSENGERS;

    $w('#subprice').text =
        "$ " + Number(BASEPRICE).toFixed(2);

    $w('#totalprice').text =
        "$ " + totalPrice.toFixed(2);

    if (extrasData.extras.length > 0) {

        const extraNames = extrasData.extras.map(
            extra => `${extra.name} × ${extra.quantity}`
        );

        $w('#extraaddition').text =
            extraNames.join(', ');

        $w('#extraprice').text =
            "$ " + extrasData.totalExtras.toFixed(2);

        $w('#extraaddition').expand();
        $w('#extraprice').expand();

    } else {

        $w('#extraaddition').collapse();
        $w('#extraprice').collapse();
    }
}

function getExtras() {

    const childSeats = Number($w('#child-seat').value) || 0;
    const infantSeats = Number($w('#infant-seat').value) || 0;
    const boosterSeats = Number($w('#booster-seat').value) || 0;
    const water = Number($w('#drinkwater-input').value) || 0;

    const waiting = $w('#waitingcheckbox').value.length !== 0;
    const stop = $w('#stopcheckbox').value.length !== 0;
    const pets = $w('#petscheckbox').value.length !== 0;

    const extras = [];

    if (childSeats > 0) {
        extras.push({
            name: 'Child Seat',
            quantity: childSeats,
            price: CHILD_SEAT_PRICE
        });
    }

    if (infantSeats > 0) {
        extras.push({
            name: 'Infant Seat',
            quantity: infantSeats,
            price: INFANT_SEAT_PRICE
        });
    }

    if (boosterSeats > 0) {
        extras.push({
            name: 'Booster',
            quantity: boosterSeats,
            price: BOOSTER_SEAT_PRICE
        });
    }

    if (waiting) {
        extras.push({
            name: 'Extra hour of waiting',
            quantity: 1,
            price: WAITING_PRICE
        });
    }

    if (stop) {
        extras.push({
            name: 'Stop',
            quantity: 1,
            price: STOP_PRICE
        });
    }

    if (pets) {
        extras.push({
            name: 'Travelling with pets',
            quantity: 1,
            price: 0
        });
    }

    if (water > 0) {
        extras.push({
            name: 'Drinking Water',
            quantity: water,
            price: WATER_PRICE
        });
    }

    const totalExtras = extras.reduce(
        (total, extra) =>
        total + (extra.price * extra.quantity),
        0
    );

    return {
        extras,
        totalExtras
    };
}

$w('#childSeat').onChange((event) => {
    console.log($w('#childSeat').value, "child Value")
    if ($w('#childSeat').value.length != 0) {
        // 
        $w('#childseatselection').expand()
        return

    }
    $w('#childseatselection').collapse()
})

$w('#stopcheckbox').onChange(() => {

    if ($w('#stopcheckbox').value.length !== 0) {
        $w('#stopgroup').expand();
    } else {
        $w('#stopgroup').collapse();
    }

    OrderSummaryUpdate();
});

$w('#bookform').onViewportEnter((event) => {
    $w('#box1').expand()
})

$w('#bookform').onViewportLeave((event) => {
    $w('#box1').collapse()
})

$w('#arrivalTime').onChange((event) => {
    $w('#arrivaltime').text = formatTime($w('#arrivalTime').value)
    ARRIVALTIME=$w('#arrivalTime').value

})

$w('#passenger').onChange(() => {

    let passenger = Number($w('#passenger').value) || 0;

    const childSeat = Number($w('#child-seat').value) || 0;
    const infantSeat = Number($w('#infant-seat').value) || 0;
    const boosterSeat = Number($w('#booster-seat').value) || 0;

    const otherOccupancy =
        childSeat +
        infantSeat +
        boosterSeat;

    const maximumPassenger =
        VEHICLECAPACITY - otherOccupancy;

    passenger = Math.max(0, passenger);
    passenger = Math.min(passenger, maximumPassenger);

    $w('#passenger').value = String(passenger);
    PASSENGERS = passenger
    $w('#passengers').text = String(passenger);
});

function handleQuantityChange(handlerName, handlerInput) {

    const input = $w(`#${handlerInput}`);

    let currentValue = Number(input.value) || 0;

    const isPlus = handlerName.toLowerCase().includes('plus');
    const isMinus = handlerName.toLowerCase().includes('minus');

    // Only these three inputs count toward vehicle capacity
    const isSeat =
        handlerInput === 'child-seat' ||
        handlerInput === 'infant-seat' ||
        handlerInput === 'booster-seat';

    if (isPlus) {

        // Capacity restriction ONLY for seats
        if (isSeat && !canIncreaseOccupancy()) {
            return;
        }

        currentValue++;

    } else if (isMinus) {

        currentValue = Math.max(0, currentValue - 1);
    }

    input.value = String(currentValue);

    // Recalculate summary and price
    OrderSummaryUpdate();
}

function canIncreaseOccupancy() {
    return getOccupancy() < VEHICLECAPACITY;
}

function getOccupancy() {
    const passenger = Number($w('#passenger').value) || 0;
    const childSeat = Number($w('#child-seat').value) || 0;
    const infantSeat = Number($w('#infant-seat').value) || 0;
    const boosterSeat = Number($w('#booster-seat').value) || 0;

    return passenger + childSeat + infantSeat + boosterSeat;
}

$w('#childSeatplus').onClick(() => {
    handleQuantityChange('childSeatplus', 'child-seat');
});

$w('#childSeatminus').onClick(() => {
    handleQuantityChange('childSeatminus', 'child-seat');
});

$w('#infantplus').onClick(() => {
    handleQuantityChange('infantplus', 'infant-seat');
});

$w('#infantminus').onClick(() => {
    handleQuantityChange('infantminus', 'infant-seat');
});

$w('#boosterplus').onClick(() => {
    handleQuantityChange('boosterplus', 'booster-seat');
});

$w('#boosterminus').onClick(() => {
    handleQuantityChange('boosterminus', 'booster-seat');
});

$w('#waitingcheckbox').onChange((event) => {

    OrderSummaryUpdate();
})

$w('#drinkingwaterplus').onClick((event) => {
    handleQuantityChange('drinkingwaterplus', 'drinkwater-input');
})

$w('#drinkingwaterminus').onClick((event) => {
    handleQuantityChange('drinkingwaterminus', 'drinkwater-input');

})

$w('#petscheckbox').onChange((event) => {
    OrderSummaryUpdate()
})

$w('#Continue').onClick(() => {

    // ==========================================
    // 1. GET REQUIRED CUSTOMER INFORMATION
    // ==========================================

    const name = $w('#name').value.trim();
    const email = $w('#email').value.trim();
    const phone = $w('#phoneNumber').value.trim();

    // ==========================================
    // 2. VALIDATE REQUIRED FIELDS
    // ==========================================

    if (!name) {
        $w('#name').scrollTo();
        return;
    }

    if (!email) {
        $w('#email').scrollTo();
        return;
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        $w('#email').scrollTo();
        return;
    }

    if (!phone) {
        $w('#phoneNumber').scrollTo();
        return;
    }

    // ==========================================
    // 3. GET EXTRAS
    // ==========================================

    const extrasData = getExtras();

    // ==========================================
    // 4. CALCULATE FINAL PRICE
    // ==========================================

    const totalPrice =
        Number(BASEPRICE) + extrasData.totalExtras;

    // ==========================================
    // 5. CREATE BOOKING OBJECT
    // ==========================================
    BOOKINGOBJ = {

        flightNumber: $w('#flightNumber').value,

        pickup: PICKUP,

        destination: DESTINATION,

        arrivaldate: DATE,

        arrivaltime: ARRIVALTIME,

        destinationAddresshotel: $w('#destinationAddress').value,

        nameSurname: name,

        email: email,

        phone: phone,
        bookedBy:"CUSTOMER",
        orderNumber:"TM"+ "", //4digit Random Number


        passenger: Number($w('#passenger').value) || 0,

        childSeat: $w('#childSeat').value.length !== 0,

        seat: Number($w('#child-seat').value) || 0,

        infantSeat: Number($w('#infant-seat').value) || 0,

        boosterSeat: Number($w('#booster-seat').value) || 0,

        waitingcheckbox: $w('#waitingcheckbox').value.length !== 0,

        drinkingwater: Number($w('#drinkwater-input').value) || 0,

        stopcheckbox: $w('#stopcheckbox').value.length !== 0,

        stopLocation: $w('#stoplocation').value,

        petscheckbox: $w('#petscheckbox').value.length !== 0,

        comments: $w('#Comments').value,

        promoCode: $w('#promoCode').value,

        vehicleName: VEHICLENAME,

        BASEPRICE: Number(BASEPRICE),

        TOTALPRICE: totalPrice,

        extrasData: extrasData
    };

    // ==========================================
    // 6. SAVE COMPLETE BOOKING TO SESSION
    // ==========================================

    session.setItem(
        "Booking",
        JSON.stringify(BOOKINGOBJ)
    );

    // ==========================================
    // 7. MOVE TO PAYMENT STATE
    // ==========================================
    $w('#byCard').scrollTo()
    $w('#statebox8').changeState("PaymentSelection");

});

$w('#byCard').onChange((event) => {
    if ($w('#byCard').checked) {
        // 
        $w('#box14').style.borderColor = "#1E1E1E"
        $w('#box14').style.borderWidth = '1px'
    } else {
        $w('#box14').style.borderColor = "#FFFFFF"
        $w('#box14').style.borderWidth = '1px'
    }
})

$w('#paymentBtn').onClick(async () => {

    try {

        // Get latest booking from session
        const savedBooking = session.getItem("Booking");

        if (!savedBooking) {

            console.error("No booking found.");
            return;
        }

        const bookingObj =
            JSON.parse(savedBooking);

        BOOKINGOBJ = bookingObj;

        // =========================
        // CREATE PAYMENT
        // =========================

        const payment =
            await PaymentInitiate(bookingObj);

        // =========================
        // OPEN PAYMENT WINDOW
        // =========================

        const paymentResult =
            await wixPayFrontend.startPayment(payment.id);

        console.log(
            "Payment result:",
            paymentResult
        );

        // =========================
        // CHECK PAYMENT STATUS
        // =========================

        if (paymentResult.status === "Successful") {

            console.log("Payment successful");

            // =========================
            // SAVE BOOKING
            // =========================

            let save = await SaveBooking(bookingObj);
            console.log(save, "save")
            if (save.status != "Success") {
                // show exception 
                wixLocationFrontend.to("/thank-you")
                return
            }

            // =========================
            // REMOVE TEMPORARY SESSION
            // =========================

            // session.removeItem("Booking");

            console.log(
                "Booking successfully saved"
            );

        }
        else if(paymentResult.status === "Cancelled"){
            // 
            let save = await SaveBooking(bookingObj);
            console.log(save, "save from cancelled ")
            if (save.status == "Success") {
                // show exception 
                console.log("in thank you")
                wixLocationFrontend.to("/thank-you")
                return
            }
            // goto thankyou page 
        }
         else {

            console.log(
                "Payment was not successful:",
                paymentResult.status
            );
        }

    } catch (error) {

        console.error(
            "Payment error:",
            error
        );

    }

});

$w('#editTransfer').onClick((event) => {
    $w('#statebox8').changeState("BookingForm")
})
