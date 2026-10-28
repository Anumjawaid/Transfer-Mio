import {
    LoadPickupInstant,
    LoadDestinationInstant,
    LoadDestinationFirstInstant,
    LoadPickupByDestinationInstant,
    LoadPrices
} from "backend/handler_drop.web.js";

import { session } from "wix-storage-frontend";
import wixLocationFrontend from "wix-location-frontend";

// ==========================================
// STATE AND SELECTIONS
// ==========================================

let Route = "AirportToCity";
let activeState = "State1";
let isSubmitting = false;

const searchData = {
    State1: {
        pickup: "",
        destination: "",
        pickupRequest: 0,
        destinationRequest: 0,
        pickupTimer: null,
        destinationTimer: null
    },
    State2: {
        pickup: "",
        destination: "",
        pickupRequest: 0,
        destinationRequest: 0,
        pickupTimer: null,
        destinationTimer: null
    }
};

// ==========================================
// ELEMENT IDS
// ==========================================

function getIds(state) {
    const suffix = state === "State2" ? "2" : "";

    return {
        pickupInput: `#pickupSearch${suffix}`,
        pickupRepeater: `#pickupRepeater${suffix}`,
        pickupText: `#pickupResultTxt${suffix}`,

        destinationInput: `#destinationSearch${suffix}`,
        destinationRepeater: `#destinationRepeater${suffix}`,
        destinationText: `#destinationResultTxt${suffix}`
    };
}

// ==========================================
// HELPERS
// ==========================================

function getLocations(response, field) {
    const items = Array.isArray(response) ?
        response :
        Array.isArray(response?.payload) ?
        response.payload : [];

    return [...new Set(
        items.map(item => {
            if (typeof item === "string") {
                return item.trim();
            }

            return String(item?.[field] || "").trim();
        }).filter(Boolean)
    )];
}

function makeLocationId(name) {
    let hash = 2166136261;

    for (const char of String(name)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }

    return "loc" + (hash >>> 0).toString(36);
}

function sortLocations(locations, query) {
    const search = query.toLowerCase();

    return locations.sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(search);
        const bStarts = b.toLowerCase().startsWith(search);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return a.localeCompare(b);
    });
}

function showError(message) {
    $w("#exception").text = message;
    $w("#exception").show();
}

function clearError() {
    $w("#exception").text = "";
    $w("#exception").hide();
}

function clearRepeater(repeaterId) {
    $w(repeaterId).data = [];
    $w(repeaterId).collapse();
}

function renderResults(state, type, locations) {
    const ids = getIds(state);
    const repeaterId = type === "pickup" ?
        ids.pickupRepeater :
        ids.destinationRepeater;

    const textId = type === "pickup" ?
        ids.pickupText :
        ids.destinationText;

    const data = locations.map(name => ({
        _id: makeLocationId(name),
        name
    }));

    $w(repeaterId).data = data;

    // Update text on existing repeater items.
    $w(repeaterId).forEachItem(($item, itemData) => {
        $item(textId).text = itemData.name;
    });

    if (data.length) {
        $w(repeaterId).expand();
    } else {
        $w(repeaterId).collapse();
    }
}

function invalidateSearch(state, type) {
    const data = searchData[state];

    if (type === "pickup") {
        data.pickupRequest++;
        clearTimeout(data.pickupTimer);
    } else {
        data.destinationRequest++;
        clearTimeout(data.destinationTimer);
    }
}

// ==========================================
// RESET DEPENDENT FIELD
// ==========================================

function resetDestination(state) {
    const data = searchData[state];
    const ids = getIds(state);

    data.destination = "";

    invalidateSearch(state, "destination");

    $w(ids.destinationInput).value = "";
    clearRepeater(ids.destinationRepeater);
}

function resetPickup(state) {
    const data = searchData[state];
    const ids = getIds(state);

    data.pickup = "";

    invalidateSearch(state, "pickup");

    $w(ids.pickupInput).value = "";
    clearRepeater(ids.pickupRepeater);
}

// ==========================================
// SEARCH PICKUP
// State1: search any pickup
// State2: search pickup for selected destination
// ==========================================

async function searchPickup(state, query) {
    const data = searchData[state];
    const ids = getIds(state);

    const requestId = ++data.pickupRequest;
    const search = String(query || "").trim();

    if (search.length < 2) {
        clearRepeater(ids.pickupRepeater);
        return;
    }

    if (state === "State2" && !data.destination) {
        clearRepeater(ids.pickupRepeater);
        return;
    }

    try {
        let response;

        if (state === "State1") {
            response = await LoadPickupInstant(search);
        } else {
            response = await LoadPickupByDestinationInstant(
                data.destination,
                search
            );
        }

        if (requestId !== data.pickupRequest) return;

        const locations = getLocations(
            response,
            "pickUpLocation"
        );

        renderResults(
            state,
            "pickup",
            sortLocations(locations, search)
        );

    } catch (error) {
        if (requestId !== data.pickupRequest) return;

        console.error("Pickup search error:", error);
        clearRepeater(ids.pickupRepeater);

        showError("Unable to search pickup locations. Please try again.");
    }
}

// ==========================================
// SEARCH DESTINATION
// State1: based on selected pickup
// State2: search all destinations first
// ==========================================

async function searchDestination(state, query) {
    const data = searchData[state];
    const ids = getIds(state);

    const requestId = ++data.destinationRequest;
    const search = String(query || "").trim();

    if (search.length < 2) {
        clearRepeater(ids.destinationRepeater);
        return;
    }

    if (state === "State1" && !data.pickup) {
        clearRepeater(ids.destinationRepeater);
        return;
    }

    try {
        let response;

        if (state === "State1") {
            response = await LoadDestinationInstant(
                data.pickup,
                search
            );
        } else {
            response = await LoadDestinationFirstInstant(search);
        }

        if (requestId !== data.destinationRequest) return;

        const locations = getLocations(
            response,
            "destination"
        );

        renderResults(
            state,
            "destination",
            sortLocations(locations, search)
        );

    } catch (error) {
        if (requestId !== data.destinationRequest) return;

        console.error("Destination search error:", error);
        clearRepeater(ids.destinationRepeater);

        showError("Unable to search destinations. Please try again.");
    }
}

// ==========================================
// REGISTER PICKUP REPEATER
// ==========================================

function registerPickupRepeater(state) {
    const data = searchData[state];
    const ids = getIds(state);

    $w(ids.pickupRepeater).onItemReady(($item, itemData) => {
        $item(ids.pickupText).text = itemData.name;

        $item(ids.pickupText).onClick(() => {
            invalidateSearch(state, "pickup");

            data.pickup = itemData.name;
            $w(ids.pickupInput).value = itemData.name;

            clearRepeater(ids.pickupRepeater);

            // State1 selects pickup first, so reset destination.
            if (state === "State1") {
                resetDestination(state);
            }

            clearError();

            console.log(state, "Selected pickup:", data.pickup);
        });
    });
}

// ==========================================
// REGISTER DESTINATION REPEATER
// ==========================================

function registerDestinationRepeater(state) {
    const data = searchData[state];
    const ids = getIds(state);

    $w(ids.destinationRepeater).onItemReady(($item, itemData) => {
        $item(ids.destinationText).text = itemData.name;

        $item(ids.destinationText).onClick(() => {
            invalidateSearch(state, "destination");

            data.destination = itemData.name;
            $w(ids.destinationInput).value = itemData.name;

            clearRepeater(ids.destinationRepeater);

            // State2 selects destination first, so reset pickup.
            if (state === "State2") {
                resetPickup(state);
            }

            clearError();

            console.log(
                state,
                "Selected destination:",
                data.destination
            );
        });
    });
}

// ==========================================
// REGISTER INPUTS
// ==========================================

function registerInputs(state) {
    const data = searchData[state];
    const ids = getIds(state);

    // PICKUP INPUT
    $w(ids.pickupInput).onInput(event => {
        const query = event.target.value;

        data.pickup = "";

        invalidateSearch(state, "pickup");
        clearRepeater(ids.pickupRepeater);
        clearError();

        // In State1, changing pickup resets destination.
        // In State2, destination must be selected first.
        if (state === "State1") {
            resetDestination(state);
        } else if (!data.destination) {
            showError("Please select a destination first.");
            return;
        }

        if (String(query || "").trim().length < 2) return;

        data.pickupTimer = setTimeout(() => {
            searchPickup(state, query);
        }, 300);
    });

    // DESTINATION INPUT
    $w(ids.destinationInput).onInput(event => {
        const query = event.target.value;

        data.destination = "";

        invalidateSearch(state, "destination");
        clearRepeater(ids.destinationRepeater);
        clearError();

        // In State1, pickup must be selected first.
        // In State2, destination is selected first.
        if (state === "State1" && !data.pickup) {
            showError("Please select a pickup location first.");
            return;
        }

        // In State2, changing destination resets pickup.
        if (state === "State2") {
            resetPickup(state);
        }

        if (String(query || "").trim().length < 2) return;

        data.destinationTimer = setTimeout(() => {
            searchDestination(state, query);
        }, 300);
    });
}

// ==========================================
// VALIDATE ACTIVE STATE
// ==========================================

function validateLocations(state) {
    const data = searchData[state];
    const ids = getIds(state);

    const pickupInput = String(
        $w(ids.pickupInput).value || ""
    ).trim();

    const destinationInput = String(
        $w(ids.destinationInput).value || ""
    ).trim();

    if (!data.pickup || pickupInput !== data.pickup) {
        showError("Please select a valid pickup from the suggestions.");
        return false;
    }

    if (
        !data.destination ||
        destinationInput !== data.destination
    ) {
        showError("Please select a valid destination from the suggestions.");
        return false;
    }

    return true;
}

// ==========================================
// CONTINUE BOOKING
// ==========================================

async function continueBooking() {
    if (isSubmitting) return;

    const state = activeState;
    const data = searchData[state];

    isSubmitting = true;
    $w("#bookNow").disable();
    clearError();

    try {
        if (!validateLocations(state)) return;

        // CMS field order stays pickup then destination,
        // even when the customer searched in reverse order.
        const rates = await LoadPrices(
            data.pickup,
            data.destination
        );

        console.log("Route:", Route);
        console.log("Pickup:", data.pickup);
        console.log("Destination:", data.destination);
        console.log("Rates:", rates);

        if (
            !rates ||
            (Array.isArray(rates) && rates.length === 0)
        ) {
            showError("No available rates found for this route.");
            return;
        }

        session.setItem("Pickup", data.pickup);
        session.setItem("Destination", data.destination);
        session.setItem("Route", Route);

        session.setItem(
            "Date",
            String($w("#datePicker1").value)
        );

        session.setItem(
            "Passengers",
            $w("#passengers").value
        );

        session.setItem(
            "RatesWindow",
            JSON.stringify(rates)
        );

        wixLocationFrontend.to("/route-vehicle");

    } catch (error) {
        console.error("Continue booking error:", error);

        showError("Something went wrong. Please try again.");
    } finally {
        isSubmitting = false;
        $w("#bookNow").enable();
    }
}

// ==========================================
// PAGE READY
// ==========================================

$w.onReady(function () {
    clearError();

    ["State1", "State2"].forEach(state => {
        const ids = getIds(state);

        clearRepeater(ids.pickupRepeater);
        clearRepeater(ids.destinationRepeater);

        registerPickupRepeater(state);
        registerDestinationRepeater(state);
        registerInputs(state);
    });

});
// Existing button switches to State1
$w("#state2change").onClick(() => {
    activeState = "State1";
    Route = "AirportToCity";

    clearError();
    $w("#statebox8").changeState("State1");
});

// Existing button switches to State2
$w("#statechange1").onClick(() => {
    activeState = "State2";
    Route = "CityToAirport";

    clearError();
    $w("#statebox8").changeState("State2");
});

// Shared Continue button
$w("#bookNow").onClick(continueBooking);
