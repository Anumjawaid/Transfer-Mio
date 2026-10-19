import { LoadPickupInstant, LoadDestinationInstant, LoadPrices } from 'backend/handler_drop.web.js';

import { session } from "wix-storage-frontend";
import wixLocationFrontend from 'wix-location-frontend';

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let Route = "AirportToCity";

let selectedPickup = "";
let selectedDestination = "";

let pickupSearchRequest = 0;
let destinationSearchRequest = 0;

let pickupSearchTimer;
let destinationSearchTimer;

let isSubmitting = false;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Converts backend results to string arrays
function normalizeLocations(result, key) {

    const data = Array.isArray(result) ?
        result :
        Array.isArray(result?.payload) ?
        result.payload : [];

    return [...new Set(
        data.map(item => {

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
    )];
}

// Generate a stable repeater ID for each location.
// This hash is deterministic for the same string.
function makeLocationId(name) {

    let hash = 2166136261;

    for (const char of String(name)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }

    return "loc" + (hash >>> 0).toString(36);
}

// Create repeater data with unique IDs
function createRepeaterData(locations) {

    return locations.map(name => ({
        _id: makeLocationId(name),
        name
    }));
}

// ==========================================
// ERROR MESSAGES
// ==========================================

function showBookingError(message) {

    $w("#exception").text = message;
    $w("#exception").show();
}

function clearBookingError() {

    $w("#exception").text = "";
    $w("#exception").hide();
}

// ==========================================
// RESET SEARCH RESULTS
// ==========================================

function clearPickupResults() {

    $w("#pickupRepeater").data = [];
    $w("#pickupRepeater").collapse();
}

function clearDestinationResults() {

    $w("#destinationRepeater").data = [];
    $w("#destinationRepeater").collapse();
}

// ==========================================
// RESET DESTINATION
// ==========================================

function resetDestination() {

    selectedDestination = "";

    destinationSearchRequest++;

    clearTimeout(destinationSearchTimer);

    $w("#destinationSearch").value = "";

    clearDestinationResults();
}

// ==========================================
// SEARCH PICKUPS FROM CMS
// ==========================================

async function searchPickups(searchText) {

    const requestId = ++pickupSearchRequest;

    const query = String(searchText || "").trim();

    if (query.length < 2) {

        clearPickupResults();
        return;
    }

    try {

        const response = await LoadPickupInstant(query);

        // Ignore responses from older searches
        if (requestId !== pickupSearchRequest) {
            return;
        }

        const locations = normalizeLocations(
            response,
            "pickUpLocation"
        );

        // Prioritize locations beginning with the query
        const sortedLocations = locations.sort((a, b) => {

            const search = query.toLowerCase();

            const aStarts = a.toLowerCase().startsWith(search);
            const bStarts = b.toLowerCase().startsWith(search);

            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.localeCompare(b);
        });

        const repeaterData = createRepeaterData(
            sortedLocations
        );

        $w("#pickupRepeater").data = repeaterData;

        // Update existing repeater items too
        $w("#pickupRepeater").forEachItem(
            ($item, itemData) => {

                $item("#pickupResultTxt").text =
                    itemData.name;
            }
        );

        if (repeaterData.length > 0) {

            $w("#pickupRepeater").expand();

        } else {

            clearPickupResults();
        }

    } catch (error) {

        if (requestId !== pickupSearchRequest) return;

        console.error("Pickup search error:", error);

        clearPickupResults();

        showBookingError(
            "Unable to search pickup locations. Please try again."
        );
    }
}

// ==========================================
// SEARCH DESTINATIONS FROM CMS
// ==========================================

async function searchDestinations(searchText) {

    const requestId = ++destinationSearchRequest;

    const query = String(searchText || "").trim();

    if (!selectedPickup || query.length < 2) {

        clearDestinationResults();
        return;
    }

    const pickupAtRequest = selectedPickup;

    try {

        const response = await LoadDestinationInstant(
            pickupAtRequest,
            query
        );

        // Prevent stale results
        if (
            requestId !== destinationSearchRequest ||
            pickupAtRequest !== selectedPickup
        ) {
            return;
        }

        const locations = normalizeLocations(
            response,
            "destination"
        );

        const sortedLocations = locations.sort((a, b) => {

            const search = query.toLowerCase();

            const aStarts = a.toLowerCase().startsWith(search);
            const bStarts = b.toLowerCase().startsWith(search);

            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.localeCompare(b);
        });

        const repeaterData = createRepeaterData(
            sortedLocations
        );

        $w("#destinationRepeater").data = repeaterData;

        $w("#destinationRepeater").forEachItem(
            ($item, itemData) => {

                $item("#destinationResultTxt").text =
                    itemData.name;
            }
        );

        if (repeaterData.length > 0) {

            $w("#destinationRepeater").expand();

        } else {

            clearDestinationResults();
        }

    } catch (error) {

        if (requestId !== destinationSearchRequest) return;

        console.error("Destination search error:", error);

        clearDestinationResults();

        showBookingError(
            "Unable to search destinations. Please try again."
        );
    }
}

// ==========================================
// VALIDATE SELECTED LOCATIONS
// ==========================================

function validateLocations() {

    const pickupInput = String(
        $w("#pickupSearch").value || ""
    ).trim();

    const destinationInput = String(
        $w("#destinationSearch").value || ""
    ).trim();

    if (
        !selectedPickup ||
        pickupInput !== selectedPickup
    ) {

        showBookingError(
            "Please select a valid pickup location from the suggestions."
        );

        return false;
    }

    if (
        !selectedDestination ||
        destinationInput !== selectedDestination
    ) {

        showBookingError(
            "Please select a valid destination from the suggestions."
        );

        return false;
    }

    return true;
}

// ==========================================
// PAGE READY
// ==========================================

$w.onReady(function () {

    // Hide errors and results initially
    clearBookingError();

    clearPickupResults();
    clearDestinationResults();

    // ======================================
    // PICKUP REPEATER
    // ======================================

    $w("#pickupRepeater").onItemReady(
        ($item, itemData) => {

            $item("#pickupResultTxt").text =
                itemData.name;

            $item("#pickupResultTxt").onClick(() => {

                // Cancel pending searches
                pickupSearchRequest++;
                clearTimeout(pickupSearchTimer);

                selectedPickup = itemData.name;

                $w("#pickupSearch").value =
                    itemData.name;

                clearPickupResults();

                // Changing pickup invalidates destination
                resetDestination();

                clearBookingError();

                console.log(
                    "Selected pickup:",
                    selectedPickup
                );
            });
        }
    );
     $w("#pickupRepeater2").onItemReady(
        ($item, itemData) => {

            $item("#pickupResultTxt2").text =
                itemData.name;

            $item("#pickupResultTxt2").onClick(() => {

                // Cancel pending searches
                pickupSearchRequest++;
                clearTimeout(pickupSearchTimer);

                selectedPickup = itemData.name;

                $w("#pickupSearch2").value =
                    itemData.name;

                clearPickupResults();

                // Changing pickup invalidates destination
                resetDestination();

                clearBookingError();

                console.log(
                    "Selected pickup:",
                    selectedPickup
                );
            });
        }
    );

    // ======================================
    // DESTINATION REPEATER
    // ======================================

    $w("#destinationRepeater").onItemReady(
        ($item, itemData) => {

            $item("#destinationResultTxt").text =
                itemData.name;

            $item("#destinationResultTxt").onClick(() => {

                destinationSearchRequest++;
                clearTimeout(destinationSearchTimer);

                selectedDestination = itemData.name;

                $w("#destinationSearch").value =
                    itemData.name;

                clearDestinationResults();

                clearBookingError();

                console.log(
                    "Selected destination:",
                    selectedDestination
                );
            });
        }
    );
      $w("#destinationRepeater2").onItemReady(
        ($item, itemData) => {

            $item("#destinationResultTxt2").text =
                itemData.name;

            $item("#destinationResultTxt2").onClick(() => {

                destinationSearchRequest++;
                clearTimeout(destinationSearchTimer);

                selectedDestination = itemData.name;

                $w("#destinationSearch2").value =
                    itemData.name;

                clearDestinationResults();

                clearBookingError();

                console.log(
                    "Selected destination:",
                    selectedDestination
                );
            });
        }
    );

    // ======================================
    // PICKUP INPUT
    // ======================================

    $w("#pickupSearch").onInput(event => {

        const query = event.target.value;

        // Invalidate previously selected pickup
        selectedPickup = "";

        // Clear destination when pickup changes
        resetDestination();

        clearBookingError();
        clearPickupResults();

        pickupSearchRequest++;

        clearTimeout(pickupSearchTimer);

        if (String(query).trim().length < 2) {
            return;
        }

        // Debounce backend search
        pickupSearchTimer = setTimeout(() => {

            searchPickups(query);

        }, 300);
    });
    $w("#pickupSearch2").onInput(event => {

        const query = event.target.value;

        // Invalidate previously selected pickup
        selectedPickup = "";

        // Clear destination when pickup changes
        resetDestination();

        clearBookingError();
        clearPickupResults();

        pickupSearchRequest++;

        clearTimeout(pickupSearchTimer);

        if (String(query).trim().length < 2) {
            return;
        }

        // Debounce backend search
        pickupSearchTimer = setTimeout(() => {

            searchPickups(query);

        }, 300);
    });

    // ======================================
    // DESTINATION INPUT
    // ======================================

    $w("#destinationSearch").onInput(event => {

        const query = event.target.value;

        selectedDestination = "";

        clearBookingError();
        clearDestinationResults();

        destinationSearchRequest++;

        clearTimeout(destinationSearchTimer);

        if (!selectedPickup) {

            showBookingError(
                "Please select a pickup location first."
            );

            return;
        }

        if (String(query).trim().length < 2) {
            return;
        }

        destinationSearchTimer = setTimeout(() => {

            searchDestinations(query);

        }, 300);
    });
    $w("#destinationSearch2").onInput(event => {

        const query = event.target.value;

        selectedDestination = "";

        clearBookingError();
        clearDestinationResults();

        destinationSearchRequest++;

        clearTimeout(destinationSearchTimer);

        if (!selectedPickup) {

            showBookingError(
                "Please select a pickup location first."
            );

            return;
        }

        if (String(query).trim().length < 2) {
            return;
        }

        destinationSearchTimer = setTimeout(() => {

            searchDestinations(query);

        }, 300);
    });

    // ======================================
    // CONTINUE BUTTON
    // ======================================

    $w('#bookNow').onClick(async (event) => {
        console.log(isSubmitting, "in onclick")
        if (isSubmitting) return;

        isSubmitting = true;
        console.log(isSubmitting, "in 2ndonclick")
        $w("#bookNow").disable();

        clearBookingError();

        try {

            // Validate pickup and destination
            if (!validateLocations()) {
                return;
            }

            // ==================================
            // LOAD ROUTE PRICES
            // ==================================

            const rates = await LoadPrices(
                selectedPickup,
                selectedDestination
            );

            console.log("Loaded rates:", rates);

            if (
                !rates ||
                (Array.isArray(rates) && rates.length === 0)
            ) {

                showBookingError(
                    "No available vehicles or rates found for this route."
                );

                return;
            }

            // ==================================
            // SAVE BOOKING SESSION
            // ==================================

            session.setItem(
                "Pickup",
                selectedPickup
            );

            session.setItem(
                "Destination",
                selectedDestination
            );

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

            console.log(
                "Booking session saved successfully."
            );

            // ==================================
            // NAVIGATE TO VEHICLE PAGE
            // ==================================

            wixLocationFrontend.to("/route-vehicle");

        } catch (error) {

            console.error(
                "Booking continuation error:",
                error
            );

            showBookingError(
                "Something went wrong. Please try again."
            );

        } finally {

            isSubmitting = false;

            $w("#bookNow").enable();
        }
    });
})

$w('#state2change').onClick((event) => {
    $w("#statebox8").changeState("State1");

    Route = "AirportToCity";

})

$w("#statechange1").onClick(() => {

    $w("#statebox8").changeState("State2");

    Route = "CityToAirport";
});
