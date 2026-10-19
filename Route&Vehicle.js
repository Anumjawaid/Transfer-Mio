
import { session } from "wix-storage-frontend";
import wixLocationFrontend from "wix-location-frontend";
import {convertUsdToEur} from 'backend/currencyconversion.web.js'

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

const mapforVehicle = {
    "Bus 13": "bus13Pax",
    "Comfort": "comfort4Pax",
    "Business": "business3Pax",
    "VIP Mini Bus 6": "vipMinibus6Pax",
    "Mini Bus 7": "minibus7Pax",
    "Mini Van 4": "minivan4Pax"
};

// Keep selections and search requests independent per state.
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
    const raw = Array.isArray(result)
        ? result
        : Array.isArray(result?.payload)
            ? result.payload
            : [];

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
    } else {
        data.destinationRequest++;
        clearTimeout(data.destinationTimer);
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

    Route = state === "State2"
        ? "CityToAirport"
        : "AirportToCity";

    updateRouteText();
}

function updateRouteText() {
    $w("#Pickuptxt").text = PICKUP || "";
    $w("#Destinationtxt").text = DESTINATION || "";
    $w("#datetxt").text = DATE ? formatDate(DATE) : "";
    $w("#passengertxt").text = String(PASSENGERS || "");

    $w("#maintxt").text = `Taxi & Transfer from ${PICKUP || "—"} To ${DESTINATION || "—"}`;
    $w('#statebox8').show()
}

// =====================================================
// PICKUP SEARCH
// State1: pickup searched first.
// State2: pickup searched after destination is selected.
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

    // State2 requires a destination before pickup search.
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
            (state === "State2" &&
                destinationAtRequest !== data.destination)
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

        showError("Unable to search pickup locations. Please try again.");
    }
}

// =====================================================
// DESTINATION SEARCH
// State1: destination searched after pickup is selected.
// State2: destination searched first.
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
            (state === "State1" &&
                pickupAtRequest !== data.pickup)
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

        showError("Unable to search destinations. Please try again.");
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

        // A changed pickup invalidates its destination in State1.
        if (state === "State1") {
            resetDestination(state);
        }
    } else {
        if (data.destination === location) return;

        data.destination = location;

        // A changed destination invalidates its pickup in State2.
        if (state === "State2") {
            resetPickup(state);
        }
    }

    cancelSearch(state, type);

    const inputId = type === "pickup"
        ? ids.pickupInput
        : ids.destinationInput;

    const repeaterId = type === "pickup"
        ? ids.pickupRepeater
        : ids.destinationRepeater;

    $w(inputId).value = location;
    clearRepeater(repeaterId);

    syncActiveRoute(state);

    if (PICKUP && DESTINATION) {
        await refreshRoutePrices();
    } else {
        rateRequestId++;
        RATES = {};

        session.setItem("RatesWindow", JSON.stringify(RATES));

        updateVehiclePrices();
    }
}

// =====================================================
// SETUP LOCATION REPEATERS AND INPUTS FOR BOTH STATES
// =====================================================

function setupLocationState(state) {
    const ids = getIds(state);
    const data = stateData[state];

    // -------------------------
    // Pickup results repeater
    // -------------------------

    $w(ids.pickupRepeater).onItemReady(($item, itemData) => {
        $item(ids.pickupText).text = itemData.name;

        $item(ids.pickupText).onClick(async () => {
            await selectLocation(state, "pickup", itemData.name);
        });
    });

    // -------------------------
    // Destination results repeater
    // -------------------------

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

    // -------------------------
    // Pickup input
    // -------------------------

    $w(ids.pickupInput).onInput(event => {
        const query = event.target.value;

        data.pickup = "";
        cancelSearch(state, "pickup");

        if (state === "State1") {
            resetDestination(state);
        }

        if (state === "State2") {
            syncActiveRoute(state);
            rateRequestId++;
            RATES = {};
            session.setItem("RatesWindow", JSON.stringify(RATES));
            updateVehiclePrices();
        }

        clearError();
        clearRepeater(ids.pickupRepeater);

        if (String(query || "").trim().length < 2) {
            syncActiveRoute(state);
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

    // -------------------------
    // Destination input
    // -------------------------

    $w(ids.destinationInput).onInput(event => {
        const query = event.target.value;

        data.destination = "";
        cancelSearch(state, "destination");

        if (state === "State2") {
            resetPickup(state);
        }

        clearError();
        clearRepeater(ids.destinationRepeater);

        if (state === "State1") {
            syncActiveRoute(state);
            rateRequestId++;
            RATES = {};
            session.setItem("RatesWindow", JSON.stringify(RATES));
            updateVehiclePrices();
        }

        if (String(query || "").trim().length < 2) {
            syncActiveRoute(state);
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
    return price !== undefined &&
        price !== null &&
        price !== "" &&
        Number.isFinite(Number(price)) &&
        Number(price) > 0;
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

    // Clear prices from the previous route while loading.
    updateVehiclePrices();

    try {
        console.log("Loading route prices:", {
            pickup: PICKUP,
            destination: DESTINATION,
            route: Route
        });

        // Always pass pickup first and destination second.
        const result = await LoadPrices(PICKUP, DESTINATION);

        if (requestId !== rateRequestId) {
            return;
        }

        const priceRecord = getPriceRecord(result);

        RATES = priceRecord || {};

        session.setItem("RatesWindow", JSON.stringify(RATES));

        console.log("Updated rates:", RATES);

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
        }
    }
}

// =====================================================
// VEHICLE REPEATER
// =====================================================

 function updateVehiclePrices() {
    $w("#VEHICLES").forEachItem(async($item, itemData) => {
        const vehicleName = itemData.vehicleName;
        const rateKey = mapforVehicle[vehicleName];
        const price = rateKey ? RATES[rateKey] : undefined;

        if (isValidPrice(price)) {
            $item("#price").text = `$ ${Number(price)} ≅ € ${await convertUsdToEur(Number(price))}`

            $item("#Continue").label = "Continue";
            $item("#Continue").enable();
        } else {
            $item("#price").text = "N/A";
            $item("#Continue").label = "Unavailable";
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

function setupVehicleRepeater() {
    $w("#VEHICLES").onItemReady(($item, itemData) => {
        $item("#box10").style.borderWidth = "0px";

        const vehicleName = itemData.vehicleName;

        $item("#Continue").onClick(async () => {
            if (isLoadingRates) {
                return;
            }

            if (!PICKUP || !DESTINATION) {
                showError("Please select both pickup and destination first.");
                return;
            }

            const rateKey = mapforVehicle[vehicleName];
            const price = rateKey ? RATES[rateKey] : undefined;

            if (!isValidPrice(price)) {
                $item("#price").text = "N/A";
                $item("#Continue").label = "Unavailable";
                $item("#Continue").disable();
                return;
            }

            selectedIndex = itemData._id;

            $w("#VEHICLES").forEachItem(
                ($vehicleItem, vehicleData) => {
                    const selected =
                        vehicleData._id === selectedIndex;

                    $vehicleItem("#box10").style.borderWidth =
                        selected ? "1px" : "0px";

                    if (selected) {
                        $vehicleItem("#box10").style.borderColor =
                            "#6E0404";
                    }
                }
            );

            session.setItem("Pickup", PICKUP);
            session.setItem("Destination", DESTINATION);
            session.setItem("Date", String(DATE));
            session.setItem("Passengers", String(PASSENGERS));
            session.setItem("RatesWindow", JSON.stringify(RATES));

            session.setItem("BASEPRICE", String(Number(price)));
            session.setItem("Vehicle", vehicleName);

            session.setItem(
                "Capacity",
                String($item("#vehiclecapacity").text)
            );

            session.setItem(
                "VehicleImage",
                String($item("#vehicleImage").src)
            );

            wixLocationFrontend.to("/book-now");
        });

        // Apply current prices whenever a vehicle item is created.
        const rateKey = mapforVehicle[vehicleName];
        const price = rateKey ? RATES[rateKey] : undefined;

        if (isValidPrice(price)) {
            $item("#price").text =
                "$ " + Number(price).toFixed(2);

            $item("#Continue").label = "Continue";
            $item("#Continue").enable();
        } else {
            $item("#price").text = "N/A";
            $item("#Continue").label = "Unavailable";
            $item("#Continue").disable();
        }
    });
}

// =====================================================
// PAGE READY
// =====================================================

$w.onReady(async function () {
    PICKUP = session.getItem("Pickup") || "";
    DESTINATION = session.getItem("Destination") || "";
    DATE = session.getItem("Date") || "";
    PASSENGERS = session.getItem("Passengers") || "";

    try {
        RATES = JSON.parse(
            session.getItem("RatesWindow") || "{}"
        );
    } catch (error) {
        RATES = {};
    }

    // Restore the existing route into State1 by default.
    stateData.State1.pickup = PICKUP;
    stateData.State1.destination = DESTINATION;
   

    $w("#pickupSearch").value = PICKUP;
    $w("#destinationSearch").value = DESTINATION;

    if (DATE) {
        $w("#datePicker1").value = new Date(DATE);
    }

    if (PASSENGERS) {
        $w("#passengers").value = PASSENGERS;
    }

    clearError();

    clearRepeater("#pickupRepeater");
    clearRepeater("#destinationRepeater");
    clearRepeater("#pickupRepeater2");
    clearRepeater("#destinationRepeater2");

    setupLocationState("State1");
    setupLocationState("State2");
    setupVehicleRepeater();

    // State1 = AirportToCity
    // State2 = CityToAirport
    $w("#state2change").onClick(async () => {
        await $w("#statebox8").changeState("State1");
        syncActiveRoute("State1");

        if (PICKUP && DESTINATION) {
            await refreshRoutePrices();
        }
    });

    $w("#statechange1").onClick(async () => {
        await $w("#statebox8").changeState("State2");
        syncActiveRoute("State2");

        const ids = getIds("State2");

        $w(ids.pickupInput).value =
            stateData.State2.pickup;

        $w(ids.destinationInput).value =
            stateData.State2.destination;

        if (PICKUP && DESTINATION) {
            await refreshRoutePrices();
        } else {
            RATES = {};
            session.setItem("RatesWindow", JSON.stringify(RATES));
            updateVehiclePrices();
        }
    });

    // Keep active state and route direction in sync.
    $w("#statebox8").onChange(() => {
        const stateId = $w("#statebox8").currentState.id;
        const state = stateId === "State2" ? "State2" : "State1";

        syncActiveRoute(state);
    });

  

    syncActiveRoute("State1");
    updateVehiclePrices();

    // Reload prices for the restored route.
    if (PICKUP && DESTINATION) {
        await refreshRoutePrices();
    }
});
 $w("#datePicker1").onChange(() => {
        DATE = String($w("#datePicker1").value);
        session.setItem("Date", String(DATE));
        updateRouteText();
    });

    $w("#passengers").onChange(() => {
        PASSENGERS = $w("#passengers").value;
        session.setItem("Passengers", String(PASSENGERS));
        updateRouteText();
    });

    $w("#bookNow").onClick(() => {
        syncActiveRoute();

        session.setItem("Pickup", PICKUP);
        session.setItem("Destination", DESTINATION);
        session.setItem("Date", String(DATE));
        session.setItem("Passengers", String(PASSENGERS));

        updateRouteText();
        $w("#VEHICLES").scrollTo();
    });

$w('#stateChange').onClick((event) => {
    $w('#statebox8').changeState("Form")
        
})
