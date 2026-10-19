import { session } from "wix-storage-frontend";
import {
    convertUsdToEur
} from "backend/currencyconversion.web.js";

import {
    LoadPickupInstant,
    LoadDestinationInstant,
    LoadDestinationFirstInstant,
    LoadPickupByDestinationInstant,
    LoadPrices
} from "backend/handler_drop.web.js";

import { formatDate } from "public/universal.js";

// =====================================================
// GLOBAL VARIABLES
// =====================================================

let PICKUP = "";
let DESTINATION = "";
let PASSENGERS = "";
let DATE = "";
let RATES = {};

let activeState = "State1";
let Route = "AirportToCity";

let selectedIndex = "";
let isLoadingRates = false;
let rateRequestId = 0;

const AGENT_DISCOUNT = 15;

const mapforVehicle = {
    "Bus 13": "bus13Pax",
    "Comfort": "comfort4Pax",
    "Business": "business3Pax",
    "VIP Mini Bus 6": "vipMinibus6Pax",
    "Mini Bus 7": "minibus7Pax",
    "Mini Van 4": "minivan4Pax"
};

// Vehicle repeater data.
// Add image/capacity fields here if you want to populate those
// elements dynamically instead of using the existing item template.
const VEHICLE_DATA = [
    { _id: "bus13", vehicleName: "Bus 13" },
    { _id: "comfort", vehicleName: "Comfort" },
    { _id: "business", vehicleName: "Business" },
    { _id: "vipminibus6", vehicleName: "VIP Mini Bus 6" },
    { _id: "minibus7", vehicleName: "Mini Bus 7" },
    { _id: "minivan4", vehicleName: "Mini Van 4" }
];

const stateData = {
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

// =====================================================
// SESSION HELPERS
// =====================================================

function clearBookingSession() {
    [
        "Pickup",
        "Destination",
        "Date",
        "Passengers",
        "RatesWindow",
        "BASEPRICE",
        "ORIGINALBASEPRICE",
        "AgentDiscount",
        "Vehicle",
        "Capacity",
        "VehicleImage"
    ].forEach(key => session.removeItem(key));
}

function saveRouteSession() {
    session.setItem("Pickup", PICKUP);
    session.setItem("Destination", DESTINATION);
    session.setItem("Date", String(DATE || ""));
    session.setItem("Passengers", String(PASSENGERS || ""));
    session.setItem("RatesWindow", JSON.stringify(RATES));
}

// =====================================================
// LOCATION SEARCH HELPERS
// =====================================================

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

function normalizeLocations(result, key) {
    const raw = Array.isArray(result) ?
        result :
        Array.isArray(result?.payload) ?
        result.payload :
        [];

    return [
        ...new Set(
            raw.map(item => {
                if (typeof item === "string") {
                    return item.trim();
                }

                return String(
                    item?.[key] ||
                    item?.name ||
                    item?.label ||
                    ""
                ).trim();
            }).filter(Boolean)
        )
    ];
}

function makeLocationId(name) {
    let hash = 2166136261;

    for (const char of String(name)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }

    return "loc" + (hash >>> 0).toString(36);
}

function createRepeaterData(locations) {
    return locations.map(name => ({
        _id: makeLocationId(name),
        name
    }));
}

function sortLocations(locations, query) {
    const search = String(query || "").toLowerCase();

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

function cancelSearch(state, type) {
    const data = stateData[state];

    if (type === "pickup") {
        data.pickupRequest++;
        clearTimeout(data.pickupTimer);
        data.pickupTimer = null;
    } else {
        data.destinationRequest++;
        clearTimeout(data.destinationTimer);
        data.destinationTimer = null;
    }
}

function resetDestination(state) {
    const data = stateData[state];
    const ids = getIds(state);

    data.destination = "";

    cancelSearch(state, "destination");

    $w(ids.destinationInput).value = "";
    clearRepeater(ids.destinationRepeater);
}

function resetPickup(state) {
    const data = stateData[state];
    const ids = getIds(state);

    data.pickup = "";

    cancelSearch(state, "pickup");

    $w(ids.pickupInput).value = "";
    clearRepeater(ids.pickupRepeater);
}

function syncActiveRoute(state = activeState) {
    activeState = state;

    const data = stateData[state];

    PICKUP = data.pickup;
    DESTINATION = data.destination;

    Route = state === "State2" ?
        "CityToAirport" :
        "AirportToCity";

    updateRouteText();
}

function updateRouteText() {
    $w("#Pickuptxt").text = PICKUP || "";
    $w("#Destinationtxt").text = DESTINATION || "";
    $w("#datetxt").text = DATE ? formatDate(DATE) : "";
    $w("#passengertxt").text = String(PASSENGERS || "");

    $w("#maintxt").text =
        `Taxi & Transfer from ${PICKUP || "—"} To ${DESTINATION || "—"}`;
}

// =====================================================
// PICKUP SEARCH
// =====================================================

async function searchPickups(state, searchText) {
    const data = stateData[state];
    const ids = getIds(state);

    const requestId = ++data.pickupRequest;
    const query = String(searchText || "").trim();

    if (query.length < 2) {
        clearRepeater(ids.pickupRepeater);
        return;
    }

    const destinationAtRequest = data.destination;

    if (state === "State2" && !destinationAtRequest) {
        clearRepeater(ids.pickupRepeater);
        return;
    }

    try {
        let response;

        if (state === "State1") {
            response = await LoadPickupInstant(query);
        } else {
            response = await LoadPickupByDestinationInstant(
                destinationAtRequest,
                query
            );
        }

        if (
            requestId !== data.pickupRequest ||
            (
                state === "State2" &&
                destinationAtRequest !== data.destination
            )
        ) {
            return;
        }

        const locations = normalizeLocations(
            response,
            "pickUpLocation"
        );

        const results = createRepeaterData(
            sortLocations(locations, query)
        );

        $w(ids.pickupRepeater).data = results;

        if (results.length) {
            $w(ids.pickupRepeater).expand();
        } else {
            clearRepeater(ids.pickupRepeater);
        }
    } catch (error) {
        if (requestId !== data.pickupRequest) return;

        console.error("Pickup search failed:", error);
        clearRepeater(ids.pickupRepeater);

        showError(
            "Unable to search pickup locations. Please try again."
        );
    }
}

// =====================================================
// DESTINATION SEARCH
// =====================================================

async function searchDestinations(state, searchText) {
    const data = stateData[state];
    const ids = getIds(state);

    const requestId = ++data.destinationRequest;
    const query = String(searchText || "").trim();

    if (query.length < 2) {
        clearRepeater(ids.destinationRepeater);
        return;
    }

    const pickupAtRequest = data.pickup;

    if (state === "State1" && !pickupAtRequest) {
        clearRepeater(ids.destinationRepeater);
        return;
    }

    try {
        let response;

        if (state === "State1") {
            response = await LoadDestinationInstant(
                pickupAtRequest,
                query
            );
        } else {
            response = await LoadDestinationFirstInstant(query);
        }

        if (
            requestId !== data.destinationRequest ||
            (
                state === "State1" &&
                pickupAtRequest !== data.pickup
            )
        ) {
            return;
        }

        const locations = normalizeLocations(
            response,
            "destination"
        );

        const results = createRepeaterData(
            sortLocations(locations, query)
        );

        $w(ids.destinationRepeater).data = results;

        if (results.length) {
            $w(ids.destinationRepeater).expand();
        } else {
            clearRepeater(ids.destinationRepeater);
        }
    } catch (error) {
        if (requestId !== data.destinationRequest) return;

        console.error("Destination search failed:", error);
        clearRepeater(ids.destinationRepeater);

        showError(
            "Unable to search destinations. Please try again."
        );
    }
}

// =====================================================
// LOCATION SELECTION
// =====================================================

async function selectLocation(state, type, location) {
    const data = stateData[state];
    const ids = getIds(state);

    clearError();

    if (type === "pickup") {
        if (data.pickup === location) return;

        data.pickup = location;

        // In State1, changing pickup invalidates destination.
        if (state === "State1") {
            resetDestination(state);
        }
    } else {
        if (data.destination === location) return;

        data.destination = location;

        // In State2, changing destination invalidates pickup.
        if (state === "State2") {
            resetPickup(state);
        }
    }

    cancelSearch(state, type);

    const inputId = type === "pickup" ?
        ids.pickupInput :
        ids.destinationInput;

    const repeaterId = type === "pickup" ?
        ids.pickupRepeater :
        ids.destinationRepeater;

    $w(inputId).value = location;
    clearRepeater(repeaterId);

    syncActiveRoute(state);

    if (PICKUP && DESTINATION) {
        await refreshRoutePrices();
    } else {
        rateRequestId++;
        isLoadingRates = false;
        RATES = {};

        session.setItem("RatesWindow", JSON.stringify(RATES));
        updateVehiclePrices();
    }
}

// =====================================================
// SET UP LOCATION SEARCH FOR BOTH ROUTE STATES
// =====================================================

function setupLocationState(state) {
    const ids = getIds(state);
    const data = stateData[state];

    $w(ids.pickupRepeater).onItemReady(($item, itemData) => {
        $item(ids.pickupText).text = itemData.name;

        $item(ids.pickupText).onClick(async () => {
            await selectLocation(state, "pickup", itemData.name);
        });
    });

    $w(ids.destinationRepeater).onItemReady(($item, itemData) => {
        $item(ids.destinationText).text = itemData.name;

        $item(ids.destinationText).onClick(async () => {
            await selectLocation(
                state,
                "destination",
                itemData.name
            );
        });
    });

    $w(ids.pickupInput).onInput(event => {
        const query = event.target.value;

        data.pickup = "";
        cancelSearch(state, "pickup");

        if (state === "State1") {
            resetDestination(state);
        }

        syncActiveRoute(state);
        rateRequestId++;
        isLoadingRates = false;
        RATES = {};

        session.setItem("RatesWindow", JSON.stringify(RATES));
        updateVehiclePrices();

        clearError();
        clearRepeater(ids.pickupRepeater);

        if (String(query || "").trim().length < 2) {
            return;
        }

        if (state === "State2" && !data.destination) {
            showError("Please select a destination first.");
            return;
        }

        data.pickupTimer = setTimeout(() => {
            searchPickups(state, query);
        }, 300);
    });

    $w(ids.destinationInput).onInput(event => {
        const query = event.target.value;

        data.destination = "";
        cancelSearch(state, "destination");

        if (state === "State2") {
            resetPickup(state);
        }

        syncActiveRoute(state);
        rateRequestId++;
        isLoadingRates = false;
        RATES = {};

        session.setItem("RatesWindow", JSON.stringify(RATES));
        updateVehiclePrices();

        clearError();
        clearRepeater(ids.destinationRepeater);

        if (String(query || "").trim().length < 2) {
            return;
        }

        if (state === "State1" && !data.pickup) {
            showError("Please select a pickup location first.");
            return;
        }

        data.destinationTimer = setTimeout(() => {
            searchDestinations(state, query);
        }, 300);
    });
}

// =====================================================
// PRICING HELPERS
// =====================================================

function getPriceRecord(result) {
    const raw = result?.payload ?? result;

    if (Array.isArray(raw)) {
        return raw[0] || null;
    }

    if (Array.isArray(raw?.items)) {
        return raw.items[0] || null;
    }

    return raw || null;
}

function isValidPrice(price) {
    return (
        price !== undefined &&
        price !== null &&
        price !== "" &&
        Number.isFinite(Number(price)) &&
        Number(price) > 0
    );
}

function getAgentPrice(originalPrice) {
    const price = Number(originalPrice);

    if (!Number.isFinite(price) || price <= 0) {
        return null;
    }

    return Number(
        (price * (1 - AGENT_DISCOUNT / 100)).toFixed(2)
    );
}

async function refreshRoutePrices() {
    if (!PICKUP || !DESTINATION) {
        RATES = {};
        session.setItem("RatesWindow", JSON.stringify(RATES));
        updateVehiclePrices();
        return;
    }

    const requestId = ++rateRequestId;

    isLoadingRates = true;
    RATES = {};

    updateVehiclePrices();

    try {
        console.log("Loading route prices:", {
            pickup: PICKUP,
            destination: DESTINATION,
            route: Route
        });

        // The existing backend function expects pickup first.
        const result = await LoadPrices(PICKUP, DESTINATION);

        if (requestId !== rateRequestId) {
            return;
        }

        const priceRecord = getPriceRecord(result);

        RATES = priceRecord || {};

        session.setItem("RatesWindow", JSON.stringify(RATES));

        console.log("Updated original rates:", RATES);

        updateVehiclePrices();
    } catch (error) {
        if (requestId !== rateRequestId) return;

        console.error("Failed to load route prices:", error);

        RATES = {};
        session.setItem("RatesWindow", JSON.stringify(RATES));

        updateVehiclePrices();

        showError("Could not load vehicle prices for this route.");
    } finally {
        if (requestId === rateRequestId) {
            isLoadingRates = false;
            updateVehiclePrices();
        }
    }
}

// =====================================================
// VEHICLE PRICES
// Display the 15% discounted agent price.
// RATES continues to hold the original prices.
// =====================================================

function updateVehiclePrices() {
    $w("#VEHICLES").forEachItem(async ($item, itemData) => {
        const vehicleName = itemData.vehicleName;
        const rateKey = mapforVehicle[vehicleName];
        const originalPrice = rateKey ? RATES[rateKey] : undefined;

        if (isValidPrice(originalPrice)) {
            const original = Number(originalPrice);
            const discounted = getAgentPrice(original);

            try {
                const originalEUR = Number(
                    await convertUsdToEur(original)
                );

                const discountedEUR = Number(
                    await convertUsdToEur(discounted)
                );

                // Original price: new text element.
                $item("#originalPrice").text =
                    `$ ${original.toFixed(2)} ≅ € ${originalEUR.toFixed(2)} (Original Price)`;

                // Discounted price: existing text element.
                $item("#price").text =
                    `$ ${discounted.toFixed(2)} ≅ € ${discountedEUR.toFixed(2)} (After Discount)`;

            } catch (error) {
                console.error("Currency conversion failed:", error);

                $item("#originalPrice").text =
                    `$ ${original.toFixed(2)} (Original Price)`;

                $item("#price").text =
                    `$ ${discounted.toFixed(2)} (After Discount)`;
            }

            if (isLoadingRates) {
                $item("#Continue").label = "Loading...";
                $item("#Continue").disable();
            } else {
                $item("#Continue").label = "Continue";
                $item("#Continue").enable();
            }
        } else {
            $item("#originalPrice").text = "N/A";

            $item("#price").text = "N/A";
            $item("#Continue").label = isLoadingRates ?
                "Loading..." :
                "Unavailable";
            $item("#Continue").disable();
        }

        const isSelected = itemData._id === selectedIndex;

        $item("#box10").style.borderWidth =
            isSelected ? "1px" : "0px";

        if (isSelected) {
            $item("#box10").style.borderColor = "#6E0404";
        }
    });
}

// =====================================================
// SAVE VEHICLE AND MOVE TO CUSTOMER DETAILS
// =====================================================

function setupVehicleRepeater() {
    $w("#VEHICLES").onItemReady(($item, itemData) => {
        $item("#box10").style.borderWidth = "0px";

        const vehicleName = itemData.vehicleName;

        $item("#Continue").onClick(async () => {
            if (isLoadingRates) {
                showError("Please wait while vehicle prices are loading.");
                return;
            }

            if (!PICKUP || !DESTINATION) {
                showError("Please select both pickup and destination first.");
                return;
            }

            if (!DATE || DATE === "null" || DATE === "undefined") {
                showError("Please select your transfer date first.");
                return;
            }

            if (!PASSENGERS) {
                showError("Please select the number of passengers first.");
                return;
            }

            const rateKey = mapforVehicle[vehicleName];
            const originalPrice = rateKey ? RATES[rateKey] : undefined;

            if (!isValidPrice(originalPrice)) {
                showError("This vehicle is unavailable for the selected route.");
                return;
            }

            const agentPrice = getAgentPrice(originalPrice);

            if (agentPrice === null) {
                showError("Unable to calculate the discounted vehicle price.");
                return;
            }

            selectedIndex = itemData._id;

            $w("#VEHICLES").forEachItem(
                ($vehicleItem, vehicleData) => {
                    const selected = vehicleData._id === selectedIndex;

                    $vehicleItem("#box10").style.borderWidth =
                        selected ? "1px" : "0px";

                    if (selected) {
                        $vehicleItem("#box10").style.borderColor = "#6E0404";
                    }
                }
            );

            // Save route, date, passenger and price details.
            saveRouteSession();

            // BASEPRICE is the discounted price for the agent booking.
            session.setItem("BASEPRICE", String(agentPrice));

            // Keep the undiscounted price separately.
            session.setItem(
                "ORIGINALBASEPRICE",
                String(Number(originalPrice))
            );

            session.setItem("AgentDiscount", String(AGENT_DISCOUNT));
            session.setItem("Vehicle", vehicleName);

            session.setItem(
                "Capacity",
                String($item("#vehiclecapacity").text || "")
            );

            session.setItem(
                "VehicleImage",
                String($item("#vehicleImage").src || "")
            );

            clearError();

            // Continue to the customer-details state on this page.
             $w("#statebox10").changeState("Booking");
        });

        // Initial price display.
        // updateVehiclePrices() handles both price tags consistently.
        updateVehiclePrices();
        const rateKey = mapforVehicle[vehicleName];
        const originalPrice = rateKey ? RATES[rateKey] : undefined;

        if (isValidPrice(originalPrice)) {
            const agentPrice = getAgentPrice(originalPrice);

            $item("#price").text =
                `$ ${Number(agentPrice).toFixed(2)}`;

            if (isLoadingRates) {
                $item("#Continue").label = "Loading...";
                $item("#Continue").disable();
            } else {
                $item("#Continue").label = "Continue";
                $item("#Continue").enable();
            }
        } else {
            $item("#price").text = "N/A";
            $item("#Continue").label = "Unavailable";
            $item("#Continue").disable();
        }
    });
}

// =====================================================
// ROUTE STATE SWITCHING
// =====================================================

async function switchRouteState(state) {
    clearError();

    await $w("#statebox8").changeState(state);
    syncActiveRoute(state);

    const ids = getIds(state);
    const data = stateData[state];

    $w(ids.pickupInput).value = data.pickup || "";
    $w(ids.destinationInput).value = data.destination || "";

    if (PICKUP && DESTINATION) {
        await refreshRoutePrices();
    } else {
        rateRequestId++;
        isLoadingRates = false;
        RATES = {};

        session.setItem("RatesWindow", JSON.stringify(RATES));
        updateVehiclePrices();
    }
}

// =====================================================
// PAGE READY
// =====================================================

$w.onReady(function () {
    // Start each new agent booking with clean session values.
    clearBookingSession();

    PICKUP = "";
    DESTINATION = "";
    DATE = "";
    PASSENGERS = "";
    RATES = {};

    activeState = "State1";
    Route = "AirportToCity";

    selectedIndex = "";
    isLoadingRates = false;
    rateRequestId = 0;

    stateData.State1.pickup = "";
    stateData.State1.destination = "";
    stateData.State2.pickup = "";
    stateData.State2.destination = "";

    // Reset form inputs.
    $w("#pickupSearch").value = "";
    $w("#destinationSearch").value = "";
    $w("#pickupSearch2").value = "";
    $w("#destinationSearch2").value = "";

    $w("#datePicker1").value = null;
    $w("#passengers").value = "";

    clearError();

    clearRepeater("#pickupRepeater");
    clearRepeater("#destinationRepeater");
    clearRepeater("#pickupRepeater2");
    clearRepeater("#destinationRepeater2");

    setupLocationState("State1");
    setupLocationState("State2");

    // Populate vehicle cards so the repeater has items to render.
    // If your repeater is connected to a dataset containing the
    // vehicle names, remove this assignment and use that dataset.
    $w("#VEHICLES").data = VEHICLE_DATA;

    setupVehicleRepeater();

    // Default route direction.
    syncActiveRoute("State1");

    // Switch to Airport-to-City.
    $w("#state2change").onClick(async () => {
        await switchRouteState("State1");
    });

    // Switch to City-to-Airport.
    $w("#statechange1").onClick(async () => {
        await switchRouteState("State2");
    });

    // Date selection.
    $w("#datePicker1").onChange(() => {
        const value = $w("#datePicker1").value;

        DATE = value ? String(value) : "";

        if (DATE) {
            session.setItem("Date", DATE);
        } else {
            session.removeItem("Date");
        }

        updateRouteText();
    });

    // Passenger selection.
    $w("#passengers").onChange(() => {
        PASSENGERS = $w("#passengers").value;

        if (PASSENGERS) {
            session.setItem("Passengers", String(PASSENGERS));
        } else {
            session.removeItem("Passengers");
        }

        updateRouteText();
    });

    // Keep route direction synchronized when changing between
    // the two route states. Do not treat the Form state as State1.
    $w("#statebox8").onChange(() => {
        const stateId = $w("#statebox8").currentState.id;

        if (stateId === "State1" || stateId === "State2") {
            syncActiveRoute(stateId);
        }
    });

    // Book Now button scrolls to the vehicle selection area.
    $w("#bookNow").onClick(() => {
        syncActiveRoute();

        saveRouteSession();
        updateRouteText();

        $w("#VEHICLES").scrollTo();
    });

    // Existing state-change button opens the customer-details form.
    $w("#stateChange").onClick(async () => {
        await $w("#statebox8").changeState("Form");
    });

    updateVehiclePrices();
});
