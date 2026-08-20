import { LoadPickups, LoadCityPrice, LoadfromDestination, LoadDestinations } from 'backend/handler_drop.web.js'
import { session } from "wix-storage-frontend"
import wixLocationFrontend from 'wix-location-frontend';

let Route = "AirportToCity"

$w.onReady(async function () {

    let airports = await LoadPickups()
    if (airports.length != 0) {
        // 
        const airportsloc = airports.map((v) => { return { label: v, value: v } })
        $w('#pickup1').options = airportsloc
        const Cities = await LoadDestinations()
        if (Cities.length != []) {
            $w('#city2').options = Cities.map((v) => { return { label: v, value: v } })
        }
    }

});

$w('#state2change').onClick((event) => {
    $w('#statebox8').changeState("State1")
    Route = "AirportToCity"
   
})

$w('#statechange1').onClick((event) => {
    $w('#statebox8').changeState("State2")
    Route = "CityToAirport"
   
})

// $w('#airport1').onChange(async (event) => {
//     console.log($w('#airport1').value, "Airport")
//     let city_price = await LoadfromCity($w('#airport1').value)
//     console.log(city_price, "cityProce")
//     if (city_price.length != 0) {
//         // 
//         $w('#city1').options = city_price.map((v) => { return { label: v.city, value: v.city } })
//     }

// })

// $w('#book1').onClick((event) => {
//     if (Route == "AirportToCity") {
//         if ($w('#airport1').value == "" || $w('#city1').value == " ") {
//             $w('#exception1').show()
//             setTimeout(() => {
//                 $w('#exception1').hide()
//             }, 1000);
//         } else {
//             // 
//             sendTobookNow()

//         }
//     } else {
//         // 
//         if ($w('#airport2').value == "" || $w('#city2').value == " ") {
//             $w('#exception1').show()
//             setTimeout(() => {
//                 $w('#exception1').hide()
//             }, 1000);
//         } else {
//             // 
//             sendTobookNow()

//         }
//     }
// })

// function sendTobookNow() {
//     if (Route == "AirportToCity") {
//         session.setItem("Airport", $w('#airport1').value)
//         session.setItem("City", $w('#city1').value)
//         session.setItem("Price", $w('#price1').value)
//         session.setItem('People', $w('#people1').value)
//         session.setItem("Route", Route)
//     } else {
//         session.setItem("Airport", $w('#airport2').value)
//         session.setItem("City", $w('#city2').value)
//         session.setItem("Price", $w('#price1').value)
//         session.setItem('People', $w('#people1').value)
//         session.setItem("Route", Route)
//     }

//     wixLocationFrontend.to("/book-now1")

// }

// $w('#city1').onChange(async (event) => {
//     // from city get row and display result

// })

// $w('#people1').onChange(async (event) => {
//     console.log("In Route ", Route)
//     if (Route == "AirportToCity") {

//         let get_price = await LoadCityPrice($w('#airport1').value, $w('#city1').value, $w('#people1').value)
//         if (get_price != undefined) {
//             // 
//             $w('#price1').value = get_price + ""
//         }
//     } else {
//         let get_price = await LoadCityPrice($w('#airport2').value, $w('#city2').value, $w('#people1').value)
//         if (get_price != undefined) {
//             // 
//             $w('#price1').value = get_price + ""
//         }

//     }

// })

// $w('#city2').onChange(async (event) => {
//     let load = await LoadfromAirport($w('#city2').value)
//     $w('#airport2').options = []
//     if (load.length != 0) {
//         // 
//         $w('#airport2').options = load.map((v) => { return { label: v.airport, value: v.airport } })

//     }
// })

$w('#bookNow').onClick((event) => {
            // Disable button immediately to prevent multiple clicks
        $w('#bookNow').disable();

        // Get values
        const pickup = $w('#pickup1').value;
        const destination = $w('#destination1').value;

        // Clear previous exception
        $w('#exception').text = '';
        $w('#exception').hide();

        // Validate required fields
        if (!pickup || !destination) {
            $w('#exception').text = 'Please fill required fields to proceed.';
            $w('#exception').show();

            // Re-enable button because operation stopped
            $w('#bookNow').enable();
            return;
        }

        try {
            // Your operation/navigation
            session.setItem("Pickup",pickup)
            session.setItem("Destination",destination)
            session.setItem("Date",String($w('#datePicker1').value))
            session.setItem("Passengers",$w('#passengers').value)
             wixLocationFrontend.to('/route-vehicle');

        } catch (error) {
            console.error(error);

            $w('#exception').text = 'Something went wrong. Please try again.';
            $w('#exception').show();

            // Re-enable if operation fails
            $w('#bookNow').enable();
        }
        
})

$w('#pickup1').onChange(async (event) => {
      console.log($w('#pickup1').value, "Airport")
    let destinations = await LoadDestinations($w('#pickup1').value)
    console.log(destinations, "cityProce")
    if (destinations.length != 0) {
        // 
        $w('#destination1').options = destinations.map((v) => { return { label: v.destination, value: v.destination } })
    }
        
})

$w('#destination1').onChange((event) => {
        
})
