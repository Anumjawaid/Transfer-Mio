import { currentMember } from "wix-members-frontend";
import { GetMyBookings, GetAgentBookingsPage, UpdateBooking } from "backend/CMS_Bookings.web.js";
import { LoadPickups, LoadDestinations, LoadPrices } from 'backend/handler_drop.web.js'
import wixPayFrontend from "wix-pay-frontend";

let isSavingBooking = false;

const CUSTOMER_ROLE_ID = "b405ef8d-e944-4f03-97a0-33ff66ba14ef";
const AGENT_ROLE_ID = "83eaa9ff-9ddf-414e-9e75-02e0adc62c7b";

let currentAgent = "";
let currentPage = 1;
const pageSize = 7;
let totalPages = 1;
let editVehicles = [];
let editBasePrice = 0;
let selectedBooking = null;
let isEditLoading = false;
const EXTRA_PRICES = {
    childSeat: 10,
    boosterSeat: 5,
    infantSeat: 10,
    waiting: 14,
    stop: 14,
    pets: 0,
    drinkingWater: 3
};

let editExtras = {
    childSeat: 0,
    boosterSeat: 0,
    infantSeat: 0,
    waiting: false,
    stop: false,
    stopLocation: "",
    pets: false,
    drinkingWater: 0
};

let editExtrasData = {
    extras: [],
    totalExtras: 0
};

let isChildSeatExpanded = false;

function getExtraQuantity(extras, names) {
    const extra = extras.find(item =>
        names.some(name =>
            String(item.name || "").trim().toLowerCase() ===
            name.toLowerCase()
        )
    );

    return extra ? Math.max(0, Number(extra.quantity) || 0) : 0;
}

function hasExtra(extras, names) {
    return getExtraQuantity(extras, names) > 0;
}

const mapforVehicle = {
    "Bus 13": "bus13Pax",
    "Comfort": "comfort4Pax",
    "Business": "business3Pax",
    "VIP Mini Bus 6": "vipMinibus6Pax",
    "Mini Bus 7": "minibus7Pax",
    "Mini Van 4": "minivan4Pax"
};

const vehiclePassengers = {
    "Bus 13": 13,
    "Comfort": 4,
    "Business": 3,
    "VIP Mini Bus 6": 6,
    "Mini Bus 7": 7,
    "Mini Van 4": 4
};

$w.onReady(async function () {

    // Show loading state first
    await $w("#statebox8").changeState("Loading");

    try {
        const roles = await getLoggedInUserRoles();

        console.log("Logged in user roles:", roles);

        const isCustomer = roles.some(
            role => role._id === CUSTOMER_ROLE_ID
        );

        const isAgent = roles.some(
            role => role._id === AGENT_ROLE_ID
        );
        if (isCustomer) {

            currentAgent = "Customer";

            await loadCustomerBookings();
            return;
        }

        if (isAgent) {

            currentAgent = "Agent";

            await loadAgentBookings();
            return;
        }

        console.log("User has neither Customer nor Agent role.");

    } catch (error) {
        console.error("MyBookings page error:", error);
    }
});

async function LoadSatesforEdit(pickup, destination) {
    // 
    let pickups = await LoadPickups()
    if (pickups.length != 0) {
        // 
        const pickuploc = pickups.map((v) => { return { label: v, value: v } })
        $w('#pickupEdit').options = pickuploc

    }
    $w('#pickupEdit').value = pickup

    let destinationoption = await LoadDestinations(pickup)
    if (destinationoption.length != 0) {
        // 
        const destinationloc = destinationoption.map((v) => { return { label: v, value: v } })
        $w('#destinationEdit').options = destinationloc

    }
    $w('#destinationEdit').value = destination

    // from pickup load destination 

}

// ======================================================
// GET LOGGED-IN USER ROLES
// ======================================================

async function getLoggedInUserRoles() {
    const member = await currentMember.getMember();

    if (!member) {
        throw new Error("No logged-in member found.");
    }

    const roles = await currentMember.getRoles();

    return roles || [];
}

// ======================================================
// CUSTOMER BOOKINGS
// ======================================================

async function loadCustomerBookings() {

    try {

        const member = await currentMember.getMember();

        if (!member?.loginEmail) {
            throw new Error("Customer email could not be found.");
        }

        const result = await GetMyBookings({
            email: member.loginEmail,
            page: currentPage,
            pageSize: pageSize
        });

        console.log("Customer bookings:", result);

        if (
            result.status !== "Success" ||
            !result.payload
        ) {
            console.log("No customer bookings found.");

            $w("#AllBookingsCustomer").data = [];
            setupPagination(
                result.payload.totalBookings,
                result.payload.totalPages
            );

            $w("#statebox8").changeState(
                "CustomerView"
            );

            return;
        }

        const bookings = result.payload.bookings || [];

        $w("#AllBookingsCustomer").data = bookings;

        $w("#statebox8").changeState(
            "CustomerView"
        );

    } catch (error) {

        console.error(
            "loadCustomerBookings error:",
            error
        );
    }
}

// ======================================================
// AGENT BOOKINGS
// ======================================================

async function loadAgentBookings() {

    try {

        const member = await currentMember.getMember();

        if (!member?.loginEmail) {
            throw new Error("Agent email could not be found.");
        }

        const result = await GetAgentBookingsPage({
            email: member.loginEmail,
            page: currentPage,
            pageSize: pageSize
        });

        console.log("Agent bookings:", result);

        if (
            result.status !== "Success" ||
            !result.payload
        ) {
            console.log("No agent bookings found.");

            $w("#AllBOOKINGSAgent").data = [];

            setupPagination(
                result.payload.totalBookings,
                result.payload.totalPages
            );

            await $w("#statebox8").changeState(
                "AgentBookings"
            );

            return;
        }

        const bookings = result.payload.bookings || [];

        $w("#AllBOOKINGSAgent").data = bookings;

        await $w("#statebox8").changeState(
            "AgentBookings"
        );

    } catch (error) {

        console.error(
            "loadAgentBookings error:",
            error
        );
    }
}

// ======================================================
// DATE + TIME FORMATTER
// ======================================================

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
        "en-US", { month: "short" }
    );

    const year = date.getFullYear();

    const timeParts = timeValue.split(":");

    let hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);

    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    const formattedTime =
        `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;

    return `${day} ${month} ${year}, ${formattedTime}`;
}

$w("#back").onClick(() => {

    if (currentAgent === "Customer") {

        $w("#statebox8").changeState("CustomerView");

    } else if (currentAgent === "Agent") {

        $w("#statebox8").changeState("AgentView");

    }

});
// so we are at the MyBookings Page this is a member's area page the difference what the user is going to be be if the role is customer we are going to
//  fetch GETMYBOOKINGS if agent then we will fetch GetAgentBookingsPage  first check the role of the loggedin User then fetch based on role and change state my state box
//  $wstatebox 8 and its state are   CustomerBookings and AgentBookings based on that I want the data to be shown in their respective Repeater $w(AllBookingsCustomer) for customer repeater and for agent AllBOOKINGSAgent 
// Also set up iemReady data for agent it is orderNumberAgent,NameAgent,BookedByAgent,RouteAgent,DateTimeAgent,VehicleAgent,PersonAgent,AmountAgent,ViewDetailAgent(button) notice the word Agent that is a differenciation for all the data to be that of agent

$w("#AllBOOKINGSAgent").onItemReady(
    ($item, itemData) => {

        $item("#orderNumberAgent").text =
            itemData.orderNumber || "";

        $item("#NameAgent").text =
            itemData.nameSurname || "";

        $item("#BookedByAgent").text =
            itemData.bookedBy || "";

        $item("#RouteAgent").text =
            `${itemData.pickup || ""} → ${itemData.destination || ""}`;

        $item("#DateTimeAgent").text =
            formatBookingDateTime(
                itemData.arrivaldate,
                itemData.arrivaltime
            );

        $item("#VehicleAgent").text =
            itemData.vehicleName || "";

        $item("#PersonAgent").text =
            String(itemData.passenger || "");

        $item("#AmountAgent").text =
            `$${Number(itemData.TOTALPRICE || 0).toFixed(2)}`;

        $item("#ViewDetailAgent").onClick(() => {

            console.log(
                "Agent booking selected:",
                itemData
            );

            showBookingDetails(itemData);
        });
    }
);

$w("#AllBookingsCustomer").onItemReady(
    ($item, itemData) => {

        $item("#orderNumberCustomer").text =
            itemData.orderNumber || "";

        $item("#NameCustomer").text =
            itemData.nameSurname || "";

        $item("#BookedByCustomer").text =
            itemData.bookedBy || "";

        $item("#RouteCustomer").text =
            `${itemData.pickup || ""} → ${itemData.destination || ""}`;

        $item("#DateTimeCustomer").text =
            formatBookingDateTime(
                itemData.arrivaldate,
                itemData.arrivaltime
            );

        $item("#VehicleCustomer").text =
            itemData.vehicleName || "";

        $item("#PersonCustomer").text =
            String(itemData.passenger || "");

        $item("#AmountCustomer").text =
            `$${Number(itemData.TOTALPRICE || 0).toFixed(2)}`;

        $item("#ViewDetailCustomer").onClick(() => {

            showBookingDetails(itemData);

        });
    }
);

function setupPagination(totalBookings, totalPagesValue) {

    totalPages = Math.max(
        1,
        totalPagesValue || 1
    );

    const showingTo = Math.min(
        currentPage * pageSize,
        totalBookings
    );

    $w("#showingTxt").text =
        `Showing ${showingTo} of ${totalBookings} bookings`;

    const paginationData = [];

    for (let i = 1; i <= totalPages; i++) {

        paginationData.push({
            _id: String(i),
            page: i
        });
    }

    $w("#paginationRepeater").data =
        paginationData;

}

// so now when in repeater either in agent or in customer view view Details btn is clicked I want to open up a screen ehich will have the complete details for the booking 
// here are the tags #pickupView #destinationView #pickupDateView #pickupTimeView #PassengerView #flightNoView #addonsView (I want all the add on connected with a comma to be displayed here )
// #addonsView (If no information is available I want N/A to be displayed in that ) #totalPriceView 

function showBookingDetails(itemData) {

    selectedBooking = itemData;

    console.log("Selected booking:", selectedBooking);

    $w('#ReferenceNoV').text = "Reference # " + itemData.orderNumber
    // $w('#ReferenceNoE').text = "Reference # " + itemData.orderNumber

    $w('#VehicleView').text = itemData.vehicleName

    // Pickup
    $w("#pickupView").text = itemData.pickup || "N/A";

    // Destination
    $w("#destinationView").text = itemData.destination || "N/A";

    // Pickup Date
    $w("#pickupDateView").text = formatPickupDate(itemData.arrivaldate);

    // Pickup Time
    $w("#pickupTimeView").text = formatPickupTime(itemData.arrivaltime);

    // Passengers
    $w("#PassengerView").text = itemData.passenger != null ? String(itemData.passenger) : "N/A";

    // Flight Number
    $w("#flightNoView").text = itemData.flightNumber || "N/A";

    // Addons
    $w("#addonsView").text = formatAddons(itemData.extrasData);
    $w("#addonsEdit").text = formatAddons(itemData.extrasData);
    $w('#extraPriceView').text = itemData.extrasData.totalExtras != null ? "$ " + itemData.extrasData.totalExtras : "N/A"
    $w('#extraPriceEdit').text = itemData.extrasData.totalExtras != null ? "$ " + itemData.extrasData.totalExtras : "N/A"

    // Total Price
    $w("#totalPriceV").text =
        itemData.TOTALPRICE != null ?
        `$${Number(itemData.TOTALPRICE).toFixed(2)}` :
        "N/A";
    $w('#totalPriceView').text = "Base Price for the flight is $ " + itemData.BASEPRICE
    $w('#basePriceEdit').text = "Base Price for the flight is $ " + itemData.BASEPRICE

    $w('#commentsView').text = itemData.comments != null ? itemData.comments : "N/A"
    $w('#commentsEdit').value = itemData.comments != null ? itemData.comments : "N/A"

    // Name
    $w('#customerNameV').text = itemData.name != null ? itemData.name : "N/A";
    $w("#customerNameV").text = itemData.nameSurname || itemData.name || "N/A";

    $w('#emailcustomerV').text = itemData.email != null ? itemData.email : "N/A";

    $w('#PhoneCustomerV').text = itemData.phone != null ? itemData.phone : "N/A";

    $w('#emailcustomerEdit').value = itemData.email != null ? itemData.email : "N/A";

    $w('#PhoneCustomerEdit').value = itemData.phone != null ? itemData.phone : "N/A";

    $w('#BookCreateDateV').text = formatPickupDate(itemData._createdDate)
    $w('#BookEditedDatev').text = formatPickupDate(itemData._updatedDate)

    $w('#BookCreateDateEdit').text = formatPickupDate(itemData._createdDate) + "(Auto-updated)"
    $w('#BookEditedDatev').text = formatPickupDate(itemData._updatedDate) + "(Auto-updated)"

    // Open detail state
    $w("#statebox8").changeState("ViewDetails");
}

function formatAddons(extrasData) {

    const extras = extrasData?.extras || [];

    if (!extras.length) {
        return "N/A";
    }

    const addonNames = extras
        .filter(extra => extra?.name)
        .map(extra => {
            const quantity = Number(extra.quantity || 1);

            if (quantity > 1) {
                return `${extra.name} × ${quantity}`;
            }

            return extra.name;
        });

    return addonNames.length ?
        addonNames.join(", ") :
        "N/A";
}

function formatPickupDate(dateValue) {

    if (!dateValue) {
        return "N/A";
    }

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "N/A";
    }

    const day = date.getDate();

    const month = date.toLocaleString(
        "en-US", { month: "short" }
    );

    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
}

function formatPickupTime(timeValue) {

    if (!timeValue) {
        return "N/A";
    }

    const parts = timeValue.split(":");

    if (parts.length < 2) {
        return timeValue;
    }

    let hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (isNaN(hours) || isNaN(minutes)) {
        return timeValue;
    }

    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

$w('#paginationRepeaterCustomer').onItemReady(($item, itemData) => {
    $item("#paginationTxt").text =
        String(itemData.page);

    if (itemData.page === currentPage) {
        $item("#paginationTxt").style.color = "#000000";
    } else {
        $item("#paginationTxt").style.color = "#999999";
    }

    $item("#paginationTxt").onClick(async () => {

        if (itemData.page === currentPage) {
            return;
        }

        currentPage = itemData.page;

        if (currentAgent === "Customer") {
            await loadCustomerBookings();
        } else if (currentAgent === "Agent") {
            await loadAgentBookings();
        }
    });
})

// so we have an Edit state in the same multistate box now what we want is to tweak the function (showBookingDetails) in a way that It can help the view details and edit details I have added the value part for the input update it so no validation error for input comes use .validation property now I have added the add on section for babyseat drinking water stop and pet I also have added a dropdown for vehicle pickup destinaion now here is the scenario there is a simple edit that doesnot effect the prices like name date but there can also be scenaio where edit can increase the prices for which I wanted to charge people the additional amoount based on the seelction this depends upon pickup destination vehcle change and also the add on selection the other scenariio is where the edit can make the prices go lower in that case i want an email and notification to admin for refund they will handle it manually we just need to trigger the email (I will make the templates on email.web.js ) for now I want you to do a code that can load pickup destination vehicle on edit screen and do the validation handling 

$w("#editChange").onClick(async () => {

    if (!selectedBooking || isEditLoading) {
        return;
    }

    isEditLoading = true;

    try {
        // Immediately open EditScreen
        $w("#statebox8").changeState("EditScreen");

        // Prevent duplicate clicks
        $w("#editChange").disable();

        // Load and prefill fields
        await initializeEditScreen(selectedBooking);

    } catch (error) {
        console.error("EditScreen initialization error:", error);

    } finally {
        isEditLoading = false;
        $w("#editChange").enable();
    }
});

$w('#editbackbtn').onClick((event) => {
    $w('#statebox8').changeState("ViewDetails")
})

$w('#editaddon').onClick((event) => {
    $w('#statebox9').changeState("AddOns")
})

async function initializeEditScreen(booking) {

    console.log("Initializing EditScreen:", booking);
    initializeEditExtras(booking);

    // ========================================
    // REFERENCE NUMBER
    // ========================================

    $w("#ReferenceNoE").text =
        `Reference # ${booking.orderNumber || "N/A"}`;

    // ========================================
    // PICKUP DROPDOWN
    // ========================================

    await Promise.all([
        loadPickupEdit(booking.pickup),

        loadDestinationEdit(
            booking.pickup,
            booking.destination
        ),

        loadVehicleEdit(
            booking.pickup,
            booking.destination,
            booking.vehicleName
        )
    ]);

    updateEditPrice(
        editBasePrice || Number(booking.BASEPRICE || 0),
        Number(booking.extrasData?.totalExtras || 0)
    );
    // ========================================
    // DATE AND TIME
    // ========================================

    $w("#pickupDateEdit").value =
        booking.arrivaldate ?
        new Date(booking.arrivaldate) :
        null;

    $w("#pickupTimeEdit").value =
        booking.arrivaltime || "";

    // ========================================
    // PASSENGERS
    // ========================================

    $w("#PassengerEdit").value =
        booking.passenger != null ?
        String(booking.passenger) :
        "";

    // ========================================
    // FLIGHT NUMBER
    // ========================================

    $w("#flightNoEdit").value =
        booking.flightNumber || "";

    // ========================================
    // EXTRAS
    // ========================================

    $w("#addonsEdit").text =
        formatAddons(booking.extrasData);

    $w("#extraPriceEdit").text =
        `$${Number(booking.extrasData?.totalExtras || 0).toFixed(2)}`;

    // ========================================
    // COMMENTS
    // ========================================

    $w("#commentsEdit").value =
        booking.comments || "";

    // ========================================
    // CUSTOMER INFORMATION
    // ========================================

    $w("#customerNameEdit").value = booking.nameSurname || booking.name || "";

    $w("#emailcustomerEdit").value = booking.email || "";

    $w("#PhoneCustomerEdit").value = booking.phone || "";

    // ========================================
    // BOOKING DATES
    // ========================================

    $w("#BookCreateDateEdit").text = `${formatPickupDate(booking._createdDate)} (Auto-updated)`;

    $w("#BookEditedDateEdit").text = `${formatPickupDate(booking._updatedDateupd)} (Auto-updated)`;

    // ========================================
    // PRICE
    // ========================================

    updateEditPrice(Number(booking.BASEPRICE || 0), Number(booking.extrasData?.totalExtras || 0));
}

async function loadPickupEdit(selectedPickup = "") {

    const result = await LoadPickups();

    console.log("Pickup API result:", result);

    const pickups = Array.isArray(result) ?
        result :
        result.payload || [];

    const options = pickups.map(item => {

        const name =
            typeof item === "string" ?
            item :
            item.name || item.pickup || item.label;

        return {
            label: String(name),
            value: String(name)
        };
    });

    $w("#pickupEdit").options = options;

    $w("#pickupEdit").value =
        options.some(option => option.value === selectedPickup) ?
        selectedPickup :
        undefined;
}

async function loadDestinationEdit(
    pickup,
    selectedDestination = ""
) {

    $w("#destinationEdit").disable();

    $w("#destinationEdit").options = [];

    $w("#destinationEdit").value = undefined;

    if (!pickup) {
        return;
    }

    const result = await LoadDestinations(pickup);

    console.log("Destination API result:", result);

    const destinations = Array.isArray(result) ?
        result :
        result.payload || [];

    const options = destinations.map(item => {

        const name =
            typeof item === "string" ?
            item :
            item.name || item.destination || item.label;

        return {
            label: String(name),
            value: String(name)
        };
    });

    $w("#destinationEdit").options = options;

    $w("#destinationEdit").value =
        options.some(option => option.value === selectedDestination) ?
        selectedDestination :
        undefined;

    $w("#destinationEdit").enable();
}
async function loadVehicleEdit(pickup, destination, selectedVehicle = "") {
    try {
        $w("#VehicleEdit").disable();

        // Fetch prices for the booking's route
        const result = await LoadPrices(pickup, destination);

        console.log("LoadPrices result:", result);

        // Handle direct record, payload object, or payload array
        const raw = result?.payload ?? result;
        const priceRecord = Array.isArray(raw) ?
            raw[0] :
            raw?.items?.[0] ?? raw;

        if (!priceRecord) {
            console.error("No prices found for:", pickup, destination);
            return;
        }

        editVehicles = Object.entries(mapforVehicle)
            .filter(([vehicleName, fieldKey]) => {
                const price = priceRecord[fieldKey];

                return price !== null &&
                    price !== undefined &&
                    price !== "" &&
                    Number.isFinite(Number(price)) &&
                    Number(price) > 0;
            })
            .map(([vehicleName, fieldKey]) => ({
                name: vehicleName,
                key: fieldKey,
                passengers: vehiclePassengers[vehicleName],
                price: Number(priceRecord[fieldKey])
            }));

        const options = editVehicles.map(vehicle => ({

            label: `${vehicle.name} (${vehicle.passengers} Passengers) - ` +
                `$${getEditVehiclePrice(vehicle.price).toFixed(2)}`,

            value: vehicle.name

        }));

        // Match existing booking vehicle
        const matchedVehicle = editVehicles.find(
            vehicle =>
            vehicle.name.trim().toLowerCase() ===
            String(selectedVehicle).trim().toLowerCase()
        );

        // Fallback: keep existing vehicle visible even if no price was returned
        if (selectedVehicle && !matchedVehicle) {
            options.unshift({
                label: selectedVehicle,
                value: selectedVehicle
            });
        }

        // IMPORTANT: Set options before setting value
        $w("#VehicleEdit").options = options;

        $w("#VehicleEdit").value = matchedVehicle ?
            matchedVehicle.name :
            selectedVehicle || undefined;

        editBasePrice = matchedVehicle ?
            (
                selectedBooking &&
                matchedVehicle.name === selectedBooking.vehicleName &&
                pickup === selectedBooking.pickup &&
                destination === selectedBooking.destination ?
                Number(selectedBooking.BASEPRICE || 0) :
                getEditVehiclePrice(matchedVehicle.price)
            ) :
            Number(selectedBooking?.BASEPRICE || 0);

        $w("#VehicleEdit").enable();

        console.log("Vehicle options:", options);
        console.log("Selected vehicle:", $w("#VehicleEdit").value);

    } catch (error) {
        console.error("loadVehicleEdit error:", error);
        $w("#VehicleEdit").enable();
    }
}

$w("#VehicleEdit").onChange(() => {
    const selectedVehicleName = $w("#VehicleEdit").value;

    const vehicle = editVehicles.find(
        item => item.name === selectedVehicleName
    );

    if (!vehicle) return;

    editBasePrice = getEditVehiclePrice(vehicle.price);

    updateEditPrice(editBasePrice, editExtrasData.totalExtras);
});



function initializeEditExtras(booking) {

    const extras = booking.extrasData?.extras || [];

    editExtras = {
        childSeat: getExtraQuantity(extras, ["Child Seat"]),
        boosterSeat: getExtraQuantity(extras, ["Booster Seat"]),
        infantSeat: getExtraQuantity(extras, ["Infant Seat"]),
        waiting: hasExtra(extras, [
            "Extra hour of waiting",
            "Extra Waiting",
            "Waiting"
        ]),
        stop: hasExtra(extras, [
            "Stop",
            "Stop on the way"
        ]),
        stopLocation: booking.extrasData?.stopLocation ||
            booking.stopLocation ||
            "",
        pets: hasExtra(extras, ["Pets", "Pet"]),
        drinkingWater: getExtraQuantity(extras, [
            "Drinking water",
            "Drinking Water",
            "Water"
        ])
    };

    // Seat counters
    $w("#child-seat").value = String(editExtras.childSeat);
    $w("#booster-seat").value = String(editExtras.boosterSeat);
    $w("#infant-seat").value = String(editExtras.infantSeat);

    // Checkboxes
    setCheckboxGroup("#waitingcheckbox", editExtras.waiting);
    setCheckboxGroup("#stopcheckbox", editExtras.stop);
    setCheckboxGroup("#petscheckbox", editExtras.pets);

    // Stop location
    $w("#stoplocation").value = editExtras.stopLocation;

    // Drinking water
    $w("#drinkwater-input").value =
        String(editExtras.drinkingWater);

    // Expand seat selection when seats exist
    isChildSeatExpanded =
        editExtras.childSeat > 0 ||
        editExtras.boosterSeat > 0 ||
        editExtras.infantSeat > 0;

    if (isChildSeatExpanded) {
        $w("#childseatselection").expand();
    } else {
        $w("#childseatselection").collapse();
    }

    updateEditExtrasPrice();
}
// Expand / collapse seat options
$w("#childSeat").onClick(() => {

    isChildSeatExpanded = !isChildSeatExpanded;

    if (isChildSeatExpanded) {
        $w("#childseatselection").expand();
    } else {
        $w("#childseatselection").collapse();
    }
});

// ========================================
// CHILD SEAT
// ========================================

$w("#childSeatplus").onClick(() => {
    changeEditExtraQuantity("childSeat", 1);
});

$w("#childSeatminus").onClick(() => {
    changeEditExtraQuantity("childSeat", -1);
});

// ========================================
// BOOSTER SEAT
// ========================================

$w("#boosterplus").onClick(() => {
    changeEditExtraQuantity("boosterSeat", 1);
});

$w("#boosterminus").onClick(() => {
    changeEditExtraQuantity("boosterSeat", -1);
});

// ========================================
// INFANT SEAT
// ========================================

$w("#infantplus").onClick(() => {
    changeEditExtraQuantity("infantSeat", 1);
});

$w("#infantminus").onClick(() => {
    changeEditExtraQuantity("infantSeat", -1);
});

// ========================================
// DRINKING WATER
// ========================================

$w("#drinkingwaterplus").onClick(() => {
    changeEditExtraQuantity("drinkingWater", 1);
});

$w("#drinkingwaterminus").onClick(() => {
    changeEditExtraQuantity("drinkingWater", -1);
});

// ========================================
// CHECKBOXES
// ========================================

$w("#waitingcheckbox").onChange(() => {
    editExtras.waiting =
        $w("#waitingcheckbox").value.length !== 0;

    updateEditExtrasPrice();
});

$w("#stopcheckbox").onChange(() => {
    editExtras.stop =
        $w("#stopcheckbox").value.length !== 0;

    if (!editExtras.stop) {
        editExtras.stopLocation = "";
        $w("#stoplocation").value = "";
    }

    updateEditExtrasPrice();
});

$w("#petscheckbox").onChange(() => {
    editExtras.pets =
        $w("#petscheckbox").value.length !== 0;

    updateEditExtrasPrice();
});

$w("#stoplocation").onInput(() => {
    editExtras.stopLocation = $w("#stoplocation").value;
    updateEditExtrasPrice();
});

function changeEditExtraQuantity(type, change) {

    const current = Number(editExtras[type]) || 0;

    editExtras[type] = Math.max(0, current + change);

    const inputMap = {
        childSeat: "#child-seat",
        boosterSeat: "#booster-seat",
        infantSeat: "#infant-seat",
        drinkingWater: "#drinkwater-input"
    };

    $w(inputMap[type]).value = String(editExtras[type]);

    updateEditExtrasPrice();
}

function updateEditExtrasPrice() {

    const extras = [];

    function addExtra(name, quantity, unitPrice) {

        if (quantity <= 0) return;

        extras.push({
            name,
            quantity,
            price: unitPrice
        });
    }

    addExtra(
        "Child Seat",
        editExtras.childSeat,
        EXTRA_PRICES.childSeat
    );

    addExtra(
        "Booster Seat",
        editExtras.boosterSeat,
        EXTRA_PRICES.boosterSeat
    );

    addExtra(
        "Infant Seat",
        editExtras.infantSeat,
        EXTRA_PRICES.infantSeat
    );

    addExtra(
        "Extra hour of waiting",
        editExtras.waiting ? 1 : 0,
        EXTRA_PRICES.waiting
    );

    addExtra(
        "Stop",
        editExtras.stop ? 1 : 0,
        EXTRA_PRICES.stop
    );

    addExtra(
        "Pets",
        editExtras.pets ? 1 : 0,
        EXTRA_PRICES.pets
    );

    addExtra(
        "Drinking water",
        editExtras.drinkingWater,
        EXTRA_PRICES.drinkingWater
    );

    const totalExtras = extras.reduce(
        (total, extra) =>
        total + extra.quantity * extra.price,
        0
    );

    editExtrasData = {
        extras,
        totalExtras,
        stopLocation: editExtras.stop ?
            editExtras.stopLocation : ""
    };

    // Display add-ons
    $w("#addonsEdit").text =
        formatAddons(editExtrasData);

    // Update total using existing price function
    updateEditPrice(editBasePrice, totalExtras);

    console.log("Updated edit extras:", editExtrasData);
}

function setCheckboxGroup(selector, selected) {
    const options = $w(selector).options;

    $w(selector).value = selected && options.length ? [options[0].value] : [];
}


function getBookingPriceDifference() {

    const oldTotal = Number(selectedBooking?.TOTALPRICE || 0);

    const newTotal = Math.round(
        (
            Number(editBasePrice || 0) +
            Number(editExtrasData.totalExtras || 0)
        ) * 100
    ) / 100;

    const difference = (
        Math.round(newTotal * 100) -
        Math.round(oldTotal * 100)
    ) / 100;

    return {
        oldTotal,
        newTotal,
        difference
    };
}


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function showUpdateMessage(message) {

    $w("#loadingTxt").text = message;

    $w("#loadingTxt").show();

    console.log("Price message:", message);
}




// ==========================================
// DISPLAY PRICE SCENARIO
// ==========================================

function showPriceScenario(difference) {

    const amount = Math.abs(difference).toFixed(2);

    if (difference > 0) {

        showUpdateMessage(
            `Your booking price has increased by $${amount}. ` +
            "An additional payment will be required."
        );

    } else if (difference < 0) {

        showUpdateMessage(
            `Your booking price has decreased by $${amount}. ` +
            "A refund will need to be arranged."
        );

    } else {

        showUpdateMessage(
            "No price change. You can save your booking updates."
        );
    }
}


// ==========================================
// SINGLE PRICE UPDATE FUNCTION
// ==========================================

function updateEditPrice(basePrice, extrasPrice) {

    editBasePrice = Number(basePrice) || 0;

    const extras = Number(extrasPrice) || 0;

    const total = Math.round(
        (editBasePrice + extras) * 100
    ) / 100;

    // Update displayed prices
    $w("#basePriceEdit").text =
        `Base Price for the flight is $${editBasePrice.toFixed(2)}`;

    $w("#extraPriceEdit").text =
        `$${extras.toFixed(2)}`;

    $w("#totalPriceEdit").text =
        `$${total.toFixed(2)}`;

    // Avoid displaying misleading price differences
    // before a route and vehicle have been selected.
    const pickup = $w("#pickupEdit").value;
    const destination = $w("#destinationEdit").value;
    const vehicle = $w("#VehicleEdit").value;

    if (!selectedBooking || !pickup || !destination || !vehicle) {

        showUpdateMessage(
            "Please select your pickup, destination and vehicle."
        );

        return;
    }

    // Do not treat an unavailable vehicle as a free vehicle
    if (editBasePrice <= 0) {

        showUpdateMessage(
            "Please select an available vehicle."
        );

        return;
    }

    const priceInfo = getBookingPriceDifference();

    console.log("Booking price comparison:", priceInfo);

    showPriceScenario(priceInfo.difference);
}





// ==========================================
// SAVE BOOKING CHANGES
// ==========================================

async function saveBookingChanges() {

    if (!selectedBooking?._id || isSavingBooking) {
        return;
    }

    isSavingBooking = true;

    $w("#saveChanges").disable();

    try {

        // ======================================
        // UPDATE ADD-ON CALCULATIONS
        // ======================================

        updateEditExtrasPrice();

        // ======================================
        // VALIDATE FORM
        // ======================================

        if (!validateBookingEdit()) {
            return;
        }

        // ======================================
        // CHECK PRICE DIFFERENCE
        // ======================================

        const { difference } = getBookingPriceDifference();

        if (difference > 0) {

            showUpdateMessage(
                `The new booking costs $${difference.toFixed(2)} more. ` +
                "An additional payment is required before this change can be saved."
            );

            return;
        }

        if (difference < 0) {

            showUpdateMessage(
                `The new booking costs $${Math.abs(difference).toFixed(2)} less. ` +
                "A refund must be arranged before this change can be saved."
            );

            return;
        }

        // ======================================
        // GET CURRENT LOGGED-IN MEMBER
        // ======================================

        const member = await currentMember.getMember();

        if (!member?._id) {

            throw new Error(
                "Please log in again to update your booking."
            );
        }

        const currentMemberId = member._id;

        console.log(
            "Current member ID:",
            currentMemberId
        );

        // ======================================
        // PREPARE UPDATED BOOKING OBJECT
        // ======================================

        const updatedBooking = {

            _id: selectedBooking._id,

            pickup: $w("#pickupEdit").value,

            destination: $w("#destinationEdit").value,

            vehicleName: $w("#VehicleEdit").value,

            arrivaldate: $w("#pickupDateEdit").value,

            arrivaltime: $w("#pickupTimeEdit").value,

            passenger: Number(
                $w("#PassengerEdit").value
            ),

            flightNo: $w("#flightNoEdit").value,

            comments: $w("#commentsEdit").value,

            nameSurname: $w("#customerNameEdit").value,

            phone: $w("#PhoneCustomerEdit").value,

            extrasData: editExtrasData

        };

        console.log(
            "Updated booking object:",
            updatedBooking
        );

        // ======================================
        // CALL BACKEND UPDATE FUNCTION
        // ======================================

        showUpdateMessage(
            "Saving your booking changes..."
        );

        const result = await UpdateBooking(
            updatedBooking,
            currentMemberId,
            false
        );

        console.log(
            "UpdateBooking response:",
            result
        );

        // ======================================
        // HANDLE BACKEND RESPONSE
        // ======================================

        if (result.status !== "Success") {

            throw new Error(
                result.message ||
                "Unable to update booking."
            );
        }

        // ======================================
        // UPDATE SELECTED BOOKING
        // ======================================

        selectedBooking = result.payload;

        showBookingDetails(selectedBooking);

        // ======================================
        // REFRESH BOOKINGS
        // ======================================

        if (currentAgent === "Customer") {

            await loadCustomerBookings();

        } else if (currentAgent === "Agent") {

            await loadAgentBookings();
        }

        // ======================================
        // RETURN TO DETAILS SCREEN
        // ======================================

        await $w("#statebox8").changeState(
            "ViewDetails"
        );

        showUpdateMessage(
            "Your booking has been updated successfully."
        );

    } catch (error) {

        console.error(
            "Booking update error:",
            error
        );

        showUpdateMessage(
            error.message ||
            "Unable to update your booking."
        );

    } finally {

        isSavingBooking = false;

        $w("#saveChanges").enable();
    }
}

// ==========================================
// SAVE BUTTON
// ==========================================

$w("#saveChanges").onClick(async () => {

    await saveBookingChanges();

});

$w('#saveChanges').onClick((event) => {

})

// ==========================================
// AGENT VEHICLE DISCOUNT
// ==========================================

function getEditVehiclePrice(rawPrice) {

    const price = Number(rawPrice) || 0;

    if (currentAgent === "Agent") {
        return Math.round(price * 0.85 * 100) / 100;
    }

    return price;
}


// ==========================================
// VALIDATE EDIT FORM
// ==========================================

function validateBookingEdit() {

    const requiredFields = [
        "#pickupEdit",
        "#destinationEdit",
        "#VehicleEdit",
        "#pickupDateEdit",
        "#pickupTimeEdit",
        "#PassengerEdit",
        "#customerNameEdit",
        "#emailcustomerEdit",
        "#PhoneCustomerEdit"
    ];

    for (const id of requiredFields) {

        const element = $w(id);
        const value = element.value;

        if (
            value === undefined ||
            value === null ||
            String(value).trim() === "" ||
            element.valid === false
        ) {

            if (
                typeof element.updateValidityIndication === "function"
            ) {
                element.updateValidityIndication();
            }

            showUpdateMessage(
                "Please complete all required fields correctly."
            );

            return false;
        }
    }

    // ======================================
    // PASSENGER CAPACITY
    // ======================================

    const vehicle = editVehicles.find(
        v => v.name === $w("#VehicleEdit").value
    );

    const passengers = Number(
        $w("#PassengerEdit").value
    );

    if (
        !vehicle ||
        !Number.isInteger(passengers) ||
        passengers < 1 ||
        passengers > vehicle.passengers
    ) {

        showUpdateMessage(
            "Please select a valid vehicle and passenger count."
        );

        return false;
    }

    // ======================================
    // STOP LOCATION
    // ======================================

    if (
        editExtras.stop &&
        !String(editExtras.stopLocation || "").trim()
    ) {

        showUpdateMessage(
            "Please enter the stop location."
        );

        return false;
    }

    return true;
}
// ==========================================
// PICKUP CHANGE
// ==========================================

$w("#pickupEdit").onChange(async () => {

    try {

        $w("#VehicleEdit").options = [];
        $w("#VehicleEdit").value = undefined;

        editVehicles = [];
        editBasePrice = 0;

        updateEditPrice(
            0,
            editExtrasData.totalExtras
        );

        await loadDestinationEdit(
            $w("#pickupEdit").value
        );

    } catch (error) {

        console.error(
            "Pickup change error:",
            error
        );

        showUpdateMessage(
            "Unable to load destinations."
        );
    }
});

// ==========================================
// DESTINATION CHANGE
// ==========================================

$w("#destinationEdit").onChange(async () => {

    try {

        editVehicles = [];
        editBasePrice = 0;

        updateEditPrice(
            0,
            editExtrasData.totalExtras
        );

        const pickup = $w("#pickupEdit").value;
        const destination = $w("#destinationEdit").value;

        if (pickup && destination) {

            await loadVehicleEdit(
                pickup,
                destination
            );

            $w("#VehicleEdit").value = undefined;

            editBasePrice = 0;

            updateEditPrice(
                0,
                editExtrasData.totalExtras
            );
        }

    } catch (error) {

        console.error(
            "Destination change error:",
            error
        );

        showUpdateMessage(
            "Unable to load vehicle prices."
        );
    }
});
