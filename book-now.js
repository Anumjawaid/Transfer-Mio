import { session } from "wix-storage-frontend"
import wixLocationFrontend from "wix-location-frontend"
import { formatDate, formatTime } from 'public/universal.js'
let PICKUP, DESTINATION, PASSENGERS, DATE, ARRIVALTIME, VEHICLENAME, VEHICLECAPACITY, BASEPRICE, TOTALPRICE
const CHILD_SEAT_PRICE = 10;
const INFANT_SEAT_PRICE = 10;
const BOOSTER_SEAT_PRICE = 5;
const WAITING_PRICE = 14;
const STOP_PRICE = 14;
const WATER_PRICE = 3; // change this to your actual water price

$w.onReady(function () {

    PICKUP = session.getItem("Pickup")
    DESTINATION = session.getItem("Destination")
    DATE = session.getItem("Date")
    PASSENGERS = session.getItem("Passengers")
    VEHICLENAME = session.getItem("Vehicle")
    VEHICLECAPACITY = session.getItem("Capacity")
    BASEPRICE = Number(session.getItem("BASEPRICE"))
    TOTALPRICE = BASEPRICE

    $w('#arrivaldate').value = new Date(DATE)
    $w('#passenger').value = PASSENGERS
    OrderSummaryUpdate()

});

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
            extra => extra.name
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

    // Checkbox Groups
    const waiting = $w('#waitingcheckbox').value.length !== 0;
    const stop = $w('#stopcheckbox').value.length !== 0;
    const pets = $w('#petscheckbox').value.length !== 0;

    const extras = [];

    if (childSeats > 0) {
        extras.push({
            name: `Child Seat × ${childSeats}`,
            price: childSeats * CHILD_SEAT_PRICE
        });
    }

    if (infantSeats > 0) {
        extras.push({
            name: `Infant Seat × ${infantSeats}`,
            price: infantSeats * INFANT_SEAT_PRICE
        });
    }

    if (boosterSeats > 0) {
        extras.push({
            name: `Booster × ${boosterSeats}`,
            price: boosterSeats * BOOSTER_SEAT_PRICE
        });
    }

    if (waiting) {
        extras.push({
            name: 'Extra hour of waiting × 1',
            price: WAITING_PRICE
        });
    }

    if (stop) {
        extras.push({
            name: 'Stop × 1',
            price: STOP_PRICE
        });
    }

    if (pets) {
        extras.push({
            name: 'I am travelling with pets × 1',
            price: 0
        });
    }

    if (water > 0) {
        extras.push({
            name: `Drinking Water × ${water}`,
            price: water * WATER_PRICE
        });
    }

    const totalExtras = extras.reduce(
        (total, extra) => total + extra.price,
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
