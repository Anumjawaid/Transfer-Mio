import { session } from "wix-storage-frontend"
import wixLocationFrontend from "wix-location-frontend"
import { LoadPickups, LoadDestinations, LoadPrices } from 'backend/handler_drop.web.js'
import { formatDate } from 'public/universal.js'

let PICKUP, DESTINATION, PASSENGERS, DATE, RATES
let selectedIndex = -1;
let mapforVehicle = {
    "Bus 13": "bus13Pax",
    "Comfort": "comfort4Pax",
    "Business": "business3Pax",
    "VIP Mini Bus 6": "vipMinibus6Pax",
    "Mini Bus 7": "minibus7Pax",
    "Mini Van 4": "minivan4Pax"
}

$w.onReady(async function () {

    PICKUP = session.getItem("Pickup")
    DESTINATION = session.getItem("Destination")
    DATE = session.getItem("Date")
    PASSENGERS = session.getItem("Passengers")
    const ratesSession = session.getItem("RatesWindow");

    if (ratesSession) {
        RATES = JSON.parse(ratesSession);
    } else {
        RATES = {};
    }

    console.log("RATES:", RATES);
    console.log(mapforVehicle, "mapfor")

    setTimeout(() => {
        $w('#statebox8').show()
    }, 1000);
    let airports = await LoadPickups()
    if (airports.length != 0) {
        // 
        const airportsloc = airports.map((v) => { return { label: v, value: v } })
        $w('#pickup1').options = airportsloc
        const Cities = await LoadDestinations()
        if (Cities.length != []) {
            $w('#destination1').options = Cities.map((v) => { return { label: v.destination, value: v.destination } })
        }
    }

    $w('#pickup1').value = PICKUP
    const Cities = await LoadDestinations(PICKUP)
    if (Cities.length != []) {
        $w('#destination1').options = Cities.map((v) => { return { label: v.destination, value: v.destination } })
    }
    $w('#destination1').value = DESTINATION
    $w('#passengers').value = PASSENGERS

    $w('#Pickuptxt').text = PICKUP
    $w('#Destinationtxt').text = DESTINATION
    $w('#datetxt').text = formatDate(DATE)
    $w('#passengertxt').text = "" + PASSENGERS
    setTimeout(() => {
        changeMaintxt(PICKUP, DESTINATION)
    }, 2000);

});

const changeMaintxt = (pickup, destination) => {
    $w('#maintxt').text = "Taxi & Transfer from " + pickup + " To " + destination
}

function isVehicleAvailable(vehicleName) {

    const rateKey = mapforVehicle[vehicleName];

    // Vehicle is not mapped at all
    if (!rateKey) {
        return false;
    }

    // Vehicle does not exist in current rates
    if (RATES[rateKey] === undefined || RATES[rateKey] === null) {
        return false;
    }

    // Also make sure it has a valid price
    if (RATES[rateKey] === "" || Number(RATES[rateKey]) <= 0) {
        return false;
    }

    return true;
}

$w('#VEHICLES').onItemReady(($item, itemData, index) => {

    const vehicleName = itemData.vehicleName

    console.log("Vehicle:===>", vehicleName);
    console.log(mapforVehicle, "vehicle map")
    console.log(mapforVehicle[vehicleName], "name tag")

    const rateKey = mapforVehicle[vehicleName];

    console.log("Rate key:===>", rateKey);

    const rate = RATES?.[rateKey];

    console.log("Rate:===>", rate);

    // Check if vehicle has a rate
    const available =
        rateKey &&
        RATES[rateKey] !== undefined &&
        RATES[rateKey] !== null &&
        RATES[rateKey] !== "" &&
        Number(RATES[rateKey]) > 0;

    console.log(available, "available")
    // =========================
    // VEHICLE AVAILABILITY
    // =========================

    if (!available) {

        // Disable button
        $item('#Continue').disable();

        // Change button text
        $item('#Continue').label = "Unavailable";
        $item('#price').text = "N/A"

    } else {
        $item('#price').text = "$ " + Number(RATES[rateKey])

        // Enable button
        $item('#Continue').enable();

        // Normal label
        $item('#Continue').label = "Continue";

    }

    // Initial border
    $item('#box10').style.borderWidth = '0px';

    // =========================
    // CONTINUE BUTTON
    // =========================

    $item('#Continue').onClick(async () => {

        selectedIndex = index;

        $w('#VEHICLES').forEachItem(
            ($repeaterItem, repeaterItemData, repeaterItemIndex) => {

                if (repeaterItemIndex === selectedIndex) {

                    $repeaterItem('#box10').style.borderWidth = '1px';
                    $repeaterItem('#box10').style.borderColor = '#6E0404';

                } else {

                    $repeaterItem('#box10').style.borderWidth = '0px';

                }

            }
        );

        // Get price directly from RATES
        const rateKey = mapforVehicle[vehicleName];
        const price = Number(RATES[rateKey]);

        session.setItem(
            "BASEPRICE",
            String(price)
        );

        // Save vehicle
        session.setItem(
            "Vehicle",
            vehicleName
        );

        session.setItem(
            "Capacity",
            String($item('#vehiclecapacity').text)
        );

        session.setItem(
            "VehicleImage",
            String($item('#vehicleImage').src)
        );

        wixLocationFrontend.to("/book-now");

    });

});

$w('#pickup1').onChange(async (event) => {
    session.setItem("Pickup", $w('#pickup1').value)
    PICKUP = $w('#pickup1').value
    changeMaintxt(PICKUP, DESTINATION)
    let destinations = await LoadDestinations($w('#pickup1').value)
    console.log(destinations, "cityProce")
    if (destinations.length != 0) {
        // 
        $w('#destination1').options = destinations.map((v) => { return { label: v.destination, value: v.destination } })
    }
})

$w('#destination1').onChange((event) => {
    session.setItem("Destination", $w('#destination1').value)
    DESTINATION = $w('#destination1').value
    changeMaintxt(PICKUP, DESTINATION)

})

$w('#datePicker1').onChange((event) => {
    DATE = $w('#datePicker1').value
    session.setItem("Date", String(DATE))
    setSession()
})

$w('#passengers').onChange((event) => {
    PASSENGERS = $w('#passengers').value
    session.setItem("Passengers", PASSENGERS)
    setSession()
})

$w('#stateChange').onClick((event) => {
    if ($w('#statebox8').currentState.id == "Description") {
        $w('#statebox8').changeState("Form")
        return
    }
    $w('#statebox8').changeState("Description")

})

$w('#bookNow').onClick((event) => {
    //  put everything in session and focus on repeater
    setSession()
    $w('#VEHICLES').scrollTo()
})

const setSession = () => {

    session.setItem("Pickup", PICKUP)
    session.setItem("Destination", DESTINATION)
    session.setItem("Date", String(DATE))
    session.setItem("Passengers", PASSENGERS)

    $w('#Pickuptxt').text = PICKUP
    $w('#Destinationtxt').text = DESTINATION
    $w('#datetxt').text = formatDate(DATE)
    $w('#passengertxt').text = "" + PASSENGERS
    changeMaintxt(PICKUP, DESTINATION)

}
